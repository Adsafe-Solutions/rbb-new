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
import { MemoryStorage } from "../media/memory.ts";
import { FakeDonationProvider } from "../support/fake-donations.ts";
import { testMongo } from "./mongo.ts";
import { approveOverHttp } from "./workflow.ts";

/* Get Involved (M20) end to end over the test database: sessions, CSRF,
   RBAC, the (orgId, pageId) index, two organizations in one database,
   revisions, approval completeness, the structure-only audit, and the
   published pages in the public snapshot. Test records only. */

const mongo = testMongo();
const provider = createMongoProvider({ uri: mongo.uri, dbName: mongo.dbName });
const ADMIN = "https://admin.example";
const PASSWORD = "a correct long password";
const FAKE_KEY = "test-givebutter-key-not-real-0000000000";
const logs = captureLogs();
const appFor = (orgId: string): App =>
  createApp({ config: testConfig({ orgId, mongo: { uri: mongo.uri, dbName: mongo.dbName }, integrations: { givebutter: { apiKey: FAKE_KEY } } }), mongo: provider, scrypt: CHEAP_SCRYPT, write: logs.write, storage: new MemoryStorage(), donationProvider: new FakeDonationProvider() });
let appA: App, appB: App;
const tokens: Record<string, string> = {};
const bodies: string[] = [];
const call = async (app: App, path: string, init: RequestInit = {}) => {
  const res = await app.handle(new Request(`https://api.example${path}`, init), { clientIp: "203.0.113.92" });
  bodies.push(await res.clone().text());
  return res;
};
const send = (app: App, who: string, method: string, path: string, body?: unknown) =>
  call(app, path, { method, headers: { Origin: ADMIN, Cookie: `cms_session=${tokens[who]}`, ...(body !== undefined && { "Content-Type": "application/json" }) }, ...(body !== undefined && { body: JSON.stringify(body) }) });

const WORDING = "Integration paragraph wording";
const path = { shortDescription: "Integration line.", hubNote: "Integration note.", sections: [{ id: "first", heading: "First heading", body: [WORDING], items: ["Integration item."] }] };

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
  const audit = new AuditService(mongoAuditStore(mongo.db(), "org-a"), { orgId: "org-a", secret: "test-only-auth-secret-0123456789abcdef", log: silentLog });
  const settings = settingsRecord("org-a");
  await new SettingsService(new MongoSettingsStore(mongo.db(), "org-a"), new MongoMediaStore(mongo.db(), "org-a"), audit, { orgId: "org-a" }).importInitial(settings, { id: null, name: "Settings import" });
});
after(async () => {
  await provider.close();
  await mongo.cleanup();
});

test("index: one record per page per organization — and nothing speculative", async () => {
  const indexes = await mongo.db().collection(COLLECTIONS.getInvolvedPages).indexes();
  assert.deepEqual(indexes.map((i) => i.name).sort(), ["_id_", "orgId_pageId_unique"]);
  assert.deepEqual(INDEXES.getInvolvedPages.map((i) => i.name), ["orgId_pageId_unique"]);
  assert.ok(indexes.find((i) => i.name === "orgId_pageId_unique")!.unique);
});

test("no session → 401; a foreign Origin cannot write; an unknown page has no route", async () => {
  for (const p of ["/api/v1/get-involved", "/api/v1/get-involved/hub", "/api/v1/get-involved/volunteer"]) assert.equal((await call(appA, p, { headers: { Origin: ADMIN } })).status, 401, p);
  assert.equal((await call(appA, "/api/v1/get-involved/volunteer", { method: "PATCH", headers: { Cookie: `cms_session=${tokens.ownerA}`, Origin: "https://evil.example", "Content-Type": "application/json" }, body: JSON.stringify({ revision: 0, changes: {} }) })).status, 403);
  for (const id of ["fundraise", "donate", "Volunteer", "giving"]) assert.equal((await send(appA, "ownerA", "GET", `/api/v1/get-involved/${id}`)).status, 404, id);
});

