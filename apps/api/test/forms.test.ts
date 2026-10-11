import { test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { MIN_FILL_MS } from "@rbb/forms";
import type { ApiError } from "../src/errors.ts";
import { AuditService } from "../src/modules/audit/audit.ts";
import { FORMS_OFF, formEnabled, loadFormsConfig, type FormsConfig } from "../src/modules/forms/config.ts";
import { createDeliverer, refusingTransport, resendTransport, type EmailTransport, type OutgoingEmail } from "../src/modules/forms/email.ts";
import { FormService } from "../src/modules/forms/service.ts";
import { acknowledgement, notification } from "../src/modules/forms/templates.ts";
import { clock, memoryAuditStore, memoryAuthStores, memoryData, silentLog } from "./auth/memory.ts";
import { captureLogs } from "./helpers.ts";
import { createLogger } from "../src/logging/logger.ts";

/* M18 — the public forms at the service level: configuration (fail
   closed), the email modes, bot suppression, validation codes, the rate
   limit, delivery failures and privacy. NO real email is ever sent: every
   transport here is a fake that records, and the default transport under
   NODE_ENV=test refuses. HTTP, CORS, origins and the SHARED (MongoDB)
   limit across two app instances: test/integration/forms.mongo.test.ts. */

const VISITOR = { name: "Asha Visitor", email: "asha.visitor@example.org", message: "I would like to <b>help</b> & learn more.\nThanks" };
const SECRETS = [VISITOR.name, VISITOR.email, "help", "learn more"];
const facts = (clientIp = "198.51.100.7") => ({ requestId: "req-form-0001", clientIp, idempotencyKey: "abcdef12-3456" });
const body = (formId: string, fields: Record<string, unknown> = VISITOR, extra: Record<string, unknown> = {}) => ({ formId, fields, website: "", elapsedMs: 5000, antiSpamToken: null, ...extra });
const failure = async (p: Promise<unknown>) => (await p.then(() => assert.fail("expected a refusal"), (e) => e)) as ApiError;

const env = (over: Record<string, string> = {}) => ({
  EMAIL_MODE: "test",
  EMAIL_TO_CONTACT: "contact-inbox@rbb.example",
  EMAIL_TO_VOLUNTEER: "volunteer-inbox@rbb.example",
  EMAIL_TO_PARTNER: "partner-inbox@rbb.example",
  EMAIL_TO_FUNDRAISE: "fundraise-inbox@rbb.example",
  ...over,
});

/* A transport that records what WOULD have been sent — never the network. */
function fakeTransport(result: Awaited<ReturnType<EmailTransport>> = { ok: true, id: "fake-1" }) {
  const sent: OutgoingEmail[] = [];
  const transport: EmailTransport = async (email) => {
    sent.push(email);
    return result;
  };
  return { sent, transport };
}

function world(config: FormsConfig, transport: EmailTransport = fakeTransport().transport) {
  const data = memoryData();
  const time = clock();
  const logs = captureLogs();
  const log = createLogger({ level: "debug", write: logs.write });
  const audit = new AuditService(memoryAuditStore(data, "org-a"), { orgId: "org-a", secret: "test-only-auth-secret-0123456789abcdef", log: silentLog, now: time.now });
  const captured: OutgoingEmail[] = [];
  const service = new FormService(memoryAuthStores(data, "org-a").throttle, audit, {
    orgId: "org-a",
    config,
    secret: "test-only-auth-secret-0123456789abcdef",
    transport,
    log,
    now: time.now,
    capture: (email) => captured.push(email),
  });
  const outcomes = () => data.audit.filter((e) => e.action === "forms.submission").map((e) => e.metadata.outcome);
  return { data, time, logs, service, captured, outcomes };
}

/* ---------------- Configuration ---------------- */

test("config: off by default; test mode with recipients enables exactly the four approved forms", () => {
  assert.equal(loadFormsConfig({}).mode, "off");
  for (const id of ["contact", "volunteer", "partner", "fundraise", "travel", "newsletter"]) assert.equal(formEnabled(loadFormsConfig({}), id), false);
  const config = loadFormsConfig(env());
  assert.deepEqual(config.problems, []);
  assert.deepEqual(["contact", "volunteer", "partner", "fundraise", "travel", "newsletter", "unknown"].map((id) => formEnabled(config, id)), [true, true, true, true, false, false, false]);
  const noRecipient = loadFormsConfig(env({ EMAIL_TO_PARTNER: "" }));
  assert.equal(formEnabled(noRecipient, "partner"), false, "no recipient: that form is off");
  assert.equal(formEnabled(noRecipient, "contact"), true);
});

test("config: Newsletter and Travel stay off whatever the environment says", () => {
  const config = loadFormsConfig(env({ EMAIL_TO_NEWSLETTER: "news@rbb.example", EMAIL_TO_TRAVEL: "travel@rbb.example", NEWSLETTER_ENABLED: "true", EMAIL_ACK_FORMS: "contact,newsletter" }));
  assert.equal(formEnabled(config, "newsletter"), false);
  assert.equal(formEnabled(config, "travel"), false);
  assert.deepEqual(config.acknowledge, ["contact"]);
  assert.ok(config.problems.some((p) => p.startsWith("EMAIL_TO_NEWSLETTER is ignored")));
  assert.ok(config.problems.some((p) => p.startsWith("NEWSLETTER_ENABLED is ignored")));
});

test("config fails closed: global problems turn every form off; a bad recipient turns only its form off", () => {
  const cases: [Record<string, string>, RegExp][] = [
    [{ EMAIL_MODE: "loud" }, /EMAIL_MODE/],
    [{ EMAIL_MODE: "staging", EMAIL_FROM: "RBB <forms@rbb.example>", EMAIL_TEST_RECIPIENT: "qa@rbb.example" }, /EMAIL_API_KEY/],
    [{ EMAIL_MODE: "live", EMAIL_API_KEY: "re_x", EMAIL_FROM: "not an address" }, /EMAIL_FROM is missing or not a valid From/],
    [{ EMAIL_MODE: "live", EMAIL_API_KEY: "re_x", EMAIL_FROM: "RBB <onboarding@resend.dev>" }, /temporary resend\.dev sender/],
    [{ EMAIL_MODE: "staging", EMAIL_API_KEY: "re_x", EMAIL_FROM: "RBB <forms@rbb.example>" }, /EMAIL_TEST_RECIPIENT is required/],
  ];
  for (const [over, problem] of cases) {
    const config = loadFormsConfig(env(over));
    assert.equal(config.mode, "off", JSON.stringify(over));
    assert.ok(config.problems.some((p) => problem.test(p)), `${JSON.stringify(over)} → ${config.problems}`);
    assert.equal(formEnabled(config, "contact"), false);
  }
  const bad = loadFormsConfig(env({ EMAIL_TO_VOLUNTEER: "a@rbb.example,b@rbb.example" }));
  assert.equal(bad.mode, "test");
  assert.equal(formEnabled(bad, "volunteer"), false);
  assert.equal(formEnabled(bad, "contact"), true);
  const live = loadFormsConfig(env({ EMAIL_MODE: "live", EMAIL_API_KEY: "re_x", EMAIL_FROM: "Rising Beyond Borders <forms@rbb.example>" }));
  assert.deepEqual([live.mode, live.problems], ["live", []]);
  for (const config of [bad, live, loadFormsConfig(env({ EMAIL_MODE: "live", EMAIL_API_KEY: "re_secret_value", EMAIL_FROM: "bad" }))])
    assert.ok(!JSON.stringify(config.problems).includes("re_"), "problems never carry a value");
  assert.deepEqual(loadFormsConfig(env({ FORMS_RATE_LIMIT_MAX: "0", FORMS_RATE_LIMIT_WINDOW_S: "abc" })).rateLimit, { max: 5, windowMs: 600_000 });
});

/* ---------------- Email modes ---------------- */

test("test mode renders and captures — the transport is never called", async () => {
  const fake = fakeTransport();
  const w = world(loadFormsConfig(env({ EMAIL_ACK_FORMS: "contact" })), fake.transport);
  const { reference } = await w.service.submit("contact", body("contact", { ...VISITOR, topic: "volunteer" }), facts());
  assert.match(reference, /^RBB-[A-HJ-NP-Z2-9]{8}$/);
  assert.equal(fake.sent.length, 0, "nothing reached a transport");
  assert.deepEqual(w.captured.map((e) => [e.to, e.replyTo ?? null]), [["contact-inbox@rbb.example", VISITOR.email], [VISITOR.email, null]]);
  assert.ok(w.captured[0]!.html.includes("I would like to &lt;b&gt;help&lt;/b&gt; &amp; learn more.<br>Thanks"), "visitor text escaped in HTML");
  assert.ok(!w.captured[0]!.subject.includes(VISITOR.name) && !w.captured[0]!.subject.includes(VISITOR.email), "no visitor input in a subject");
  assert.ok(!w.captured[1]!.html.includes("help") && !w.captured[1]!.text.includes("help"), "the acknowledgement never quotes the submission");
  assert.deepEqual(w.outcomes(), ["delivered"]);
});

test("staging sends ONLY to the test inbox, every subject marked [TEST]", async () => {
  const fake = fakeTransport();
  const w = world(loadFormsConfig(env({ EMAIL_MODE: "staging", EMAIL_API_KEY: "re_fake", EMAIL_FROM: "RBB <forms@rbb.example>", EMAIL_TEST_RECIPIENT: "qa@rbb.example", EMAIL_ACK_FORMS: "volunteer" })), fake.transport);
  await w.service.submit("volunteer", body("volunteer"), facts());
  assert.deepEqual(fake.sent.map((e) => e.to), ["qa@rbb.example", "qa@rbb.example"], "neither RBB's inbox nor the visitor");
  assert.ok(fake.sent.every((e) => e.subject.startsWith("[TEST] ")));
  assert.equal(fake.sent[0]!.replyTo, VISITOR.email);
  assert.deepEqual(fake.sent.map((e) => e.idempotencyKey), ["volunteer:abcdef12-3456:notify", "volunteer:abcdef12-3456:ack"]);
});

test("live delivers as addressed; a provider failure is a 503, never a success", async () => {
  const live = loadFormsConfig(env({ EMAIL_MODE: "live", EMAIL_API_KEY: "re_fake", EMAIL_FROM: "Rising Beyond Borders <forms@rbb.example>" }));
  const ok = fakeTransport();
  const w = world(live, ok.transport);
  await w.service.submit("partner", body("partner", { ...VISITOR, organization: "Example Trust" }), facts());
  assert.deepEqual(ok.sent.map((e) => [e.to, e.from]), [["partner-inbox@rbb.example", "Rising Beyond Borders <forms@rbb.example>"]]);
  for (const category of ["rejected", "unavailable"] as const) {
    const down = world(live, fakeTransport({ ok: false, category }).transport);
    const refused = await failure(down.service.submit("fundraise", body("fundraise"), facts()));
    assert.equal(refused.code, "SERVICE_UNAVAILABLE");
    assert.deepEqual(down.outcomes(), [`provider_${category}`]);
  }
  // A failed acknowledgement does not undo the delivered notification.
  let calls = 0;
  const ackFails: EmailTransport = async () => (++calls === 1 ? { ok: true, id: "n" } : { ok: false, category: "unavailable" });
  const a = world(loadFormsConfig(env({ EMAIL_MODE: "live", EMAIL_API_KEY: "re_fake", EMAIL_FROM: "RBB <forms@rbb.example>", EMAIL_ACK_FORMS: "contact" })), ackFails);
  assert.ok((await a.service.submit("contact", body("contact"), facts())).reference);
  assert.deepEqual(a.outcomes(), ["delivered"]);
});

test("the default transport under NODE_ENV=test can never reach a provider; Resend's is fetch-based and keeps the key in one header", async () => {
  assert.deepEqual(await refusingTransport({ from: "a@b.example", to: "c@d.example", subject: "s", html: "h", text: "t", idempotencyKey: "k" }, "re_x"), { ok: false, category: "unavailable" });
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ id: "msg_1" }), { status: 200 });
  }) as unknown as typeof fetch;
  const result = await resendTransport(fetchImpl)({ from: "RBB <forms@rbb.example>", to: "inbox@rbb.example", replyTo: "v@example.org", subject: "S", html: "<p>h</p>", text: "t", idempotencyKey: "contact:k:notify" }, "re_fake_key");
  assert.deepEqual(result, { ok: true, id: "msg_1" });
  assert.equal(calls[0]!.url, "https://api.resend.com/emails");
  const headers = calls[0]!.init.headers as Record<string, string>;
  assert.equal(headers.Authorization, "Bearer re_fake_key");
  assert.equal(headers["Idempotency-Key"], "contact:k:notify");
  assert.ok(!String(calls[0]!.init.body).includes("re_fake_key"));
  const status = async (code: number) => (await resendTransport((async () => new Response("{}", { status: code })) as unknown as typeof fetch)({ from: "a@b.example", to: "c@d.example", subject: "s", html: "h", text: "t", idempotencyKey: "k" }, "k")).ok === false;
  assert.ok((await status(422)) && (await status(500)));
  const thrown = await resendTransport((async () => { throw new Error("network down"); }) as unknown as typeof fetch)({ from: "a@b.example", to: "c@d.example", subject: "s", html: "h", text: "t", idempotencyKey: "k" }, "k");
  assert.deepEqual(thrown, { ok: false, category: "unavailable" });
  // "off" (or a deliverer without a From outside test mode) never sends.
  const off = createDeliverer(FORMS_OFF, async () => assert.fail("must not be called"));
  assert.deepEqual(await off({ to: "x@y.example", subject: "s", html: "h", text: "t" }, "k"), { ok: false, category: "unavailable" });
});

