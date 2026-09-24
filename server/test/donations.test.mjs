/* Document 22 — the donation path, end to end against a fake Razorpay.
   No network: the Razorpay client is replaced by an in-memory stand-in,
   and email runs in EMAIL_MODE=test (captured, never sent). The keys and
   secrets below are obviously fake strings made up for the tests. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { loadDonationConfig } from "../donations/config.mjs";
import { createDonationHandler } from "../donations/handler.mjs";
import { orderState, paymentState } from "../donations/state.mjs";
import { verifyPaymentSignature, verifyWebhookSignature } from "../donations/razorpay.mjs";
import { donationNotification, donationSuccess } from "../email/templates.mjs";
import { formatMoney, toDecimalString, toMinorUnits } from "../../src/lib/money.js";

const ORIGIN = "https://site.invalid";
const SECRET = "test-key-secret-not-real";
const WEBHOOK_SECRET = "test-webhook-secret-not-real";
const ENV = {
  DONATION_ENABLED: "true",
  RAZORPAY_MODE: "test",
  RAZORPAY_KEY_ID: "rzp_test_FAKEKEY000000",
  RAZORPAY_KEY_SECRET: SECRET,
  RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
  DONATION_CURRENCY: "INR",
  DONATION_MIN_AMOUNT: "100",
  DONATION_MAX_AMOUNT: "50000",
  DONATION_ALLOWED_AMOUNTS: "500,1000",
  DONATION_CUSTOM_AMOUNT: "true",
  DONATION_EMAIL_ENABLED: "true",
  EMAIL_TO_DONATIONS: "donations@rbb.invalid",
  DONATION_DONOR_EMAILS: "success,processing,failed,refunded",
  ALLOWED_ORIGIN: ORIGIN,
};
const EMAIL = { mode: "test", from: "RBB <x@rbb.invalid>", apiKey: null };

const hmac = (secret, text) => createHmac("sha256", secret).update(text).digest("hex");

/* ---------------- a fake Razorpay ---------------- */
function fakeRazorpay() {
  const orders = new Map();
  const payments = new Map();
  let n = 0;
  let down = false;
  const ok = (data) => Promise.resolve(down ? { ok: false, category: "unavailable" } : { ok: true, data });
  const calls = { createOrder: 0 };
  return {
    calls,
    orders,
    payments,
    setDown: (v) => (down = v),
    createOrder({ amount, currency, receipt, notes }) {
      calls.createOrder++;
      const id = `order_FAKE${String(++n).padStart(10, "0")}`;
      const order = { id, entity: "order", amount, currency, receipt, notes, status: "created" };
      orders.set(id, order);
      return ok(order);
    },
    fetchOrder: (id) =>
      orders.has(id) ? ok(orders.get(id)) : Promise.resolve({ ok: false, category: "rejected" }),
    fetchPayment: (id) =>
      payments.has(id) ? ok(payments.get(id)) : Promise.resolve({ ok: false, category: "rejected" }),
    fetchOrderPayments: (id) => ok({ items: [...payments.values()].filter((p) => p.order_id === id) }),
    findOrderByReceipt: (receipt) => ok({ items: [...orders.values()].filter((o) => o.receipt === receipt) }),
    /* Simulate the donor paying in Checkout. */
    pay(orderId, { status = "captured", amount, currency } = {}) {
      const order = orders.get(orderId);
      const id = `pay_FAKE${String(++n).padStart(10, "0")}`;
      const payment = {
        id,
        entity: "payment",
        order_id: orderId,
        amount: amount ?? order.amount,
        currency: currency ?? order.currency,
        status,
        amount_refunded: 0,
        email: "donor@example.invalid",
      };
      payments.set(id, payment);
      return payment;
    },
  };
}

function setup(envOverrides = {}, opts = {}) {
  const config = loadDonationConfig({ ...ENV, ...envOverrides });
  const razorpay = fakeRazorpay();
  const emails = [];
  const logs = [];
  const handle = createDonationHandler({
    config,
    emailConfig: EMAIL,
    razorpay,
    capture: (e) => emails.push(e),
    log: (l) => logs.push(l),
    ...opts,
  });
  return { config, razorpay, emails, logs, handle };
}

