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
import { MemoryStorage, fixture } from "../media/memory.ts";
import { FakeDonationProvider } from "../support/fake-donations.ts";
import { testMongo } from "./mongo.ts";

/* Programs end to end over the test database: sessions, CSRF, RBAC,
   indexes, two organizations in one database, the order, and programs in
   the public snapshot. Test records only. The configured Givebutter key is
   a made-up string that must appear nowhere. */

const mongo = testMongo();
const provider = createMongoProvider({ uri: mongo.uri, dbName: mongo.dbName });
const ADMIN = "https://admin.example";
const PASSWORD = "a correct long password";
const FAKE_KEY = "test-givebutter-key-not-real-0000000000";
const storage = new MemoryStorage();
const logs = captureLogs();
const appFor = (orgId: string): App =>
  createApp({ config: testConfig({ orgId, mongo: { uri: mongo.uri, dbName: mongo.dbName }, integrations: { givebutter: { apiKey: FAKE_KEY } } }), mongo: provider, scrypt: CHEAP_SCRYPT, write: logs.write, storage, donationProvider: new FakeDonationProvider() });
let appA: App, appB: App;
const tokens: Record<string, string> = {};
const bodies: string[] = [];
const call = async (app: App, path: string, init: RequestInit = {}) => {
  const res = await app.handle(new Request(`https://api.example${path}`, init), { clientIp: "203.0.113.90" });
  bodies.push(await res.clone().text());
  return res;
};
const send = (app: App, who: string, method: string, path: string, body?: unknown) =>
  call(app, path, { method, headers: { Origin: ADMIN, Cookie: `cms_session=${tokens[who]}`, ...(body !== undefined && { "Content-Type": "application/json" }) }, ...(body !== undefined && { body: JSON.stringify(body) }) });
let imageId = "";

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
  const png = fixture("sample.png");
  const intent = (await jsonOf(await send(appA, "ownerA", "POST", "/api/v1/media/upload-intents", { filename: "share.png", mimeType: "image/png", size: png.byteLength }))).data;
  storage.put(intent.objectKey, png, "image/png");
  await send(appA, "ownerA", "POST", `/api/v1/media/${intent.mediaId}/complete`);
  imageId = intent.mediaId;
  const audit = new AuditService(mongoAuditStore(mongo.db(), "org-a"), { orgId: "org-a", secret: "test-only-auth-secret-0123456789abcdef", log: silentLog });
  await new SettingsService(new MongoSettingsStore(mongo.db(), "org-a"), new MongoMediaStore(mongo.db(), "org-a"), audit, { orgId: "org-a" }).importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
});
after(async () => {
  await provider.close();
  await mongo.cleanup();
});

test("indexes: programs by id, address and order, organization-scoped", async () => {
  const indexes = await mongo.db().collection(COLLECTIONS.programs).indexes();
  assert.deepEqual(indexes.map((i) => i.name).sort(), ["_id_", ...INDEXES.programs.map((i) => i.name!)].sort());
  assert.deepEqual(indexes.filter((i) => i.unique).map((i) => i.name).sort(), ["orgId_id_unique", "orgId_slug_unique"]);
  await ensureIndexes(mongo.db());
});

test("no session → 401; a foreign Origin cannot write", async () => {
  for (const [method, path] of [["GET", "/api/v1/programs"], ["GET", "/api/v1/programs/x"], ["POST", "/api/v1/programs"], ["PATCH", "/api/v1/programs/x"], ["DELETE", "/api/v1/programs/x"], ["POST", "/api/v1/programs/order"]] as const)
    assert.equal((await call(appA, path, { method, headers: { Origin: ADMIN, "Content-Type": "application/json" }, ...(method === "POST" || method === "PATCH" ? { body: "{}" } : {}) })).status, 401, `${method} ${path}`);
  assert.equal((await call(appA, "/api/v1/programs", { method: "POST", headers: { Cookie: `cms_session=${tokens.ownerA}`, Origin: "https://evil.example", "Content-Type": "application/json" }, body: "{}" })).status, 403);
});