/* ---------------- Submissions ---------------- */

test("unknown, unsupported and unconfigured forms are refused before anything else", async () => {
  const w = world(loadFormsConfig(env({ EMAIL_TO_FUNDRAISE: "" })));
  assert.equal((await failure(w.service.submit("donate", body("donate"), facts()))).code, "NOT_FOUND");
  for (const formId of ["newsletter", "travel", "fundraise"]) assert.equal((await failure(w.service.submit(formId, body(formId), facts()))).code, "SERVICE_UNAVAILABLE", formId);
  const off = world(FORMS_OFF);
  assert.equal((await failure(off.service.submit("contact", body("contact"), facts()))).code, "SERVICE_UNAVAILABLE");
  assert.equal((await failure(w.service.submit("contact", body("volunteer"), facts()))).code, "BAD_REQUEST", "the body's form must be the path's");
  assert.equal(w.captured.length + w.data.throttle.size, 0, "nothing counted, nothing rendered");
});

test("bots get a normal answer and nothing is sent: honeypot filled, or filled too fast", async () => {
  const w = world(loadFormsConfig(env()));
  const honeypot = await w.service.submit("contact", body("contact", VISITOR, { website: "https://spam.example" }), facts());
  const fast = await w.service.submit("contact", body("contact", VISITOR, { elapsedMs: MIN_FILL_MS - 1 }), facts());
  assert.ok(honeypot.reference && fast.reference);
  assert.equal(w.captured.length, 0);
  assert.deepEqual(w.outcomes(), ["spam_discarded", "spam_discarded"]);
});

