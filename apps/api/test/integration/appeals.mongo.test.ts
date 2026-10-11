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
import { FakeDonationProvider, fakeCampaign, testCheckout } from "../support/fake-donations.ts";
import { SCRATCH_PREFIX, dropScratch, testMongo, withCollectionRenamed } from "./mongo.ts";
import { approveOverHttp } from "./workflow.ts";

/* Appeals and the general donation page end to end over the test
   database: sessions, CSRF, RBAC, the real stores and indexes (including
   the M2 → M7 index migration), two organizations in one database, and
   publishing into the public snapshot. Givebutter is a deterministic
   fake; the configured key is a made-up string that must never appear in
   a response, a snapshot or a log. */

const mongo = testMongo();
const provider = createMongoProvider({ uri: mongo.uri, dbName: mongo.dbName });
const ADMIN = "https://admin.example";
const PASSWORD = "a correct long password";
const FAKE_KEY = "test-givebutter-key-not-real-0000000000";
const storage = new MemoryStorage();
const logs = captureLogs();
const donations = new FakeDonationProvider();
const appFor = (orgId: string): App =>
  createApp({
    config: testConfig({ orgId, mongo: { uri: mongo.uri, dbName: mongo.dbName }, integrations: { givebutter: { apiKey: FAKE_KEY } } }),
    mongo: provider,
    scrypt: CHEAP_SCRYPT,
    write: logs.write,
    storage,
    donationProvider: donations,
  });
let appA: App, appB: App;
const tokens: Record<string, string> = {};
const bodies: string[] = [];
const call = async (app: App, path: string, init: RequestInit = {}) => {
  const res = await app.handle(new Request(`https://api.example${path}`, init), { clientIp: "203.0.113.60" });
  bodies.push(await res.clone().text());
  return res;
};
const as = (who: string, init: RequestInit = {}) => ({ ...init, headers: { Origin: ADMIN, Cookie: `cms_session=${tokens[who]}`, ...(init.body ? { "Content-Type": "application/json" } : {}) } });
const send = (app: App, who: string, method: string, path: string, body?: unknown) => call(app, path, as(who, { method, ...(body !== undefined && { body: JSON.stringify(body) }) }));
const rich = [{ type: "paragraph", children: [{ type: "text", text: "A test paragraph." }] }];
const sections = [
  { id: "why", type: "richText", enabled: true, version: 1, data: { heading: "Why it matters", content: rich } },
  { id: "helps", type: "numberedCards", enabled: true, version: 1, data: { heading: "How your support helps", items: [{ title: "Test item" }] } },
];
let imageId = "";
const appeal = (o: Record<string, unknown> = {}) => ({ kind: "campaign", title: "Integration appeal", summary: "A test summary.", imageId, sections, ...o });

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

test("indexes: exactly the declared ones, org-scoped, idempotent", async () => {
  await ensureIndexes(mongo.db());
  await ensureIndexes(mongo.db());
  const appeals = await mongo.db().collection(COLLECTIONS.appeals).indexes();
  assert.deepEqual(appeals.map((i) => i.name).sort(), ["_id_", ...INDEXES.appeals.map((i) => i.name!)].sort());
  assert.deepEqual(appeals.find((i) => i.name === "orgId_slug_unique")!.key, { orgId: 1, "record.slug": 1 });
  assert.deepEqual(appeals.filter((i) => i.unique).map((i) => i.name).sort(), ["orgId_id_unique", "orgId_slug_unique"]);
  const pages = await mongo.db().collection(COLLECTIONS.generalDonationPages).indexes();
  assert.deepEqual(pages.find((i) => i.name === "orgId_unique")!.key, { orgId: 1 });
  assert.equal(pages.find((i) => i.name === "orgId_unique")!.unique, true);
});

