/* Document 26 — the host-neutral server app every host adapter uses. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServerApp } from "../app.mjs";

const req = (path, init) => new Request(`https://site.invalid${path}`, init);

test("routes /api/forms and /api/donations/*, and nothing else", async () => {
  const app = createServerApp({ env: {}, log: () => {} });
  assert.equal(app.handle(req("/")), null);
  assert.equal(app.handle(req("/about")), null);
  assert.equal(app.handle(req("/api/other")), null);
  assert.equal((await app.handle(req("/api/forms"))).status, 405);
  const donation = await app.handle(req("/api/donations/config"));
  assert.deepEqual(await donation.json(), { ok: false, error: "unavailable" });
});

test("with no configuration everything is off, and says so without values", async () => {
  const app = createServerApp({ env: {}, log: () => {} });
  assert.equal(app.emailMode, "off");
  assert.equal(app.donationMode, "off");
  const res = await app.handle(
    req("/api/forms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ formId: "contact", fields: {} }) })
  );
  assert.equal(res.status, 503);
});

test("configuration problems are reported by name, never by value", () => {
  const app = createServerApp({
    env: { EMAIL_MODE: "live", EMAIL_API_KEY: "secret-value-not-real", DONATION_ENABLED: "true", RAZORPAY_MODE: "live", RAZORPAY_KEY_ID: "rzp_test_FAKEKEY000000" },
    log: () => {},
  });
  const text = JSON.stringify(app.problems);
  assert.ok(app.problems.email.length > 0 && app.problems.donations.length > 0);
  assert.ok(!text.includes("secret-value-not-real") && !text.includes("rzp_test_FAKEKEY000000"));
  assert.equal(app.emailMode, "off");
  assert.equal(app.donationMode, "off");
});

test("a shared limiter passed to the app reaches both endpoints", async () => {
  let hits = 0;
  const shared = { hit: async () => (hits++, { allowed: false }) };
  const app = createServerApp({
    env: {
      EMAIL_MODE: "test",
      EMAIL_TO_CONTACT: "inbox@rbb.invalid",
      RATE_LIMIT_STORE: "shared",
    },
    rateLimiter: shared,
    log: () => {},
  });
  const res = await app.handle(
    req("/api/forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formId: "contact", fields: { name: "A", email: "a@b.invalid", message: "Hi" }, elapsedMs: 5000 }),
    })
  );
  assert.equal(res.status, 429);
  assert.equal(hits, 1);
});
