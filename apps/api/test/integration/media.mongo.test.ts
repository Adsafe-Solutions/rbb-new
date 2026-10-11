import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createApp, type App } from "../../src/app.ts";
import { COLLECTIONS, ensureIndexes } from "../../src/db/collections.ts";
import { createMongoProvider } from "../../src/db/mongo.ts";
import { mongoAuthStores } from "../../src/modules/auth/repository.ts";
import { MongoMediaStore } from "../../src/modules/media/repository.ts";
import { CHEAP_SCRYPT, addMember } from "../auth/memory.ts";
import { captureLogs, jsonOf, testConfig } from "../helpers.ts";
import { MemoryStorage, fixture } from "../media/memory.ts";
import { testMongo } from "./mongo.ts";

/* The media routes end to end over the test database: real sessions,
   CSRF, RBAC, the real repository and indexes, two organizations in ONE
   database. Storage is the in-memory double (no R2 here — see
   test/live/r2.live.test.ts). */

const mongo = testMongo();
const provider = createMongoProvider({ uri: mongo.uri, dbName: mongo.dbName });
const ADMIN = "https://admin.example";
const PASSWORD = "a correct long password";
const png = fixture("sample.png");
const logs = captureLogs();

const appFor = (orgId: string, storage: MemoryStorage | null): App =>
  createApp({ config: testConfig({ orgId, mongo: { uri: mongo.uri, dbName: mongo.dbName } }), mongo: provider, scrypt: CHEAP_SCRYPT, write: logs.write, storage });

const storageA = new MemoryStorage();
const storageB = new MemoryStorage();
let appA: App, appB: App;
const call = (app: App, path: string, init: RequestInit = {}) => app.handle(new Request(`https://api.example${path}`, init), { clientIp: "203.0.113.30" });
const tokens: Record<string, string> = {};

async function login(app: App, email: string) {
  const res = await call(app, "/api/v1/auth/login", { method: "POST", headers: { Origin: ADMIN, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) });
  assert.equal(res.status, 200, email);
  return /cms_session=([^;]*)/.exec(res.headers.get("set-cookie") ?? "")![1]!;
}
const as = (who: string, init: RequestInit = {}) => ({ ...init, headers: { Origin: ADMIN, Cookie: `cms_session=${tokens[who]}`, ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers as Record<string, string>) } });
const post = (who: string, body?: unknown) => as(who, { method: "POST", ...(body !== undefined && { body: JSON.stringify(body) }) });

async function upload(app: App, storage: MemoryStorage, who: string, filename = "photo.png") {
  const intent = (await jsonOf(await call(app, "/api/v1/media/upload-intents", post(who, { filename, mimeType: "image/png", size: png.byteLength })))).data;
  storage.put(intent.objectKey, png, "image/png");
  const done = await call(app, `/api/v1/media/${intent.mediaId}/complete`, post(who));
  assert.equal(done.status, 200);
  return (await jsonOf(done)).data;
}

before(async () => {
  await mongo.connect();
  await ensureIndexes(mongo.db());
  appA = appFor("org-a", storageA);
  appB = appFor("org-b", storageB);
  for (const [orgId, email, role] of [["org-a", "owner@a.example", "OWNER"], ["org-a", "editor@a.example", "EDITOR"], ["org-b", "owner@b.example", "OWNER"]] as const)
    await addMember(mongoAuthStores(mongo.db(), orgId), { orgId, email, password: PASSWORD, role });
  tokens.ownerA = await login(appA, "owner@a.example");
  tokens.editorA = await login(appA, "editor@a.example");
  tokens.ownerB = await login(appB, "owner@b.example");
});
after(async () => {
  await provider.close();
  await mongo.cleanup();
});

test("indexes: media has its org-scoped unique and list indexes", async () => {
  const names = (await mongo.db().collection(COLLECTIONS.media).indexes()).map((i) => i.name);
  for (const name of ["orgId_id_unique", "orgId_objectKey_unique", "orgId_status_createdAt_id", "orgId_objectState"]) assert.ok(names.includes(name), name);
  const unique = (await mongo.db().collection(COLLECTIONS.media).indexes()).filter((i) => i.unique).map((i) => i.name).sort();
  assert.deepEqual(unique, ["orgId_id_unique", "orgId_objectKey_unique"]);
});

