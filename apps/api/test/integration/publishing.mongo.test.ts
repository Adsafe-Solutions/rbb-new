import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PublishedSnapshot } from "@rbb/content-schema";
import { createApp, type App } from "../../src/app.ts";
import { COLLECTIONS, ensureIndexes } from "../../src/db/collections.ts";
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
import { testMongo } from "./mongo.ts";

/* Settings, publishing and the public snapshot end to end over the
   test database: real sessions, CSRF, RBAC, the Mongo stores and
   indexes, two organizations in ONE database. */

const mongo = testMongo();
const provider = createMongoProvider({ uri: mongo.uri, dbName: mongo.dbName });
const ADMIN = "https://admin.example";
const PASSWORD = "a correct long password";
const logs = captureLogs();
const storage = new MemoryStorage();
const appFor = (orgId: string): App => createApp({ config: testConfig({ orgId, mongo: { uri: mongo.uri, dbName: mongo.dbName } }), mongo: provider, scrypt: CHEAP_SCRYPT, write: logs.write, storage });
let appA: App, appB: App;
const tokens: Record<string, string> = {};
const call = (app: App, path: string, init: RequestInit = {}) => app.handle(new Request(`https://api.example${path}`, init), { clientIp: "203.0.113.40" });
const as = (who: string, init: RequestInit = {}) => ({ ...init, headers: { Origin: ADMIN, Cookie: `cms_session=${tokens[who]}`, ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers as Record<string, string>) } });
const patch = (who: string, body: unknown) => as(who, { method: "PATCH", body: JSON.stringify(body) });
const publish = (app: App, who: string) => call(app, "/api/v1/publish", as(who, { method: "POST" }));
const settingsOf = async (app: App, who: string) => (await jsonOf(await call(app, "/api/v1/settings", as(who)))).data;

async function login(app: App, email: string) {
  const res = await call(app, "/api/v1/auth/login", { method: "POST", headers: { Origin: ADMIN, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) });
  return /cms_session=([^;]*)/.exec(res.headers.get("set-cookie") ?? "")![1]!;
}

before(async () => {
  await mongo.connect();
  await ensureIndexes(mongo.db());
  appA = appFor("org-a");
  appB = appFor("org-b");
  for (const [orgId, email, role] of [["org-a", "owner@a.example", "OWNER"], ["org-a", "editor@a.example", "EDITOR"], ["org-b", "owner@b.example", "OWNER"]] as const)
    await addMember(mongoAuthStores(mongo.db(), orgId), { orgId, email, password: PASSWORD, role, name: email.split("@")[0]! });
  tokens.ownerA = await login(appA, "owner@a.example");
  tokens.editorA = await login(appA, "editor@a.example");
  tokens.ownerB = await login(appB, "owner@b.example");
});
after(async () => {
  await provider.close();
  await mongo.cleanup();
});

test("indexes: one settings record and one publish state per organization; one snapshot per version", async () => {
  const unique = async (name: string) => (await mongo.db().collection(name).indexes()).filter((i) => i.unique).map((i) => i.name);
  assert.deepEqual(await unique(COLLECTIONS.siteSettings), ["orgId_unique"]);
  assert.deepEqual(await unique(COLLECTIONS.publishState), ["orgId_unique"]);
  assert.deepEqual(await unique(COLLECTIONS.publishedSnapshots), ["orgId_version_unique"]);
});

test("before anything is imported or published", async () => {
  assert.equal(await settingsOf(appA, "ownerA"), null);
  const res = await call(appA, "/api/v1/public/snapshot");
  assert.equal(res.status, 404);
  assert.equal((await jsonOf(res)).error.code, "NOT_FOUND");
  assert.equal((await publish(appA, "ownerA")).status, 409);
});

