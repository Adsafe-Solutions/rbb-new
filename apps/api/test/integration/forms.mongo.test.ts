import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createApp, type App } from "../../src/app.ts";
import { COLLECTIONS, ensureIndexes } from "../../src/db/collections.ts";
import { createMongoProvider, type MongoProvider } from "../../src/db/mongo.ts";
import { loadFormsConfig } from "../../src/modules/forms/config.ts";
import type { EmailTransport, OutgoingEmail } from "../../src/modules/forms/email.ts";
import { captureLogs, jsonOf, testConfig } from "../helpers.ts";
import { testMongo } from "./mongo.ts";

/* M18 — the public forms over HTTP against the dedicated test database
   (MONGODB_TEST_URI + MONGODB_TEST_DB; never the application's). Real
   routing, CORS, CSRF/Origin, body limits, and the SHARED MongoDB rate
   limit — proven with TWO independently built app instances, each with
   its own MongoDB client, counting into the same database. No email is
   ever sent: test mode captures, and every other mode uses a fake
   transport that records. */

const mongo = testMongo();
const SITE = "https://site.example";
const ADMIN = "https://admin.example";
const VISITOR = { name: "Ravi Visitor", email: "ravi.visitor@example.org", message: "Please tell me about volunteering — <i>thanks</i>." };
const logs = captureLogs();
const providers: MongoProvider[] = [];

const ENV = {
  EMAIL_MODE: "test",
  EMAIL_TO_CONTACT: "contact-inbox@rbb.example",
  EMAIL_TO_VOLUNTEER: "volunteer-inbox@rbb.example",
  EMAIL_TO_PARTNER: "partner-inbox@rbb.example",
  EMAIL_TO_FUNDRAISE: "fundraise-inbox@rbb.example",
  FORMS_RATE_LIMIT_MAX: "3",
};

/* An app instance with its OWN MongoDB client (as two serverless
   instances would have). */
function instance(orgId: string, env: Record<string, string> = ENV, transport?: EmailTransport) {
  const provider = createMongoProvider({ uri: mongo.uri, dbName: mongo.dbName });
  providers.push(provider);
  const captured: OutgoingEmail[] = [];
  const app = createApp({
    config: testConfig({ orgId, mongo: { uri: mongo.uri, dbName: mongo.dbName }, forms: loadFormsConfig(env) }),
    mongo: provider,
    write: logs.write,
    formsCapture: (email) => captured.push(email),
    ...(transport && { emailTransport: transport }),
  });
  return { app, captured };
}

const body = (formId: string, fields: Record<string, unknown> = VISITOR, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ formId, fields, website: "", elapsedMs: 4000, antiSpamToken: null, ...extra });
const post = (app: App, formId: string, payload: string, { origin = SITE as string | null, ip = "203.0.113.50", type = "application/json", headers = {} as Record<string, string> } = {}) =>
  app.handle(
    new Request(`https://api.example/api/v1/forms/${formId}`, {
      method: "POST",
      headers: { ...(origin && { Origin: origin }), ...(type && { "Content-Type": type }), "Idempotency-Key": "smoke-key-0001", ...headers },
      body: payload,
    }),
    { clientIp: ip }
  );

let a: ReturnType<typeof instance>;
let b: ReturnType<typeof instance>;
let ipCounter = 0;
const freshIp = () => `198.18.10.${++ipCounter}`;

before(async () => {
  await mongo.connect();
  await ensureIndexes(mongo.db());
  a = instance("org-a");
  b = instance("org-a");
});

after(async () => {
  for (const provider of providers) await provider.close();
  await mongo.cleanup();
});

test("a valid submission in test mode: 200 with a reference, CORS for the site, the email rendered and NOT sent", async () => {
  const res = await post(a.app, "contact", body("contact", { ...VISITOR, topic: "general" }), { ip: freshIp() });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), SITE);
  const { data } = await jsonOf(res);
  assert.match(data.reference, /^RBB-[A-Z2-9]{8}$/);
  assert.deepEqual(Object.keys(data), ["reference"]);
  assert.equal(a.captured.length, 1);
  assert.equal(a.captured[0]!.to, "contact-inbox@rbb.example");
  assert.equal(a.captured[0]!.replyTo, VISITOR.email);
  for (const formId of ["volunteer", "partner", "fundraise"]) assert.equal((await post(a.app, formId, body(formId, formId === "partner" ? { ...VISITOR, organization: "Example Trust" } : VISITOR), { ip: freshIp() })).status, 200, formId);
});

