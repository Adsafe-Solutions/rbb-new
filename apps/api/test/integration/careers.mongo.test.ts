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

/* Careers (M13) end to end over the test database: sessions, CSRF,
   RBAC, its index, two organizations in one database, revisions, and the
   Careers page in the public snapshot. Test records only. The configured
   Givebutter key is a made-up string that must appear nowhere. */

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


const page = { title: "Test careers", intro: "A test intro.", opportunities: { heading: "Open", empty: "None.", roles: [{ title: "Test role" }] }, closing: { heading: "Explore.", primary: { label: "About Us", href: "/about" } } };

test("index: one Careers page per organization — and nothing speculative", async () => {
  const indexes = await mongo.db().collection(COLLECTIONS.careersPages).indexes();
  assert.deepEqual(indexes.map((i) => i.name).sort(), ["_id_", ...INDEXES.careersPages.map((i) => i.name!)].sort());
  assert.deepEqual(INDEXES.careersPages.map((i) => i.name), ["orgId_unique"]);
  assert.ok(indexes.find((i) => i.name === "orgId_unique")!.unique);
  await ensureIndexes(mongo.db());
});

test("no session → 401; a foreign Origin cannot write", async () => {
  for (const method of ["GET", "POST", "PATCH", "DELETE"] as const)
    assert.equal((await call(appA, "/api/v1/careers", { method, headers: { Origin: ADMIN, "Content-Type": "application/json" }, ...(method === "POST" || method === "PATCH" ? { body: "{}" } : {}) })).status, 401, method);
  assert.equal((await call(appA, "/api/v1/careers", { method: "POST", headers: { Cookie: `cms_session=${tokens.ownerA}`, Origin: "https://evil.example", "Content-Type": "application/json" }, body: "{}" })).status, 403);
});

test("careers over HTTP: one per organization, revisions, editors never approve, org-scoped", async () => {
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/careers", { ...page, opportunities: { ...page.opportunities, roles: [{ title: "R", applicationUrl: "https://jobs.example.org" }] } })).status, 400);
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/careers", { ...page, seo: { ogImageId: imageId } })).status, 400, "no share image: the page has none");
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/careers", page)).status, 201);
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/careers", page)).status, 409);
  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/careers", { revision: 1, changes: { status: "published" } })).status, 400);
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/careers/submit", { revision: 1 })).status, 200);
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/careers/approve", { revision: 2 })).status, 403);
  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/careers", { revision: 2, changes: { title: "Under review" } })).status, 409, "a submitted page is locked");
  await approveOverHttp((method, path, body) => send(appA, "ownerA", method, path, body), "/api/v1/careers");
  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/careers", { revision: 1, changes: { title: "Stale" } })).status, 409);
  assert.equal((await jsonOf(await send(appB, "ownerB", "GET", "/api/v1/careers"))).data.record, null);
  const actions = (await mongo.db().collection(COLLECTIONS.auditLogs).find({ orgId: "org-a", action: /^careers\./ }).toArray()).map((e) => e.action);
  for (const action of ["careers.created", "careers.submitted", "careers.approved"]) assert.ok(actions.includes(action), action);
});

test("publish: the published Careers page, and nothing internal", async () => {
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/publish")).status, 403);
  assert.equal((await send(appA, "ownerA", "POST", "/api/v1/publish")).status, 200);
  const snapshot = (await jsonOf(await call(appA, "/api/v1/public/snapshot"))).data;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.deepEqual(snapshot.content.careers.opportunities.roles, [{ title: "Test role" }]);
  const text = JSON.stringify(snapshot);
  for (const leak of ["_id", "revision", "updatedBy", "objectKey", FAKE_KEY, "editor@a.example"]) assert.ok(!text.includes(leak), `leaked: ${leak}`);
});

test("secrets: the Givebutter key never appears in a response or a log line", () => {
  assert.ok(!bodies.join("\n").includes(FAKE_KEY));
  assert.ok(!logs.text().includes(FAKE_KEY));
});