test("indexes: M2's flat appeal indexes are replaced — and refused while an M2-shaped appeal exists", async () => {
  /* The shared appeals collection already has the M7 indexes, so each case
     gets a scratch appeals collection in the same test database. */
  for (const [suffix, flatDocument] of [["empty", false], ["held", true]] as const) {
    const scratch = `${SCRATCH_PREFIX}legacy_appeals_${suffix}`;
    await dropScratch(mongo.db(), scratch); // an interrupted earlier run's
    const db = withCollectionRenamed(mongo.db(), COLLECTIONS.appeals, scratch);
    try {
      const appeals = db.collection(COLLECTIONS.appeals);
      await appeals.createIndexes([
        { name: "orgId_slug_unique", key: { orgId: 1, slug: 1 }, unique: true },
        { name: "orgId_id_unique", key: { orgId: 1, id: 1 }, unique: true },
      ]);
      if (flatDocument) {
        await appeals.insertOne({ orgId: "org-a", id: "m2-appeal", slug: "m2-appeal", revision: 1 });
        await assert.rejects(ensureIndexes(db), /M2-shaped appeals/);
        assert.deepEqual((await appeals.indexes()).find((i) => i.name === "orgId_slug_unique")!.key, { orgId: 1, slug: 1 }, "nothing changed");
      } else {
        await ensureIndexes(db);
        assert.deepEqual((await appeals.indexes()).find((i) => i.name === "orgId_slug_unique")!.key, { orgId: 1, "record.slug": 1 });
        await ensureIndexes(db);
      }
    } finally {
      await dropScratch(mongo.db(), scratch);
    }
  }
});

test("no session → 401 on every appeal and donation-page route; a foreign Origin cannot write", async () => {
  for (const [method, path] of [["GET", "/api/v1/appeals"], ["GET", "/api/v1/appeals/x"], ["POST", "/api/v1/appeals"], ["PATCH", "/api/v1/appeals/x"], ["DELETE", "/api/v1/appeals/x"], ["GET", "/api/v1/donation-page"], ["PATCH", "/api/v1/donation-page"]] as const)
    assert.equal((await call(appA, path, { method, headers: { Origin: ADMIN, "Content-Type": "application/json" }, ...(method === "POST" || method === "PATCH" ? { body: "{}" } : {}) })).status, 401, `${method} ${path}`);
  const csrf = await call(appA, "/api/v1/appeals", { method: "POST", headers: { Cookie: `cms_session=${tokens.ownerA}`, Origin: "https://evil.example", "Content-Type": "application/json" }, body: JSON.stringify(appeal()) });
  assert.equal(csrf.status, 403);
});

test("appeals over HTTP: create, read, edit, submit, approve, confirmed address change, conflicts, archive; editors cannot approve or publish", async () => {
  const asOwner = (method: string, path: string, body?: unknown) => send(appA, "ownerA", method, path, body);
  const created = await send(appA, "editorA", "POST", "/api/v1/appeals", appeal({ donation: { checkout: testCheckout({ campaignId: "123" }) } }));
  assert.equal(created.status, 201);
  const view = (await jsonOf(created)).data;
  assert.equal(view.record.status, "draft");
  for (const field of ["_id", "orgId_", "createdBy"]) assert.equal(field in view.record, false);

  const path = `/api/v1/appeals/${view.record.id}`;
  assert.equal((await send(appA, "editorA", "PATCH", path, { revision: 1, changes: { status: "published" } })).status, 400, "a save never changes the status");
  assert.equal((await send(appA, "editorA", "POST", `${path}/submit`, { revision: 1 })).status, 200);
  assert.equal((await send(appA, "editorA", "POST", `${path}/approve`, { revision: 2 })).status, 403, "editors never approve");
  const unverifiable = await asOwner("POST", `${path}/approve`, { revision: 2 });
  assert.equal(unverifiable.status, 400, "approving an unverifiable campaign is refused");
  assert.equal((await jsonOf(await asOwner("GET", path))).data.record.status, "submitted", "nothing changed");
  assert.equal((await asOwner("POST", `${path}/reject`, { revision: 2 })).status, 200);
  assert.equal((await asOwner("PATCH", path, { revision: 3, changes: { donation: { checkout: testCheckout() } } })).status, 200);
  const approved = await approveOverHttp(asOwner, path);
  assert.equal((await send(appA, "editorA", "PATCH", path, { revision: 1, changes: { title: "Stale" } })).status, 409);
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/publish")).status, 403, "editors never publish");
  assert.equal((await asOwner("POST", "/api/v1/publish")).status, 200);
  const slugChange = await asOwner("PATCH", path, { revision: approved.revision, changes: { slug: "new-address" } });
  assert.equal(slugChange.status, 409, "the address is public now");
  const moved = (await jsonOf(await asOwner("PATCH", path, { revision: approved.revision, changes: { slug: "new-address" }, confirmSlugChange: true }))).data;
  assert.deepEqual(moved.previousSlugs, ["integration-appeal"]);
  assert.deepEqual([moved.record.status, moved.live], ["draft", true], "the move waits for approval; the old address stays live");
  assert.equal((await asOwner("POST", "/api/v1/appeals", appeal({ slug: "new-address" }))).status, 400, "the address is taken (unique index)");
  await approveOverHttp(asOwner, path);

  const list = await jsonOf(await send(appA, "editorA", "GET", "/api/v1/appeals?status=approved&sort=date"));
  assert.deepEqual(list.data.map((i: { record: { slug: string } }) => i.record.slug), ["new-address"]);

  const draft = (await jsonOf(await send(appA, "ownerA", "POST", "/api/v1/appeals", appeal({ title: "Archived integration appeal" })))).data;
  const archived = await send(appA, "editorA", "DELETE", `/api/v1/appeals/${draft.record.id}`);
  assert.equal((await jsonOf(archived)).data.record.status, "archived");
  assert.equal(await mongo.db().collection(COLLECTIONS.appeals).countDocuments({ orgId: "org-a" }), 2, "nothing destroyed");
  const actions = (await mongo.db().collection(COLLECTIONS.auditLogs).find({ orgId: "org-a", action: /^appeal\./ }).toArray()).map((e) => e.action);
  for (const action of ["appeal.created", "appeal.updated", "appeal.submitted", "appeal.rejected", "appeal.approved", "appeal.archived"]) assert.ok(actions.includes(action), action);
});