test("get involved over HTTP: the list, empty drafts, revisions, completeness, owners approve, org-scoped, audit without wording", async () => {
  const list = (await jsonOf(await send(appA, "editorA", "GET", "/api/v1/get-involved"))).data;
  assert.deepEqual(list.pages.map((p: { id: string; route: string; view: { record: unknown } }) => [p.id, p.route, p.view.record]), [["hub", "/get-involved", null], ["volunteer", "/get-involved/volunteer", null], ["fellowship", "/get-involved/fellowship", null], ["partner", "/get-involved/partner", null], ["travel", "/get-involved/travel", null]]);

  const created = await send(appA, "editorA", "PATCH", "/api/v1/get-involved/volunteer", { revision: 0, changes: {} });
  assert.equal(created.status, 200);
  const draft = (await jsonOf(created)).data;
  assert.deepEqual([draft.record.id, draft.record.status, draft.record.sections, draft.record.shortDescription, draft.revision], ["volunteer", "draft", [], undefined, 1]);
  assert.ok(await mongo.db().collection(COLLECTIONS.getInvolvedPages).findOne({ orgId: "org-a", pageId: "volunteer" }), "stored under its fixed key");

  for (const [changes, why] of [
    [{ sections: [{ id: "x", heading: "H", body: ["<b>x</b>"] }] }, "HTML"],
    [{ sections: [{ id: "inquiry", heading: "H", body: ["P."] }] }, "the reserved id"],
    [{ title: "Volunteer" }, "a title"],
    [{ shortDescription: "Demo — x." }, "working text"],
  ] as const)
    assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/get-involved/volunteer", { revision: 1, changes })).status, 400, why);

  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/get-involved/volunteer", { revision: 1, changes: { sections: path.sections } })).status, 200);
  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/get-involved/volunteer", { revision: 1, changes: { hubNote: "Stale" } })).status, 409, "a stale revision");
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/get-involved/volunteer/submit", { revision: 2 })).status, 200);
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/get-involved/volunteer/approve", { revision: 3 })).status, 403, "editors never approve");
  const incomplete = await send(appA, "ownerA", "POST", "/api/v1/get-involved/volunteer/approve", { revision: 3 });
  assert.equal(incomplete.status, 400, "no short description");
  assert.deepEqual((await jsonOf(incomplete)).error.details.map((d: { path: string }) => d.path), ["body.shortDescription"]);
  assert.equal((await send(appA, "ownerA", "POST", "/api/v1/get-involved/volunteer/reject", { revision: 3 })).status, 200);
  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/get-involved/volunteer", { revision: 4, changes: path })).status, 200);
  await approveOverHttp((method, p, body) => send(appA, "ownerA", method, p, body), "/api/v1/get-involved/volunteer");

  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/get-involved/hub", { revision: 0, changes: { heading: "Integration hub", intro: "Integration intro.", closing: { heading: "Integration closing.", primary: { label: "Integration label", target: "contact" } } } })).status, 200);
  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/get-involved/hub", { revision: 1, changes: { closing: { heading: "H", primary: { label: "Go", target: "https://evil.example" } } } })).status, 400, "a CTA is a target, never an address");
  await approveOverHttp((method, p, body) => send(appA, "ownerA", method, p, body), "/api/v1/get-involved/hub");

  const other = (await jsonOf(await send(appB, "ownerB", "GET", "/api/v1/get-involved"))).data;
  assert.ok(other.pages.every((p: { view: { record: unknown } }) => p.view.record === null), "the other organization sees its own (empty) pages");

  const trail = await mongo.db().collection(COLLECTIONS.auditLogs).find({ orgId: "org-a", resourceType: "get_involved" }).toArray();
  for (const action of ["get_involved.created", "get_involved.updated", "get_involved.submitted", "get_involved.rejected", "get_involved.approved"]) assert.ok(trail.some((e) => e.action === action), action);
  assert.deepEqual([...new Set(trail.map((e) => e.resourceId))].sort(), ["hub", "volunteer"]);
  const audited = JSON.stringify(trail);
  for (const words of [WORDING, "First heading", "Integration line", "Integration note", "Integration item", "Integration hub", "Integration closing", "Integration label"]) assert.ok(!audited.includes(words), `no wording in the audit: ${words}`);
});

test("publish: the published pages only, hub first, nothing internal; a pending edit keeps the live version", async () => {
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/publish")).status, 403);
  assert.equal((await send(appA, "ownerA", "POST", "/api/v1/publish")).status, 200);
  let snapshot = (await jsonOf(await call(appA, "/api/v1/public/snapshot"))).data;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.deepEqual(snapshot.content.getInvolved.map((p: { id: string; status: string }) => [p.id, p.status]), [["hub", "published"], ["volunteer", "published"]]);
  assert.equal(snapshot.content.getInvolved[1].sections[0].body[0], WORDING);
  const text = JSON.stringify(snapshot);
  for (const leak of ["_id", "revision", "updatedBy", "pageId", FAKE_KEY, "editor@a.example"]) assert.ok(!text.includes(leak), `leaked: ${leak}`);

  const live = (await jsonOf(await send(appA, "ownerA", "GET", "/api/v1/get-involved/volunteer"))).data;
  assert.equal(live.live, true);
  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/get-involved/volunteer", { revision: live.revision, changes: { hubNote: "A pending edit." } })).status, 200);
  assert.equal((await send(appA, "ownerA", "POST", "/api/v1/publish")).status, 409, "nothing new to publish: the pending edit is not part of it");
  snapshot = (await jsonOf(await call(appA, "/api/v1/public/snapshot"))).data;
  assert.equal(snapshot.content.getInvolved[1].hubNote, "Integration note.");
});

test("secrets: the Givebutter key never appears in a response or a log line", () => {
  assert.ok(!bodies.join("\n").includes(FAKE_KEY));
  assert.ok(!logs.text().includes(FAKE_KEY));
});
