import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createApp, type App } from "../../src/app.ts";
import { COLLECTIONS, ensureIndexes } from "../../src/db/collections.ts";
import { createMongoProvider, type MongoProvider } from "../../src/db/mongo.ts";
import { loadFormsConfig } from "../../src/modules/forms/config.ts";
import type { OutgoingEmail } from "../../src/modules/forms/email.ts";
import { MongoPlaceStore } from "../../src/modules/forms/places.ts";
import { MongoPublishStore } from "../../src/modules/publishing/repository.ts";
import { captureLogs, jsonOf, testConfig } from "../helpers.ts";
import { testMongo } from "./mongo.ts";

/* 2026-10-17 — event registration and career applications over HTTP
   against the dedicated test database (never the application's):
   registrations checked against the LIVE snapshot's event, the place
   limit held by the MongoDB counter under concurrency, the confirmation
   and RBB's email rendered (test mode: nothing sent), and every open
   Careers role taking applications at 3 per client and role. */

const mongo = testMongo();
const SITE = "https://site.example";
const ORG = "org-d";
const EVENT_ID = "itest-event-0001";
const logs = captureLogs();
const providers: MongoProvider[] = [];

const FIELDS = [
  { id: "name", type: "text", label: "Your full name", required: true },
  { id: "email", type: "email", label: "Email address", required: true },
  { id: "days", type: "checkboxes", label: "Days", required: false, options: ["Saturday", "Sunday"] },
  { id: "country", type: "country", label: "Country", required: true },
];
const EVENT = {
  id: EVENT_ID, orgId: ORG, schemaVersion: 1, status: "published", slug: "itest-football", title: "Integration football", summary: "S", about: [],
  date: "2099-06-01", startTime: "6:00 PM", endTime: "8:00 PM", timezone: "Europe/London", programId: null, venue: "Test ground", address: "1 Test Road", schedule: [], imageId: "m1",
  registration: { open: true, capacity: 3, submitLabel: "Register", successMessage: "Done.", fields: FIELDS },
};

function instance() {
  const provider = createMongoProvider({ uri: mongo.uri, dbName: mongo.dbName });
  providers.push(provider);
  const captured: OutgoingEmail[] = [];
  const app = createApp({
    config: testConfig({ orgId: ORG, mongo: { uri: mongo.uri, dbName: mongo.dbName }, forms: loadFormsConfig({ EMAIL_MODE: "test", EMAIL_TO_EVENTS: "events-inbox@rbb.example", EMAIL_TO_CAREERS: "jobs@rbb.example" }) }),
    mongo: provider,
    write: logs.write,
    formsCapture: (email) => captured.push(email),
  });
  return { app, captured };
}
const post = (app: App, formId: string, fields: Record<string, unknown>, ip: string) =>
  app.handle(
    new Request(`https://api.example/api/v1/forms/${formId}`, {
      method: "POST",
      headers: { Origin: SITE, "Content-Type": "application/json" },
      body: JSON.stringify({ formId, fields, website: "", elapsedMs: 4000, antiSpamToken: null }),
    }),
    { clientIp: ip }
  );
const person = (n: number) => ({ name: `Person ${n}`, email: `person${n}@example.org`, days: ["Sunday"], country: "India" });

let a: ReturnType<typeof instance>;
let b: ReturnType<typeof instance>;

before(async () => {
  await mongo.connect();
  await ensureIndexes(mongo.db());
  /* A live website version for the test org: the event and one Careers role. */
  const store = new MongoPublishStore(mongo.db(), ORG);
  const lock = "itest-lock";
  assert.ok(await store.acquireLock(lock, new Date(), 60_000));
  const version = await store.nextVersion(lock);
  const info = { version, generatedAt: new Date().toISOString(), publishedBy: { id: "u", name: "Test" }, sourceHash: "itest" };
  await store.insertSnapshot({ ...info, snapshot: { content: { events: [EVENT], careers: { opportunities: { roles: [{ id: "field-coordinator", title: "Field Coordinator" }] } } } } as never });
  assert.ok(await store.activate(lock, info));
  await store.releaseLock(lock);
  a = instance();
  b = instance();
});

