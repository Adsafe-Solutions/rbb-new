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

/* Stories and projects (M12) end to end over the test database:
   sessions, CSRF, RBAC, indexes, two organizations in one database, one
   posts collection shared by stories and news/blog posts (each module
   sees only its own; an address is unique across both), the projects'
   order, references, and the public snapshot. Test records only. The
   configured Givebutter key is a made-up string that must appear nowhere. */

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


const body = [{ type: "paragraph", children: [{ type: "text", text: "A test paragraph." }] }];

test("indexes: projects by id, address and order, organization-scoped; stories use the posts collection's", async () => {
  const indexes = await mongo.db().collection(COLLECTIONS.projects).indexes();
  assert.deepEqual(indexes.map((i) => i.name).sort(), ["_id_", ...INDEXES.projects.map((i) => i.name!)].sort());
  for (const i of indexes) if (i.name !== "_id_") assert.equal(Object.keys(i.key)[0], "orgId", i.name);
  assert.ok((await mongo.db().collection(COLLECTIONS.posts).indexes()).some((i) => i.name === "orgId_slug_unique" && i.unique));
  await ensureIndexes(mongo.db());
});

test("no session → 401; a foreign Origin cannot write", async () => {
  for (const [method, path] of [["GET", "/api/v1/stories"], ["POST", "/api/v1/stories"], ["PATCH", "/api/v1/stories/x"], ["DELETE", "/api/v1/stories/x"], ["GET", "/api/v1/projects"], ["POST", "/api/v1/projects"], ["PATCH", "/api/v1/projects/x"], ["DELETE", "/api/v1/projects/x"], ["POST", "/api/v1/projects/order"]] as const)
    assert.equal((await call(appA, path, { method, headers: { Origin: ADMIN, "Content-Type": "application/json" }, ...(method === "POST" || method === "PATCH" ? { body: "{}" } : {}) })).status, 401, `${method} ${path}`);
  for (const path of ["/api/v1/stories", "/api/v1/projects"])
    assert.equal((await call(appA, path, { method: "POST", headers: { Cookie: `cms_session=${tokens.ownerA}`, Origin: "https://evil.example", "Content-Type": "application/json" }, body: "{}" })).status, 403, path);
});

