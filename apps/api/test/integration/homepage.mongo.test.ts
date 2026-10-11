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

/* The homepage end to end over the test database: sessions, CSRF,
   RBAC, one homepage per organization (unique index), references to
   posts/events/appeals, and publishing into the public snapshot. The
   configured Givebutter key is a made-up string that must appear nowhere. */

const mongo = testMongo();
const provider = createMongoProvider({ uri: mongo.uri, dbName: mongo.dbName });
const ADMIN = "https://admin.example";
const PASSWORD = "a correct long password";
const FAKE_KEY = "test-givebutter-key-not-real-0000000000";
const storage = new MemoryStorage();
const logs = captureLogs();
const appFor = (orgId: string): App =>
  createApp({
    config: testConfig({ orgId, mongo: { uri: mongo.uri, dbName: mongo.dbName }, integrations: { givebutter: { apiKey: FAKE_KEY } } }),
    mongo: provider,
    scrypt: CHEAP_SCRYPT,
    write: logs.write,
    storage,
    donationProvider: new FakeDonationProvider(),
  });
let appA: App, appB: App;
const tokens: Record<string, string> = {};
const bodies: string[] = [];
const call = async (app: App, path: string, init: RequestInit = {}) => {
  const res = await app.handle(new Request(`https://api.example${path}`, init), { clientIp: "203.0.113.80" });
  bodies.push(await res.clone().text());
  return res;
};
const send = (app: App, who: string, method: string, path: string, body?: unknown) =>
  call(app, path, { method, headers: { Origin: ADMIN, Cookie: `cms_session=${tokens[who]}`, ...(body !== undefined && { "Content-Type": "application/json" }) }, ...(body !== undefined && { body: JSON.stringify(body) }) });
const rich = [{ type: "paragraph", children: [{ type: "text", text: "A test paragraph." }] }];
const block = (id: string, type: string, data: unknown, enabled = true) => ({ id, type, enabled, version: 1, data });
let imageId = "";
let pendingId = "";

async function upload(name: string, complete = true) {
  const png = fixture("sample.png");
  const intent = (await jsonOf(await send(appA, "ownerA", "POST", "/api/v1/media/upload-intents", { filename: name, mimeType: "image/png", size: png.byteLength }))).data;
  if (complete) {
    storage.put(intent.objectKey, png, "image/png");
    await send(appA, "ownerA", "POST", `/api/v1/media/${intent.mediaId}/complete`);
  }
  return intent.mediaId as string;
}

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
  imageId = await upload("test-image.png");
  pendingId = await upload("pending.png", false);
  const audit = new AuditService(mongoAuditStore(mongo.db(), "org-a"), { orgId: "org-a", secret: "test-only-auth-secret-0123456789abcdef", log: silentLog });
  await new SettingsService(new MongoSettingsStore(mongo.db(), "org-a"), new MongoMediaStore(mongo.db(), "org-a"), audit, { orgId: "org-a" }).importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
});
after(async () => {
  await provider.close();
  await mongo.cleanup();
});

const hero = () => block("hero", "hero", { slides: [{ id: "one", headline: ["A test line."], cta: { label: "Go", href: "/work" }, imageId, insetId: imageId }], secondaryCta: { label: "More", href: "/get-involved" }, intervalMs: 7000 });
const who = () => block("who", "imageText", { heading: "Who we are", body: ["A paragraph."], imageId });

test("indexes: one homepage per organization, plus status and recency", async () => {
  const indexes = await mongo.db().collection(COLLECTIONS.homepages).indexes();
  assert.deepEqual(indexes.map((i) => i.name).sort(), ["_id_", ...INDEXES.homepages.map((i) => i.name!)].sort());
  assert.equal(indexes.find((i) => i.name === "orgId_unique")!.unique, true);
});

