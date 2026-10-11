import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PublishedSnapshot } from "@rbb/content-schema";
import { createApp, type App } from "../../src/app.ts";
import { COLLECTIONS, INDEXES, ensureIndexes } from "../../src/db/collections.ts";
import { createMongoProvider } from "../../src/db/mongo.ts";
import { AuditService, mongoAuditStore } from "../../src/modules/audit/audit.ts";
import { mongoAuthStores } from "../../src/modules/auth/repository.ts";
import { MongoMediaStore } from "../../src/modules/media/repository.ts";
import { MongoSettingsStore } from "../../src/modules/settings/repository.ts";
import { SettingsService } from "../../src/modules/settings/service.ts";
import { CHEAP_SCRYPT, addMember, silentLog } from "../auth/memory.ts";
import { settingsRecord } from "../fixtures/settings.ts";
import { captureLogs, jsonOf, testConfig } from "../helpers.ts";
import { MemoryStorage } from "../media/memory.ts";
import { FakeDonationProvider } from "../support/fake-donations.ts";
import { testMongo } from "./mongo.ts";
import { approveOverHttp } from "./workflow.ts";

/* Policies (M19) end to end over the test database: sessions, CSRF, RBAC,
   the (orgId, policyId) index, two organizations in one database,
   revisions, approval completeness, contacts, the structure-only audit,
   and the published policies in the public snapshot. Test records only;
   no wording here is, or resembles, legal text. */

const mongo = testMongo();
const provider = createMongoProvider({ uri: mongo.uri, dbName: mongo.dbName });
const ADMIN = "https://admin.example";
const PASSWORD = "a correct long password";
const FAKE_KEY = "test-givebutter-key-not-real-0000000000";
const logs = captureLogs();
const appFor = (orgId: string): App =>
  createApp({ config: testConfig({ orgId, mongo: { uri: mongo.uri, dbName: mongo.dbName }, integrations: { givebutter: { apiKey: FAKE_KEY } } }), mongo: provider, scrypt: CHEAP_SCRYPT, write: logs.write, storage: new MemoryStorage(), donationProvider: new FakeDonationProvider() });
let appA: App, appB: App;
const tokens: Record<string, string> = {};
const bodies: string[] = [];
const call = async (app: App, path: string, init: RequestInit = {}) => {
  const res = await app.handle(new Request(`https://api.example${path}`, init), { clientIp: "203.0.113.91" });
  bodies.push(await res.clone().text());
  return res;
};
const send = (app: App, who: string, method: string, path: string, body?: unknown) =>
  call(app, path, { method, headers: { Origin: ADMIN, Cookie: `cms_session=${tokens[who]}`, ...(body !== undefined && { "Content-Type": "application/json" }) }, ...(body !== undefined && { body: JSON.stringify(body) }) });

const WORDING = "Integration paragraph wording";
const complete = { effectiveDate: "2026-09-01", lastUpdated: "2026-09-15", intro: ["Integration intro."], sections: [{ id: "first", heading: "First heading", body: [WORDING], items: ["Integration item."] }], contactReference: "test-mail" };

before(async () => {
  await mongo.connect();
  await ensureIndexes(mongo.db());
  appA = appFor("org-a");
  appB = appFor("org-b");
  for (const [orgId, email, role] of [["org-a", "owner@a.example", "OWNER"], ["org-a", "editor@a.example", "EDITOR"], ["org-b", "owner@b.example", "OWNER"]] as const)
    await addMember(mongoAuthStores(mongo.db(), orgId), { orgId, email, password: PASSWORD, role, name: email.split("@")[0]! });
  for (const [app, who, email] of [[() => appA, "ownerA", "owner@a.example"], [() => appA, "editorA", "editor@a.example"], [() => appB, "ownerB", "owner@b.example"]] as const) {
    const res = await call(app(), "/api/v1/auth/login", { method: "POST", headers: { Origin: ADMIN, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) });
    tokens[who] = /cms_session=([^;]*)/.exec(res.headers.get("set-cookie") ?? "")![1]!;
  }
  const audit = new AuditService(mongoAuditStore(mongo.db(), "org-a"), { orgId: "org-a", secret: "test-only-auth-secret-0123456789abcdef", log: silentLog });
  const settings = { ...settingsRecord("org-a"), contact: { methods: [{ id: "test-mail", type: "email", label: "Test mailbox", value: "mailbox@example.org" }] } };
  await new SettingsService(new MongoSettingsStore(mongo.db(), "org-a"), new MongoMediaStore(mongo.db(), "org-a"), audit, { orgId: "org-a" }).importInitial(settings, { id: null, name: "Settings import" });
});
after(async () => {
  await provider.close();
  await mongo.cleanup();
});

test("index: one record per policy per organization — and nothing speculative", async () => {
  const indexes = await mongo.db().collection(COLLECTIONS.policies).indexes();
  assert.deepEqual(indexes.map((i) => i.name).sort(), ["_id_", "orgId_policyId_unique"]);
  assert.deepEqual(INDEXES.policies.map((i) => i.name), ["orgId_policyId_unique"]);
  assert.ok(indexes.find((i) => i.name === "orgId_policyId_unique")!.unique);
  await ensureIndexes(mongo.db());
});

test("no session → 401; a foreign Origin cannot write; an unknown policy has no route", async () => {
  for (const path of ["/api/v1/policies", "/api/v1/policies/privacy"]) assert.equal((await call(appA, path, { headers: { Origin: ADMIN } })).status, 401, path);
  assert.equal((await call(appA, "/api/v1/policies/privacy", { method: "PATCH", headers: { Cookie: `cms_session=${tokens.ownerA}`, Origin: "https://evil.example", "Content-Type": "application/json" }, body: JSON.stringify({ revision: 0, changes: {} }) })).status, 403);
  for (const id of ["cookies", "accessibility", "Privacy"]) assert.equal((await send(appA, "ownerA", "GET", `/api/v1/policies/${id}`)).status, 404, id);
});

