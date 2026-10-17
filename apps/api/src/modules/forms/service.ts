import { randomBytes, randomUUID } from "node:crypto";
import { FORM_SCHEMA, HONEYPOT_FIELD, MIN_FILL_MS, validateSubmission } from "@rbb/forms";
import { ApiError, errors } from "../../errors.ts";
import type { Logger } from "../../logging/logger.ts";
import type { AuditService } from "../audit/audit.ts";
import type { ThrottleStore } from "../auth/repository.ts";
import { pseudonym } from "../auth/tokens.ts";
import { FORM_IDS, formEnabled, type FormId, type FormsConfig } from "./config.ts";
import type { SubmissionStore } from "../submissions/repository.ts";
import { STORE_ONLY_FORM_IDS, STORED_FORM_IDS } from "../submissions/service.ts";
import { createDeliverer, type EmailTransport, type OutgoingEmail } from "./email.ts";
import { acknowledgement, definitionNotification, eventConfirmation, notification, type SubmissionData } from "./templates.ts";
import { validateAgainstDefinition } from "./definition.ts";
import type { FormUpload, FormUploadService } from "./uploads.ts";
import { minutesOf, zonedTimeToInstant, type Event, type FormDefinition } from "@rbb/content-schema";
import type { PlaceStore } from "./places.ts";

/* M18 — a public form submission, end to end (Document 21).

   STORED since 2026-10-13 (owner decision): a Contact, Volunteer or
   Partner submission is kept in `form_submissions` — its validated fields
   only, never the IP address or user agent — for owners to read in the
   admin, until an owner deletes it; and it is ALSO emailed when email is
   configured for that form. The log and the audit trail still carry only
   the form, the outcome and a reference — never a name, address, message
   or IP address.

     accepting? (stored, or email enabled) ──▶ rate limit (shared, per
       client + form) ──▶ bot? ──▶ validate (@rbb/forms) ──▶ store
       ──▶ notify RBB (if email is on) ──▶ acknowledge (optional)

   Every attempt on an enabled form counts against the limit — bots
   included — so nothing can flood the inbox or the audit trail. A bot
   (honeypot filled, or filled impossibly fast) gets exactly the answer a
   person gets and nothing is sent. A submission is "sent" only once the
   mode's delivery has completed: test mode renders it, staging and live
   have the provider accept it. A STORED submission is received even if
   the email then fails (that is logged); an email-only form still answers
   503 when its email fails, as before. */

export interface SubmitFacts {
  requestId: string | null;
  clientIp: string | null;
  idempotencyKey: string | null;
}

type Outcome = "registration_closed" | "registration_full" | "delivered" | "stored" | "stored_and_delivered" | "stored_email_failed" | "spam_discarded" | "invalid" | "rate_limited" | "provider_rejected" | "provider_unavailable";

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
  /* Where Contact, Volunteer and Partner submissions are kept. Without it
     (or for any other form) the form is email-only, as in M18. */
  submissions?: SubmissionStore;
  /* Forms saved in the admin (form-definitions): the one a submission is
     checked against. Without it every form keeps its built-in schema. */
  definitions?: { live(id: string): Promise<FormDefinition | null> };
  /* Career-form attachments (uploads.ts). */
  uploads?: FormUploadService;
  /* Event registrations (2026-10-17): the event AS PUBLISHED on the
     website — what the visitor's page shows — by record id, and the
     events' place counters. Without both, no event takes registrations. */
  events?: { live(id: string): Promise<Event | null> };
  places?: PlaceStore;
  /* The website's origin, for the event's link in the confirmation. */
  siteOrigin?: string | null;
}

/* An event registration form's id: "event-" and the event's record id. */
export const EVENT_FORM_PREFIX = "event-";
const registrationRefused = (reason: "closed" | "full") =>
  new ApiError("CONFLICT", reason === "full" ? "This event is full." : "Registration for this event has closed.", { details: [{ path: "registration", message: reason }] });

/* When an event's registration closes: at its end, in its own time zone
   (the end of its day when it has no end time). A record without a zone
   (never one the CMS saved) closes at the latest that day could end
   anywhere, UTC+14. */
