/* The submission endpoint's test matrix — Document 21 §16.
   Run: npm run test:server   (Node's built-in runner; no dependencies)

   Nothing here touches the network: Resend is replaced by a fake `fetch`
   that records what would have been sent. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../config.mjs";
import { createSubmissionHandler } from "../handler.mjs";
import { createMemoryRateLimiter } from "../rate-limit.mjs";

const ORIGIN = "https://rbb.test.invalid";
const ENV = {
  EMAIL_MODE: "live",
  /* The tests run one process, so the in-memory limiter is honest here. */
  RATE_LIMIT_SINGLE_INSTANCE: "true",
  EMAIL_API_KEY: "test-key-not-real",
  EMAIL_FROM: "Rising Beyond Borders <forms@rbb.test.invalid>",
  EMAIL_TO_CONTACT: "contact-inbox@rbb.test.invalid",
  EMAIL_TO_VOLUNTEER: "volunteer-inbox@rbb.test.invalid",
  EMAIL_TO_PARTNER: "partner-inbox@rbb.test.invalid",
  EMAIL_TO_FUNDRAISE: "fundraise-inbox@rbb.test.invalid",
  EMAIL_TO_NEWSLETTER: "newsletter-inbox@rbb.test.invalid",
  ALLOWED_ORIGIN: ORIGIN,
};

/* A fake Resend: records requests; `fail` makes it answer with an error. */
function fakeResend({ fail = null } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    if (fail === "network") throw new Error("network down");
    if (fail)
      return new Response(JSON.stringify({ message: "internal provider detail" }), {
        status: fail,
      });
    return new Response(JSON.stringify({ id: `msg_${calls.length}` }), { status: 200 });
  };
  return { calls, fetchImpl };
}

function setup({ env = {}, fail = null, max = 50 } = {}) {
  const resend = fakeResend({ fail });
  const logs = [];
  const config = loadConfig({ ...ENV, ...env });
  const handle = createSubmissionHandler({
    config,
    fetchImpl: resend.fetchImpl,
    rateLimiter: createMemoryRateLimiter({ max, windowMs: 60_000 }),
    log: (e) => logs.push(e),
  });
  return { handle, resend, logs, config };
}

const post = (body, { headers = {}, raw } = {}) =>
  new Request("https://rbb.test.invalid/api/forms", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN, ...headers },
    body: raw ?? JSON.stringify(body),
  });

const contact = (fields = {}, extra = {}) => ({
  formId: "contact",
  fields: {
    name: "Ada Lovelace",
    email: "ada@example.org",
    topic: "general",
    message: "Hello there.",
    ...fields,
  },
  elapsedMs: 8000,
  ...extra,
});

test("valid contact: sends the notification to the approved recipient, Reply-To the submitter", async () => {
  const { handle, resend, logs } = setup();
  const res = await handle(post(contact()), { clientIp: "203.0.113.1" });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.ok, true);
  assert.match(body.reference, /^RBB-[A-Z2-9]{8}$/);
  assert.equal(resend.calls.length, 1);
  const sent = resend.calls[0];
  assert.equal(sent.url, "https://api.resend.com/emails");
  assert.equal(sent.headers.Authorization, "Bearer test-key-not-real");
  assert.deepEqual(sent.body.to, ["contact-inbox@rbb.test.invalid"]);
  assert.equal(sent.body.reply_to, "ada@example.org");
  assert.equal(sent.body.from, ENV.EMAIL_FROM);
  assert.match(sent.body.subject, /^New contact inquiry · RBB-/);
  assert.ok(
    sent.body.html.includes("Hello there.") && sent.body.text.includes("Hello there.")
  );
  assert.ok(sent.headers["Idempotency-Key"].startsWith("contact:"));
  /* Logs: metadata only. */
  assert.deepEqual(Object.keys(logs.at(-1)).sort(), [
    "at",
    "form",
    "outcome",
    "providerId",
    "reference",
  ]);
  assert.ok(
    !JSON.stringify(logs).includes("ada@example.org") &&
      !JSON.stringify(logs).includes("Hello there")
  );
});

