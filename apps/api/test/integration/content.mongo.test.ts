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
import { approveOverHttp } from "./workflow.ts";

/* Posts and events end to end over the test database: sessions, CSRF,
   RBAC, the real stores and unique indexes, two organizations in one
   database, and publishing them into the public snapshot. */

const mongo = testMongo();
const provider = createMongoProvider({ uri: mongo.uri, dbName: mongo.dbName });
const ADMIN = "https://admin.example";
const PASSWORD = "a correct long password";
const storage = new MemoryStorage();
const appFor = (orgId: string): App => createApp({ config: testConfig({ orgId, mongo: { uri: mongo.uri, dbName: mongo.dbName } }), mongo: provider, scrypt: CHEAP_SCRYPT, write: captureLogs().write, storage });
let appA: App, appB: App;
const tokens: Record<string, string> = {};
const call = (app: App, path: string, init: RequestInit = {}) => app.handle(new Request(`https://api.example${path}`, init), { clientIp: "203.0.113.50" });
const as = (who: string, init: RequestInit = {}) => ({ ...init, headers: { Origin: ADMIN, Cookie: `cms_session=${tokens[who]}`, ...(init.body ? { "Content-Type": "application/json" } : {}) } });
const send = (app: App, who: string, method: string, path: string, body?: unknown) => call(app, path, as(who, { method, ...(body !== undefined && { body: JSON.stringify(body) }) }));
const body = [{ type: "paragraph", children: [{ type: "text", text: "A test paragraph." }] }];
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
  // A ready image in org A's library.
  const png = fixture("sample.png");
  const intent = (await jsonOf(await send(appA, "ownerA", "POST", "/api/v1/media/upload-intents", { filename: "test-image.png", mimeType: "image/png", size: png.byteLength }))).data;
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

test("indexes: org-scoped unique id and address, and the list/snapshot indexes", async () => {
  for (const name of [COLLECTIONS.posts, COLLECTIONS.events]) {
    const indexes = await mongo.db().collection(name).indexes();
    assert.deepEqual(indexes.filter((i) => i.unique).map((i) => i.name).sort(), ["orgId_id_unique", "orgId_slug_unique"], name);
    for (const n of ["orgId_status_date", "orgId_updatedAt"]) assert.ok(indexes.some((i) => i.name === n), `${name}.${n}`);
  }
});

test("no session → 401 on every content route; a foreign Origin cannot write", async () => {
  for (const [method, path] of [["GET", "/api/v1/posts"], ["GET", "/api/v1/events"], ["POST", "/api/v1/posts"], ["PATCH", "/api/v1/posts/x"], ["DELETE", "/api/v1/events/x"]] as const)
    assert.equal((await call(appA, path, { method, headers: { Origin: ADMIN, "Content-Type": "application/json" }, ...(method !== "GET" && method !== "DELETE" && { body: "{}" }) })).status, 401, `${method} ${path}`);
  const csrf = await call(appA, "/api/v1/posts", { method: "POST", headers: { Cookie: `cms_session=${tokens.ownerA}`, Origin: "https://evil.example", "Content-Type": "application/json" }, body: JSON.stringify({ type: "news", title: "x", body }) });
  assert.equal(csrf.status, 403);
});

test("editors and owners create, edit and archive; editors submit; only owners approve and publish", async () => {
  const created = await send(appA, "editorA", "POST", "/api/v1/posts", { type: "news", title: "Editor news", body, imageId });
  assert.equal(created.status, 201);
  const post = (await jsonOf(created)).data;
  assert.equal((await send(appA, "ownerA", "PATCH", `/api/v1/posts/${post.record.id}`, { revision: 1, changes: { status: "published" } })).status, 400, "a save never publishes");
  assert.equal((await send(appA, "editorA", "POST", `/api/v1/posts/${post.record.id}/submit`, { revision: 1 })).status, 200);
  assert.equal((await send(appA, "editorA", "POST", `/api/v1/posts/${post.record.id}/approve`, { revision: 2 })).status, 403);
  assert.equal((await send(appA, "editorA", "POST", `/api/v1/posts/${post.record.id}/reject`, { revision: 2 })).status, 403);
  const approved = await send(appA, "ownerA", "POST", `/api/v1/posts/${post.record.id}/approve`, { revision: 2 });
  assert.equal(approved.status, 200);
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/publish")).status, 403);
  assert.equal((await send(appA, "ownerA", "POST", "/api/v1/publish")).status, 200);
});