test("no session → 401; no allowed Origin on a change → 403; both roles may upload, edit and delete", async () => {
  assert.equal((await call(appA, "/api/v1/media")).status, 401);
  assert.equal((await call(appA, "/api/v1/media/upload-intents", { method: "POST", headers: { Origin: ADMIN, "Content-Type": "application/json" }, body: "{}" })).status, 401);
  const csrf = await call(appA, "/api/v1/media/upload-intents", { method: "POST", headers: { Cookie: `cms_session=${tokens.ownerA}`, Origin: "https://evil.example", "Content-Type": "application/json" }, body: JSON.stringify({ filename: "x.png", mimeType: "image/png", size: 10 }) });
  assert.equal(csrf.status, 403);

  for (const who of ["ownerA", "editorA"]) {
    const media = await upload(appA, storageA, who, `${who}.png`);
    const patched = await call(appA, `/api/v1/media/${media.id}`, as(who, { method: "PATCH", body: JSON.stringify({ version: media.version, alt: "A flat blue test image" }) }));
    assert.equal(patched.status, 200, who);
    const removed = await call(appA, `/api/v1/media/${media.id}`, as(who, { method: "DELETE" }));
    assert.equal(removed.status, 200, who);
    assert.deepEqual((await jsonOf(removed)).data, { deleted: true, storage: "removed" });
  }
  const policy = (await jsonOf(await call(appA, "/api/v1/media/policy", as("editorA")))).data;
  assert.deepEqual(policy.mimeTypes, ["image/jpeg", "image/png", "image/webp", "image/avif"]);
});

test("full lifecycle over HTTP, persisted in MongoDB", async () => {
  const intentRes = await call(appA, "/api/v1/media/upload-intents", post("ownerA", { filename: "Field Visit.png", mimeType: "image/png", size: png.byteLength }));
  assert.equal(intentRes.status, 201);
  const intent = (await jsonOf(intentRes)).data;
  assert.deepEqual(Object.keys(intent).sort(), ["expiresAt", "media", "mediaId", "objectKey", "uploadHeaders", "uploadMethod", "uploadUrl"]);
  assert.equal(intent.media.status, "pending");

  // Completing before the bytes arrive: still pending.
  assert.equal((await call(appA, `/api/v1/media/${intent.mediaId}/complete`, post("ownerA"))).status, 409);
  storageA.put(intent.objectKey, png, "image/png");
  const ready = (await jsonOf(await call(appA, `/api/v1/media/${intent.mediaId}/complete`, post("ownerA")))).data;
  assert.equal(ready.status, "ready");
  assert.equal(ready.publicUrl, `https://media.test/${intent.objectKey}`);
  assert.equal((await call(appA, `/api/v1/media/${intent.mediaId}/complete`, post("ownerA"))).status, 200, "idempotent");

  const stored = await mongo.db().collection(COLLECTIONS.media).findOne({ id: intent.mediaId });
  assert.equal(stored?.orgId, "org-a");
  assert.ok(stored?.createdAt instanceof Date && stored?.completedAt instanceof Date, "timestamps are BSON dates");
  assert.equal(stored?.schemaVersion, 1);

  const got = await jsonOf(await call(appA, `/api/v1/media/${intent.mediaId}`, as("editorA")));
  assert.equal(got.data.id, intent.mediaId);
  assert.ok(!("orgId" in got.data), "the organization is implicit, not data");
  assert.ok(!JSON.stringify(got).includes("X-Amz"), "no signed URL in a record");

  const stale = await call(appA, `/api/v1/media/${intent.mediaId}`, as("ownerA", { method: "PATCH", body: JSON.stringify({ version: 1, alt: "x" }) }));
  assert.equal(stale.status, 409);
  const sneaky = await call(appA, `/api/v1/media/${intent.mediaId}`, as("ownerA", { method: "PATCH", body: JSON.stringify({ version: ready.version, objectKey: "org-b/x" }) }));
  assert.equal(sneaky.status, 400);
});