test("volunteer, partner, fundraise: each routed to its own recipient and template", async () => {
  const cases = [
    [
      "volunteer",
      { name: "V", email: "v@example.org", message: "Weekends" },
      "volunteer-inbox@",
      /volunteer interest/,
    ],
    [
      "partner",
      { name: "P", organization: "Org Ltd", email: "p@example.org", message: "Schools" },
      "partner-inbox@",
      /partnership inquiry/,
    ],
    [
      "fundraise",
      { name: "F", email: "f@example.org", message: "A run" },
      "fundraise-inbox@",
      /fundraising inquiry/,
    ],
  ];
  for (const [formId, fields, to, subject] of cases) {
    const { handle, resend } = setup();
    const res = await handle(post({ formId, fields, elapsedMs: 5000 }));
    assert.equal(res.status, 200, formId);
    assert.ok(resend.calls[0].body.to[0].startsWith(to), formId);
    assert.match(resend.calls[0].body.subject, subject);
    if (formId === "partner") assert.ok(resend.calls[0].body.html.includes("Org Ltd"));
  }
});

test("acknowledgement: only when enabled, never quotes the submission", async () => {
  const off = setup();
  await off.handle(post(contact()));
  assert.equal(off.resend.calls.length, 1, "no acknowledgement unless enabled");

  const on = setup({ env: { EMAIL_ACK_FORMS: "contact" } });
  await on.handle(post(contact({ message: "SECRET-SPAM-PAYLOAD http://spam.example" })));
  assert.equal(on.resend.calls.length, 2);
  const ack = on.resend.calls[1].body;
  assert.deepEqual(ack.to, ["ada@example.org"]);
  assert.ok(!ack.reply_to);
  assert.ok(
    !ack.html.includes("SECRET-SPAM-PAYLOAD") && !ack.text.includes("SECRET-SPAM-PAYLOAD")
  );
  assert.ok(on.resend.calls[1].headers["Idempotency-Key"].endsWith(":ack"));
});

test("newsletter: unavailable until enabled; then requires consent and sends confirmation", async () => {
  const disabled = setup();
  const r1 = await disabled.handle(
    post({
      formId: "newsletter",
      fields: { email: "n@example.org", consent: true },
      elapsedMs: 4000,
    })
  );
  assert.equal(r1.status, 503);
  assert.equal(disabled.resend.calls.length, 0);

  const enabled = setup({ env: { NEWSLETTER_ENABLED: "true" } });
  const noConsent = await enabled.handle(
    post({
      formId: "newsletter",
      fields: { email: "n@example.org", consent: false },
      elapsedMs: 4000,
    })
  );
  assert.equal(noConsent.status, 422);
  assert.deepEqual((await noConsent.json()).fields, { consent: "required" });

  const ok = await enabled.handle(
    post({
      formId: "newsletter",
      fields: { email: "n@example.org", consent: true },
      elapsedMs: 4000,
    })
  );
  assert.equal(ok.status, 200);
  assert.deepEqual(
    enabled.resend.calls.map((c) => c.body.to[0]),
    ["newsletter-inbox@rbb.test.invalid", "n@example.org"]
  );
});

test("invalid email, too long, missing required: 422 with codes only, nothing sent", async () => {
  const { handle, resend } = setup();
  const res = await handle(
    post(contact({ email: "not-an-email", message: "x".repeat(5001), name: "" }))
  );
  assert.equal(res.status, 422);
  const body = await res.json();
  assert.deepEqual(body.fields, {
    name: "required",
    email: "format",
    message: "too-long",
  });
  assert.ok(
    !JSON.stringify(body).includes("not-an-email"),
    "submitted text never echoed"
  );
  assert.equal(resend.calls.length, 0);
});

