import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createApp, type App } from "../../src/app.ts";
import { ensureIndexes } from "../../src/db/collections.ts";
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
import { FakeDonationProvider, testCheckout } from "../support/fake-donations.ts";
import { testMongo } from "./mongo.ts";

/* The publishing rule over HTTP (M14), for every kind of content record:
   an editor creates and edits drafts and submits them for review, but
   NEVER approves one (403, nothing written) and never publishes the
   website. A save never changes the status. Owners approve, reject and
   publish; an edit to published content is a draft whose live version
   stays public until the edit is approved AND the website is published.
   The dedicated test database; test records only. */

const mongo = testMongo();
const provider = createMongoProvider({ uri: mongo.uri, dbName: mongo.dbName });
const ADMIN = "https://admin.example";
const PASSWORD = "a correct long password";
const storage = new MemoryStorage();
let app: App;
const tokens: Record<string, string> = {};
const call = (path: string, init: RequestInit = {}) => app.handle(new Request(`https://api.example${path}`, init), { clientIp: "203.0.113.70" });
const send = (who: string, method: string, path: string, body?: unknown) =>
  call(path, { method, headers: { Origin: ADMIN, Cookie: `cms_session=${tokens[who]}`, ...(body !== undefined && { "Content-Type": "application/json" }) }, ...(body !== undefined && { body: JSON.stringify(body) }) });
const rich = [{ type: "paragraph", children: [{ type: "text", text: "A test paragraph." }] }];
let imageId = "";

before(async () => {
  await mongo.connect();
  await ensureIndexes(mongo.db());
  app = createApp({ config: testConfig({ orgId: "org-a", mongo: { uri: mongo.uri, dbName: mongo.dbName } }), mongo: provider, scrypt: CHEAP_SCRYPT, write: captureLogs().write, storage, donationProvider: new FakeDonationProvider() });
  for (const [email, role] of [["owner@a.example", "OWNER"], ["editor@a.example", "EDITOR"]] as const) await addMember(mongoAuthStores(mongo.db(), "org-a"), { orgId: "org-a", email, password: PASSWORD, role, name: email.split("@")[0]! });
  for (const [who, email] of [["owner", "owner@a.example"], ["editor", "editor@a.example"]]) {
    const res = await call("/api/v1/auth/login", { method: "POST", headers: { Origin: ADMIN, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) });
    tokens[who] = /cms_session=([^;]*)/.exec(res.headers.get("set-cookie") ?? "")![1]!;
  }
  const png = fixture("sample.png");
  const intent = (await jsonOf(await send("owner", "POST", "/api/v1/media/upload-intents", { filename: "test-image.png", mimeType: "image/png", size: png.byteLength }))).data;
  storage.put(intent.objectKey, png, "image/png");
  await send("owner", "POST", `/api/v1/media/${intent.mediaId}/complete`);
  imageId = intent.mediaId;
  const audit = new AuditService(mongoAuditStore(mongo.db(), "org-a"), { orgId: "org-a", secret: "test-only-auth-secret-0123456789abcdef", log: silentLog });
  await new SettingsService(new MongoSettingsStore(mongo.db(), "org-a"), new MongoMediaStore(mongo.db(), "org-a"), audit, { orgId: "org-a" }).importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
});
after(async () => {
  await provider.close();
  await mongo.cleanup();
});

const COLLECTIONS = [
  { base: "posts", record: () => ({ type: "news", title: "Permission test news", body: rich, imageId }), edit: { excerpt: "Edited by an editor." } },
  { base: "events", record: () => ({ title: "Permission test event", summary: "A summary.", about: rich, date: "2026-11-14", startTime: "6:30 PM", timezone: "Europe/London", venue: "Hall", address: "1 Street", imageId }), edit: { venue: "Another hall" } },
  { base: "appeals", record: () => ({ kind: "campaign", title: "Permission test appeal", summary: "A summary.", imageId, donation: { checkout: testCheckout() } }), edit: { summary: "Edited by an editor." } },
];

const ids: Record<string, string> = {};
const read = async (path: string) => (await jsonOf(await send("owner", "GET", path))).data;

for (const c of COLLECTIONS) {
  test(`${c.base}: editor → draft → submit; a save never publishes; editor's approve → 403; owner approves; submitted is locked`, async () => {
    assert.equal((await send("editor", "POST", `/api/v1/${c.base}`, { ...c.record(), status: "published" })).status, 400, "a new record starts as a draft");
    assert.equal((await read(`/api/v1/${c.base}`)).length, 0, "nothing was written");
    const created = await send("editor", "POST", `/api/v1/${c.base}`, c.record());
    assert.equal(created.status, 201);
    const view = (await jsonOf(created)).data;
    const path = `/api/v1/${c.base}/${view.record.id}`;
    ids[c.base] = path;
    assert.equal(view.record.status, "draft");
    const edited = (await jsonOf(await send("editor", "PATCH", path, { revision: 1, changes: c.edit }))).data;
    assert.equal(edited.record.status, "draft", "an editor's edit stays a draft");
    for (const status of ["published", "approved", "submitted"]) assert.equal((await send("editor", "PATCH", path, { revision: 2, changes: { status } })).status, 400, `a save never sets ${status}`);
    assert.equal((await send("owner", "PATCH", path, { revision: 2, changes: { status: "published" } })).status, 400, "not even an owner's");
    assert.equal((await send("owner", "POST", `${path}/approve`, { revision: 2 })).status, 409, "draft → approve");
    const submitted = await send("editor", "POST", `${path}/submit`, { revision: 2 });
    assert.equal((await jsonOf(submitted)).data.record.status, "submitted");
    assert.equal((await send("editor", "POST", `${path}/submit`, { revision: 3 })).status, 409, "submitted → submit");
    assert.equal((await send("editor", "PATCH", path, { revision: 3, changes: { title: "Changed under review" } })).status, 409, "a submitted revision is locked");
    const refused = await send("editor", "POST", `${path}/approve`, { revision: 3 });
    assert.equal(refused.status, 403);
    assert.equal((await jsonOf(refused)).error.code, "FORBIDDEN");
    assert.equal((await send("editor", "POST", `${path}/reject`, { revision: 3 })).status, 403);
    assert.equal((await read(path)).revision, 3, "nothing was written");
    const approved = await send("owner", "POST", `${path}/approve`, { revision: 3 });
    assert.equal(approved.status, 200, await approved.clone().text());
    assert.equal((await jsonOf(approved)).data.record.status, "approved");
    assert.equal((await send("owner", "POST", `${path}/approve`, { revision: 3 })).status, 409, "a stale approval");
  });
}