test("list over MongoDB: pagination, search, filter; deleted never listed", async () => {
  for (const name of ["one.png", "two.png", "three.png"]) await upload(appA, storageA, "ownerA", name);
  const pending = (await jsonOf(await call(appA, "/api/v1/media/upload-intents", post("ownerA", { filename: "four.png", mimeType: "image/png", size: png.byteLength })))).data;
  const all = await jsonOf(await call(appA, "/api/v1/media?pageSize=2", as("ownerA")));
  assert.equal(all.data.length, 2);
  assert.equal(all.pagination.pageSize, 2);
  assert.ok(all.pagination.total >= 5);
  assert.equal(all.data[0].id, pending.mediaId, "newest first");
  const search = await jsonOf(await call(appA, "/api/v1/media?search=TWO", as("ownerA")));
  assert.deepEqual(search.data.map((m: { originalFilename: string }) => m.originalFilename), ["two.png"]);
  const pendingOnly = await jsonOf(await call(appA, "/api/v1/media?status=pending", as("ownerA")));
  assert.ok(pendingOnly.data.every((m: { status: string }) => m.status === "pending"));
  const regex = await call(appA, `/api/v1/media?search=${encodeURIComponent(".*")}`, as("ownerA"));
  assert.equal((await jsonOf(regex)).data.length, 0, "search text is literal, not a pattern");
  assert.equal((await call(appA, "/api/v1/media?status=deleted", as("ownerA"))).status, 400);
  const everything = await new MongoMediaStore(mongo.db(), "org-a").list({ sort: "newest", page: 1, pageSize: 100 });
  assert.ok(everything.items.every((m) => m.status !== "deleted"));
});

test("organization isolation: org B cannot list, read, change, complete or delete org A's media", async () => {
  const aMedia = await upload(appA, storageA, "ownerA", "private-to-a.png");
  const bList = await jsonOf(await call(appB, "/api/v1/media?pageSize=100", as("ownerB")));
  assert.ok(!bList.data.some((m: { id: string }) => m.id === aMedia.id));
  assert.equal((await call(appB, `/api/v1/media/${aMedia.id}`, as("ownerB"))).status, 404);
  assert.equal((await call(appB, `/api/v1/media/${aMedia.id}`, as("ownerB", { method: "PATCH", body: JSON.stringify({ version: aMedia.version, alt: "hijack" }) }))).status, 404);
  assert.equal((await call(appB, `/api/v1/media/${aMedia.id}/complete`, post("ownerB"))).status, 404);
  assert.equal((await call(appB, `/api/v1/media/${aMedia.id}`, as("ownerB", { method: "DELETE" }))).status, 404);
  // An org-B session presented to org A's deployment is not a session there.
  assert.equal((await call(appA, `/api/v1/media/${aMedia.id}`, as("ownerB"))).status, 401);
  // An orgId in the body is refused, not obeyed.
  assert.equal((await call(appB, "/api/v1/media/upload-intents", post("ownerB", { filename: "x.png", mimeType: "image/png", size: 10, orgId: "org-a" }))).status, 400);
  const after = await mongo.db().collection(COLLECTIONS.media).findOne({ id: aMedia.id });
  assert.equal(after?.status, "ready");
  assert.equal(after?.alt, "");
});

test("audit: media actions recorded with actor, org, request id — never a URL or credential", async () => {
  const entries = await mongo.db().collection(COLLECTIONS.auditLogs).find({ orgId: "org-a", resourceType: "media" }).toArray();
  const actions = new Set(entries.map((e) => e.action));
  for (const action of ["media.upload_intent", "media.upload_completed", "media.metadata_updated", "media.deleted"]) assert.ok(actions.has(action), action);
  for (const entry of entries) {
    assert.ok(entry.actorUserId);
    assert.ok(entry.requestId);
    assert.ok(entry.resourceId);
  }
  const text = JSON.stringify(entries) + logs.text();
  assert.ok(!text.includes("X-Amz-Signature=deadbeef") && !text.includes("storage.test/"), "presigned URLs are neither audited nor logged");
});

test("storage not configured: media routes answer 503, nothing half-made", async () => {
  const appNone = appFor("org-a", null);
  const res = await call(appNone, "/api/v1/media/upload-intents", post("ownerA", { filename: "x.png", mimeType: "image/png", size: png.byteLength }));
  assert.equal(res.status, 503);
  assert.equal((await jsonOf(res)).error.message, "Media storage is not configured.");
});
