/* The donation endpoints — Document 22. Platform-neutral like the form
   endpoint (Document 21): a Fetch API Request in, a Response out, so the
   chosen host's serverless function mounts it with a few lines.

     GET  /api/donations/config             public Checkout settings
     POST /api/donations/order              validate → create Razorpay order
     POST /api/donations/verify             Checkout callback → verified state
     POST /api/donations/webhook            Razorpay → verified state
     GET  /api/donations/status/:reference  minimal state, by reference

   AUTHORITY. Nothing the browser says is believed:
     - the amount and currency are the SERVER's (config + validation); the
       browser only picks one of the approved amounts or types one within
       the approved bounds
     - the Checkout callback is a claim. /verify checks its signature with
       the key secret, then reads the order and the payment FROM RAZORPAY
       and checks they belong together, to this reference, in this
       currency, for this amount. Only Razorpay's own payment status
       decides the state — a valid signature on an uncaptured payment is
       "authorized", not success
     - a webhook is believed only after its signature checks out against
       the raw body, and only for an order that is ours
     - "captured" is the only success. Emails go out from here, never
       from the browser

   NO DATABASE (Document 22 says: not unless necessary — it is not).
   Razorpay is the record: our reference is the order's `receipt`, the
   donor's form details are in the order's notes, and every state is read
   back from Razorpay when needed. Reconciliation uses the log lines below
   (reference ↔ order ↔ payment ↔ refund, amount, currency — no personal
   data) against the Razorpay dashboard.

   IDEMPOTENCY
     - /order: one Idempotency-Key per donation attempt → the same order
       back on a retry (per instance; an unpaid duplicate order is harmless
       — it simply expires unpaid)
     - /verify and the webhook may both see one payment, and Razorpay
       redelivers webhooks: every email carries an idempotency key derived
       from the PAYMENT (or refund) id, so Resend sends it once, whichever
       path gets there first, on any instance; an in-memory set skips the
       call entirely when this instance has already sent it
     - webhook event ids (x-razorpay-event-id) already handled are
       acknowledged without being processed again

   Responses are generic JSON with codes only. Provider errors, payloads,
   signatures and secrets never reach a response or a log. */
import { randomUUID } from "node:crypto";
import { EMAIL_PATTERN, MIN_FILL_MS, HONEYPOT_FIELD } from "../../src/lib/formSchema.js";
import { formatMoney, toMinorUnits } from "../../src/lib/money.js";
import { createDeliverer } from "../email/deliver.mjs";
import {
  donationFailed,
  donationNotification,
  donationProcessing,
  donationRefunded,
  donationSuccess,
} from "../email/templates.mjs";
import { isJson, json, newReference, readBody } from "../http.mjs";
import { createMemoryRateLimiter, rateKey, rateLimitProblem } from "../rate-limit.mjs";
import { CONTROL } from "../validate.mjs";
import { publicDonationConfig } from "./config.mjs";
import {
  createRazorpayClient,
  ORDER_ID,
  PAYMENT_ID,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from "./razorpay.mjs";
import { consistent, orderState, paymentState } from "./state.mjs";
import { DONATION_WORDING } from "./wording.mjs";

export const BASE_PATH = "/api/donations";
export const REFERENCE = /^RBBD-[A-Z2-9]{16}$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9-]{8,64}$/;
const MAX_REQUEST_BYTES = 4 * 1024;
const MAX_WEBHOOK_BYTES = 256 * 1024;
const PHONE = /^\+?[0-9][0-9 ()-]{5,18}[0-9]$/;
const ORDER_KEYS = new Set(["amount", "name", "email", "phone", HONEYPOT_FIELD, "elapsedMs"]);
const VERIFY_KEYS = new Set(["reference", "orderId", "paymentId", "signature"]);

/* The webhook events acted on. Everything else is acknowledged and
   ignored (Razorpay stops redelivering), never processed. */
const EVENTS = {
  "payment.captured": "captured",
  "order.paid": "captured",
  "payment.authorized": "authorized",
  "payment.failed": "failed",
  "refund.processed": "refunded",
};

/* A single-line text field: control and bidi characters removed. */
function text(value, max) {
  if (typeof value !== "string") return { error: "required" };
  if (/[\r\n]/.test(value.trim())) return { error: "format" };
  const v = value.replace(CONTROL, "").trim();
  if (!v) return { error: "required" };
  if (v.length > max) return { error: "too-long" };
  return { value: v };
}

const stamp = (date) => date.toISOString().slice(0, 16).replace("T", " ");