test("Origin: missing, foreign or the admin's → 403, and nothing is counted or rendered", async () => {
  const before = a.captured.length;
  for (const origin of [null, "https://evil.example", ADMIN, "http://site.example", `${SITE}/`]) {
    const res = await post(a.app, "contact", body("contact"), { origin, ip: freshIp() });
    assert.equal(res.status, 403, String(origin));
  }
  assert.equal(a.captured.length, before);
});

test("CORS preflight: the site may POST with Content-Type and Idempotency-Key; another origin gets no allowance", async () => {
  const preflight = (origin: string) =>
    a.app.handle(new Request("https://api.example/api/v1/forms/contact", { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type,idempotency-key" } }));
  const ok = await preflight(SITE);
  assert.ok(ok.status === 204 || ok.status === 200, String(ok.status));
  assert.equal(ok.headers.get("access-control-allow-origin"), SITE);
  assert.match(ok.headers.get("access-control-allow-methods") ?? "", /POST/);
  assert.match(ok.headers.get("access-control-allow-headers") ?? "", /Content-Type/);
  assert.match(ok.headers.get("access-control-allow-headers") ?? "", /Idempotency-Key/);
  const foreign = await preflight("https://evil.example");
  assert.equal(foreign.headers.get("access-control-allow-origin"), null);
});

test("body: invalid JSON → 400, wrong type → 415, over the limit → 413, unknown form → 404", async () => {
  assert.equal((await post(a.app, "contact", "{not json", { ip: freshIp() })).status, 400);
  assert.equal((await post(a.app, "contact", "formId=contact", { type: "application/x-www-form-urlencoded", ip: freshIp() })).status, 415);
  assert.equal((await post(a.app, "contact", body("contact", { ...VISITOR, message: "x".repeat(17 * 1024) }), { ip: freshIp() })).status, 413);
  assert.equal((await post(a.app, "lottery", body("lottery"), { ip: freshIp() })).status, 404);
  assert.equal((await post(a.app, "contact", body("volunteer"), { ip: freshIp() })).status, 400, "body and path must agree");
});

test("invalid fields → 422 with the exact field codes, never the values", async () => {
  const res = await post(a.app, "contact", body("contact", { name: "", email: "ravi@@example", message: "x".repeat(5001), topic: "lottery" }), { ip: freshIp() });
  assert.equal(res.status, 422);
  const { error } = await jsonOf(res);
  assert.equal(error.code, "UNPROCESSABLE_CONTENT");
  assert.deepEqual(Object.fromEntries(error.details.map((d: { path: string; message: string }) => [d.path, d.message])), {
    "fields.name": "required",
    "fields.email": "format",
    "fields.topic": "invalid",
    "fields.message": "too-long",
  });
  assert.ok(!JSON.stringify(error).includes("ravi"));
});

test("bots: honeypot or too-fast → the same 200, and no email rendered", async () => {
  const before = a.captured.length;
  for (const extra of [{ website: "https://spam.example" }, { elapsedMs: 200 }]) {
    const res = await post(a.app, "volunteer", body("volunteer", VISITOR, extra), { ip: freshIp() });
    assert.equal(res.status, 200);
    assert.ok((await jsonOf(res)).data.reference);
  }
  assert.equal(a.captured.length, before);
});

test("rate limit SHARED across two app instances (separate MongoDB clients): the 4th attempt from one client is 429 on either", async () => {
  const ip = freshIp();
  assert.equal((await post(a.app, "contact", body("contact"), { ip })).status, 200);
  assert.equal((await post(b.app, "contact", body("contact"), { ip })).status, 200);
  assert.equal((await post(a.app, "contact", body("contact"), { ip })).status, 200);
  const limitedOnB = await post(b.app, "contact", body("contact"), { ip });
  assert.equal(limitedOnB.status, 429, "instance B knows about A's attempts");
  assert.ok(Number(limitedOnB.headers.get("retry-after")) > 0);
  assert.equal((await post(a.app, "contact", body("contact"), { ip })).status, 429);
  assert.equal((await post(b.app, "partner", body("partner", { ...VISITOR, organization: "Trust" }), { ip })).status, 200, "another form: its own limit");
  assert.equal((await post(b.app, "contact", body("contact"), { ip: freshIp() })).status, 200, "another client: its own limit");
  const counters = await mongo.db().collection(COLLECTIONS.authThrottle).find({ orgId: "org-a", _id: { $regex: "^form:" } } as never).toArray();
  assert.ok(counters.length > 0 && counters.every((c) => !String(c._id).includes(ip)), "one shared counter per window, keyed without the IP");
});

test("concurrency: 6 simultaneous submissions from one client across both instances — exactly 3 accepted", async () => {
  const ip = freshIp();
  const results = await Promise.all(Array.from({ length: 6 }, (_, i) => post(i % 2 ? b.app : a.app, "fundraise", body("fundraise"), { ip })));
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 200, 200, 429, 429, 429]);
});

test("disabled forms: Newsletter and Travel 503 even with an endpoint env; an unconfigured form or mode off → 503", async () => {
  const withNewsletterEnv = instance("org-a", { ...ENV, EMAIL_TO_NEWSLETTER: "news@rbb.example", NEWSLETTER_ENABLED: "true", EMAIL_TO_TRAVEL: "travel@rbb.example" });
  for (const formId of ["newsletter", "travel"]) {
    const res = await post(withNewsletterEnv.app, formId, body(formId, formId === "newsletter" ? { email: VISITOR.email, consent: true } : { ...VISITOR, phone: "123" }), { ip: freshIp() });
    assert.equal(res.status, 503, formId);
  }
  assert.equal(withNewsletterEnv.captured.length, 0);
  const off = instance("org-a", {});
  assert.equal((await post(off.app, "contact", body("contact"), { ip: freshIp() })).status, 503);
  const noVolunteer = instance("org-a", { ...ENV, EMAIL_TO_VOLUNTEER: "" });
  assert.equal((await post(noVolunteer.app, "volunteer", body("volunteer"), { ip: freshIp() })).status, 503);
});

test("provider failure and malformed configuration: 503, never a success", async () => {
  const failing: EmailTransport = async () => ({ ok: false, category: "unavailable" });
  const live = instance("org-b", { ...ENV, EMAIL_MODE: "live", EMAIL_API_KEY: "re_fake_key", EMAIL_FROM: "Rising Beyond Borders <forms@rbb.example>" }, failing);
  const res = await post(live.app, "contact", body("contact"), { ip: freshIp() });
  assert.equal(res.status, 503);
  assert.ok(!JSON.stringify(await jsonOf(res)).includes("re_fake_key"));
  const temporary = instance("org-b", { ...ENV, EMAIL_MODE: "live", EMAIL_API_KEY: "re_fake_key", EMAIL_FROM: "RBB <onboarding@resend.dev>" }, async () => assert.fail("must never be called"));
  assert.equal((await post(temporary.app, "contact", body("contact"), { ip: freshIp() })).status, 503);
});

test("staging over HTTP: every email goes to the test inbox with [TEST]; nothing reaches RBB's inbox or the visitor", async () => {
  const sent: OutgoingEmail[] = [];
  const staging = instance("org-b", { ...ENV, EMAIL_MODE: "staging", EMAIL_API_KEY: "re_fake_key", EMAIL_FROM: "RBB <forms@rbb.example>", EMAIL_TEST_RECIPIENT: "qa@rbb.example", EMAIL_ACK_FORMS: "contact" }, async (email) => {
    sent.push(email);
    return { ok: true, id: "fake" };
  });
  assert.equal((await post(staging.app, "contact", body("contact"), { ip: freshIp() })).status, 200);
  assert.deepEqual(sent.map((e) => [e.to, e.subject.startsWith("[TEST] ")]), [["qa@rbb.example", true], ["qa@rbb.example", true]]);
});

test("privacy: no visitor answer, address or IP in any response, log line or stored audit entry; nothing else stored", async () => {
  const entries = await mongo.db().collection(COLLECTIONS.auditLogs).find({ action: "forms.submission" }).toArray();
  assert.ok(entries.length > 0);
  const text = JSON.stringify(entries) + logs.text();
  for (const leak of [VISITOR.name, VISITOR.email, "volunteering", "203.0.113.50", "198.18.10."]) assert.ok(!text.includes(leak), `leaked: ${leak}`);
  assert.ok(entries.every((e) => e.ipHash === null && e.userAgent === null && e.actorUserId === null && e.resourceType === "form"));
  const outcomes = new Set(entries.map((e) => e.metadata.outcome));
  for (const outcome of ["delivered", "spam_discarded", "invalid", "rate_limited", "provider_unavailable"]) assert.ok(outcomes.has(outcome), outcome);
  // Email only: no collection holds a submission.
  for (const { name } of await mongo.db().listCollections({}, { nameOnly: true }).toArray()) {
    const docs = JSON.stringify(await mongo.db().collection(name).find({}).limit(500).toArray());
    assert.ok(!docs.includes(VISITOR.email) && !docs.includes(VISITOR.name), `${name} holds a submission`);
  }
});