test("email address with smuggled recipients is rejected", async () => {
  const { handle, resend } = setup();
  for (const email of [
    "a@example.org, b@example.org",
    "a@example.org;b@example.org",
    "Ada <a@example.org>",
  ]) {
    const res = await handle(post(contact({ email })));
    assert.equal(res.status, 422, email);
  }
  assert.equal(resend.calls.length, 0);
});

test("header injection: a line break in a single-line field is rejected", async () => {
  const { handle, resend } = setup();
  const res1 = await handle(post(contact({ name: "Ada\r\nBcc: victim@example.org" })));
  const res2 = await handle(
    post(contact({ email: "ada@example.org\nBcc: victim@example.org" }))
  );
  assert.equal(res1.status, 422);
  assert.equal(res2.status, 422);
  assert.equal(resend.calls.length, 0);
});

test("HTML/script payload is escaped in the email and never in the subject", async () => {
  const { handle, resend } = setup();
  const payload = `<script>alert(1)</script><img src=x onerror=alert(2)>"'&`;
  const res = await handle(
    post(contact({ name: payload.slice(0, 60), message: payload }))
  );
  assert.equal(res.status, 200);
  const { html, subject } = resend.calls[0].body;
  assert.ok(!html.includes("<script>alert") && !html.includes("<img src=x"));
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(!subject.includes("<") && !subject.includes("alert"));
});

test("unknown field, unknown body key, non-string value: rejected 400", async () => {
  const { handle, resend } = setup();
  assert.equal((await handle(post(contact({ phone: "123" })))).status, 400);
  assert.equal(
    (await handle(post(contact({}, { recipient: "attacker@example.org" })))).status,
    400
  );
  assert.equal((await handle(post(contact({ message: { $gt: "" } })))).status, 400);
  assert.equal((await handle(post({ formId: "contact", fields: ["a"] }))).status, 400);
  assert.equal(resend.calls.length, 0);
});

test("method, content type, malformed JSON, oversized body, origin, unknown form", async () => {
  const { handle } = setup();
  const get = await handle(
    new Request("https://rbb.test.invalid/api/forms", { method: "GET" })
  );
  assert.equal(get.status, 405);
  assert.equal(get.headers.get("allow"), "POST");
  assert.equal(
    (
      await handle(
        post(null, {
          raw: "name=a",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        })
      )
    ).status,
    415
  );
  assert.equal((await handle(post(null, { raw: "{not json" }))).status, 400);
  assert.equal(
    (
      await handle(
        post(null, { raw: JSON.stringify(contact({ message: "x".repeat(20_000) })) })
      )
    ).status,
    413
  );
  assert.equal(
    (await handle(post(contact(), { headers: { Origin: "https://evil.example" } })))
      .status,
    403
  );
  assert.equal((await handle(post({ formId: "admin", fields: {} }))).status, 404);
});

test("honeypot and impossibly fast fill: answered as success, nothing sent", async () => {
  const { handle, resend, logs } = setup();
  const r1 = await handle(post(contact({}, { website: "http://spam.example" })));
  const r2 = await handle(post(contact({}, { elapsedMs: 200 })));
  assert.equal(r1.status, 200);
  assert.equal((await r1.json()).ok, true);
  assert.equal(r2.status, 200);
  assert.equal(resend.calls.length, 0);
  assert.deepEqual(
    logs.map((l) => l.outcome),
    ["spam-discarded", "spam-discarded"]
  );
});

test("rate limit: generic 429 once the window is exhausted, per client and form", async () => {
  const { handle, resend } = setup({ max: 2 });
  const ip = { clientIp: "198.51.100.7" };
  assert.equal((await handle(post(contact()), ip)).status, 200);
  assert.equal((await handle(post(contact()), ip)).status, 200);
  const limited = await handle(post(contact()), ip);
  assert.equal(limited.status, 429);
  assert.deepEqual(await limited.json(), { ok: false, error: "rate-limited" });
  assert.equal(
    (await handle(post(contact()), { clientIp: "198.51.100.8" })).status,
    200,
    "another client is unaffected"
  );
  assert.equal(resend.calls.length, 3);
});