const post = (path, body, headers = {}) =>
  new Request(`https://site.invalid/api/donations${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const get = (path, headers = {}) =>
  new Request(`https://site.invalid/api/donations${path}`, { headers: { Origin: ORIGIN, ...headers } });

const DONOR = { name: "A Donor", email: "donor@example.invalid", elapsedMs: 5000 };

async function order(h, body = { ...DONOR, amount: "500" }, headers = {}) {
  const res = await h.handle(post("/order", body, headers));
  return { status: res.status, body: await res.json() };
}

function webhookRequest(event, payload, { secret = WEBHOOK_SECRET, eventId = `evt_${Math.random()}` } = {}) {
  const raw = JSON.stringify({ entity: "event", event, payload });
  return new Request("https://site.invalid/api/donations/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Razorpay-Signature": hmac(secret, raw),
      "X-Razorpay-Event-Id": eventId,
    },
    body: raw,
  });
}

/* ---------------- money ---------------- */
test("money: string arithmetic, integer minor units, no floats", () => {
  assert.equal(toMinorUnits("500", 2), 50000);
  assert.equal(toMinorUnits("0.1", 2), 10);
  assert.equal(toMinorUnits("1,500.50", 2), 150050);
  assert.equal(toMinorUnits("1.234", 2), null);
  assert.equal(toMinorUnits("-5", 2), null);
  assert.equal(toMinorUnits("1e3", 2), null);
  assert.equal(toMinorUnits("12.5", 0), null);
  assert.equal(toMinorUnits("NaN", 2), null);
  assert.equal(toDecimalString(5, 2), "0.05");
  assert.equal(formatMoney(150050, "INR", { display: "code" }).replace(/\s/g, " "), "INR 1,500.50");
});

/* ---------------- configuration: fails closed ---------------- */
test("config: off by default, and off on any problem", () => {
  assert.equal(loadDonationConfig({}).mode, "off");
  const cases = {
    "no secret": { RAZORPAY_KEY_SECRET: "" },
    "no webhook secret": { RAZORPAY_WEBHOOK_SECRET: "" },
    "bad mode": { RAZORPAY_MODE: "production" },
    "live mode with a test key": { RAZORPAY_MODE: "live" },
    "test mode with a live key": { RAZORPAY_KEY_ID: "rzp_live_FAKEKEY000000" },
    "no currency": { DONATION_CURRENCY: "" },
    "unknown currency": { DONATION_CURRENCY: "XXQ" },
    "no minimum": { DONATION_MIN_AMOUNT: "" },
    "max below min": { DONATION_MAX_AMOUNT: "50" },
    "preset out of range": { DONATION_ALLOWED_AMOUNTS: "50,500" },
    "invalid preset": { DONATION_ALLOWED_AMOUNTS: "5.5.5" },
    "no amounts at all": { DONATION_ALLOWED_AMOUNTS: "", DONATION_CUSTOM_AMOUNT: "false" },
    "not enabled": { DONATION_ENABLED: "" },
  };
  for (const [label, override] of Object.entries(cases)) {
    const c = loadDonationConfig({ ...ENV, ...override });
    assert.equal(c.mode, "off", label);
    assert.equal(c.keySecret, null, label);
  }
  const good = loadDonationConfig(ENV);
  assert.equal(good.mode, "test");
  assert.deepEqual(good.presets, [50000, 100000]);
  assert.equal(good.min, 10000);
  assert.equal(loadDonationConfig({ ...ENV, RAZORPAY_MODE: "live", RAZORPAY_KEY_ID: "rzp_live_FAKE0000000" }).mode, "live");
});

test("off: every route refuses, nothing reaches Razorpay", async () => {
  const h = setup({ DONATION_ENABLED: "false" });
  for (const req of [post("/order", { ...DONOR, amount: "500" }), webhookRequest("payment.captured", {})]) {
    assert.equal((await h.handle(req)).status, 503);
  }
  /* /config answers "not available" as a normal response. */
  const config = await h.handle(get("/config"));
  assert.equal(config.status, 200);
  assert.deepEqual(await config.json(), { ok: false, error: "unavailable" });
  assert.equal(h.razorpay.calls.createOrder, 0);
});

test("routing: wrong method 405, unknown path 404", async () => {
  const h = setup();
  assert.equal((await h.handle(get("/order"))).status, 405);
  assert.equal((await h.handle(post("/config", {}))).status, 405);
  assert.equal((await h.handle(get("/nope"))).status, 404);
});