test("donation page: editor creates, edits and submits a draft; editor's approve → 403; owner approves", async () => {
  const hero = { title: "Permission test page", description: "A description.", imageId };
  assert.equal((await send("editor", "PATCH", "/api/v1/donation-page", { revision: 0, changes: { hero, donation: { designation: "where-needed-most" }, status: "published" } })).status, 400);
  const created = (await jsonOf(await send("editor", "PATCH", "/api/v1/donation-page", { revision: 0, changes: { hero, donation: { designation: "where-needed-most" } } }))).data;
  assert.equal(created.record.status, "draft");
  assert.equal((await send("editor", "PATCH", "/api/v1/donation-page", { revision: 1, changes: { status: "published" } })).status, 400);
  assert.equal((await send("editor", "POST", "/api/v1/donation-page/submit", { revision: 1 })).status, 200);
  assert.equal((await send("editor", "POST", "/api/v1/donation-page/approve", { revision: 2 })).status, 403);
  const approved = await send("owner", "POST", "/api/v1/donation-page/approve", { revision: 2 });
  assert.equal((await jsonOf(approved)).data.record.status, "approved");
  ids["donation-page"] = "/api/v1/donation-page";
});

test("the website: editors cannot publish it; the owner's publish carries exactly the approved revisions; later edits wait for approval", async () => {
  assert.equal((await send("editor", "POST", "/api/v1/publish")).status, 403);
  const draft = (await jsonOf(await send("editor", "POST", "/api/v1/posts", { type: "news", title: "Editor draft only", body: rich }))).data;
  assert.equal((await send("owner", "POST", "/api/v1/publish")).status, 200);
  const titles = (snapshot: { content: Record<string, { title: string }[]> }) => ["news", "events", "appeals"].map((k) => snapshot.content[k]!.map((p) => p.title));
  const first = (await jsonOf(await call("/api/v1/public/snapshot"))).data;
  assert.deepEqual(titles(first), [["Permission test news"], ["Permission test event"], ["Permission test appeal"]]);
  assert.equal(first.content.generalDonation.hero.title, "Permission test page");
  assert.ok(!JSON.stringify(first).includes(draft.record.title));
  for (const path of Object.values(ids)) assert.equal((await read(path)).record.status, "published", path);

  // Editors edit the published records: drafts again, the live versions stay.
  for (const c of COLLECTIONS) {
    const v = await read(ids[c.base]!);
    const later = (await jsonOf(await send("editor", "PATCH", ids[c.base]!, { revision: v.revision, changes: { title: "Edited after publishing" } }))).data;
    assert.deepEqual([later.record.status, later.live], ["draft", true], "editing a published record makes a draft; the live version stays");
  }
  const page = await read("/api/v1/donation-page");
  await send("editor", "PATCH", "/api/v1/donation-page", { revision: page.revision, changes: { seo: { title: "Edited by an editor" } } });
  assert.equal((await send("owner", "POST", "/api/v1/publish")).status, 409, "nothing approved: nothing new to publish");
  assert.deepEqual((await jsonOf(await call("/api/v1/public/snapshot"))).data, first, "the public snapshot is unchanged");

  // Submitted and approved, the edits go live at the owner's next publish.
  for (const path of Object.values(ids)) {
    const v = await read(path);
    assert.equal((await send("editor", "POST", `${path}/submit`, { revision: v.revision })).status, 200);
    assert.equal((await send("owner", "POST", `${path}/approve`, { revision: v.revision + 1 })).status, 200);
  }
  const status = (await jsonOf(await send("owner", "GET", "/api/v1/publish/status"))).data;
  assert.equal(status.review.approved.length, 4);
  assert.equal((await send("owner", "POST", "/api/v1/publish", { changesKey: "0:stale" })).status, 409, "a stale review");
  assert.equal((await send("owner", "POST", "/api/v1/publish", { changesKey: status.changesKey })).status, 200);
  const second = (await jsonOf(await call("/api/v1/public/snapshot"))).data;
  assert.deepEqual(titles(second), [["Edited after publishing"], ["Edited after publishing"], ["Edited after publishing"]]);
  assert.equal(second.content.generalDonation.seo.title, "Edited by an editor");
  assert.equal(second.version, first.version + 1);
});