test("validation: the shared rules, as 400 (malformed) or 422 with field codes — never the typed values", async () => {
  const w = world(loadFormsConfig({ ...env(), FORMS_RATE_LIMIT_MAX: "50" }));
  const codes = async (fields: Record<string, unknown>, formId = "contact") => {
    const e = await failure(w.service.submit(formId, body(formId, fields), facts()));
    assert.equal(e.code, "UNPROCESSABLE_CONTENT");
    return Object.fromEntries(e.details!.map((d) => [d.path, d.message]));
  };
  assert.deepEqual(await codes({}), { "fields.name": "required", "fields.email": "required", "fields.message": "required" });
  assert.deepEqual(await codes({ ...VISITOR, email: "not-an-email" }), { "fields.email": "format" });
  assert.deepEqual(await codes({ ...VISITOR, name: "x".repeat(201) }), { "fields.name": "too-long" });
  assert.deepEqual(await codes({ ...VISITOR, name: "Asha\nBcc: x@y.example" }), { "fields.name": "invalid" });
  assert.deepEqual(await codes({ ...VISITOR, topic: "lottery" }), { "fields.topic": "invalid" });
  for (const malformed of [body("contact", { ...VISITOR, extra: "x" }), { ...body("contact"), surprise: 1 }, body("contact", { ...VISITOR, name: 42 }), body("contact", "fields" as unknown as Record<string, unknown>)])
    assert.equal((await failure(w.service.submit("contact", malformed, facts()))).code, "BAD_REQUEST");
  const e = await failure(w.service.submit("contact", body("contact", { ...VISITOR, email: "asha@@example" }), facts()));
  assert.ok(!JSON.stringify(e.details).includes("asha"), "codes, never values");
});

