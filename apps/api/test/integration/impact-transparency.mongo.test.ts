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

/* Impact and Transparency (M11) end to end over the test database:
   sessions, CSRF, RBAC, indexes, two organizations in one database, the
   figures' and documents' order, the Impact page and the Transparency
   record, and all of them in the public snapshot. Test records only —
   the figures and shares are made up. The configured Givebutter key is a
   made-up string that must appear nowhere. */

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


const block = (id: string, type: string, data: unknown, enabled = true) => ({ id, type, enabled, version: 1, data });
const overview = { year: 2026, verification: "pending-review", items: [{ id: "a", label: "Test A", percentage: 70 }, { id: "b", label: "Test B", percentage: 30 }] };

test("indexes: figures and documents by id, key and order; one Impact page and one Transparency record per organization", async () => {
  for (const key of ["metrics", "reports", "impactPages", "transparencyPages"] as const) {
    const indexes = await mongo.db().collection(COLLECTIONS[key]).indexes();
    assert.deepEqual(indexes.map((i) => i.name).sort(), ["_id_", ...INDEXES[key].map((i) => i.name!)].sort(), key);
    for (const i of indexes) if (i.name !== "_id_") assert.equal(Object.keys(i.key)[0], "orgId", `${key}.${i.name} starts with orgId`);
  }
  await ensureIndexes(mongo.db());
});

test("no session → 401; a foreign Origin cannot write", async () => {
  const routes = [
    ["GET", "/api/v1/metrics"], ["POST", "/api/v1/metrics"], ["PATCH", "/api/v1/metrics/x"], ["DELETE", "/api/v1/metrics/x"], ["POST", "/api/v1/metrics/order"],
    ["GET", "/api/v1/reports"], ["POST", "/api/v1/reports"], ["PATCH", "/api/v1/reports/x"], ["DELETE", "/api/v1/reports/x"], ["POST", "/api/v1/reports/order"],
    ["GET", "/api/v1/impact"], ["POST", "/api/v1/impact"], ["PATCH", "/api/v1/impact"], ["DELETE", "/api/v1/impact"],
    ["GET", "/api/v1/transparency"], ["POST", "/api/v1/transparency"], ["PATCH", "/api/v1/transparency"], ["DELETE", "/api/v1/transparency"],
  ] as const;
  for (const [method, path] of routes)
    assert.equal((await call(appA, path, { method, headers: { Origin: ADMIN, "Content-Type": "application/json" }, ...(method === "POST" || method === "PATCH" ? { body: "{}" } : {}) })).status, 401, `${method} ${path}`);
  for (const path of ["/api/v1/metrics", "/api/v1/reports", "/api/v1/impact", "/api/v1/transparency"])
    assert.equal((await call(appA, path, { method: "POST", headers: { Cookie: `cms_session=${tokens.ownerA}`, Origin: "https://evil.example", "Content-Type": "application/json" }, body: "{}" })).status, 403, path);
});

test("figures and documents over HTTP: at the end, reorder, conflicts, editors never approve, cross-org refused", async () => {
  const figure = async (slug: string, extra: Record<string, unknown> = {}) => (await jsonOf(await send(appA, "editorA", "POST", "/api/v1/metrics", { slug, value: "10+", label: `Test ${slug}`, ...extra }))).data;
  const x = await figure("test-x");
  const y = await figure("test-y");
  assert.deepEqual([x.record.order, y.record.order, x.record.status, x.record.verification], [0, 1, "draft", "pending-review"]);
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/metrics", { slug: "z", value: "1", label: "Z", status: "published" })).status, 400, "a new record starts as a draft");
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/metrics/order", { items: [{ id: y.record.id, revision: y.revision }, { id: x.record.id, revision: x.revision }] })).status, 200);
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/metrics/order", { items: [{ id: x.record.id, revision: x.revision }, { id: y.record.id, revision: y.revision }] })).status, 409, "stale revision");
  for (const v of [x, y]) {
    const fresh = (await jsonOf(await send(appA, "ownerA", "GET", `/api/v1/metrics/${v.record.id}`))).data;
    assert.equal((await send(appA, "editorA", "PATCH", `/api/v1/metrics/${v.record.id}`, { revision: fresh.revision, changes: { status: "published" } })).status, 400, "a save never publishes");
  assert.equal((await send(appA, "editorA", "POST", `/api/v1/metrics/${v.record.id}/approve`, { revision: fresh.revision })).status, 403, "editors never approve");
    await approveOverHttp((m, p, b) => send(appA, "ownerA", m, p, b), `/api/v1/metrics/${v.record.id}`);
  }
  assert.equal((await send(appB, "ownerB", "GET", `/api/v1/metrics/${x.record.id}`)).status, 404);
  assert.equal((await send(appB, "ownerB", "POST", "/api/v1/metrics/order", { items: [{ id: x.record.id, revision: 1 }] })).status, 404);
  await figure("test-draft", { label: "Test draft figure never public" });

  const doc = async (title: string, extra: Record<string, unknown> = {}) => send(appA, "editorA", "POST", "/api/v1/reports", { category: "annualReport", title, fileUrl: "https://files.rbb.test/report.pdf", ...extra });
  const r = (await jsonOf(await doc("Test report"))).data;
  assert.equal((await doc("Insecure", { fileUrl: "http://files.rbb.test/x.pdf" })).status, 400);
  assert.equal((await doc("Script", { fileUrl: "javascript:alert(1)" })).status, 400);
  const fresh = (await jsonOf(await send(appA, "ownerA", "GET", `/api/v1/reports/${r.record.id}`))).data;
  assert.equal((await send(appA, "editorA", "PATCH", `/api/v1/reports/${r.record.id}`, { revision: fresh.revision, changes: { status: "published" } })).status, 400, "a save never publishes");
  assert.equal((await send(appA, "editorA", "POST", `/api/v1/reports/${r.record.id}/approve`, { revision: fresh.revision })).status, 403, "editors never approve");
  await approveOverHttp((m, p, b) => send(appA, "ownerA", m, p, b), `/api/v1/reports/${r.record.id}`);
  assert.equal((await send(appA, "editorA", "PATCH", `/api/v1/reports/${r.record.id}`, { revision: fresh.revision, changes: { title: "Stale" } })).status, 409);
  assert.equal((await send(appB, "ownerB", "GET", `/api/v1/reports/${r.record.id}`)).status, 404);
  await doc("Test draft document never public");
  const actions = (await mongo.db().collection(COLLECTIONS.auditLogs).find({ orgId: "org-a", action: /^(metric|report)\./ }).toArray()).map((e) => e.action);
  for (const action of ["metric.created", "metric.reordered", "metric.approved", "report.created", "report.approved"]) assert.ok(actions.includes(action), action);
});