export function registrationClosesAt(event: Pick<Event, "date" | "startTime" | "endTime" | "timezone">): number {
  const end = event.endTime ? minutesOf(event.endTime) : 24 * 60 - 1;
  const local = `${event.date}T${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
  if (event.timezone) {
    const converted = zonedTimeToInstant(local, event.timezone);
    if (converted.ok) return Date.parse(converted.instant) + 60_000;
  }
  return Date.parse(`${local}:00Z`) - 14 * 3_600_000 + 60_000;
}

const isFormId = (id: string): id is FormId => (FORM_IDS as readonly string[]).includes(id);
const STORED = new Set<string>(STORED_FORM_IDS);
const STORE_ONLY = new Set<string>(STORE_ONLY_FORM_IDS);

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
    if (formId.startsWith(EVENT_FORM_PREFIX)) return this.#register(formId, formId.slice(EVENT_FORM_PREFIX.length), body, facts);
    const { config } = this.#options;
    /* A form saved in the admin is checked against what was saved; one
       never saved keeps the built-in schema (2026-10-13). */
    const definition = (await this.#options.definitions?.live(formId)) ?? null;
    if (!definition && !Object.hasOwn(FORM_SCHEMA, formId)) throw errors.notFound("form");
    const career = definition?.kind === "career";
    const emailing = career ? config.mode !== "off" && Boolean(config.careersRecipient) : formEnabled(config, formId);
    const storing = Boolean(this.#options.submissions) && (career || STORED.has(formId));
    if ((!emailing && !storing) || (!career && !isFormId(formId) && !STORE_ONLY.has(formId))) throw errors.unavailable("This form is not taking submissions at the moment.");
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

    let data: Record<string, string>;
    let files: Record<string, string> = {};
    const refuse = async (status: number, problems?: Record<string, string>) => {
      await this.#record(formId, "invalid", reference, facts);
      if (status === 422 && problems) throw errors.unprocessable(Object.entries(problems).map(([name, code]) => ({ path: `fields.${name}`, message: code })));
      throw errors.badRequest("The request is malformed.");
    };
    if (definition) {
      const result = validateAgainstDefinition(definition, body);
      if (!result.ok) return refuse(result.status, result.fields);
      data = result.data;
      files = result.files;
    } else {
      const result = validateSubmission(body);
      if (!result.ok) return refuse(result.status, result.fields as Record<string, string> | undefined);
      /* Checkboxes (the marketing emails choice) are kept as Yes / No. */
      data = Object.fromEntries(Object.entries(result.data as Record<string, unknown>).map(([k, v]) => [k, typeof v === "boolean" ? (v ? "Yes" : "No") : (v as string)]));
      /* The newsletter's required consent IS the marketing opt-in. */
      if (formId === "newsletter") data.marketing = "Yes";
    }

    /* Attachments: uploads made for this form's file fields, unclaimed. */
    let uploads: FormUpload[] = [];
    if (Object.keys(files).length) {
      if (!this.#options.uploads) throw errors.unavailable("This form is not taking submissions at the moment.");
      const resolved = await this.#options.uploads.resolve(formId, files);
      if (Object.keys(resolved.problems).length) return refuse(422, resolved.problems);
      uploads = resolved.uploads;
    }

    const submittedAt = this.#now().toISOString().slice(0, 16).replace("T", " ");
    const meta = { reference, submittedAt };
    const idem = facts.idempotencyKey && IDEMPOTENCY_KEY.test(facts.idempotencyKey) ? facts.idempotencyKey : randomUUID();
    if (storing) {
      const at = this.#now().toISOString();
      const id = randomUUID();
      if (uploads.length && !(await this.#options.uploads!.claim(uploads.map((u) => u.id), id))) return refuse(422, Object.fromEntries(uploads.map((u) => [u.fieldId, "invalid"])));
      try {
        await this.#options.submissions!.insert({
          id,
          orgId: this.#options.orgId,
          formId,
          reference,
          fields: storedFields(data),
          ...(definition && { formTitle: definition.title, labels: Object.fromEntries(definition.fields.map((f) => [f.id, f.label])) }),
          ...(uploads.length && { attachments: uploads.map((u) => ({ id: u.id, fieldId: u.fieldId, name: u.name, size: u.size, contentType: u.contentType, key: u.key })) }),
          status: "new",
          createdAt: at,
          updatedAt: at,
        });
      } catch {
        this.#options.log.error("form submission could not be stored", { form: formId, reference });
        throw errors.unavailable("Your message could not be sent. Please try again in a moment.");
      }
      if (!emailing) {
        await this.#record(formId, "stored", reference, facts);
        return { reference };
      }
    }

    const to = career ? config.careersRecipient! : config.recipients[formId as FormId]!;
    const rendered = definition ? definitionNotification(definition, data, uploads.map((u) => ({ label: definition.fields.find((f) => f.id === u.fieldId)?.label ?? u.fieldId, name: u.name, size: u.size })), meta) : notification(formId as FormId, data as unknown as SubmissionData, meta);
    const deliver = createDeliverer(config, this.#options.transport, this.#options.capture);
    const sent = await deliver({ to, replyTo: data.email, ...rendered }, `${formId}:${idem}:notify`);
    if (!sent.ok) {
      if (storing) {
        /* Kept already: the visitor's message is received; RBB reads it in the admin. */
        await this.#record(formId, "stored_email_failed", reference, facts);
        return { reference };
      }
      await this.#record(formId, `provider_${sent.category}`, reference, facts);
      throw errors.unavailable("Your message could not be sent. Please try again in a moment.");
    }
    await this.#record(formId, storing ? "stored_and_delivered" : "delivered", reference, facts);

    /* The submitter's copy, only where enabled. Its failure does not undo
       the delivered notification; it is recorded. */
    if (!career && isFormId(formId) && config.acknowledge.includes(formId)) {
      const ack = await deliver({ to: data.email, ...acknowledgement(formId, meta) }, `${formId}:${idem}:ack`);
      if (!ack.ok) this.#options.log.warn("form acknowledgement failed", { form: formId, reference, category: ack.category });
    }
    return { reference };
  }

  /* An event registration (2026-10-17), against the event AS PUBLISHED:

       published, with an open registration form? ──▶ rate limit ──▶ bot?
       ──▶ before the event ends? ──▶ validate ──▶ a place (the limit,
       atomically) ──▶ store ──▶ tell RBB's events inbox (if set)
       ──▶ confirm to the registrant (whenever email is on)

     Always stored: a registration is received once it is kept, whatever
     the emails then do (a failure is logged, never shown as an error —
     the place is taken). A full or closed event answers 409 with the
     reason, which the page turns into its own words. */
  async #register(formId: string, eventId: string, body: unknown, facts: SubmitFacts): Promise<{ reference: string }> {
    const { config, submissions, places } = this.#options;
    const event = (await this.#options.events?.live(eventId)) ?? null;
    const registration = event?.registration;
    if (!event || !registration || !submissions || !places) throw errors.notFound("form");
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
    if (!registration.open || this.#now().getTime() >= registrationClosesAt(event)) {
      await this.#record(formId, "registration_closed", reference, facts);
      throw registrationRefused("closed");
    }
    const result = validateAgainstDefinition(registration, body);
    if (!result.ok) {
      await this.#record(formId, "invalid", reference, facts);
      if (result.status === 422 && result.fields) throw errors.unprocessable(Object.entries(result.fields).map(([name, code]) => ({ path: `fields.${name}`, message: code })));
      throw errors.badRequest("The request is malformed.");
    }
    const data = result.data;

    if (!(await places.take(formId, registration.capacity ?? null, async () => (await submissions.counts()).byForm[formId]?.total ?? 0))) {
      await this.#record(formId, "registration_full", reference, facts);
      throw registrationRefused("full");
    }
    const title = `Registration — ${event.title}`.slice(0, 200);
    const at = this.#now().toISOString();
    try {
      await submissions.insert({
        id: randomUUID(),
        orgId: this.#options.orgId,
        formId,
        reference,
        fields: storedFields(data),
        formTitle: title,
        labels: Object.fromEntries(registration.fields.map((f) => [f.id, f.label])),
        status: "new",
        createdAt: at,
        updatedAt: at,
      });
    } catch {
      await places.release(formId);
      this.#options.log.error("event registration could not be stored", { form: formId, reference });
      throw errors.unavailable("Your registration could not be sent. Please try again in a moment.");
    }

    if (config.mode === "off") {
      await this.#record(formId, "stored", reference, facts);
      return { reference };
    }
    const meta = { reference, submittedAt: at.slice(0, 16).replace("T", " ") };
    const idem = facts.idempotencyKey && IDEMPOTENCY_KEY.test(facts.idempotencyKey) ? facts.idempotencyKey : randomUUID();
    const deliver = createDeliverer(config, this.#options.transport, this.#options.capture);
    let delivered = true;
    if (config.eventsRecipient) {
      const sent = await deliver({ to: config.eventsRecipient, replyTo: data.email, ...definitionNotification({ title, fields: registration.fields }, data, [], meta) }, `${formId}:${idem}:notify`);
      if (!sent.ok) {
        delivered = false;
        this.#options.log.warn("event registration notification failed", { form: formId, reference, category: sent.category });
      }
    }
    const origin = this.#options.siteOrigin;
    const confirmation = eventConfirmation({ ...event, ...(origin && { pageUrl: `${origin}/media/events/${event.slug}` }) }, meta);
    const confirmed = await deliver({ to: data.email!, ...confirmation }, `${formId}:${idem}:confirm`);
    if (!confirmed.ok) {
      delivered = false;
      this.#options.log.warn("event registration confirmation failed", { form: formId, reference, category: confirmed.category });
    }
    await this.#record(formId, delivered ? "stored_and_delivered" : "stored_email_failed", reference, facts);
    return { reference };
  }

  /* Fixed windows in the shared throttle store (MongoDB: every API
     instance counts into the same document). The key is a keyed hash of
     the organization and client address plus the form: no IP is stored. */
  async #rateLimit(formId: string, facts: SubmitFacts, reference: string) {
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
  async #record(formId: string, outcome: Outcome, reference: string, facts: SubmitFacts) {
    this.#options.log.info("form submission", { form: formId, outcome, reference, mode: this.#options.config.mode });
    await this.#audit.recordSafely(
      { action: "forms.submission", resourceType: "form", resourceId: formId, metadata: { outcome, reference, mode: this.#options.config.mode } },
      { requestId: facts.requestId, clientIp: null, userAgent: null }
    );
  }
}

/* What is kept: the validated fields (checkboxes as Yes / No), trimmed,
   empty ones left out — never the honeypot or timing. */
function storedFields(data: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(data as unknown as Record<string, unknown>)
      .filter(([, v]) => typeof v === "string" && v.trim() !== "")
      .map(([k, v]) => [k, (v as string).trim()])
  );
}