test("no session → 401 on every homepage route; a foreign Origin cannot write", async () => {
  for (const method of ["GET", "POST", "PATCH", "DELETE"])
    assert.equal((await call(appA, "/api/v1/homepage", { method, headers: { Origin: ADMIN, "Content-Type": "application/json" }, ...(method === "POST" || method === "PATCH" ? { body: "{}" } : {}) })).status, 401, method);
  const csrf = await call(appA, "/api/v1/homepage", { method: "POST", headers: { Cookie: `cms_session=${tokens.ownerA}`, Origin: "https://evil.example", "Content-Type": "application/json" }, body: JSON.stringify({ sections: [] }) });
  assert.equal(csrf.status, 403);
});

test("CRUD: create once, edit with revisions, stale → 409 with the homepage message, archive", async () => {
  assert.deepEqual((await jsonOf(await send(appA, "editorA", "GET", "/api/v1/homepage"))).data.record, null);
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/homepage", { sections: [hero(), block("x", "carousel", { heading: "H" })] })).status, 400, "unknown block");
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/homepage", { sections: [block("x", "html", { html: "<script>alert(1)</script>" })] })).status, 400, "html block");
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/homepage", { sections: [{ ...who(), data: { heading: "H", body: ["p"], imageId: pendingId } }] })).status, 400, "an image that is not ready");
  const created = await send(appA, "editorA", "POST", "/api/v1/homepage", { sections: [hero(), who()] });
  assert.equal(created.status, 201);
  assert.equal((await jsonOf(created)).data.record.status, "draft");
  assert.equal((await send(appA, "ownerA", "POST", "/api/v1/homepage", { sections: [] })).status, 409, "one per organization");
  const edited = await send(appA, "editorA", "PATCH", "/api/v1/homepage", { revision: 1, changes: { sections: [hero(), { ...who(), enabled: false }] } });
  assert.equal(edited.status, 200);
  const stale = await send(appA, "editorA", "PATCH", "/api/v1/homepage", { revision: 1, changes: { sections: [hero()] } });
  assert.equal(stale.status, 409);
  assert.equal((await jsonOf(stale)).error.message, "These homepage changes are out of date. Reload the latest version before saving.");
  assert.equal(await mongo.db().collection(COLLECTIONS.homepages).countDocuments({ orgId: "org-a" }), 1);
  const actions = (await mongo.db().collection(COLLECTIONS.auditLogs).find({ orgId: "org-a", action: /^homepage\./ }).toArray()).map((e) => e.action);
  assert.deepEqual(actions.sort(), ["homepage.created", "homepage.updated"]);
});

test("organization isolation: org B cannot see or change org A's homepage, nor use its media", async () => {
  assert.equal((await jsonOf(await send(appB, "ownerB", "GET", "/api/v1/homepage"))).data.record, null);
  assert.equal((await call(appB, "/api/v1/homepage", { headers: { Origin: ADMIN, Cookie: `cms_session=${tokens.ownerA}` } })).status, 401, "org A's session is nothing in org B");
  assert.equal((await send(appB, "ownerB", "POST", "/api/v1/homepage", { sections: [who()] })).status, 400, "org A's image is not org B's");
});

