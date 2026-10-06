/* The submission endpoint — Document 21. Platform-neutral: it takes a
   standard Fetch API `Request` and returns a `Response`, which is what the
   serverless runtimes of the common static hosts hand a function. The
   adapter for the chosen host is a few lines (docs/FORMS_AND_EMAIL.md); no
   host is assumed here.

     browser ──POST JSON──▶ this handler ──▶ validate ──▶ anti-spam
       ──▶ rate limit ──▶ Resend (server-to-server) ──▶ RBB inbox
                                       └──▶ acknowledgement (if enabled)

   Every response is generic JSON: { ok, reference } or { ok: false,
   error, fields? }. Nothing a visitor sent, nothing from Resend, no stack
   trace and no configuration ever appears in one. Logs carry only
   { at, reference, form, outcome, providerId } — never a name, address,
   message, IP address or key. */
import { randomUUID } from "node:crypto";
import {
  FORM_SCHEMA,
  HONEYPOT_FIELD,
  MAX_BODY_BYTES,
  MIN_FILL_MS,
} from "../src/lib/formSchema.js";
import { formAvailable } from "./config.mjs";
import { validateSubmission } from "./validate.mjs";
import { createMemoryRateLimiter, rateKey, rateLimitProblem } from "./rate-limit.mjs";
import { createDeliverer } from "./email/deliver.mjs";
import { isJson, json, newReference, readBody } from "./http.mjs";
import {
  acknowledgement,
  newsletterConfirmation,
  newsletterNotification,
  notification,
} from "./email/templates.mjs";

const IDEMPOTENCY_KEY = /^[A-Za-z0-9-]{8,64}$/;

/* `capture` receives every email in "test" mode instead of sending it. */
export function createSubmissionHandler({
  config,
  rateLimiter,
  fetchImpl = fetch,
  log = (entry) => console.log(JSON.stringify(entry)),
  now = () => new Date(),
  capture = () => {},
}) {
  /* Keys of submissions already sent, so a retry returns the original
     reference instead of sending again (Resend also de-duplicates by
     Idempotency-Key for 24 h). Bounded and in-memory: a best effort per
     instance, backed by Resend's own guarantee. */
  const completed = new Map();

  const record = (reference, form, outcome, providerId = null) =>
    log({
      at: now().toISOString(),
      reference,
      form,
      outcome,
      ...(providerId && { providerId }),
    });

  /* Rate limiting must suit the deployment before live mode may send
     (Document 25): otherwise the endpoint stays off. */
  const limitProblem = rateLimitProblem({
    live: config.mode === "live",
    store: config.rateLimit.store ?? "memory",
    singleInstance: config.rateLimit.singleInstance,
    provided: Boolean(rateLimiter),
  });
  const limiter = rateLimiter ?? createMemoryRateLimiter(config.rateLimit);
  if (limitProblem) log({ at: now().toISOString(), event: "config-problem", problem: limitProblem });

  const deliver = createDeliverer({ config, fetchImpl, capture });

  return async function handle(request, { clientIp = null } = {}) {
    if (request.method !== "POST")
      return json(405, { ok: false, error: "method-not-allowed" }, { Allow: "POST" });

    if (config.allowedOrigin && request.headers.get("origin") !== config.allowedOrigin)
      return json(403, { ok: false, error: "forbidden" });

    if (!isJson(request))
      return json(415, { ok: false, error: "unsupported-media-type" });

    const raw = await readBody(request, MAX_BODY_BYTES);
    if (raw === null) return json(413, { ok: false, error: "too-large" });

    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return json(400, { ok: false, error: "bad-request" });
    }

    const formId = body?.formId;
    if (!FORM_SCHEMA[formId]) return json(404, { ok: false, error: "unknown-form" });
    if (limitProblem || !formAvailable(config, formId))
      return json(503, { ok: false, error: "unavailable" });

    const reference = newReference();

    /* Anti-spam baseline: a filled honeypot or an impossibly fast fill.
       Answered exactly like a success — a bot learns nothing — and nothing
       is sent. Not a security boundary on its own: the rate limit below
       and any approved challenge provider are. */
    const honeypot = body[HONEYPOT_FIELD];
    const elapsed = Number(body.elapsedMs);
    if (
      (typeof honeypot === "string" && honeypot.trim()) ||
      (Number.isFinite(elapsed) && elapsed < MIN_FILL_MS)
    ) {
      record(reference, formId, "spam-discarded");
      return json(200, { ok: true, reference });
    }

    const result = validateSubmission(body);
    if (!result.ok) {
      record(reference, formId, result.error);
      return json(result.status, {
        ok: false,
        error: result.error,
        ...(result.fields && { fields: result.fields }),
      });
    }

    if (!(await limiter.hit(rateKey(clientIp, formId))).allowed) {
      record(reference, formId, "rate-limited");
      return json(429, { ok: false, error: "rate-limited" }, { "Retry-After": "600" });
    }

    const headerKey = request.headers.get("idempotency-key");
    const idem = headerKey && IDEMPOTENCY_KEY.test(headerKey) ? headerKey : randomUUID();
    const dedupeKey = `${formId}:${idem}`;
    if (completed.has(dedupeKey))
      return json(200, { ok: true, reference: completed.get(dedupeKey) });

    const { data } = result;
    const submittedAt = now().toISOString().slice(0, 16).replace("T", " ");
    const meta = { reference, submittedAt };

    const primary =
      formId === "newsletter"
        ? { to: config.recipients.newsletter, ...newsletterNotification(data, meta) }
        : {
            to: config.recipients[formId],
            replyTo: data.email,
            ...notification(formId, data, meta),
          };

    const sent = await deliver(primary, `${dedupeKey}:notify`);
    if (!sent.ok) {
      record(reference, formId, `provider-${sent.category}`);
      return json(502, { ok: false, error: "failed" });
    }
    record(reference, formId, "sent", sent.id);

    /* The submitter's copy — only where RBB has enabled it for this form
       (newsletter: the confirmation, always, once the flow is enabled). A
       failure here does not undo the received message; it is logged. */
    const secondary =
      formId === "newsletter"
        ? newsletterConfirmation(meta)
        : config.acknowledge(formId)
          ? acknowledgement(formId, meta)
          : null;
    if (secondary) {
      const ack = await deliver({ to: data.email, ...secondary }, `${dedupeKey}:ack`);
      record(
        reference,
        formId,
        ack.ok ? "acknowledged" : `ack-${ack.category}`,
        ack.ok ? ack.id : null
      );
    }

    completed.set(dedupeKey, reference);
    if (completed.size > 5000) completed.delete(completed.keys().next().value);
    return json(200, { ok: true, reference });
  };
}