test("rate limit: the (max+1)th attempt per client and form is a 429 with Retry-After; other forms and clients are separate", async () => {
  const w = world(loadFormsConfig({ ...env(), FORMS_RATE_LIMIT_MAX: "3" }));
  for (let i = 0; i < 3; i++) await w.service.submit("contact", body("contact"), facts());
  const limited = await failure(w.service.submit("contact", body("contact"), facts()));
  assert.equal(limited.code, "RATE_LIMITED");
  assert.ok(Number(limited.headers!["Retry-After"]) > 0);
  assert.equal((await failure(w.service.submit("contact", body("contact"), facts()))).code, "RATE_LIMITED");
  assert.ok((await w.service.submit("volunteer", body("volunteer"), facts())).reference, "another form: its own limit");
  assert.ok((await w.service.submit("contact", body("contact"), facts("198.51.100.99"))).reference, "another client: its own limit");
  assert.deepEqual(w.outcomes().filter((o) => o === "rate_limited"), ["rate_limited"], "only the first refusal of a window is recorded");
  w.time.advance(600_000);
  assert.ok((await w.service.submit("contact", body("contact"), facts())).reference, "a new window");
  assert.ok(![...w.data.throttle.keys()].some((k) => k.includes("198.51.100")), "no IP address in a throttle key");
});