test("policies over HTTP: the list, an empty draft, revisions, completeness, owners approve, org-scoped", async () => {
  const list = (await jsonOf(await send(appA, "editorA", "GET", "/api/v1/policies"))).data;
  assert.deepEqual(list.policies.map((p: { id: string; route: string; view: { record: unknown } }) => [p.id, p.route, p.view.record]), [["privacy", "/privacy", null], ["terms", "/terms", null], ["donation", "/donation-policy", null]]);
  assert.deepEqual(list.contactMethods.map((m: { id: string }) => m.id), ["test-mail"]);

  const created = await send(appA, "editorA", "PATCH", "/api/v1/policies/privacy", { revision: 0, changes: {} });
  assert.equal(created.status, 200);
  const draft = (await jsonOf(created)).data;
  assert.deepEqual([draft.record.id, draft.record.status, draft.record.sections, draft.record.intro, draft.revision], ["privacy", "draft", [], [], 1]);
  const stored = await mongo.db().collection(COLLECTIONS.policies).findOne({ orgId: "org-a", policyId: "privacy" });
  assert.ok(stored, "stored under its fixed key");

  for (const [changes, why] of [
    [{ sections: [{ id: "x", heading: "H", body: ["<b>x</b>"] }] }, "HTML"],
    [{ id: "terms" }, "the id"],
    [{ releaseMarker: "Sample" }, "a release marker"],
    [{ effectiveDate: "2026-02-30" }, "an impossible date"],
    [{ contactReference: "missing" }, "a contact not in the settings"],
    [{ relatedPolicies: ["cookies"] }, "an unknown related policy"],
  ] as const)
    assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/policies/privacy", { revision: 1, changes })).status, 400, why);

  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/policies/privacy", { revision: 1, changes: { sections: complete.sections } })).status, 200);
  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/policies/privacy", { revision: 1, changes: { title: "Stale" } })).status, 409, "a stale revision");
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/policies/privacy/submit", { revision: 2 })).status, 200);
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/policies/privacy/approve", { revision: 3 })).status, 403, "editors never approve");
  const incomplete = await send(appA, "ownerA", "POST", "/api/v1/policies/privacy/approve", { revision: 3 });
  assert.equal(incomplete.status, 400, "no dates");
  assert.deepEqual((await jsonOf(incomplete)).error.details.map((d: { path: string }) => d.path).sort(), ["body.effectiveDate", "body.lastUpdated"]);
  assert.equal((await send(appA, "ownerA", "POST", "/api/v1/policies/privacy/reject", { revision: 3 })).status, 200);
  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/policies/privacy", { revision: 4, changes: complete })).status, 200);
  await approveOverHttp((method, path, body) => send(appA, "ownerA", method, path, body), "/api/v1/policies/privacy");

  // The other organization sees its own (empty) policies only.
  const other = (await jsonOf(await send(appB, "ownerB", "GET", "/api/v1/policies"))).data;
  assert.ok(other.policies.every((p: { view: { record: unknown } }) => p.view.record === null));
  assert.deepEqual(other.contactMethods, []);

  const trail = await mongo.db().collection(COLLECTIONS.auditLogs).find({ orgId: "org-a", resourceType: "policy" }).toArray();
  for (const action of ["policy.created", "policy.updated", "policy.submitted", "policy.rejected", "policy.approved"]) assert.ok(trail.some((e) => e.action === action), action);
  assert.ok(trail.every((e) => e.resourceId === "privacy"));
  const audited = JSON.stringify(trail);
  for (const words of [WORDING, "First heading", "Integration intro", "Integration item", "mailbox@example.org"]) assert.ok(!audited.includes(words), `no wording in the audit: ${words}`);
});

test("publish: the published policy only, in the snapshot, and nothing internal; a pending edit keeps it", async () => {
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/publish")).status, 403);
  assert.equal((await send(appA, "ownerA", "POST", "/api/v1/publish")).status, 200);
  let snapshot = (await jsonOf(await call(appA, "/api/v1/public/snapshot"))).data;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.deepEqual(snapshot.content.policies.map((p: { id: string; status: string }) => [p.id, p.status]), [["privacy", "published"]]);
  assert.equal(snapshot.content.policies[0].sections[0].body[0], WORDING);
  const text = JSON.stringify(snapshot);
  for (const leak of ["_id", "revision", "updatedBy", "policyId", FAKE_KEY, "editor@a.example"]) assert.ok(!text.includes(leak), `leaked: ${leak}`);

  const live = (await jsonOf(await send(appA, "ownerA", "GET", "/api/v1/policies/privacy"))).data;
  assert.equal(live.live, true);
  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/policies/privacy", { revision: live.revision, changes: { intro: ["A pending edit."] } })).status, 200);
  assert.equal((await send(appA, "ownerA", "POST", "/api/v1/publish")).status, 409, "nothing new to publish: the pending edit is not part of it");
  snapshot = (await jsonOf(await call(appA, "/api/v1/public/snapshot"))).data;
  assert.deepEqual(snapshot.content.policies[0].intro, ["Integration intro."]);
});

test("secrets: the Givebutter key never appears in a response or a log line", () => {
  assert.ok(!bodies.join("\n").includes(FAKE_KEY));
  assert.ok(!logs.text().includes(FAKE_KEY));
});