test("config endpoint: public settings only, never a secret", async () => {
  const h = setup();
  const res = await h.handle(get("/config"));
  const text = await res.text();
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const body = JSON.parse(text);
  assert.deepEqual(Object.keys(body).sort(), ["currency", "custom", "exponent", "keyId", "max", "min", "mode", "ok", "presets"]);
  assert.ok(!text.includes(SECRET) && !text.includes(WEBHOOK_SECRET));
});

/* ---------------- order creation ---------------- */
test("order: origin, content type, unknown keys refused", async () => {
  const h = setup();
  assert.equal((await order(h, { ...DONOR, amount: "500" }, { Origin: "https://evil.invalid" })).status, 403);
  const res = await h.handle(
    new Request("https://site.invalid/api/donations/order", {
      method: "POST",
      headers: { "Content-Type": "text/plain", Origin: ORIGIN },
      body: "{}",
    })
  );
  assert.equal(res.status, 415);
  /* The browser may not send a currency, or anything else unexpected. */
  assert.equal((await order(h, { ...DONOR, amount: "500", currency: "USD" })).status, 400);
  assert.equal((await order(h, { ...DONOR, amount: "500", orderId: "order_x" })).status, 400);
  assert.equal(h.razorpay.calls.createOrder, 0);
});

test("order: the server decides amount and currency", async () => {
  const h = setup();
  const r = await order(h, { ...DONOR, amount: "500" });
  assert.equal(r.status, 200);
  assert.equal(r.body.amount, 50000);
  assert.equal(r.body.currency, "INR");
  assert.match(r.body.reference, /^RBBD-[A-Z2-9]{16}$/);
  assert.equal(r.body.keyId, "rzp_test_FAKEKEY000000");
  assert.deepEqual(Object.keys(r.body).sort(), ["amount", "currency", "keyId", "ok", "orderId", "reference"]);
  const created = h.razorpay.orders.get(r.body.orderId);
  assert.equal(created.receipt, r.body.reference);
  assert.equal(created.notes.rbb_reference, r.body.reference);
  assert.equal(created.amount, 50000);
});

test("order: amounts outside the approved rules are refused", async () => {
  const h = setup();
  const bad = async (amount, env) => {
    const hh = env ? setup(env) : h;
    const r = await order(hh, { ...DONOR, amount });
    assert.equal(r.status, 422, `amount ${amount}`);
    return r.body.fields.amount;
  };
  assert.equal(await bad("50"), "range");
  assert.equal(await bad("50001"), "range");
  assert.equal(await bad("10.555"), "format");
  assert.equal(await bad("abc"), "format");
  assert.equal(await bad("-500"), "format");
  assert.equal(await bad("750", { DONATION_CUSTOM_AMOUNT: "false" }), "not-allowed");
  /* A preset is fine even with custom amounts off. */
  assert.equal((await order(setup({ DONATION_CUSTOM_AMOUNT: "false" }), { ...DONOR, amount: "1000" })).status, 200);
  assert.equal(h.razorpay.calls.createOrder, 0);
});

test("order: donor fields validated; honeypot and too-fast refused", async () => {
  const h = setup();
  let r = await order(h, { amount: "500", name: "", email: "nope", elapsedMs: 5000 });
  assert.equal(r.status, 422);
  assert.deepEqual(r.body.fields, { name: "required", email: "format" });
  r = await order(h, { ...DONOR, amount: "500", name: "A\nBcc: x@y.z" });
  assert.equal(r.body.fields.name, "format");
  r = await order(h, { ...DONOR, amount: "500", phone: "call me" });
  assert.equal(r.body.fields.phone, "format");
  assert.equal((await order(h, { ...DONOR, amount: "500", website: "http://spam" })).status, 422);
  assert.equal((await order(h, { ...DONOR, amount: "500", elapsedMs: 200 })).status, 422);
  assert.equal(h.razorpay.calls.createOrder, 0);
});

test("order: a retried request with the same key gets the same order", async () => {
  const h = setup();
  const key = { "Idempotency-Key": "attempt-12345678" };
  const a = await order(h, { ...DONOR, amount: "500" }, key);
  const b = await order(h, { ...DONOR, amount: "500" }, key);
  assert.equal(a.body.orderId, b.body.orderId);
  assert.equal(a.body.reference, b.body.reference);
  assert.equal(h.razorpay.calls.createOrder, 1);
});

test("order: rate limited", async () => {
  const h = setup({ RATE_LIMIT_MAX: "2" });
  for (let i = 0; i < 2; i++) assert.equal((await order(h)).status, 200);
  assert.equal((await order(h)).status, 429);
});

