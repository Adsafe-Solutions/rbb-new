/* Document 25 — live endpoints must not rely on an in-memory rate limiter
   that multi-instance hosting would silently defeat. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { rateLimitProblem } from "../rate-limit.mjs";
import { loadConfig } from "../config.mjs";
import { createSubmissionHandler } from "../handler.mjs";
import { loadDonationConfig } from "../donations/config.mjs";
import { createDonationHandler } from "../donations/handler.mjs";

test("policy: live + memory needs the single-instance confirmation; shared needs a limiter", () => {
  assert.match(rateLimitProblem({ live: true, store: "memory", singleInstance: false, provided: false }), /in-memory/);
  assert.equal(rateLimitProblem({ live: true, store: "memory", singleInstance: true, provided: false }), null);
  assert.equal(rateLimitProblem({ live: false, store: "memory", singleInstance: false, provided: false }), null);
  assert.match(rateLimitProblem({ live: true, store: "shared", singleInstance: false, provided: false }), /no shared limiter/);
  assert.equal(rateLimitProblem({ live: true, store: "shared", singleInstance: false, provided: true }), null);
  assert.match(rateLimitProblem({ live: false, store: "redis", provided: false }), /memory or shared/);
});

const FORMS_LIVE = {
  EMAIL_MODE: "live",
  EMAIL_API_KEY: "test-key-not-real",
  EMAIL_FROM: "RBB <forms@rbb.invalid>",
  EMAIL_TO_CONTACT: "inbox@rbb.invalid",
};
const contact = () =>
  new Request("https://site.invalid/api/forms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ formId: "contact", fields: { name: "A", email: "a@b.invalid", message: "Hi" }, elapsedMs: 5000 }),
  });

test("forms: live with an unconfirmed in-memory limiter stays off (503), and says why in the log", async () => {
  const logs = [];
  const handle = createSubmissionHandler({ config: loadConfig(FORMS_LIVE), log: (l) => logs.push(l), fetchImpl: async () => new Response("{}") });
  assert.equal((await handle(contact())).status, 503);
  assert.ok(logs.some((l) => l.event === "config-problem"));
});

test("forms: a shared limiter from the host adapter is accepted", async () => {
  const shared = { hit: async () => ({ allowed: true }) };
  const handle = createSubmissionHandler({
    config: loadConfig({ ...FORMS_LIVE, RATE_LIMIT_STORE: "shared" }),
    rateLimiter: shared,
    log: () => {},
    fetchImpl: async () => new Response(JSON.stringify({ id: "x" }), { status: 200 }),
  });
  assert.equal((await handle(contact())).status, 200);
});

test("donations: live mode with an unconfirmed in-memory limiter answers unavailable", async () => {
  const config = loadDonationConfig({
    DONATION_ENABLED: "true",
    RAZORPAY_MODE: "live",
    RAZORPAY_KEY_ID: "rzp_live_FAKEKEY000000",
    RAZORPAY_KEY_SECRET: "x",
    RAZORPAY_WEBHOOK_SECRET: "y",
    DONATION_CURRENCY: "INR",
    DONATION_MIN_AMOUNT: "100",
    DONATION_MAX_AMOUNT: "1000",
    DONATION_CUSTOM_AMOUNT: "true",
  });
  assert.equal(config.mode, "live");
  const handle = createDonationHandler({ config, emailConfig: { mode: "off" }, razorpay: {}, log: () => {} });
  const res = await handle(new Request("https://site.invalid/api/donations/config"));
  assert.deepEqual(await res.json(), { ok: false, error: "unavailable" });
});
