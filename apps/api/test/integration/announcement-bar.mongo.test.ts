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

/* The announcement bar (M21) end to end over the test database: sessions,
   CSRF, RBAC, its index, two organizations in one database, revisions,
   approval, the structure-only audit, and the published bar (with the
   display settings) in the public snapshot. Test records only. */

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
  const res = await app.handle(new Request(`https://api.example${path}`, init), { clientIp: "203.0.113.93" });
  bodies.push(await res.clone().text());
  return res;
};
const send = (app: App, who: string, method: string, path: string, body?: unknown) =>
  call(app, path, { method, headers: { Origin: ADMIN, Cookie: `cms_session=${tokens[who]}`, ...(body !== undefined && { "Content-Type": "application/json" }) }, ...(body !== undefined && { body: JSON.stringify(body) }) });

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
  const settings = settingsRecord("org-a");
  await new SettingsService(new MongoSettingsStore(mongo.db(), "org-a"), new MongoMediaStore(mongo.db(), "org-a"), audit, { orgId: "org-a" }).importInitial(settings, { id: null, name: "Settings import" });
});
after(async () => {
  await provider.close();
  await mongo.cleanup();
});

const WORDING = "Integration message wording";

test("index: one bar per organization", async () => {
  const indexes = await mongo.db().collection(COLLECTIONS.announcementBars).indexes();
  assert.deepEqual(indexes.map((i) => i.name).sort(), ["_id_", "orgId_unique"]);
  assert.deepEqual(INDEXES.announcementBars.map((i) => i.name), ["orgId_unique"]);
});

test("over HTTP: 401 without a session, CSRF, revisions, links to this site only, owners approve, org-scoped, audit without wording", async () => {
  assert.equal((await call(appA, "/api/v1/announcement-bar", { headers: { Origin: ADMIN } })).status, 401);
  assert.equal((await call(appA, "/api/v1/announcement-bar", { method: "PATCH", headers: { Cookie: `cms_session=${tokens.ownerA}`, Origin: "https://evil.example", "Content-Type": "application/json" }, body: JSON.stringify({ revision: 0, changes: {} }) })).status, 403);
  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/announcement-bar", { revision: 0, changes: {} })).status, 200);
  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/announcement-bar", { revision: 1, changes: { items: [{ id: "m-1", text: "Go", link: { label: "Out", href: "https://elsewhere.test" } }] } })).status, 400, "another site");
  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/announcement-bar", { revision: 1, changes: { items: [{ id: "m-1", text: WORDING, link: { label: "See events", href: "/media/events" } }] } })).status, 200);
  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/announcement-bar", { revision: 1, changes: { items: [] } })).status, 409, "stale");
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/announcement-bar/submit", { revision: 2 })).status, 200);
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/announcement-bar/approve", { revision: 3 })).status, 403);
  await approveOverHttp((method, p, body) => send(appA, "ownerA", method, p, body), "/api/v1/announcement-bar");
  assert.equal((await jsonOf(await send(appB, "ownerB", "GET", "/api/v1/announcement-bar"))).data.record, null);
  const trail = await mongo.db().collection(COLLECTIONS.auditLogs).find({ orgId: "org-a", resourceType: "announcement_bar" }).toArray();
  for (const action of ["announcement_bar.created", "announcement_bar.updated", "announcement_bar.submitted", "announcement_bar.approved"]) assert.ok(trail.some((e) => e.action === action), action);
  assert.ok(!JSON.stringify(trail).includes(WORDING), "no wording in the audit");
});

test("publish: the published bar and the display settings in the snapshot; nothing internal", async () => {
  assert.equal((await send(appA, "ownerA", "POST", "/api/v1/publish")).status, 200);
  const snapshot = (await jsonOf(await call(appA, "/api/v1/public/snapshot"))).data;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.deepEqual(snapshot.content.announcementBar.items, [{ id: "m-1", text: WORDING, link: { label: "See events", href: "/media/events" } }]);
  assert.deepEqual(Object.keys(snapshot.settings.engagement.announcementBar).sort(), ["enabled", "intervalMs"]);
  for (const leak of ["_id", "revision", "updatedBy", FAKE_KEY]) assert.ok(!JSON.stringify(snapshot).includes(leak), leak);
});