test("organization isolation: another organization's appeals are invisible; sessions, query and headers cannot cross", async () => {
  const mine = (await jsonOf(await send(appA, "ownerA", "POST", "/api/v1/appeals", appeal({ title: "Isolated appeal" })))).data;
  assert.equal((await send(appB, "ownerB", "GET", `/api/v1/appeals/${mine.record.id}`)).status, 404);
  assert.equal((await send(appB, "ownerB", "PATCH", `/api/v1/appeals/${mine.record.id}`, { revision: 1, changes: { title: "Taken" } })).status, 404);
  assert.equal((await send(appB, "ownerB", "DELETE", `/api/v1/appeals/${mine.record.id}`)).status, 404);
  assert.equal((await jsonOf(await send(appB, "ownerB", "GET", "/api/v1/appeals"))).data.length, 0);
  // A session from org A is not a session in org B's deployment.
  assert.equal((await call(appB, "/api/v1/appeals", as("ownerA"))).status, 401);
  // ?orgId is refused outright (a strict query); an organization header is ignored.
  const headers = { Origin: ADMIN, Cookie: `cms_session=${tokens.ownerB}`, "X-Organization-ID": "org-a" };
  assert.equal((await call(appB, "/api/v1/appeals?orgId=org-a", { headers })).status, 400);
  const sneaky = await call(appB, "/api/v1/appeals", { headers });
  assert.equal(sneaky.status, 200);
  assert.equal((await jsonOf(sneaky)).data.length, 0);
  // org B's image library does not have org A's image.
  assert.equal((await send(appB, "ownerB", "POST", "/api/v1/appeals", appeal({ title: "Isolated appeal" }))).status, 400);
});

