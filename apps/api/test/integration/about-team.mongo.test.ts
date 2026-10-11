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

/* The About page and the team end to end over the test database:
   sessions, CSRF, RBAC, indexes, two organizations in one database, the
   team's order, and both in the public snapshot. Test records only. The
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
const block = (id: string, type: string, data: unknown, enabled = true) => ({ id, type, enabled, version: 1, data });
const intro = () => block("intro", "pageHero", { title: "About a test organization", body: "A test line." });
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
  const intent = (await jsonOf(await send(appA, "ownerA", "POST", "/api/v1/media/upload-intents", { filename: "portrait.png", mimeType: "image/png", size: png.byteLength }))).data;
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

test("indexes: one About page per organization; team members by id, address and order", async () => {
  const about = await mongo.db().collection(COLLECTIONS.aboutPages).indexes();
  assert.deepEqual(about.map((i) => i.name).sort(), ["_id_", ...INDEXES.aboutPages.map((i) => i.name!)].sort());
  assert.equal(about.find((i) => i.name === "orgId_unique")!.unique, true);
  const team = await mongo.db().collection(COLLECTIONS.teamMembers).indexes();
  assert.deepEqual(team.filter((i) => i.unique).map((i) => i.name).sort(), ["orgId_id_unique", "orgId_slug_unique"]);
  assert.deepEqual(team.find((i) => i.name === "orgId_order")!.key, { orgId: 1, "record.order": 1, "record.id": 1 });
  await ensureIndexes(mongo.db());
});

test("no session → 401; a foreign Origin cannot write", async () => {
  for (const [method, path] of [["GET", "/api/v1/about"], ["POST", "/api/v1/about"], ["PATCH", "/api/v1/about"], ["DELETE", "/api/v1/about"], ["GET", "/api/v1/team"], ["POST", "/api/v1/team"], ["PATCH", "/api/v1/team/x"], ["DELETE", "/api/v1/team/x"], ["POST", "/api/v1/team/order"]] as const)
    assert.equal((await call(appA, path, { method, headers: { Origin: ADMIN, "Content-Type": "application/json" }, ...(method === "POST" || method === "PATCH" ? { body: "{}" } : {}) })).status, 401, `${method} ${path}`);
  for (const path of ["/api/v1/about", "/api/v1/team"])
    assert.equal((await call(appA, path, { method: "POST", headers: { Cookie: `cms_session=${tokens.ownerA}`, Origin: "https://evil.example", "Content-Type": "application/json" }, body: "{}" })).status, 403, path);
});

test("about over HTTP: create once, stale → 409, editors submit, owners approve", async () => {
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/about", { sections: [block("x", "carousel", {})] })).status, 400);
  const created = await send(appA, "editorA", "POST", "/api/v1/about", { sections: [intro(), block("who", "statement", { heading: "Who", body: ["One."] })] });
  assert.equal(created.status, 201);
  assert.equal((await send(appA, "ownerA", "POST", "/api/v1/about", { sections: [] })).status, 409);
  const stale = await send(appA, "editorA", "PATCH", "/api/v1/about", { revision: 5, changes: { sections: [intro()] } });
  assert.equal(stale.status, 409);
  assert.match((await jsonOf(stale)).error.message, /About page changes are out of date/);
  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/about", { revision: 1, changes: { status: "published" } })).status, 400, "a save never changes the status");
  assert.equal((await send(appA, "ownerA", "PATCH", "/api/v1/about", { revision: 1, changes: { seo: { title: "About us" } } })).status, 200);
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/about/submit", { revision: 2 })).status, 200);
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/about/approve", { revision: 3 })).status, 403, "editors never approve");
  assert.equal((await send(appA, "ownerA", "POST", "/api/v1/about/approve", { revision: 2 })).status, 409, "a stale approval");
  assert.equal((await jsonOf(await send(appA, "ownerA", "POST", "/api/v1/about/approve", { revision: 3 }))).data.record.status, "approved");
  assert.equal((await jsonOf(await send(appB, "ownerB", "GET", "/api/v1/about"))).data.record, null, "another organization sees nothing");
  assert.equal((await call(appB, "/api/v1/about", { headers: { Origin: ADMIN, Cookie: `cms_session=${tokens.ownerA}` } })).status, 401);
});

test("team over HTTP: create at the end, reorder, editors never approve, cross-org refused", async () => {
  const make = async (name: string, extra: Record<string, unknown> = {}) => (await jsonOf(await send(appA, "editorA", "POST", "/api/v1/team", { name, role: "A test area", group: "team", ...extra }))).data;
  const a = await make("Test Role A", { imageId, biography: ["A test paragraph."] });
  const b = await make("Test Role B");
  assert.deepEqual([a.record.order, b.record.order], [0, 1]);
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/team", { name: "Published by an editor", role: "R", group: "team", status: "published" })).status, 400);
  const ordered = await send(appA, "editorA", "POST", "/api/v1/team/order", { items: [{ id: b.record.id, revision: b.revision }, { id: a.record.id, revision: a.revision }] });
  assert.equal(ordered.status, 200);
  assert.deepEqual((await jsonOf(ordered)).data.map((v: { record: { name: string; order: number } }) => [v.record.name, v.record.order]), [["Test Role B", 0], ["Test Role A", 1]]);
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/team/order", { items: [{ id: a.record.id, revision: a.revision }] })).status, 409, "stale revision");
  // A person's photograph must be described before they are submitted: refused until it is.
  const undescribed = (await jsonOf(await send(appA, "ownerA", "GET", `/api/v1/team/${a.record.id}`))).data;
  const refused = await send(appA, "editorA", "POST", `/api/v1/team/${a.record.id}/submit`, { revision: undescribed.revision });
  assert.equal(refused.status, 400);
  assert.match(JSON.stringify((await jsonOf(refused)).error.details), /no alt text/);
  const media = (await jsonOf(await send(appA, "ownerA", "GET", `/api/v1/media/${imageId}`))).data;
  assert.equal((await send(appA, "ownerA", "PATCH", `/api/v1/media/${imageId}`, { version: media.version, alt: "A test portrait" })).status, 200);
  for (const v of [a, b]) {
    const fresh = (await jsonOf(await send(appA, "ownerA", "GET", `/api/v1/team/${v.record.id}`))).data;
    assert.equal((await send(appA, "editorA", "PATCH", `/api/v1/team/${v.record.id}`, { revision: fresh.revision, changes: { status: "published" } })).status, 400);
    assert.equal((await send(appA, "editorA", "POST", `/api/v1/team/${v.record.id}/submit`, { revision: fresh.revision })).status, 200);
    assert.equal((await send(appA, "editorA", "POST", `/api/v1/team/${v.record.id}/approve`, { revision: fresh.revision + 1 })).status, 403);
    await approveOverHttp((method, path, body) => send(appA, "ownerA", method, path, body), `/api/v1/team/${v.record.id}`);
  }
  assert.equal((await send(appB, "ownerB", "GET", `/api/v1/team/${a.record.id}`)).status, 404);
  assert.equal((await send(appB, "ownerB", "POST", "/api/v1/team/order", { items: [{ id: a.record.id, revision: 1 }] })).status, 404);
  assert.equal((await send(appB, "ownerB", "POST", "/api/v1/team", { name: "B", role: "R", group: "team", imageId })).status, 400, "another organization's photograph");
  const draft = await make("Test Draft Role");
  assert.equal(draft.record.status, "draft");
  const actions = (await mongo.db().collection(COLLECTIONS.auditLogs).find({ orgId: "org-a", action: /^team_member\./ }).toArray()).map((e) => e.action);
  for (const action of ["team_member.created", "team_member.submitted", "team_member.approved"]) assert.ok(actions.includes(action), action);
});

test("publish: the snapshot carries the published About page and the published team, in order", async () => {
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/publish")).status, 403);
  assert.equal((await send(appA, "ownerA", "POST", "/api/v1/publish")).status, 200);
  const snapshot = (await jsonOf(await call(appA, "/api/v1/public/snapshot"))).data;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.deepEqual(snapshot.content.about.sections.map((s: { id: string }) => s.id), ["intro", "who"]);
  assert.equal(snapshot.content.about.seo.title, "About us");
  assert.deepEqual(snapshot.content.team.map((m: { name: string }) => m.name), ["Test Role B", "Test Role A"]);
  const text = JSON.stringify(snapshot);
  for (const leak of ["Test Draft Role", "Published by an editor", "_id", "revision", "updatedBy", "objectKey", FAKE_KEY, "editor@a.example"]) assert.ok(!text.includes(leak), `leaked: ${leak}`);
});

test("secrets: the Givebutter key never appears in a response or a log line", () => {
  assert.ok(!bodies.join("\n").includes(FAKE_KEY));
  assert.ok(!logs.text().includes(FAKE_KEY));
});