test("addresses are unique per organization (enforced by the index too); revisions conflict", async () => {
  const first = (await jsonOf(await send(appA, "ownerA", "POST", "/api/v1/posts", { type: "blog", title: "Same Address", body }))).data;
  const dup = await send(appA, "ownerA", "POST", "/api/v1/posts", { type: "news", title: "Same address", body });
  assert.equal(dup.status, 400);
  assert.equal((await jsonOf(dup)).error.message, "This address is already used by another post.");
  // Org B may use the same address.
  assert.equal((await send(appB, "ownerB", "POST", "/api/v1/posts", { type: "blog", title: "Same Address", body })).status, 201);
  // Two editors racing on one revision: the second loses.
  const a = await send(appA, "ownerA", "PATCH", `/api/v1/posts/${first.record.id}`, { revision: 1, changes: { title: "First edit" } });
  const b = await send(appA, "editorA", "PATCH", `/api/v1/posts/${first.record.id}`, { revision: 1, changes: { title: "Second edit" } });
  assert.deepEqual([a.status, b.status], [200, 409]);
  assert.equal((await jsonOf(b)).error.message, "This was changed elsewhere since you opened it. Reload the latest version before saving.");
  const stored = await mongo.db().collection(COLLECTIONS.posts).findOne({ orgId: "org-a", "record.id": first.record.id });
  assert.equal(stored?.record.title, "First edit");
  assert.equal(stored?.revision, 2);
  assert.ok(stored?.createdAt instanceof Date);
});

test("events: dates validated, stored as written; archive via DELETE", async () => {
  const bad = await send(appA, "ownerA", "POST", "/api/v1/events", { title: "Bad times", summary: "x", about: body, date: "2026-11-14", startTime: "6:30 PM", endTime: "5:00 PM", timezone: "Europe/London", venue: "Hall", address: "1 Street", imageId });
  assert.equal(bad.status, 400);
  assert.ok((await jsonOf(bad)).error.details.some((d: { path: string }) => d.path === "body.endTime"));
  const gathering = { title: "Test gathering", summary: "A test summary.", about: body, date: "2026-11-14", startTime: "6:30 PM", endTime: "9:00 PM", timezone: "America/New_York", venue: "Hall", address: "1 Street", imageId };
  assert.equal((await send(appA, "ownerA", "POST", "/api/v1/events", { ...gathering, status: "published" })).status, 400, "a new record starts as a draft");
  const res = await send(appA, "ownerA", "POST", "/api/v1/events", gathering);
  assert.equal(res.status, 201);
  const event = (await jsonOf(res)).data;
  assert.deepEqual([event.record.date, event.record.startTime, event.record.timezone], ["2026-11-14", "6:30 PM", "America/New_York"]);
  const archived = await send(appA, "editorA", "DELETE", `/api/v1/events/${event.record.id}`);
  assert.equal((await jsonOf(archived)).data.record.status, "archived");
  assert.equal(await mongo.db().collection(COLLECTIONS.events).countDocuments({ "record.id": event.record.id }), 1, "archived, not deleted");
  assert.equal((await send(appA, "ownerA", "PATCH", `/api/v1/events/${event.record.id}`, { revision: 2, changes: { status: "published" } })).status, 400, "archived reopens as a draft only");
  const restored = await send(appA, "ownerA", "PATCH", `/api/v1/events/${event.record.id}`, { revision: 2, changes: { status: "draft" } });
  assert.equal(restored.status, 200);
  await approveOverHttp((method, path, b) => send(appA, "ownerA", method, path, b), `/api/v1/events/${event.record.id}`);
});