test("references and publishing: drafts/archived refused, owner-only approval, snapshot holds the published homepage", async () => {
  const asOwner = (method: string, path: string, body?: unknown) => send(appA, "ownerA", method, path, body);
  const post = (await jsonOf(await send(appA, "ownerA", "POST", "/api/v1/posts", { type: "news", title: "Homepage news", body: rich, imageId }))).data.record;
  const event = (await jsonOf(await send(appA, "ownerA", "POST", "/api/v1/events", { title: "Homepage event", summary: "S.", about: rich, date: "2026-11-14", startTime: "6:30 PM", timezone: "Europe/London", venue: "Hall", address: "1 Street", imageId }))).data.record;
  const appeal = (await jsonOf(await send(appA, "ownerA", "POST", "/api/v1/appeals", { kind: "emergency", title: "Homepage appeal", summary: "S.", imageId }))).data.record;
  const sections = [hero(), block("news", "postList", { heading: "News", postIds: [post.id] }), block("events", "eventList", { heading: "Events", eventIds: [event.id] }), block("appeals", "appealList", { heading: "Appeals", appealIds: [appeal.id] })];
  const current = (await jsonOf(await send(appA, "ownerA", "GET", "/api/v1/homepage"))).data;
  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/homepage", { revision: current.revision, changes: { sections } })).status, 200, "a draft may point at drafts");

  const r = current.revision + 1;
  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/homepage", { revision: r, changes: { status: "published" } })).status, 400, "a save never changes the status");
  assert.equal((await asOwner("PATCH", "/api/v1/homepage", { revision: r, changes: { seo: { title: "Home", description: "A test description." } } })).status, 200);
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/homepage/submit", { revision: r + 1 })).status, 200, "submitting checks existence only");
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/homepage/approve", { revision: r + 2 })).status, 403, "editors never approve the homepage");
  const draftRefs = await asOwner("POST", "/api/v1/homepage/approve", { revision: r + 2 });
  assert.equal(draftRefs.status, 400);
  assert.deepEqual((await jsonOf(draftRefs)).error.details.map((d: { message: string }) => d.message), ["refers to a post that is draft, not approved", "refers to an event that is draft, not approved", "refers to an appeal that is draft, not approved"]);

  for (const [base, id] of [["posts", post.id], ["events", event.id], ["appeals", appeal.id]]) await approveOverHttp(asOwner, `/api/v1/${base}/${id}`);
  const approved = await asOwner("POST", "/api/v1/homepage/approve", { revision: r + 2 });
  assert.equal(approved.status, 200, await approved.clone().text());
  assert.equal((await jsonOf(approved)).data.record.status, "approved");
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/publish")).status, 403, "editors never publish the website");
  assert.equal((await send(appA, "ownerA", "POST", "/api/v1/publish")).status, 200);
  const snapshot = (await jsonOf(await call(appA, "/api/v1/public/snapshot"))).data;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.deepEqual(snapshot.content.homepage.sections.map((s: { id: string }) => s.id), ["hero", "news", "events", "appeals"]);
  assert.equal(snapshot.content.homepage.seo.title, "Home");
  const text = JSON.stringify(snapshot);
  for (const leak of ["_id", "revision", "updatedBy", "createdBy", "objectKey", FAKE_KEY, "session", "owner@a.example"]) assert.ok(!text.includes(leak), `leaked: ${leak}`);
  // The public read cannot be pointed at another organization.
  assert.equal((await jsonOf(await call(appA, "/api/v1/public/snapshot?orgId=org-b", { headers: { "X-Organization-ID": "org-b" } }))).data.organization.id, "org-a");

  // A referenced record leaves the public: the next publish is refused, the live version stays.
  await send(appA, "ownerA", "DELETE", `/api/v1/posts/${post.id}`);
  const refused = await send(appA, "ownerA", "POST", "/api/v1/publish");
  assert.equal(refused.status, 400);
  assert.match(JSON.stringify((await jsonOf(refused)).error.details), /not published/);
  assert.equal((await jsonOf(await call(appA, "/api/v1/public/snapshot"))).data.version, snapshot.version);
  const rejected = await mongo.db().collection(COLLECTIONS.auditLogs).countDocuments({ orgId: "org-a", action: "publish.rejected" });
  assert.equal(rejected, 1);
});

test("archive: DELETE archives; the next publish returns the website to its own homepage", async () => {
  const res = await send(appA, "editorA", "DELETE", "/api/v1/homepage");
  assert.equal((await jsonOf(res)).data.record.status, "archived");
  // The archived post's homepage block no longer matters once the homepage is archived.
  assert.equal((await send(appA, "ownerA", "POST", "/api/v1/publish")).status, 200);
  assert.equal((await jsonOf(await call(appA, "/api/v1/public/snapshot"))).data.content.homepage, undefined);
});

test("secrets: the Givebutter key never appears in a response or a log line", () => {
  assert.ok(!bodies.join("\n").includes(FAKE_KEY));
  assert.ok(!logs.text().includes(FAKE_KEY));
});