/* A bounded Map: oldest entries fall out first. */
function bounded(limit) {
  const map = new Map();
  return {
    has: (k) => map.has(k),
    get: (k) => map.get(k),
    set(k, v) {
      map.set(k, v);
      if (map.size > limit) map.delete(map.keys().next().value);
    },
  };
}

export function createDonationHandler({
  config,
  emailConfig,
  razorpay = config.mode === "off"
    ? null
    : createRazorpayClient({ keyId: config.keyId, keySecret: config.keySecret }),
  fetchImpl = fetch,
  rateLimiter,
  /* Status polling is a few requests per donation, so its own, looser
     limit. A host passing a shared `rateLimiter` passes this too. */
  statusLimiter,
  log = (entry) => console.log(JSON.stringify(entry)),
  now = () => new Date(),
  capture = () => {},
  wording = DONATION_WORDING,
}) {
  const deliver = createDeliverer({ config: emailConfig, fetchImpl, capture });
  /* LIVE payments need rate limiting that suits the deployment
     (Document 25) — otherwise every route answers "unavailable". */
  const limitProblem = rateLimitProblem({
    live: config.mode === "live",
    store: config.rateLimit.store ?? "memory",
    singleInstance: config.rateLimit.singleInstance,
    provided: Boolean(rateLimiter),
  });
  if (limitProblem) log({ at: now().toISOString(), event: "config-problem", problem: limitProblem });
  const limiter = rateLimiter ?? createMemoryRateLimiter(config.rateLimit);
  const pollLimiter =
    statusLimiter ??
    createMemoryRateLimiter({ max: config.rateLimit.max * 12, windowMs: config.rateLimit.windowMs });
  const orders = bounded(5000); // idempotency key → order response
  const sentEmails = bounded(20000); // email idempotency keys sent here
  const events = bounded(20000); // webhook event ids handled here

  const record = (entry) => log({ at: now().toISOString(), mode: config.mode, ...entry });
  const emailOn = () => config.email.enabled && emailConfig.mode !== "off";
  const money = (minor) => formatMoney(minor, config.currency, { display: "code" });
  const retryUrl = /^https:\/\//.test(config.allowedOrigin ?? "")
    ? `${config.allowedOrigin}/get-involved/donate`
    : null;

  /* Send one email once. Returns "sent", "skipped" or the failure
     category. */
  async function sendOnce(key, to, message) {
    if (!to) return "skipped";
    if (sentEmails.has(key)) return "skipped";
    const result = await deliver({ to, ...message }, key);
    if (result.ok) sentEmails.set(key, true);
    return result.ok ? "sent" : result.category;
  }

  /* A verified state change → its emails. `order` is Razorpay's order
     (with our notes), `payment` its verified payment. Returns false if an
     email could not be sent for a reason worth retrying. */
  async function settle(state, { order, payment, refund = null }) {
    const reference = order.notes.rbb_reference;
    const donor = {
      name: order.notes.donor_name,
      email: order.notes.donor_email,
      phone: order.notes.donor_phone,
    };
    const at = stamp(now());
    const base = { reference, orderId: order.id, paymentId: payment.id, state };
    const outcomes = {};

    if (emailOn()) {
      if (state === "captured") {
        outcomes.notify = await sendOnce(
          `donation:${payment.id}:notify`,
          config.email.notifyTo,
          donationNotification({
            mode: config.mode,
            event: "captured",
            reference,
            amount: money(payment.amount),
            donor,
            orderId: order.id,
            paymentId: payment.id,
            at,
          })
        );
        if (config.email.donor("success"))
          outcomes.donor = await sendOnce(
            `donation:${payment.id}:success`,
            donor.email,
            donationSuccess({ mode: config.mode, reference, amount: money(payment.amount), at, wording })
          );
      } else if (state === "authorized" && config.email.donor("processing")) {
        outcomes.donor = await sendOnce(
          `donation:${payment.id}:processing`,
          donor.email,
          donationProcessing({ mode: config.mode, reference, amount: money(payment.amount), at, wording })
        );
      } else if (state === "failed" && config.email.donor("failed")) {
        /* Keyed on the ORDER: a donor can fail several attempts in one
           Checkout before succeeding — they hear about it once, at most. */
        outcomes.donor = await sendOnce(
          `donation:${order.id}:failed`,
          donor.email,
          donationFailed({ mode: config.mode, reference, at, retryUrl, wording })
        );
      } else if (state === "refunded" && refund) {
        outcomes.notify = await sendOnce(
          `donation:${refund.id}:refund-notify`,
          config.email.notifyTo,
          donationNotification({
            mode: config.mode,
            event: "refunded",
            reference,
            amount: money(refund.amount),
            donor,
            orderId: order.id,
            paymentId: payment.id,
            refundId: refund.id,
            at,
          })
        );
        if (config.email.donor("refunded"))
          outcomes.donor = await sendOnce(
            `donation:${refund.id}:refunded`,
            donor.email,
            donationRefunded({
              mode: config.mode,
              reference,
              amount: money(refund.amount),
              refundId: refund.id,
              at,
              wording,
            })
          );
      }
    }

    record({
      ...base,
      event: "state",
      amount: refund ? refund.amount : payment.amount,
      currency: payment.currency,
      ...(refund && { refundId: refund.id }),
      ...(Object.keys(outcomes).length && { emails: outcomes }),
    });
    return !Object.values(outcomes).includes("unavailable");
  }

  /* An order is ours if it carries one of our references both as its
     receipt and in its notes (the Razorpay account may hold others). */
  const ours = (order) =>
    Boolean(order) &&
    REFERENCE.test(order.receipt ?? "") &&
    order.notes?.rbb_reference === order.receipt;

  /* ---------------- routes ---------------- */

  async function createOrder(request, clientIp) {
    const raw = await readBody(request, MAX_REQUEST_BYTES);
    if (raw === null) return json(413, { ok: false, error: "too-large" });
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return json(400, { ok: false, error: "bad-request" });
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      return json(400, { ok: false, error: "bad-request" });
    for (const key of Object.keys(body))
      if (!ORDER_KEYS.has(key)) return json(400, { ok: false, error: "bad-request" });

    /* A filled honeypot or an impossibly fast fill: refused without
       detail. (Card-testing bots target donation forms; Razorpay's own
       risk checks and the rate limit below are the real defence.) */
    const elapsed = Number(body.elapsedMs);
    if (
      (typeof body[HONEYPOT_FIELD] === "string" && body[HONEYPOT_FIELD].trim()) ||
      (Number.isFinite(elapsed) && elapsed < MIN_FILL_MS)
    ) {
      record({ event: "order-refused-spam" });
      return json(422, { ok: false, error: "invalid", fields: {} });
    }

    const fields = {};
    const name = text(body.name, 200);
    if (name.error) fields.name = name.error;
    const email = text(body.email, 254);
    if (email.error) fields.email = email.error;
    else if (!EMAIL_PATTERN.test(email.value)) fields.email = "format";
    let phone = null;
    if (body.phone !== undefined && body.phone !== null && String(body.phone).trim()) {
      const t = text(body.phone, 24);
      if (t.error || !PHONE.test(t.value)) fields.phone = "format";
      else phone = t.value.replace(/[ ()-]/g, "");
    }
    const amount = toMinorUnits(typeof body.amount === "string" ? body.amount : "", config.exponent);
    if (amount === null) fields.amount = "format";
    else if (config.presets.includes(amount)) {
      /* an approved preset */
    } else if (!config.custom) fields.amount = "not-allowed";
    else if (amount < config.min || amount > config.max) fields.amount = "range";

    if (Object.keys(fields).length) {
      record({ event: "order-invalid", fields: Object.keys(fields) });
      return json(422, { ok: false, error: "invalid", fields });
    }

    if (!(await limiter.hit(rateKey(clientIp, "donation-order"))).allowed) {
      record({ event: "order-rate-limited" });
      return json(429, { ok: false, error: "rate-limited" }, { "Retry-After": "600" });
    }

    const headerKey = request.headers.get("idempotency-key");
    const idem = headerKey && IDEMPOTENCY_KEY.test(headerKey) ? headerKey : null;
    /* A retry of the same attempt, with the same details → the same order. */
    const fingerprint = idem && `${idem}|${amount}|${email.value}`;
    if (fingerprint && orders.has(fingerprint)) return json(200, orders.get(fingerprint));

    const reference = newReference("RBBD-", 16);
    const created = await razorpay.createOrder({
      amount,
      currency: config.currency,
      receipt: reference,
      notes: {
        rbb_reference: reference,
        donor_name: name.value,
        donor_email: email.value,
        ...(phone && { donor_phone: phone }),
      },
    });
    const order = created.ok ? created.data : null;
    if (
      !order ||
      !ORDER_ID.test(order.id ?? "") ||
      order.amount !== amount ||
      order.currency !== config.currency
    ) {
      record({ reference, event: "order-failed", provider: created.category ?? "mismatch" });
      return json(502, { ok: false, error: "failed" });
    }

    const response = {
      ok: true,
      reference,
      orderId: order.id,
      keyId: config.keyId,
      amount,
      currency: config.currency,
    };
    if (fingerprint) orders.set(fingerprint, response);
    record({ reference, event: "order-created", orderId: order.id, amount, currency: config.currency });
    return json(200, response);
  }

  async function verify(request, clientIp) {
    const raw = await readBody(request, MAX_REQUEST_BYTES);
    if (raw === null) return json(413, { ok: false, error: "too-large" });
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return json(400, { ok: false, error: "bad-request" });
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      return json(400, { ok: false, error: "bad-request" });
    for (const key of Object.keys(body))
      if (!VERIFY_KEYS.has(key)) return json(400, { ok: false, error: "bad-request" });
    const { reference, orderId, paymentId, signature } = body;
    if (
      !REFERENCE.test(reference ?? "") ||
      !ORDER_ID.test(orderId ?? "") ||
      !PAYMENT_ID.test(paymentId ?? "")
    )
      return json(400, { ok: false, error: "bad-request" });

    if (!(await limiter.hit(rateKey(clientIp, "donation-verify"))).allowed)
      return json(429, { ok: false, error: "rate-limited" }, { "Retry-After": "600" });

    if (!verifyPaymentSignature({ orderId, paymentId, signature, keySecret: config.keySecret })) {
      record({ reference, event: "verify-signature-invalid", orderId });
      return json(400, { ok: false, error: "verification-failed", state: "unknown" });
    }

    const [o, p] = await Promise.all([razorpay.fetchOrder(orderId), razorpay.fetchPayment(paymentId)]);
    if (!o.ok || !p.ok) {
      record({ reference, event: "verify-provider-unavailable", orderId, paymentId });
      return json(502, { ok: false, error: "unavailable", reference, state: "unknown" });
    }
    const order = o.data;
    const payment = p.data;
    if (!consistent({ order, payment, reference, config })) {
      record({ reference, event: "verify-mismatch", orderId, paymentId });
      return json(400, { ok: false, error: "verification-failed", state: "unknown" });
    }

    const state = paymentState(payment);
    if (["captured", "authorized", "refunded"].includes(state)) await settle(state, { order, payment });
    else record({ reference, event: "verify", orderId, paymentId, state });
    return json(200, {
      ok: true,
      reference,
      state,
      amount: payment.amount,
      currency: payment.currency,
    });
  }

  async function webhook(request) {
    const raw = await readBody(request, MAX_WEBHOOK_BYTES);
    if (raw === null) return json(413, { ok: false, error: "too-large" });
    if (
      !verifyWebhookSignature({
        rawBody: raw,
        signature: request.headers.get("x-razorpay-signature"),
        webhookSecret: config.webhookSecret,
      })
    ) {
      record({ event: "webhook-signature-invalid" });
      return json(400, { ok: false, error: "bad-signature" });
    }

    const eventId = request.headers.get("x-razorpay-event-id");
    if (eventId && events.has(eventId)) return json(200, { ok: true });

    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return json(400, { ok: false, error: "bad-request" });
    }
    const state = EVENTS[body?.event];
    const done = () => {
      if (eventId) events.set(eventId, true);
      return json(200, { ok: true });
    };
    if (!state) {
      record({ event: "webhook-ignored", type: String(body?.event ?? "").slice(0, 60) });
      return done();
    }

    const payment = body.payload?.payment?.entity;
    const refund = state === "refunded" ? body.payload?.refund?.entity : null;
    if (!payment || !PAYMENT_ID.test(payment.id ?? "") || !ORDER_ID.test(payment.order_id ?? "")) {
      record({ event: "webhook-unusable", type: body.event });
      return done();
    }
    if (state === "refunded" && (refund?.status !== "processed" || refund.payment_id !== payment.id)) {
      record({ event: "webhook-unusable", type: body.event, paymentId: payment.id });
      return done();
    }

    /* Our order, read from Razorpay with OUR key: an order from another
       integration, or from the other mode, cannot be read or is not ours. */
    const o = await razorpay.fetchOrder(payment.order_id);
    if (!o.ok) {
      if (o.category === "unavailable") return json(503, { ok: false, error: "unavailable" });
      record({ event: "webhook-not-ours", type: body.event, paymentId: payment.id });
      return done();
    }
    const order = o.data;
    if (!ours(order)) {
      record({ event: "webhook-not-ours", type: body.event, paymentId: payment.id });
      return done();
    }
    if (!consistent({ order, payment, reference: order.receipt, config })) {
      record({ reference: order.receipt, event: "webhook-mismatch", orderId: order.id, paymentId: payment.id });
      return done();
    }

    /* A failure on an order that has since been paid is history, not news. */
    if (state === "failed") {
      const list = await razorpay.fetchOrderPayments(order.id);
      if (list.ok && ["captured", "authorized", "refunded"].includes(orderState(order, list.data?.items ?? []))) {
        record({ reference: order.receipt, event: "webhook-superseded-failure", orderId: order.id, paymentId: payment.id });
        return done();
      }
    }

    const emailsOk = await settle(state, { order, payment, refund });
    /* An email that could not be sent for a transient reason: answer 503
       so Razorpay redelivers. The emails that did go out carry
       idempotency keys, so the redelivery sends only what is missing. */
    if (!emailsOk) return json(503, { ok: false, error: "unavailable" });
    return done();
  }

  async function status(reference, clientIp) {
    if (!REFERENCE.test(reference)) return json(404, { ok: false, error: "not-found" });
    if (!(await pollLimiter.hit(rateKey(clientIp, "donation-status"))).allowed)
      return json(429, { ok: false, error: "rate-limited" }, { "Retry-After": "60" });
    const found = await razorpay.findOrderByReceipt(reference);
    if (!found.ok) return json(502, { ok: false, error: "unavailable", state: "unknown" });
    const order = found.data?.items?.[0];
    if (!ours(order) || order.receipt !== reference) return json(404, { ok: false, error: "not-found" });
    const list = await razorpay.fetchOrderPayments(order.id);
    if (!list.ok) return json(502, { ok: false, error: "unavailable", state: "unknown" });
    /* Only payments that match the order count. */
    const payments = (list.data?.items ?? []).filter((payment) =>
      consistent({ order, payment, reference, config })
    );
    return json(200, {
      ok: true,
      reference,
      state: orderState(order, payments),
      amount: order.amount,
      currency: order.currency,
    });
  }

  return async function handle(request, { clientIp = null } = {}) {
    const url = new URL(request.url, "http://localhost");
    const path = url.pathname.startsWith(BASE_PATH) ? url.pathname.slice(BASE_PATH.length) : null;
    if (path === null) return json(404, { ok: false, error: "not-found" });

    const route =
      path === "/config" ? "config"
      : path === "/order" ? "order"
      : path === "/verify" ? "verify"
      : path === "/webhook" ? "webhook"
      : path.startsWith("/status/") ? "status"
      : null;
    if (!route) return json(404, { ok: false, error: "not-found" });

    const method = route === "config" || route === "status" ? "GET" : "POST";
    if (request.method !== method)
      return json(405, { ok: false, error: "method-not-allowed" }, { Allow: method });

    /* Off: every route refuses. /config says so as an ordinary answer
       (200, ok:false) — "donations are not available" is a normal state
       the donation page asks about on every visit, not a server failure,
       so it must not surface as a failed request in the browser. */
    if (config.mode === "off" || limitProblem)
      return route === "config"
        ? json(200, { ok: false, error: "unavailable" })
        : json(503, { ok: false, error: "unavailable" });

    /* The webhook comes from Razorpay's servers — no browser Origin; its
       signature is its authentication. Every other route is the site's
       own page calling. */
    if (route !== "webhook" && config.allowedOrigin) {
      const origin = request.headers.get("origin");
      /* A same-origin GET may omit Origin; a cross-origin one never does. */
      if (origin ? origin !== config.allowedOrigin : method === "POST")
        return json(403, { ok: false, error: "forbidden" });
    }
    if (method === "POST" && !isJson(request))
      return json(415, { ok: false, error: "unsupported-media-type" });

    try {
      if (route === "config") return json(200, { ok: true, ...publicDonationConfig(config) });
      if (route === "order") return await createOrder(request, clientIp);
      if (route === "verify") return await verify(request, clientIp);
      if (route === "webhook") return await webhook(request);
      return await status(decodeURIComponent(path.slice("/status/".length)), clientIp);
    } catch {
      /* Never a stack trace or provider detail — one line, one id. */
      const incident = randomUUID();
      record({ event: "error", route, incident });
      return json(500, { ok: false, error: "failed" });
    }
  };
}