test("import, then RBAC: editors read, owners write and publish", async () => {
  const audit = new AuditService(mongoAuditStore(mongo.db(), "org-a"), { orgId: "org-a", secret: "test-only-auth-secret-0123456789abcdef", log: silentLog });
  const service = new SettingsService(new MongoSettingsStore(mongo.db(), "org-a"), new MongoMediaStore(mongo.db(), "org-a"), audit, { orgId: "org-a" });
  assert.equal((await service.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" })).created, true);

  assert.equal((await call(appA, "/api/v1/settings")).status, 401);
  const asEditor = await settingsOf(appA, "editorA");
  assert.equal(asEditor.settings.general.name, "Test Organization");
  const changes = { general: { ...asEditor.settings.general, summary: "Edited." } };
  assert.equal((await call(appA, "/api/v1/settings", patch("editorA", { revision: 1, changes }))).status, 403, "editors cannot change settings");
  assert.equal((await publish(appA, "editorA")).status, 403, "editors cannot publish");
  const status = (await jsonOf(await call(appA, "/api/v1/publish/status", as("editorA")))).data;
  assert.equal(status.canPublish, false);
  assert.equal(status.hasUnpublishedChanges, true);

  const csrf = await call(appA, "/api/v1/settings", { method: "PATCH", headers: { Cookie: `cms_session=${tokens.ownerA}`, Origin: "https://evil.example", "Content-Type": "application/json" }, body: JSON.stringify({ revision: 1, changes }) });
  assert.equal(csrf.status, 403);
  const saved = await call(appA, "/api/v1/settings", patch("ownerA", { revision: 1, changes }));
  assert.equal(saved.status, 200);
  assert.equal((await jsonOf(saved)).data.revision, 2);
  const stale = await call(appA, "/api/v1/settings", patch("ownerA", { revision: 1, changes }));
  assert.equal(stale.status, 409);
  assert.equal((await jsonOf(stale)).error.message, "These settings were changed elsewhere. Reload the latest version before saving.");
});

test("publish → the public snapshot: versioned, cache-friendly, contract-valid", async () => {
  const res = await publish(appA, "ownerA");
  assert.equal(res.status, 200);
  assert.deepEqual((await jsonOf(res)).data.deployment, { status: "not-configured" });

  const current = await call(appA, "/api/v1/public/snapshot");
  assert.equal(current.status, 200);
  assert.equal(current.headers.get("cache-control"), "no-cache");
  assert.equal(current.headers.get("etag"), '"snapshot-v1"');
  assert.equal(current.headers.get("x-snapshot-version"), "1");
  const body = await jsonOf(current);
  assert.deepEqual(Object.keys(body), ["data"]);
  assert.ok(PublishedSnapshot.safeParse(body.data).success);
  assert.equal(body.data.settings.general.summary, "Edited.");

  const unchanged = await call(appA, "/api/v1/public/snapshot", { headers: { "If-None-Match": '"snapshot-v1"' } });
  assert.equal(unchanged.status, 304, "an unchanged snapshot costs a 304");
  const pinned = await call(appA, "/api/v1/public/snapshot/1");
  assert.equal(pinned.headers.get("cache-control"), "public, max-age=31536000, immutable");
  assert.equal((await call(appA, "/api/v1/public/snapshot/2")).status, 404);
  assert.equal((await call(appA, "/api/v1/public/snapshot/abc")).status, 404);
  assert.equal((await call(appA, "/api/v1/public/snapshot", { method: "POST", headers: { Origin: ADMIN } })).status, 405, "read-only");
});

test("the public endpoint cannot be pointed at another organization", async () => {
  // Org B publishes its own settings.
  const audit = new AuditService(mongoAuditStore(mongo.db(), "org-b"), { orgId: "org-b", secret: "test-only-auth-secret-0123456789abcdef", log: silentLog });
  await new SettingsService(new MongoSettingsStore(mongo.db(), "org-b"), new MongoMediaStore(mongo.db(), "org-b"), audit, { orgId: "org-b" }).importInitial(
    { ...settingsRecord("org-b"), general: { shortName: "ORGB", name: "Organization B", summary: "Org B." } },
    { id: null, name: "Settings import" }
  );
  assert.equal((await publish(appB, "ownerB")).status, 200);

  for (const [path, headers] of [
    ["/api/v1/public/snapshot?orgId=org-b", {}],
    ["/api/v1/public/snapshot?organization=org-b", {}],
    ["/api/v1/public/snapshot", { "X-Organization-ID": "org-b" }],
    ["/api/v1/public/snapshot", { "X-Org-Id": "org-b", Cookie: `cms_session=${tokens.ownerB}` }],
  ] as const) {
    const data = (await jsonOf(await call(appA, path, { headers }))).data;
    assert.equal(data.organization.id, "org-a", path);
    assert.equal(data.settings.general.shortName, "TEST");
  }
  assert.equal((await jsonOf(await call(appB, "/api/v1/public/snapshot"))).data.organization.id, "org-b");
  // An org-B owner cannot change or publish org A.
  assert.equal((await call(appA, "/api/v1/settings", patch("ownerB", { revision: 2, changes: {} }))).status, 401);
  assert.equal((await publish(appA, "ownerB")).status, 401);
});

test("leakage: drafts, users, sessions, audit, credentials and private media never reach the public snapshot", async () => {
  // A ready logo (referenced), a ready unreferenced image, a pending upload.
  const intent = async (filename: string) =>
    (await jsonOf(await call(appA, "/api/v1/media/upload-intents", as("ownerA", { method: "POST", body: JSON.stringify({ filename, mimeType: "image/png", size: fixture("sample.png").byteLength }) })))).data;
  const logo = await intent("logo-mark.png");
  storage.put(logo.objectKey, fixture("sample.png"), "image/png");
  await call(appA, `/api/v1/media/${logo.mediaId}/complete`, as("ownerA", { method: "POST" }));
  const other = await intent("private-unreferenced.png");
  storage.put(other.objectKey, fixture("sample.png"), "image/png");
  await call(appA, `/api/v1/media/${other.mediaId}/complete`, as("ownerA", { method: "POST" }));
  const pending = await intent("pending-upload.png");

  const current = await settingsOf(appA, "ownerA");
  assert.equal((await call(appA, "/api/v1/settings", patch("ownerA", { revision: current.revision, changes: { seo: { ...current.settings.seo, ogImageId: pending.mediaId } } }))).status, 400, "pending media cannot be referenced");
  assert.equal((await call(appA, "/api/v1/settings", patch("ownerA", { revision: current.revision, changes: { seo: { ...current.settings.seo, ogImageId: logo.mediaId } } }))).status, 200);
  assert.equal((await publish(appA, "ownerA")).status, 200);

  // A later DRAFT edit that is never published.
  const draft = await settingsOf(appA, "ownerA");
  await call(appA, "/api/v1/settings", patch("ownerA", { revision: draft.revision, changes: { general: { ...draft.settings.general, summary: "UNPUBLISHED DRAFT TEXT" } } }));

  const snapshot = (await jsonOf(await call(appA, "/api/v1/public/snapshot"))).data;
  assert.equal(snapshot.version, 2);
  assert.deepEqual(Object.keys(snapshot.media), [logo.mediaId]);
  const text = JSON.stringify(snapshot);
  for (const leak of [
    "UNPUBLISHED DRAFT TEXT",
    "owner@a.example",
    "editor@a.example",
    "passwordHash",
    "scrypt",
    tokens.ownerA,
    "tokenHash",
    "cms_session",
    "audit",
    // (The logo's public URL is its key's path on the PUBLIC domain — that is
    // public by definition; the storage field itself must not appear.)
    "objectKey",
    "objectState",
    other.mediaId,
    pending.mediaId,
    "private-unreferenced",
    "test-only-auth-secret",
    "X-Amz",
    "Organization B",
    "revision",
    "updatedBy",
    "_id",
  ])
    assert.ok(!text.includes(leak), `leaked: ${leak}`);
});

test("a publish that fails validation changes nothing public", async () => {
  // M16: the media library refuses to delete a logo the settings use (409).
  const current = await settingsOf(appA, "ownerA");
  const logoId = current.settings.seo.ogImageId;
  const refused = await call(appA, `/api/v1/media/${logoId}`, as("ownerA", { method: "DELETE" }));
  assert.equal(refused.status, 409);
  assert.ok((await jsonOf(refused)).error.details.some((d: { message: string }) => d.message === "Site settings"));
  // The logo becomes unusable anyway (as if removed outside the API), then publish → refused.
  await mongo.db().collection(COLLECTIONS.media).updateOne({ orgId: "org-a", id: logoId }, { $set: { status: "deleted", publicUrl: null } });
  const res = await publish(appA, "ownerA");
  assert.equal(res.status, 400);
  assert.ok((await jsonOf(res)).error.details.some((d: { path: string }) => d.path.includes(logoId)));
  assert.equal((await jsonOf(await call(appA, "/api/v1/public/snapshot"))).data.version, 2, "still the previous version");
  const state = await mongo.db().collection(COLLECTIONS.publishState).findOne({ orgId: "org-a" });
  assert.equal(state?.lockId, null, "lock released");
});

test("audit: settings.updated with field names; publish.completed with versions", async () => {
  const entries = await mongo.db().collection(COLLECTIONS.auditLogs).find({ orgId: "org-a", resourceType: { $in: ["settings", "snapshot"] } }).toArray();
  const updated = entries.filter((e) => e.action === "settings.updated");
  assert.ok(updated.length >= 2);
  assert.ok(updated.every((e) => Array.isArray(e.metadata.fields) && e.actorUserId && e.requestId));
  assert.ok(updated.some((e) => e.metadata.fields.includes("seo.ogImageId")));
  const published = entries.filter((e) => e.action === "publish.completed").map((e) => e.metadata.version);
  assert.deepEqual(published.sort(), [1, 2]);
  assert.ok(entries.some((e) => e.action === "publish.rejected"));
  assert.ok(!JSON.stringify(entries).includes("UNPUBLISHED DRAFT TEXT"), "values never in the audit trail");
});