after(async () => {
  for (const provider of providers) await provider.close();
  await mongo.db().collection(COLLECTIONS.publishState).deleteMany({ orgId: ORG });
  await mongo.db().collection(COLLECTIONS.publishedSnapshots).deleteMany({ orgId: ORG });
  await mongo.cleanup();
});

test("a registration: stored under event-<id> with the answers, RBB's inbox and the registrant's confirmation rendered (not sent)", async () => {
  const res = await post(a.app, `event-${EVENT_ID}`, person(1), "198.18.40.1");
  assert.equal(res.status, 200);
  const rows = await mongo.db().collection(COLLECTIONS.formSubmissions).find({ orgId: ORG, formId: `event-${EVENT_ID}` }).toArray();
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0]!.fields.days, rows[0]!.fields.country, rows[0]!.formTitle], ["Sunday", "India", "Registration — Integration football"]);
  assert.deepEqual(a.captured.map((e) => e.to), ["events-inbox@rbb.example", "person1@example.org"]);
  assert.match(a.captured[1]!.subject, /^You're registered: Integration football · RBB-/);
});

test("an answer the published form refuses: 422 with the field's code; an unknown event: 404", async () => {
  const bad = await post(a.app, `event-${EVENT_ID}`, { ...person(9), country: "Narnia" }, "198.18.40.2");
  assert.equal(bad.status, 422);
  assert.deepEqual((await jsonOf(bad)).error.details, [{ path: "fields.country", message: "invalid" }]);
  assert.equal((await post(a.app, "event-no-such-event", person(9), "198.18.40.3")).status, 404);
});

test("the place limit holds across two app instances and concurrent requests: 3 places, 6 people", async () => {
  const results = await Promise.all([2, 3, 4, 5, 6, 7].map((n, i) => post(i % 2 ? b.app : a.app, `event-${EVENT_ID}`, person(n), `198.18.41.${n}`)));
  const statuses = results.map((r) => r.status).sort();
  assert.deepEqual(statuses, [200, 200, 409, 409, 409, 409], "one place was taken by the first test; two left");
  const full = results.find((r) => r.status === 409)!;
  assert.deepEqual((await jsonOf(full)).error.details, [{ path: "registration", message: "full" }]);
  assert.equal(await mongo.db().collection(COLLECTIONS.formSubmissions).countDocuments({ orgId: ORG, formId: `event-${EVENT_ID}` }), 3);
  const counter = await mongo.db().collection(COLLECTIONS.eventPlaces).findOne({ orgId: ORG, formId: `event-${EVENT_ID}` });
  assert.equal(counter?.taken, 3);
});

test("the counter: created from the registrations already stored, never below zero", async () => {
  const places = new MongoPlaceStore(mongo.db(), ORG);
  assert.equal(await places.take("event-itest-other", null, async () => 5), true);
  assert.equal((await mongo.db().collection(COLLECTIONS.eventPlaces).findOne({ orgId: ORG, formId: "event-itest-other" }))?.taken, 6);
  assert.equal(await places.take("event-itest-other", 6, async () => 0), false, "the limit counts what is already there");
  for (let i = 0; i < 8; i++) await places.release("event-itest-other");
  assert.equal((await mongo.db().collection(COLLECTIONS.eventPlaces).findOne({ orgId: ORG, formId: "event-itest-other" }))?.taken, 0);
});

test("careers: a published role with no saved form takes applications with the standard form; 3 per client and role, then 429", async () => {
  const apply = (ip: string) => post(a.app, "career-field-coordinator", { name: "Asha", email: "asha@example.org" }, ip);
  // No CV attached: each attempt is refused as invalid (422) — and counts against the limit.
  const statuses = [];
  for (let i = 0; i < 4; i++) statuses.push((await apply("198.18.42.1")).status);
  assert.deepEqual(statuses, [422, 422, 422, 429]);
  assert.equal((await apply("198.18.42.2")).status, 422, "another client has its own limit");
  assert.equal((await post(a.app, "career-not-a-published-role", { name: "A", email: "a@example.org" }, "198.18.42.3")).status, 404);
});
