import { randomBytes, randomUUID } from "node:crypto";
import { FORM_SCHEMA, HONEYPOT_FIELD, MIN_FILL_MS, validateSubmission } from "@rbb/forms";
import { errors } from "../../errors.ts";
import type { Logger } from "../../logging/logger.ts";
import type { AuditService } from "../audit/audit.ts";
import type { ThrottleStore } from "../auth/repository.ts";
import { pseudonym } from "../auth/tokens.ts";
import { formEnabled, type FormId, type FormsConfig } from "./config.ts";
import { createDeliverer, type EmailTransport, type OutgoingEmail } from "./email.ts";
import { acknowledgement, notification, type SubmissionData } from "./templates.ts";

/* M18 — a public form submission, end to end (Document 21). Email only:
   NOTHING a visitor sends is stored, logged or audited — the log and the
   audit trail carry the form, the outcome and a reference, never a name,
   address, message or IP address.

     enabled form? ──▶ rate limit (shared, per client + form) ──▶ bot?
       ──▶ validate (@rbb/forms) ──▶ notify RBB ──▶ acknowledge (optional)

   Every attempt on an enabled form counts against the limit — bots
   included — so nothing can flood the inbox or the audit trail. A bot
   (honeypot filled, or filled impossibly fast) gets exactly the answer a
   person gets and nothing is sent. A submission is "sent" only once the
   mode's delivery has completed: test mode renders it, staging and live
   have the provider accept it — otherwise the visitor gets a 503. */

export interface SubmitFacts {
  requestId: string | null;
  clientIp: string | null;
  idempotencyKey: string | null;
}

type Outcome = "delivered" | "spam_discarded" | "invalid" | "rate_limited" | "provider_rejected" | "provider_unavailable";

/* Crockford-style alphabet: no 0/O or 1/I to misread over the phone. */
const B32 = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const newReference = () => "RBB-" + [...randomBytes(8)].map((b) => B32[b % B32.length]).join("");
const IDEMPOTENCY_KEY = /^[A-Za-z0-9-]{8,64}$/;

export interface FormServiceOptions {
  orgId: string;
  config: FormsConfig;
  secret: string;
  transport: EmailTransport;
  log: Logger;
  now?: () => Date;
  /* Test mode hands each rendered email here instead of sending it. */
  capture?: (email: OutgoingEmail) => void;
}

export class FormService {
  readonly #throttle: ThrottleStore;
  readonly #audit: AuditService;
  readonly #options: FormServiceOptions;
  readonly #now: () => Date;

  constructor(throttle: ThrottleStore, audit: AuditService, options: FormServiceOptions) {
    this.#throttle = throttle;
    this.#audit = audit;
    this.#options = options;
    this.#now = options.now ?? (() => new Date());
  }

  async submit(formId: string, body: unknown, facts: SubmitFacts): Promise<{ reference: string }> {
    const { config } = this.#options;
    if (!Object.hasOwn(FORM_SCHEMA, formId)) throw errors.notFound("form");
    if (!formEnabled(config, formId)) throw errors.unavailable("This form is not taking submissions at the moment.");
    if (body && typeof body === "object" && !Array.isArray(body) && (body as { formId?: unknown }).formId !== formId)
      throw errors.badRequest("The request does not match this form.");

    const reference = newReference();
    await this.#rateLimit(formId, facts, reference);

    const fields = body as Record<string, unknown>;
    const honeypot = fields?.[HONEYPOT_FIELD];
    const elapsed = Number(fields?.elapsedMs);
    if ((typeof honeypot === "string" && honeypot.trim()) || (Number.isFinite(elapsed) && elapsed < MIN_FILL_MS)) {
      await this.#record(formId, "spam_discarded", reference, facts);
      return { reference };
    }

    const result = validateSubmission(body);
    if (!result.ok) {
      await this.#record(formId, "invalid", reference, facts);
      if (result.status === 422 && result.fields)
        throw errors.unprocessable(Object.entries(result.fields).map(([name, code]) => ({ path: `fields.${name}`, message: code as string })));
      throw errors.badRequest("The request is malformed.");
    }

    const data = result.data as SubmissionData;
    const submittedAt = this.#now().toISOString().slice(0, 16).replace("T", " ");
    const meta = { reference, submittedAt };
    const idem = facts.idempotencyKey && IDEMPOTENCY_KEY.test(facts.idempotencyKey) ? facts.idempotencyKey : randomUUID();
    const deliver = createDeliverer(config, this.#options.transport, this.#options.capture);

    const sent = await deliver({ to: config.recipients[formId]!, replyTo: data.email, ...notification(formId, data, meta) }, `${formId}:${idem}:notify`);
    if (!sent.ok) {
      await this.#record(formId, `provider_${sent.category}`, reference, facts);
      throw errors.unavailable("Your message could not be sent. Please try again in a moment.");
    }
    await this.#record(formId, "delivered", reference, facts);

    /* The submitter's copy, only where enabled. Its failure does not undo
       the delivered notification; it is recorded. */
    if (config.acknowledge.includes(formId)) {
      const ack = await deliver({ to: data.email, ...acknowledgement(formId, meta) }, `${formId}:${idem}:ack`);
      if (!ack.ok) this.#options.log.warn("form acknowledgement failed", { form: formId, reference, category: ack.category });
    }
    return { reference };
  }

  /* Fixed windows in the shared throttle store (MongoDB: every API
     instance counts into the same document). The key is a keyed hash of
     the organization and client address plus the form: no IP is stored. */
  async #rateLimit(formId: FormId, facts: SubmitFacts, reference: string) {
    const { max, windowMs } = this.#options.config.rateLimit;
    const now = this.#now().getTime();
    const index = Math.floor(now / windowMs);
    const endsAt = (index + 1) * windowMs;
    const client = pseudonym(this.#options.secret, `form-client:${this.#options.orgId}:${facts.clientIp ?? "unknown"}`);
    const count = await this.#throttle.hit(`form:${client}:${formId}:${index}`, new Date(endsAt + windowMs));
    if (count <= max) return;
    // The first refusal of a window is recorded; the rest are not (no flooding).
    if (count === max + 1) await this.#record(formId, "rate_limited", reference, facts);
    throw errors.rateLimited(Math.max(1, Math.ceil((endsAt - now) / 1000)));
  }

  /* The log line and the audit entry: form, outcome, reference, request
     id. Deliberately WITHOUT the hashed IP and user agent the audit trail
     records elsewhere — a public visitor is not a member. */
  async #record(formId: FormId, outcome: Outcome, reference: string, facts: SubmitFacts) {
    this.#options.log.info("form submission", { form: formId, outcome, reference, mode: this.#options.config.mode });
    await this.#audit.recordSafely(
      { action: "forms.submission", resourceType: "form", resourceId: formId, metadata: { outcome, reference, mode: this.#options.config.mode } },
      { requestId: facts.requestId, clientIp: null, userAgent: null }
    );
  }
}