test("order: provider unavailable → generic 502", async () => {
  const h = setup();
  h.razorpay.setDown(true);
  const r = await order(h);
  assert.equal(r.status, 502);
  assert.deepEqual(r.body, { ok: false, error: "failed" });
});

/* ---------------- verification ---------------- */
async function paidOrder(h, status = "captured", paymentOverrides = {}) {
  const o = await order(h);
  const payment = h.razorpay.pay(o.body.orderId, { status, ...paymentOverrides });
  return {
    o,
    payment,
    body: {
      reference: o.body.reference,
      orderId: o.body.orderId,
      paymentId: payment.id,
      signature: hmac(SECRET, `${o.body.orderId}|${payment.id}`),
    },
  };
}

test("signatures: payment and webhook checks", () => {
  const orderId = "order_ABCDEFGH12";
  const paymentId = "pay_ABCDEFGH12";
  const good = hmac(SECRET, `${orderId}|${paymentId}`);
  assert.ok(verifyPaymentSignature({ orderId, paymentId, signature: good, keySecret: SECRET }));
  assert.ok(!verifyPaymentSignature({ orderId, paymentId, signature: good, keySecret: "other" }));
  assert.ok(!verifyPaymentSignature({ orderId, paymentId: "pay_OTHER00000", signature: good, keySecret: SECRET }));
  assert.ok(!verifyPaymentSignature({ orderId, paymentId, signature: "zz", keySecret: SECRET }));
  const raw = '{"event":"payment.captured"}';
  assert.ok(verifyWebhookSignature({ rawBody: raw, signature: hmac(WEBHOOK_SECRET, raw), webhookSecret: WEBHOOK_SECRET }));
  assert.ok(!verifyWebhookSignature({ rawBody: raw + " ", signature: hmac(WEBHOOK_SECRET, raw), webhookSecret: WEBHOOK_SECRET }));
});

test("verify: a forged callback cannot mark a donation successful", async () => {
  const h = setup();
  const { body } = await paidOrder(h);
  const res = await h.handle(post("/verify", { ...body, signature: "0".repeat(64) }));
  assert.equal(res.status, 400);
  assert.equal((await res.json()).state, "unknown");
  assert.equal(h.emails.length, 0);
});

test("verify: captured → success, emails once however often it is called", async () => {
  const h = setup();
  const { body } = await paidOrder(h);
  for (let i = 0; i < 3; i++) {
    const res = await h.handle(post("/verify", body));
    assert.equal(res.status, 200);
    assert.equal((await res.json()).state, "captured");
  }
  assert.equal(h.emails.length, 2);
  const subjects = h.emails.map((e) => e.subject).join(" | ");
  assert.match(subjects, /Donation received/);
  assert.match(subjects, /Thank you for your donation/);
  assert.equal(h.emails.find((e) => /Thank you/.test(e.subject)).to, DONOR.email);
  assert.equal(h.emails.find((e) => /received/.test(e.subject)).to, "donations@rbb.invalid");
});

test("verify: a valid signature on an uncaptured payment is not success", async () => {
  const h = setup();
  const { body } = await paidOrder(h, "authorized");
  const res = await h.handle(post("/verify", body));
  assert.equal((await res.json()).state, "authorized");
  assert.equal(h.emails.length, 1);
  assert.match(h.emails[0].subject, /being confirmed/);
  assert.ok(!h.emails.some((e) => /Thank you|Donation received/.test(e.subject)));
});

test("verify: amount, currency or reference mismatches are refused", async () => {
  for (const override of [{ amount: 100 }, { currency: "USD" }]) {
    const h = setup();
    const { body } = await paidOrder(h, "captured", override);
    const res = await h.handle(post("/verify", body));
    assert.equal(res.status, 400, JSON.stringify(override));
    assert.equal(h.emails.length, 0);
  }
  const h = setup();
  const a = await paidOrder(h);
  const b = await order(h);
  /* A real payment, presented under another donation's reference. */
  const res = await h.handle(post("/verify", { ...a.body, reference: b.body.reference }));
  assert.equal(res.status, 400);
  assert.equal(h.emails.length, 0);
});