test("donation page over HTTP: one per organization, revision-checked, verified to approve", async () => {
  const empty = (await jsonOf(await send(appA, "editorA", "GET", "/api/v1/donation-page"))).data;
  assert.deepEqual(empty, { record: null, revision: 0, updatedAt: null, updatedBy: null, live: false, schedule: null });
  const hero = { title: "Integration donation page", description: "A test description.", imageId };
  const created = await send(appA, "editorA", "PATCH", "/api/v1/donation-page", { revision: 0, changes: { hero, donation: { designation: "where-needed-most" } } });
  assert.equal(created.status, 200);
  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/donation-page", { revision: 0, changes: { hero } })).status, 409);
  assert.equal((await send(appA, "editorA", "PATCH", "/api/v1/donation-page", { revision: 1, changes: { status: "published" } })).status, 400);
  assert.equal((await send(appA, "ownerA", "PATCH", "/api/v1/donation-page", { revision: 1, changes: { donation: { designation: "where-needed-most", checkout: testCheckout({ defaultAmount: 33 }) } } })).status, 200, "a draft may hold an unverified checkout");
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/donation-page/submit", { revision: 2 })).status, 200);
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/donation-page/approve", { revision: 3 })).status, 403);
  const bad = await send(appA, "ownerA", "POST", "/api/v1/donation-page/approve", { revision: 3 });
  assert.equal(bad.status, 400);
  assert.ok((await jsonOf(bad)).error.details.some((d: { path: string }) => d.path.endsWith("donation.checkout.defaultAmount")));
  assert.equal((await send(appA, "editorA", "POST", "/api/v1/donation-page/withdraw", { revision: 3 })).status, 200);
  const ok = await send(appA, "ownerA", "PATCH", "/api/v1/donation-page", { revision: 4, changes: { sections, donation: { designation: "where-needed-most", checkout: testCheckout({ defaultAmount: 50 }) } } });
  assert.equal(ok.status, 200);
  await approveOverHttp((method, p, body) => send(appA, "ownerA", method, p, body), "/api/v1/donation-page");
  assert.equal(await mongo.db().collection(COLLECTIONS.generalDonationPages).countDocuments({ orgId: "org-a" }), 1);
  const audit = await mongo.db().collection(COLLECTIONS.auditLogs).find({ orgId: "org-a", action: "donation_page.updated" }).toArray();
  assert.equal(audit.length, 3);
  assert.ok(!JSON.stringify(audit).includes("A test paragraph"));
});

test("publish (owner): the public snapshot carries published appeals and the page; a failing check blocks it all", async () => {
  const res = await send(appA, "ownerA", "POST", "/api/v1/publish");
  assert.equal(res.status, 200, await res.clone().text());
  const publicRes = await call(appA, "/api/v1/public/snapshot");
  const snapshot = (await jsonOf(publicRes)).data;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.deepEqual(snapshot.content.appeals.map((a: { slug: string }) => a.slug), ["new-address"]);
  assert.equal(snapshot.content.generalDonation.hero.title, "Integration donation page");
  const text = JSON.stringify(snapshot);
  for (const leak of ["Archived integration appeal", "Isolated appeal", FAKE_KEY, "createdBy", "revision", "slugHistory", "_id", "objectKey", "TestAccount0001", "session"])
    assert.ok(!text.includes(leak), `leaked: ${leak}`);
  // The public read cannot pick another organization.
  const other = await call(appA, "/api/v1/public/snapshot?orgId=org-b", { headers: { "X-Organization-ID": "org-b" } });
  assert.equal((await jsonOf(other)).data.organization.id, "org-a");

  // Givebutter closes the campaign: the next publish is refused, nothing changes.
  const later = (await jsonOf(await send(appA, "ownerA", "POST", "/api/v1/appeals", appeal({ title: "Later appeal" })))).data;
  await approveOverHttp((method, p, body) => send(appA, "ownerA", method, p, body), `/api/v1/appeals/${later.record.id}`);
  donations.campaigns.set("900001", fakeCampaign({ status: "ended" }));
  const refused = await send(appA, "ownerA", "POST", "/api/v1/publish");
  assert.equal(refused.status, 400);
  donations.campaigns.set("900001", fakeCampaign());
  const live = (await jsonOf(await call(appA, "/api/v1/public/snapshot"))).data;
  assert.equal(live.version, snapshot.version);
  assert.equal(live.content.appeals.length, 1);
});

test("M2's internal route reads published appeals from the new store", async () => {
  const res = await call(appA, "/api/v1/internal/appeals/new-address");
  assert.equal(res.status, 200);
  const { data } = await jsonOf(res);
  assert.equal(data.slug, "new-address");
  for (const field of ["_id", "revision", "createdBy"]) assert.equal(field in data, false);
  assert.equal((await call(appA, "/api/v1/internal/appeals/integration-appeal")).status, 404, "an old address is not an appeal");
});

test("secrets: the Givebutter key never appears in a response or a log line", () => {
  assert.ok(bodies.length > 20);
  assert.ok(!bodies.join("\n").includes(FAKE_KEY));
  assert.ok(!logs.text().includes(FAKE_KEY));
});