let projectSlug = "";
let storyId = "";
test("projects and stories over HTTP: references, scoping, order, conflicts, editors never approve, cross-org refused", async () => {
  // Published images are described: give the test image its alt text, as the media library would.
  const media = (await jsonOf(await send(appA, "ownerA", "GET", `/api/v1/media/${imageId}`))).data;
  assert.equal((await send(appA, "ownerA", "PATCH", `/api/v1/media/${imageId}`, { version: media.version, alt: "A described test image" })).status, 200);
  // A program for the references (approved by the owner).
  const programRes = await send(appA, "ownerA", "POST", "/api/v1/programs", { title: "Test Education", slug: "test-education", icon: "education", description: "A test line." });
  assert.equal(programRes.status, 201);
  await approveOverHttp((m, p, b) => send(appA, "ownerA", m, p, b), `/api/v1/programs/${(await jsonOf(programRes)).data.record.id}`);
  const project = async (title: string, extra: Record<string, unknown> = {}) => send(appA, "editorA", "POST", "/api/v1/projects", { title, programId: "test-education", description: "A test line.", ...extra });
  const a = (await jsonOf(await project("Test Project A", { imageId, activities: ["A test line."] }))).data;
  const b = (await jsonOf(await project("Test Project B"))).data;
  assert.deepEqual([a.record.order, b.record.order, a.record.status], [0, 1, "draft"]);
  assert.equal((await project("Unknown program", { programId: "no-such-program" })).status, 400);
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/projects/order", { items: [{ id: b.record.id, revision: b.revision }, { id: a.record.id, revision: a.revision }] })).status, 200);
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/projects/order", { items: [{ id: a.record.id, revision: a.revision }, { id: b.record.id, revision: b.revision }] })).status, 409);
  for (const v of [a, b]) {
    const fresh = (await jsonOf(await send(appA, "ownerA", "GET", `/api/v1/projects/${v.record.id}`))).data;
    assert.equal((await send(appA, "editorA", "PATCH", `/api/v1/projects/${v.record.id}`, { revision: fresh.revision, changes: { status: "published" } })).status, 400, "a save never publishes");
  assert.equal((await send(appA, "editorA", "POST", `/api/v1/projects/${v.record.id}/approve`, { revision: fresh.revision })).status, 403, "editors never approve");
    await approveOverHttp((m, p, b) => send(appA, "ownerA", m, p, b), `/api/v1/projects/${v.record.id}`);
  }
  projectSlug = a.record.slug;
  assert.equal((await send(appB, "ownerB", "GET", `/api/v1/projects/${a.record.id}`)).status, 404);
  assert.equal((await send(appB, "ownerB", "POST", "/api/v1/projects/order", { items: [{ id: a.record.id, revision: 1 }] })).status, 404);

  const story = async (title: string, extra: Record<string, unknown> = {}) => send(appA, "editorA", "POST", "/api/v1/stories", { title, category: "field", body, ...extra });
  const s = (await jsonOf(await story("Test Story", { projectId: projectSlug, programId: "test-education", imageId, galleryIds: [imageId] }))).data;
  assert.equal(s.record.type, "story");
  assert.equal((await story("HTML", { body: "<script>alert(1)</script>" })).status, 400);
  assert.equal((await story("Unknown project", { projectId: "no-such-project" })).status, 400);
  assert.equal((await story("News in disguise", { type: "news" })).status, 400);
  assert.equal((await send(appA, "editorA", "PATCH", `/api/v1/stories/${s.record.id}`, { revision: s.revision, changes: { status: "published" } })).status, 400, "a save never publishes");
  assert.equal((await send(appA, "editorA", "POST", `/api/v1/stories/${s.record.id}/approve`, { revision: s.revision })).status, 403, "editors never approve");
  await approveOverHttp((m, p, b) => send(appA, "ownerA", m, p, b), `/api/v1/stories/${s.record.id}`);
  assert.equal((await send(appA, "editorA", "PATCH", `/api/v1/stories/${s.record.id}`, { revision: s.revision, changes: { title: "Stale" } })).status, 409);
  storyId = s.record.id;
  // One posts collection: a news post cannot take a story's address, and neither module sees the other's records.
  const news = await send(appA, "editorA", "POST", "/api/v1/posts", { type: "news", title: "Test Story", slug: s.record.slug, body });
  assert.equal(news.status, 400, "an address is unique across all posts");
  assert.equal((await send(appA, "ownerA", "GET", `/api/v1/posts/${s.record.id}`)).status, 404);
  assert.ok(!(await jsonOf(await send(appA, "ownerA", "GET", "/api/v1/posts"))).data.some((v: { record: { type: string } }) => v.record.type === "story"));
  assert.equal((await send(appB, "ownerB", "GET", `/api/v1/stories/${s.record.id}`)).status, 404);
  assert.equal((await send(appB, "ownerB", "POST", "/api/v1/stories", { title: "B", category: "field", body, imageId })).status, 400, "another organization's image");
  await story("Test draft story never public");
  const actions = (await mongo.db().collection(COLLECTIONS.auditLogs).find({ orgId: "org-a", action: /^(story|project)\./ }).toArray()).map((e) => e.action);
  for (const action of ["story.created", "story.approved", "project.created", "project.reordered", "project.approved"]) assert.ok(actions.includes(action), action);
});

test("publish: published projects in order and published stories, relationships intact — or nothing changes", async () => {
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/publish")).status, 403);
  assert.equal((await send(appA, "ownerA", "POST", "/api/v1/publish")).status, 200);
  const snapshot = (await jsonOf(await call(appA, "/api/v1/public/snapshot"))).data;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.deepEqual(snapshot.content.projects.map((p: { title: string }) => p.title), ["Test Project B", "Test Project A"]);
  assert.deepEqual(snapshot.content.stories.map((s: { title: string }) => s.title), ["Test Story"]);
  const text = JSON.stringify(snapshot);
  for (const leak of ["never public", "_id", "revision", "updatedBy", "objectKey", FAKE_KEY, "editor@a.example"]) assert.ok(!text.includes(leak), `leaked: ${leak}`);
  // The story's project is archived: the publish is refused and the live snapshot stays.
  const projects = (await jsonOf(await send(appA, "ownerA", "GET", "/api/v1/projects"))).data;
  const named = projects.find((v: { record: { slug: string } }) => v.record.slug === projectSlug);
  assert.equal((await send(appA, "editorA", "DELETE", `/api/v1/projects/${named.record.id}`)).status, 200);
  const refused = await send(appA, "ownerA", "POST", "/api/v1/publish");
  assert.equal(refused.status, 400);
  assert.ok(JSON.stringify(await jsonOf(refused)).includes(`project \\"${projectSlug}\\"`));
  assert.equal((await jsonOf(await call(appA, "/api/v1/public/snapshot"))).data.version, snapshot.version);
  assert.ok(storyId);
});

test("secrets: the Givebutter key never appears in a response or a log line", () => {
  assert.ok(!bodies.join("\n").includes(FAKE_KEY));
  assert.ok(!logs.text().includes(FAKE_KEY));
});