test("bots and malformed requests count against the limit too (no flooding)", async () => {
  const w = world(loadFormsConfig({ ...env(), FORMS_RATE_LIMIT_MAX: "2" }));
  await w.service.submit("contact", body("contact", VISITOR, { website: "x" }), facts());
  await failure(w.service.submit("contact", body("contact", {}), facts()));
  assert.equal((await failure(w.service.submit("contact", body("contact"), facts()))).code, "RATE_LIMITED");
});

test("concurrent submissions: each gets its own reference; the limit holds exactly", async () => {
  const w = world(loadFormsConfig({ ...env(), FORMS_RATE_LIMIT_MAX: "5" }));
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => w.service.submit("contact", body("contact"), facts())));
  const okRefs = results.filter((r) => r.status === "fulfilled").map((r) => (r as PromiseFulfilledResult<{ reference: string }>).value.reference);
  assert.equal(okRefs.length, 5);
  assert.equal(new Set(okRefs).size, 5);
  assert.ok(results.filter((r) => r.status === "rejected").every((r) => ((r as PromiseRejectedResult).reason as ApiError).code === "RATE_LIMITED"));
  assert.equal(w.captured.length, 5);
});

test("privacy: nothing a visitor typed reaches the log or the audit trail; the audit has no IP hash or user agent", async () => {
  const w = world(loadFormsConfig({ ...env(), FORMS_RATE_LIMIT_MAX: "4" }));
  await w.service.submit("contact", body("contact"), facts());
  await w.service.submit("contact", body("contact", VISITOR, { website: "bot" }), facts());
  await failure(w.service.submit("contact", body("contact", { ...VISITOR, email: "bad" }), facts()));
  await w.service.submit("contact", body("contact"), facts());
  await failure(w.service.submit("contact", body("contact"), facts()));
  const text = JSON.stringify(w.data.audit) + w.logs.text();
  for (const leak of [...SECRETS, "198.51.100.7"]) assert.ok(!text.includes(leak), `leaked: ${leak}`);
  assert.ok(w.data.audit.every((e) => e.ipHash === null && e.userAgent === null && e.actorUserId === null));
  assert.deepEqual(Object.keys(w.data.audit[0]!.metadata).sort(), ["mode", "outcome", "reference"]);
  assert.equal(w.data.throttle.size > 0, true);
  assert.ok(![...w.data.throttle.keys()].some((k) => SECRETS.some((s) => k.includes(s))));
});

/* ---------------- Templates: identical to the website server's ---------------- */

test("templates: byte-identical to apps/web/server's for every form the API takes (no drift while both exist)", async () => {
  const web = (await import(pathToFileURL(new URL("../../web/server/email/templates.mjs", import.meta.url).pathname).href)) as {
    notification: typeof notification;
    acknowledgement: typeof acknowledgement;
  };
  const meta = { reference: "RBB-ABCD2345", submittedAt: "2026-10-10 09:30" };
  const samples = [
    ["contact", { ...VISITOR, topic: "partner" }],
    ["contact", { ...VISITOR, topic: undefined }],
    ["volunteer", VISITOR],
    ["partner", { ...VISITOR, organization: "Example <Trust> & Co" }],
    ["fundraise", { ...VISITOR, name: "O'Brien \"Q\"", message: "<script>alert(1)</script>" }],
  ] as const;
  for (const [formId, data] of samples) {
    assert.deepEqual(notification(formId, data, meta), web.notification(formId, data, meta), `notification ${formId}`);
    assert.deepEqual(acknowledgement(formId, meta), web.acknowledgement(formId, meta), `acknowledgement ${formId}`);
  }
  assert.ok(!notification("fundraise", { ...VISITOR, message: "<script>alert(1)</script>" }, meta).html.includes("<script>"));
});
