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

/* The site popup (M22) end to end over the test database: sessions, CSRF,
   RBAC, its index, a media-library photograph (ready, this organization's,
   described before review), revisions, the structure-only audit, and the
   published popup with its photograph in the public snapshot. Test records
   only. */

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
  const res = await app.handle(new Request(`https://api.example${path}`, init), { clientIp: "203.0.113.94" });
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


const WORDING = "Integration popup wording";
const popup = () => ({ key: "integration-popup", heading: "Integration heading.", body: WORDING, imageId, cta: { label: "See events", href: "/media/events" }, dismissLabel: "Not now", delayMs: 6000, frequency: "session", excludePaths: ["/contact"] });

test("index: one popup per organization", async () => {
  const indexes = await mongo.db().collection(COLLECTIONS.popups).indexes();
  assert.deepEqual(indexes.map((i) => i.name).sort(), ["_id_", "orgId_unique"]);
  assert.deepEqual(INDEXES.popups.map((i) => i.name), ["orgId_unique"]);
});

test("over HTTP: 401, CSRF, the website's rules, a described photograph before review, owners approve, org-scoped, audit without wording", async () => {
  assert.equal((await call(appA, "/api/v1/popup", { headers: { Origin: ADMIN } })).status, 401);
  assert.equal((await call(appA, "/api/v1/popup", { method: "PATCH", headers: { Cookie: `cms_session=${tokens.ownerA}`, Origin: "https://evil.example", "Content-Type": "application/json" }, body: JSON.stringify({ revision: 0, changes: popup() }) })).status, 403);
  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/popup", { revision: 0, changes: { ...popup(), cta: { label: "Go", href: "https://elsewhere.test" } } })).status, 400, "another site");
  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/popup", { revision: 0, changes: { ...popup(), startsAt: "2026-10-10T00:00:00Z" } })).status, 400, "a time window");
  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/popup", { revision: 0, changes: popup() })).status, 200);
  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/popup", { revision: 0, changes: { body: "Stale." } })).status, 409);
  const refused = await send(appA, "editorA", "POST", "/api/v1/popup/submit", { revision: 1 });
  assert.equal(refused.status, 400, "the photograph has no alt text yet");
  assert.ok(JSON.stringify(await jsonOf(refused)).includes("alt text"));
  const item = (await jsonOf(await send(appA, "ownerA", "GET", `/api/v1/media/${imageId}`))).data;
  assert.equal((await send(appA, "ownerA", "PATCH", `/api/v1/media/${imageId}`, { version: item.version, alt: "Two people at a market stall" })).status, 200);
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/popup/submit", { revision: 1 })).status, 200);
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/popup/approve", { revision: 2 })).status, 403);
  await approveOverHttp((method, p, body) => send(appA, "ownerA", method, p, body), "/api/v1/popup");
  assert.equal((await jsonOf(await send(appB, "ownerB", "GET", "/api/v1/popup"))).data.record, null);
  assert.equal((await send(appB, "ownerB", "PATCH", "/api/v1/popup", { revision: 0, changes: popup() })).status, 400, "another organization's photograph");
  const trail = await mongo.db().collection(COLLECTIONS.auditLogs).find({ orgId: "org-a", resourceType: "popup" }).toArray();
  for (const action of ["popup.created", "popup.submitted", "popup.approved"]) assert.ok(trail.some((e) => e.action === action), action);
  assert.ok(!JSON.stringify(trail).includes(WORDING));
});

test("publish: the published popup and its described photograph; nothing internal", async () => {
  assert.equal((await send(appA, "ownerA", "POST", "/api/v1/publish")).status, 200);
  const snapshot = (await jsonOf(await call(appA, "/api/v1/public/snapshot"))).data;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.deepEqual([snapshot.content.popup.key, snapshot.content.popup.body, snapshot.media[imageId].alt], ["integration-popup", WORDING, "Two people at a market stall"]);
  for (const leak of ["_id", "revision", "updatedBy", "objectKey", FAKE_KEY]) assert.ok(!JSON.stringify(snapshot).includes(leak), leak);
});