test("verify: provider unavailable → state unknown, no emails", async () => {
  const h = setup();
  const { body } = await paidOrder(h);
  h.razorpay.setDown(true);
  const res = await h.handle(post("/verify", body));
  assert.equal(res.status, 502);
  assert.equal((await res.json()).state, "unknown");
  assert.equal(h.emails.length, 0);
});

/* ---------------- webhook ---------------- */
test("webhook: unsigned or wrongly signed events are refused", async () => {
  const h = setup();
  const { payment } = await paidOrder(h);
  const res = await h.handle(webhookRequest("payment.captured", { payment: { entity: payment } }, { secret: "wrong" }));
  assert.equal(res.status, 400);
  assert.equal(h.emails.length, 0);
});

test("webhook: captured → emails once; redelivery and verify add none", async () => {
  const h = setup();
  const { payment, body } = await paidOrder(h);
  const req = () => webhookRequest("payment.captured", { payment: { entity: payment } }, { eventId: "evt_1" });
  assert.equal((await h.handle(req())).status, 200);
  assert.equal((await h.handle(req())).status, 200);
  /* order.paid for the same payment, a different event id. */
  await h.handle(webhookRequest("order.paid", { payment: { entity: payment } }, { eventId: "evt_2" }));
  await h.handle(post("/verify", body));
  assert.equal(h.emails.length, 2);
});

test("webhook: unknown events are acknowledged and ignored", async () => {
  const h = setup();
  const res = await h.handle(webhookRequest("subscription.charged", { anything: true }));
  assert.equal(res.status, 200);
  assert.equal(h.emails.length, 0);
  assert.ok(h.logs.some((l) => l.event === "webhook-ignored"));
});

test("webhook: an order that is not ours is ignored", async () => {
  const h = setup();
  const foreign = { id: "pay_FOREIGN000001", order_id: "order_FOREIGN00001", amount: 100, currency: "INR", status: "captured" };
  const res = await h.handle(webhookRequest("payment.captured", { payment: { entity: foreign } }));
  assert.equal(res.status, 200);
  assert.equal(h.emails.length, 0);
});

test("webhook: provider unavailable → 503 so Razorpay redelivers", async () => {
  const h = setup();
  const { payment } = await paidOrder(h);
  h.razorpay.setDown(true);
  assert.equal((await h.handle(webhookRequest("payment.captured", { payment: { entity: payment } }, { eventId: "evt_d" }))).status, 503);
  h.razorpay.setDown(false);
  /* The same event again is processed — it was never marked handled. */
  assert.equal((await h.handle(webhookRequest("payment.captured", { payment: { entity: payment } }, { eventId: "evt_d" }))).status, 200);
  assert.equal(h.emails.length, 2);
});

test("webhook: refund.processed → refund emails, linked to the reference, once", async () => {
  const h = setup();
  const { payment, o } = await paidOrder(h);
  const refund = { id: "rfnd_FAKE00000001", payment_id: payment.id, amount: 50000, status: "processed" };
  const refunded = { ...payment, status: "refunded", amount_refunded: 50000 };
  for (let i = 0; i < 2; i++)
    await h.handle(webhookRequest("refund.processed", { refund: { entity: refund }, payment: { entity: refunded } }));
  assert.equal(h.emails.length, 2);
  assert.ok(h.emails.every((e) => e.text.includes(o.body.reference)));
  assert.ok(h.emails.some((e) => e.text.includes("rfnd_FAKE00000001")));
  /* A refund Razorpay has not processed is not a refund. */
  const h2 = setup();
  const p2 = await paidOrder(h2);
  await h2.handle(
    webhookRequest("refund.processed", {
      refund: { entity: { ...refund, payment_id: p2.payment.id, status: "pending" } },
      payment: { entity: p2.payment },
    })
  );
  assert.equal(h2.emails.length, 0);
});

test("webhook: a failed attempt on an order since paid sends no failure email", async () => {
  const h = setup();
  const o = await order(h);
  const failed = h.razorpay.pay(o.body.orderId, { status: "failed" });
  h.razorpay.pay(o.body.orderId, { status: "captured" });
  await h.handle(webhookRequest("payment.failed", { payment: { entity: failed } }));
  assert.equal(h.emails.length, 0);
  /* On an unpaid order: once per order, however many attempts fail. */
  const o2 = await order(h);
  for (let i = 0; i < 2; i++) {
    const f = h.razorpay.pay(o2.body.orderId, { status: "failed" });
    await h.handle(webhookRequest("payment.failed", { payment: { entity: f } }));
  }
  assert.equal(h.emails.length, 1);
  assert.match(h.emails[0].subject, /not completed/);
});