test("organization isolation over HTTP", async () => {
  const mine = (await jsonOf(await send(appA, "ownerA", "POST", "/api/v1/posts", { type: "news", title: "Org A only", body }))).data;
  assert.equal((await send(appB, "ownerB", "GET", `/api/v1/posts/${mine.record.id}`)).status, 404);
  assert.equal((await send(appB, "ownerB", "PATCH", `/api/v1/posts/${mine.record.id}`, { revision: 1, changes: { title: "Hijack" } })).status, 404);
  assert.equal((await send(appB, "ownerB", "DELETE", `/api/v1/posts/${mine.record.id}`)).status, 404);
  const listB = (await jsonOf(await send(appB, "ownerB", "GET", "/api/v1/posts?pageSize=100"))).data;
  assert.ok(!listB.some((v: { record: { id: string } }) => v.record.id === mine.record.id));
  assert.equal((await send(appA, "ownerB", "GET", "/api/v1/posts")).status, 401, "org B's session is not a session at org A");
  assert.equal((await send(appA, "ownerA", "GET", "/api/v1/posts?orgId=org-b")).status, 400);
});

test("the public snapshot carries published posts and events only, with public fields only", async () => {
  // A draft and an archived post that must not appear.
  await send(appA, "ownerA", "POST", "/api/v1/posts", { type: "news", title: "Secret draft headline", body });
  const gone = (await jsonOf(await send(appA, "ownerA", "POST", "/api/v1/posts", { type: "news", title: "Withdrawn headline", body }))).data;
  await approveOverHttp((method, path, b) => send(appA, "ownerA", method, path, b), `/api/v1/posts/${gone.record.id}`);
  await send(appA, "ownerA", "DELETE", `/api/v1/posts/${gone.record.id}`);
  const status = (await jsonOf(await send(appA, "ownerA", "GET", "/api/v1/publish/status"))).data;
  assert.ok(status.changedSections.includes("events"));
  assert.equal((await send(appA, "ownerA", "POST", "/api/v1/publish")).status, 200);

  const res = await call(appA, "/api/v1/public/snapshot?orgId=org-b", { headers: { "X-Organization-ID": "org-b" } });
  assert.equal(res.headers.get("cache-control"), "no-cache", "public API unchanged");
  const snapshot = (await jsonOf(res)).data;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.equal(snapshot.organization.id, "org-a");
  assert.deepEqual(snapshot.content.news.map((p: { title: string }) => p.title).sort(), ["Editor news"]);
  assert.deepEqual(snapshot.content.blogs, [], "blogs are managed (a draft exists) but none is published");
  assert.deepEqual(snapshot.content.events.map((e: { title: string }) => e.title), ["Test gathering"]);
  const text = JSON.stringify(snapshot);
  for (const leak of ["Secret draft headline", "Withdrawn headline", "Org A only", "_id", "revision", "createdBy", "updatedBy", "slugHistory", "editor@a.example", "owner@a.example", "objectKey", "passwordHash", tokens.ownerA!])
    assert.ok(!text.includes(leak), `leaked: ${leak}`);
  const audit = await mongo.db().collection(COLLECTIONS.auditLogs).find({ orgId: "org-a", resourceType: { $in: ["post", "event"] } }).toArray();
  const actions = new Set(audit.map((e) => e.action));
  for (const a of ["post.created", "post.updated", "post.archived", "event.created", "event.updated", "event.archived"]) assert.ok(actions.has(a), a);
  assert.ok(!JSON.stringify(audit).includes("A test paragraph"), "bodies never in the audit trail");
});
