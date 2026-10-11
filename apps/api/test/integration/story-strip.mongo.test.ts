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
import { approveOverHttp } from "./workflow.ts";

/* Highlights — the story strip (M23) end to end over the test database:
   sessions, CSRF, RBAC, its index, references to this organization's
   appeals (approved before the strip), revisions, the structure-only
   audit, and the published strip with its appeals in the public snapshot.
   Test records only. */

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
  const res = await app.handle(new Request(`https://api.example${path}`, init), { clientIp: "203.0.113.95" });
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


let order: string[] = [];
const appeal = async (title: string) => (await jsonOf(await send(appA, "ownerA", "POST", "/api/v1/appeals", { kind: "campaign", title, summary: "S.", imageId }))).data.record as { id: string };

test("index: one strip per organization", async () => {
  const indexes = await mongo.db().collection(COLLECTIONS.storyStrips).indexes();
  assert.deepEqual(indexes.map((i) => i.name).sort(), ["_id_", "orgId_unique"]);
  assert.deepEqual(INDEXES.storyStrips.map((i) => i.name), ["orgId_unique"]);
});

test("over HTTP: 401, CSRF, this organization's appeals only, approved before review, owners approve, audit", async () => {
  const item = (await jsonOf(await send(appA, "ownerA", "GET", `/api/v1/media/${imageId}`))).data;
  await send(appA, "ownerA", "PATCH", `/api/v1/media/${imageId}`, { version: item.version, alt: "A photo" });
  const a = await appeal("Integration appeal A");
  const b = await appeal("Integration appeal B");
  assert.equal((await call(appA, "/api/v1/story-strip", { headers: { Origin: ADMIN } })).status, 401);
  assert.equal((await call(appA, "/api/v1/story-strip", { method: "PATCH", headers: { Cookie: `cms_session=${tokens.ownerA}`, Origin: "https://evil.example", "Content-Type": "application/json" }, body: JSON.stringify({ revision: 0, changes: { appealIds: [a.id] } }) })).status, 403);
  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/story-strip", { revision: 0, changes: { appealIds: ["not-an-appeal"] } })).status, 400);
  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/story-strip", { revision: 0, changes: { appealIds: [b.id, a.id] } })).status, 200);
  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/story-strip", { revision: 0, changes: { appealIds: [] } })).status, 409);
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/story-strip/submit", { revision: 1 })).status, 400, "its appeals are not approved yet");
  for (const id of [a.id, b.id]) await approveOverHttp((method, p, body) => send(appA, "ownerA", method, p, body), `/api/v1/appeals/${id}`);
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/story-strip/submit", { revision: 1 })).status, 200);
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/story-strip/approve", { revision: 2 })).status, 403);
  await approveOverHttp((method, p, body) => send(appA, "ownerA", method, p, body), "/api/v1/story-strip");
  assert.equal((await send(appB, "ownerB", "PATCH", "/api/v1/story-strip", { revision: 0, changes: { appealIds: [a.id] } })).status, 400, "another organization's appeal does not exist there");
  assert.equal((await jsonOf(await send(appB, "ownerB", "GET", "/api/v1/story-strip"))).data.record, null);
  const trail = await mongo.db().collection(COLLECTIONS.auditLogs).find({ orgId: "org-a", resourceType: "story_strip" }).toArray();
  for (const action of ["story_strip.created", "story_strip.submitted", "story_strip.approved"]) assert.ok(trail.some((e) => e.action === action), action);
  order = [b.id, a.id];
});

test("publish: the strip in its order, its appeals published with it; nothing internal", async () => {
  assert.equal((await send(appA, "ownerA", "POST", "/api/v1/publish")).status, 200);
  const snapshot = (await jsonOf(await call(appA, "/api/v1/public/snapshot"))).data;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.deepEqual(snapshot.content.storyStrip.appealIds, order);
  assert.ok(order.every((id: string) => snapshot.content.appeals.some((x: { id: string; status: string }) => x.id === id && x.status === "published")));
  for (const leak of ["_id", "revision", "updatedBy", FAKE_KEY]) assert.ok(!JSON.stringify(snapshot.content.storyStrip).includes(leak), leak);
});