test("emails: none at all unless donation email is enabled and approved", async () => {
  const h = setup({ DONATION_EMAIL_ENABLED: "false" });
  const { body } = await paidOrder(h);
  await h.handle(post("/verify", body));
  assert.equal(h.emails.length, 0);
  const h2 = setup({ DONATION_DONOR_EMAILS: "" });
  const p2 = await paidOrder(h2);
  await h2.handle(post("/verify", p2.body));
  assert.deepEqual(h2.emails.map((e) => e.to), ["donations@rbb.invalid"]);
});

/* ---------------- status ---------------- */
test("status: minimal state by unguessable reference only", async () => {
  const h = setup();
  const { o } = await paidOrder(h);
  const res = await h.handle(get(`/status/${o.body.reference}`));
  const body = await res.json();
  assert.deepEqual(body, { ok: true, reference: o.body.reference, state: "captured", amount: 50000, currency: "INR" });
  assert.equal((await h.handle(get("/status/RBBD-AAAAAAAAAAAAAAAA"))).status, 404);
  assert.equal((await h.handle(get(`/status/${o.body.orderId}`))).status, 404);
  assert.equal((await h.handle(get("/status/pay_FAKE0000000001"))).status, 404);
});

test("states: derived from Razorpay's own records", () => {
  assert.equal(paymentState({ status: "captured" }), "captured");
  assert.equal(paymentState({ status: "captured", amount_refunded: 100 }), "refunded");
  assert.equal(paymentState({ status: "weird" }), "unknown");
  assert.equal(paymentState(null), "unknown");
  const order = { status: "attempted" };
  assert.equal(orderState(order, [{ status: "failed" }, { status: "captured" }]), "captured");
  assert.equal(orderState(order, [{ status: "failed" }]), "failed");
  assert.equal(orderState({ status: "created" }, []), "created");
  assert.equal(orderState(null, []), "unknown");
});

/* ---------------- logs and templates ---------------- */
test("logs: never donor details, signatures or secrets", async () => {
  const h = setup();
  const { body, payment } = await paidOrder(h);
  await h.handle(post("/verify", body));
  await h.handle(webhookRequest("payment.captured", { payment: { entity: payment } }));
  await order(h, { ...DONOR, amount: "1" });
  const text = JSON.stringify(h.logs);
  for (const secret of [DONOR.name, DONOR.email, body.signature, SECRET, WEBHOOK_SECRET])
    assert.ok(!text.includes(secret), `log contains ${secret}`);
  assert.ok(h.logs.some((l) => l.event === "order-created" && l.orderId && l.amount === 50000));
});

test("templates: escaped, test-marked, no unapproved claims", () => {
  const n = donationNotification({
    mode: "test",
    event: "captured",
    reference: "RBBD-X",
    amount: "INR 500.00",
    donor: { name: '<script>alert(1)</script>', email: "a@b.invalid" },
    orderId: "order_1",
    paymentId: "pay_1",
    at: "2026-01-01 00:00",
  });
  assert.ok(!n.html.includes("<script>"));
  assert.match(n.subject, /^\[Razorpay test\]/);
  const s = donationSuccess({ mode: "live", reference: "RBBD-X", amount: "INR 500.00", at: "x" });
  assert.ok(!/tax|80G|deductib|receipt|refund/i.test(s.html + s.text));
  assert.ok(!/test/i.test(s.subject));
});

test("idempotency across instances: both paths hand Resend the same keys", async () => {
  /* Two serverless instances share nothing but Razorpay: one handles the
     browser's /verify, the other the webhook. Resend de-duplicates by
     key, so identical keys mean one email each. */
  const a = setup();
  const { body, payment } = await paidOrder(a);
  const emailsB = [];
  const b = createDonationHandler({
    config: a.config,
    emailConfig: EMAIL,
    razorpay: a.razorpay,
    capture: (e) => emailsB.push(e),
    log: () => {},
  });
  await a.handle(post("/verify", body));
  await b(webhookRequest("payment.captured", { payment: { entity: payment } }));
  const keys = (list) => list.map((e) => e.idempotencyKey).sort();
  assert.deepEqual(keys(a.emails), keys(emailsB));
  assert.deepEqual(keys(a.emails), [`donation:${payment.id}:notify`, `donation:${payment.id}:success`]);
});