test("programs over HTTP: create at the end, reorder, conflicts, editors never approve, cross-org refused", async () => {
  const make = async (title: string, extra: Record<string, unknown> = {}) => (await jsonOf(await send(appA, "editorA", "POST", "/api/v1/programs", { title, icon: "education", description: "A test line.", ...extra }))).data;
  const a = await make("Test Area A", { why: ["A test paragraph."], activities: ["A test line."], seo: { ogImageId: imageId } });
  const b = await make("Test Area B", { icon: "health" });
  assert.deepEqual([a.record.order, b.record.order, a.record.status], [0, 1, "draft"]);
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/programs", { title: "Published by an editor", icon: "education", description: "x", status: "published" })).status, 400, "a new record starts as a draft");
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/programs", { title: "Bad", icon: "education", description: "x", html: "<script>alert(1)</script>" })).status, 400);
  const ordered = await send(appA, "editorA", "POST", "/api/v1/programs/order", { items: [{ id: b.record.id, revision: b.revision }, { id: a.record.id, revision: a.revision }] });
  assert.equal(ordered.status, 200);
  assert.deepEqual((await jsonOf(ordered)).data.map((v: { record: { title: string; order: number } }) => [v.record.title, v.record.order]), [["Test Area B", 0], ["Test Area A", 1]]);
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/programs/order", { items: [{ id: a.record.id, revision: a.revision }] })).status, 409, "stale revision");
  for (const v of [a, b]) {
    const fresh = (await jsonOf(await send(appA, "ownerA", "GET", `/api/v1/programs/${v.record.id}`))).data;
    assert.equal((await send(appA, "editorA", "PATCH", `/api/v1/programs/${v.record.id}`, { revision: fresh.revision, changes: { status: "published" } })).status, 400, "a save never changes the status");
    const submitted = await send(appA, "editorA", "POST", `/api/v1/programs/${v.record.id}/submit`, { revision: fresh.revision });
    assert.equal(submitted.status, 200);
    const next = (await jsonOf(submitted)).data;
    assert.equal(next.record.status, "submitted");
    assert.equal((await send(appA, "editorA", "POST", `/api/v1/programs/${v.record.id}/approve`, { revision: next.revision })).status, 403, "editors never approve");
    assert.equal((await send(appA, "ownerA", "POST", `/api/v1/programs/${v.record.id}/approve`, { revision: fresh.revision })).status, 409, "a stale approval");
    assert.equal((await send(appA, "ownerA", "POST", `/api/v1/programs/${v.record.id}/approve`, { revision: next.revision })).status, 200);
  }
  const stale = await send(appA, "editorA", "PATCH", `/api/v1/programs/${a.record.id}`, { revision: 1, changes: { description: "Stale." } });
  assert.equal(stale.status, 409);
  assert.equal((await send(appB, "ownerB", "GET", `/api/v1/programs/${a.record.id}`)).status, 404);
  assert.equal((await send(appB, "ownerB", "PATCH", `/api/v1/programs/${a.record.id}`, { revision: 1, changes: { title: "Taken" } })).status, 404);
  assert.equal((await send(appB, "ownerB", "POST", "/api/v1/programs/order", { items: [{ id: a.record.id, revision: 1 }] })).status, 404);
  assert.equal((await send(appB, "ownerB", "POST", "/api/v1/programs", { title: "B", icon: "education", description: "x", seo: { ogImageId: imageId } })).status, 400, "another organization's image");
  assert.equal((await make("Test Draft Area")).record.status, "draft");
  const actions = (await mongo.db().collection(COLLECTIONS.auditLogs).find({ orgId: "org-a", action: /^program\./ }).toArray()).map((e) => e.action);
  for (const action of ["program.created", "program.reordered", "program.submitted", "program.approved"]) assert.ok(actions.includes(action), action);
});

test("publish: the snapshot carries the published programs, in order, and nothing else", async () => {
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/publish")).status, 403);
  assert.equal((await send(appA, "ownerA", "POST", "/api/v1/publish")).status, 200);
  const snapshot = (await jsonOf(await call(appA, "/api/v1/public/snapshot"))).data;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.deepEqual(snapshot.content.programs.map((p: { title: string }) => p.title), ["Test Area B", "Test Area A"]);
  const text = JSON.stringify(snapshot);
  for (const leak of ["Test Draft Area", "Published by an editor", "_id", "revision", "updatedBy", "objectKey", FAKE_KEY, "editor@a.example"]) assert.ok(!text.includes(leak), `leaked: ${leak}`);
  assert.equal((await jsonOf(await call(appA, "/api/v1/public/snapshot?orgId=org-b", { headers: { "X-Organization-ID": "org-b" } }))).data.organization.id, "org-a");
});

test("secrets: the Givebutter key never appears in a response or a log line", () => {
  assert.ok(!bodies.join("\n").includes(FAKE_KEY));
  assert.ok(!logs.text().includes(FAKE_KEY));
});