test("Resend failure: generic 502, provider detail never exposed", async () => {
  for (const fail of [500, 422, "network"]) {
    const { handle, logs } = setup({ fail });
    const res = await handle(post(contact()));
    assert.equal(res.status, 502);
    const text = await res.text();
    assert.ok(
      !text.includes("internal provider detail") && !text.includes("network down")
    );
    assert.deepEqual(JSON.parse(text), { ok: false, error: "failed" });
    assert.match(logs.at(-1).outcome, /^provider-(rejected|unavailable)$/);
  }
});

test("duplicate retry with the same Idempotency-Key: one send, same reference", async () => {
  const { handle, resend } = setup();
  const key = "5b0e7f2a-1111-4c2e-9e8f-0123456789ab";
  const a = await (
    await handle(post(contact(), { headers: { "Idempotency-Key": key } }))
  ).json();
  const b = await (
    await handle(post(contact(), { headers: { "Idempotency-Key": key } }))
  ).json();
  assert.equal(a.reference, b.reference);
  assert.equal(resend.calls.length, 1);
  assert.equal(resend.calls[0].headers["Idempotency-Key"], `contact:${key}:notify`);
});

test("modes: off refuses; test captures without network; staging redirects to the test inbox", async () => {
  assert.equal(
    (await setup({ env: { EMAIL_MODE: "off" } }).handle(post(contact()))).status,
    503
  );
  assert.equal(
    (await setup({ env: { EMAIL_MODE: "" } }).handle(post(contact()))).status,
    503,
    "default is off"
  );

  const captured = [];
  const t = createSubmissionHandler({
    config: loadConfig({ ...ENV, EMAIL_MODE: "test", EMAIL_API_KEY: "" }),
    capture: (e) => captured.push(e),
    fetchImpl: () => assert.fail("network used in test mode"),
    log: () => {},
  });
  assert.equal((await t(post(contact()))).status, 200);
  assert.equal(captured.length, 1);

  const s = setup({
    env: {
      EMAIL_MODE: "staging",
      EMAIL_TEST_RECIPIENT: "qa@rbb.test.invalid",
      EMAIL_ACK_FORMS: "contact",
    },
  });
  await s.handle(post(contact()));
  assert.deepEqual(
    s.resend.calls.map((c) => c.body.to[0]),
    ["qa@rbb.test.invalid", "qa@rbb.test.invalid"]
  );
  assert.ok(s.resend.calls.every((c) => c.body.subject.startsWith("[TEST] ")));
});

test("misconfiguration fails closed: no key, temporary sender, bad recipient", async () => {
  assert.equal(loadConfig({ ...ENV, EMAIL_API_KEY: "" }).mode, "off");
  assert.equal(loadConfig({ ...ENV, EMAIL_FROM: "onboarding@resend.dev" }).mode, "off");
  const bad = loadConfig({ ...ENV, EMAIL_TO_CONTACT: "a@example.org, b@example.org" });
  assert.equal(bad.mode, "off");
  assert.ok(bad.problems.length > 0);
  assert.ok(
    !JSON.stringify(bad.problems).includes("test-key-not-real"),
    "problems never contain the key"
  );
  /* A form with no approved recipient is unavailable even when live. */
  const noRecipient = setup({ env: { EMAIL_TO_FUNDRAISE: "" } });
  const res = await noRecipient.handle(
    post({
      formId: "fundraise",
      fields: { name: "F", email: "f@example.org", message: "x" },
      elapsedMs: 5000,
    })
  );
  assert.equal(res.status, 503);
});

test("responses never cache and never carry configuration", async () => {
  const { handle } = setup();
  const res = await handle(post(contact()));
  assert.equal(res.headers.get("cache-control"), "no-store");
  const text = await res.text();
  for (const secret of ["test-key-not-real", "contact-inbox@", "forms@rbb"])
    assert.ok(!text.includes(secret));
});