test("the Impact page and the Transparency record over HTTP: one each, revisions, editors never approve, org-scoped", async () => {
  const sections = [block("intro", "intro", { title: "Test Impact", body: "A test line." }), block("at-a-glance", "stats", { heading: "Glance.", metricIds: ["test-y", "test-x"] }), block("closing", "cta", { heading: "Go.", primary: { label: "Go", href: "/get-involved" }, imageId }, false)];
  const impact = await send(appA, "editorA", "POST", "/api/v1/impact", { sections, seo: { ogImageId: imageId } });
  assert.equal(impact.status, 201);
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/impact", { sections })).status, 409, "one per organization");
  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/impact", { revision: 1, changes: { sections: [...sections, block("x", "carousel", {})] } })).status, 400);
  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/impact", { revision: 1, changes: { status: "published" } })).status, 400, "a save never publishes");
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/impact/approve", { revision: 1 })).status, 403, "editors never approve");
  await approveOverHttp((m, p, b) => send(appA, "ownerA", m, p, b), "/api/v1/impact");
  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/impact", { revision: 1, changes: { seo: null } })).status, 409);
  assert.equal((await jsonOf(await send(appB, "ownerB", "GET", "/api/v1/impact"))).data.record, null, "another organization's own page");
  assert.equal((await send(appB, "ownerB", "POST", "/api/v1/impact", { sections, seo: { ogImageId: imageId } })).status, 400, "another organization's image");

  const parts = { heading: "Test transparency", intro: "A test intro.", financialOverview: overview, accountability: ["A test paragraph."] };
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/transparency", { ...parts, financialOverview: { ...overview, items: [{ id: "a", label: "A", percentage: 99 }] } })).status, 400);
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/transparency", { ...parts, sections: [] })).status, 400);
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/transparency", parts)).status, 201);
  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/transparency", { revision: 1, changes: { status: "published" } })).status, 400, "a save never publishes");
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/transparency/approve", { revision: 1 })).status, 403, "editors never approve");
  await approveOverHttp((m, p, b) => send(appA, "ownerA", m, p, b), "/api/v1/transparency");
  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/transparency", { revision: 1, changes: { heading: "Stale" } })).status, 409);
  assert.equal((await jsonOf(await send(appB, "ownerB", "GET", "/api/v1/transparency"))).data.record, null);
  const actions = (await mongo.db().collection(COLLECTIONS.auditLogs).find({ orgId: "org-a", action: /^(impact|transparency)\./ }).toArray()).map((e) => e.action);
  for (const action of ["impact.created", "impact.approved", "transparency.created", "transparency.approved"]) assert.ok(actions.includes(action), action);
});

test("publish: figures in order, the Impact page's enabled blocks, transparency and its documents — and nothing else", async () => {
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/publish")).status, 403);
  assert.equal((await send(appA, "ownerA", "POST", "/api/v1/publish")).status, 200);
  const snapshot = (await jsonOf(await call(appA, "/api/v1/public/snapshot"))).data;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.deepEqual(snapshot.content.metrics.map((m: { slug: string }) => m.slug), ["test-y", "test-x"]);
  assert.deepEqual(snapshot.content.impact.sections.map((s: { type: string }) => s.type), ["intro", "stats"]);
  assert.equal(snapshot.content.transparency.heading, "Test transparency");
  assert.deepEqual(snapshot.content.reports.map((r: { title: string }) => r.title), ["Test report"]);
  const text = JSON.stringify(snapshot);
  for (const leak of ["never public", "_id", "revision", "updatedBy", "objectKey", FAKE_KEY, "editor@a.example"]) assert.ok(!text.includes(leak), `leaked: ${leak}`);

  // A figure the Impact page names is archived: the publish is refused, and the live snapshot stays.
  const live = snapshot.version;
  const x = (await jsonOf(await send(appA, "ownerA", "GET", "/api/v1/metrics"))).data.find((v: { record: { slug: string } }) => v.record.slug === "test-x");
  assert.equal((await send(appA, "editorA", "DELETE", `/api/v1/metrics/${x.record.id}`)).status, 200);
  const refused = await send(appA, "ownerA", "POST", "/api/v1/publish");
  assert.equal(refused.status, 400);
  assert.ok(JSON.stringify(await jsonOf(refused)).includes('figure \\"test-x\\"'));
  assert.equal((await jsonOf(await call(appA, "/api/v1/public/snapshot"))).data.version, live);
});

test("secrets: the Givebutter key never appears in a response or a log line", () => {
  assert.ok(!bodies.join("\n").includes(FAKE_KEY));
  assert.ok(!logs.text().includes(FAKE_KEY));
});
