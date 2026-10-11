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
import { FakeDonationProvider } from "../support/fake-donations.ts";
import { testMongo } from "./mongo.ts";

/* The editorial workflow (M14) end to end over the test database:
   real sessions, CSRF, RBAC and the stores. Transitions are atomic
   (revision-guarded writes — of two racing requests one wins, one gets
   409), audited, organization-scoped; and the critical rule is proven
   over HTTP for a collection item (a story) and a single page (the
   homepage): the public snapshot changes only when an approved revision
   is published by an owner. Test records only. */

const mongo = testMongo();
const provider = createMongoProvider({ uri: mongo.uri, dbName: mongo.dbName });
const ADMIN = "https://admin.example";
const PASSWORD = "a correct long password";
const storage = new MemoryStorage();
const appFor = (orgId: string): App =>
  createApp({ config: testConfig({ orgId, mongo: { uri: mongo.uri, dbName: mongo.dbName } }), mongo: provider, scrypt: CHEAP_SCRYPT, write: captureLogs().write, storage, donationProvider: new FakeDonationProvider() });
let appA: App, appB: App;
const tokens: Record<string, string> = {};
const call = (app: App, path: string, init: RequestInit = {}) => app.handle(new Request(`https://api.example${path}`, init), { clientIp: "203.0.113.91" });
const send = (app: App, who: string, method: string, path: string, body?: unknown) =>
  call(app, path, { method, headers: { Origin: ADMIN, Cookie: `cms_session=${tokens[who]}`, ...(body !== undefined && { "Content-Type": "application/json" }) }, ...(body !== undefined && { body: JSON.stringify(body) }) });
const owner = (method: string, path: string, body?: unknown) => send(appA, "ownerA", method, path, body);
const editor = (method: string, path: string, body?: unknown) => send(appA, "editorA", method, path, body);
const data = async (res: Response | Promise<Response>) => (await jsonOf(await res)).data;
const publicSnapshot = async () => data(call(appA, "/api/v1/public/snapshot"));
const body = [{ type: "paragraph", children: [{ type: "text", text: "A test paragraph." }] }];
const block = (id: string, type: string, d: unknown) => ({ id, type, enabled: true, version: 1, data: d });
let imageId = "";
const who = (heading: string) => block("who", "imageText", { heading, body: ["A paragraph."], imageId });

before(async () => {
  await mongo.connect();
  await ensureIndexes(mongo.db());
  appA = appFor("org-a");
  appB = appFor("org-b");
  for (const [orgId, email, role] of [["org-a", "owner@a.example", "OWNER"], ["org-a", "owner2@a.example", "OWNER"], ["org-a", "editor@a.example", "EDITOR"], ["org-b", "owner@b.example", "OWNER"]] as const)
    await addMember(mongoAuthStores(mongo.db(), orgId), { orgId, email, password: PASSWORD, role, name: email.split("@")[0]! });
  for (const [app, who, email] of [[() => appA, "ownerA", "owner@a.example"], [() => appA, "owner2A", "owner2@a.example"], [() => appA, "editorA", "editor@a.example"], [() => appB, "ownerB", "owner@b.example"]] as const) {
    const res = await call(app(), "/api/v1/auth/login", { method: "POST", headers: { Origin: ADMIN, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) });
    tokens[who] = /cms_session=([^;]*)/.exec(res.headers.get("set-cookie") ?? "")![1]!;
  }
  const png = fixture("sample.png");
  const intent = (await jsonOf(await owner("POST", "/api/v1/media/upload-intents", { filename: "workflow.png", mimeType: "image/png", size: png.byteLength }))).data;
  storage.put(intent.objectKey, png, "image/png");
  await owner("POST", `/api/v1/media/${intent.mediaId}/complete`);
  imageId = intent.mediaId;
  const media = await data(owner("GET", `/api/v1/media/${imageId}`));
  await owner("PATCH", `/api/v1/media/${imageId}`, { version: media.version, alt: "A described test image" });
  const audit = new AuditService(mongoAuditStore(mongo.db(), "org-a"), { orgId: "org-a", secret: "test-only-auth-secret-0123456789abcdef", log: silentLog });
  await new SettingsService(new MongoSettingsStore(mongo.db(), "org-a"), new MongoMediaStore(mongo.db(), "org-a"), audit, { orgId: "org-a" }).importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
});
after(async () => {
  await provider.close();
  await mongo.cleanup();
});

test("routes: no session → 401; a foreign Origin cannot act; editors get 403 for approve and reject", async () => {
  for (const action of ["submit", "withdraw", "approve", "reject"]) {
    assert.equal((await call(appA, `/api/v1/stories/x/${action}`, { method: "POST", headers: { Origin: ADMIN, "Content-Type": "application/json" }, body: "{}" })).status, 401, action);
    assert.equal((await call(appA, `/api/v1/homepage/${action}`, { method: "POST", headers: { Cookie: `cms_session=${tokens.ownerA}`, Origin: "https://evil.example", "Content-Type": "application/json" }, body: "{}" })).status, 403, action);
  }
  for (const action of ["approve", "reject"]) assert.equal((await editor("POST", `/api/v1/stories/x/${action}`, { revision: 1 })).status, 403, action);
  assert.equal((await editor("POST", "/api/v1/stories/x/submit", { revision: 1 })).status, 404, "editors may submit: the record is simply not found");
  assert.equal((await owner("POST", "/api/v1/stories/x/submit", { revision: 1, extra: true })).status, 400, "a strict body");
});

test("atomic transitions: two owners approving the same revision — exactly one wins; the loser's 409 writes nothing", async () => {
  const s = await data(editor("POST", "/api/v1/stories", { title: "Raced story", category: "field", body }));
  const path = `/api/v1/stories/${s.record.id}`;
  const submitted = await data(editor("POST", `${path}/submit`, { revision: s.revision }));
  const [first, second] = await Promise.all([owner("POST", `${path}/approve`, { revision: submitted.revision }), send(appA, "owner2A", "POST", `${path}/reject`, { revision: submitted.revision })]);
  assert.deepEqual([first.status, second.status].sort(), [200, 409]);
  const stored = await mongo.db().collection(COLLECTIONS.posts).findOne({ orgId: "org-a", "record.id": s.record.id });
  assert.equal(stored!.revision, submitted.revision + 1, "one write only");
  const decisions = await mongo.db().collection(COLLECTIONS.auditLogs).countDocuments({ orgId: "org-a", resourceId: s.record.id, action: { $in: ["story.approved", "story.rejected"] } });
  assert.equal(decisions, 1, "one audit event");
  // An editor withdrawing while an owner approves: one wins.
  const t = await data(editor("POST", "/api/v1/stories", { title: "Withdraw race story", category: "field", body }));
  const tPath = `/api/v1/stories/${t.record.id}`;
  const tSubmitted = await data(editor("POST", `${tPath}/submit`, { revision: t.revision }));
  const [withdraw, approve] = await Promise.all([editor("POST", `${tPath}/withdraw`, { revision: tSubmitted.revision }), owner("POST", `${tPath}/approve`, { revision: tSubmitted.revision })]);
  assert.deepEqual([withdraw.status, approve.status].sort(), [200, 409]);
  assert.equal((await data(owner("GET", tPath))).revision, tSubmitted.revision + 1);
  // An edit racing a website publish never leaks: the publish takes approved revisions only.
  const [edit] = await Promise.all([editor("PATCH", tPath, { revision: tSubmitted.revision + 1, changes: { title: "Racing edit" } }), owner("POST", "/api/v1/publish")]);
  assert.ok([200, 409].includes(edit.status));
  assert.ok(!JSON.stringify(await publicSnapshot()).includes("Racing edit"));
});

test("audit records in MongoDB: submitted, withdrawn, approved, rejected — actor, from, to, revision; no wording", async () => {
  const s = await data(editor("POST", "/api/v1/stories", { title: "Audit trail story", category: "field", body }));
  const path = `/api/v1/stories/${s.record.id}`;
  let v = await data(editor("POST", `${path}/submit`, { revision: s.revision }));
  v = await data(editor("POST", `${path}/withdraw`, { revision: v.revision }));
  v = await data(editor("POST", `${path}/submit`, { revision: v.revision }));
  v = await data(owner("POST", `${path}/reject`, { revision: v.revision }));
  v = await data(editor("POST", `${path}/submit`, { revision: v.revision }));
  v = await data(owner("POST", `${path}/approve`, { revision: v.revision }));
  assert.equal(v.record.status, "approved");
  const entries = await mongo.db().collection(COLLECTIONS.auditLogs).find({ orgId: "org-a", resourceId: s.record.id }).sort({ createdAt: 1, _id: 1 }).toArray();
  assert.deepEqual(entries.map((e) => [e.action, e.metadata.from, e.metadata.to, e.metadata.revision]), [
    ["story.created", undefined, undefined, undefined],
    ["story.submitted", "draft", "submitted", 2],
    ["story.withdrawn", "submitted", "draft", 3],
    ["story.submitted", "draft", "submitted", 4],
    ["story.rejected", "submitted", "draft", 5],
    ["story.submitted", "draft", "submitted", 6],
    ["story.approved", "submitted", "approved", 7],
  ]);
  assert.ok(!JSON.stringify(entries).includes("A test paragraph"));
  // Organization isolation: org B cannot act on org A's story.
  assert.equal((await send(appB, "ownerB", "POST", `${path}/reject`, { revision: v.revision })).status, 404);
  assert.equal((await data(owner("GET", path))).record.status, "approved");
});

for (const kind of ["story", "homepage"] as const)
  test(`CRITICAL over HTTP (${kind}): edit → submit → reject → resubmit → approve leaves the public snapshot unchanged until the owner publishes; then replaced atomically; stale attempts 409`, async () => {
    const path = kind === "story" ? "" : "/api/v1/homepage";
    // 1. Published content.
    let at = path;
    if (kind === "story") {
      const s = await data(editor("POST", "/api/v1/stories", { title: "Critical original", category: "field", body, imageId }));
      at = `/api/v1/stories/${s.record.id}`;
    } else {
      assert.equal((await editor("POST", "/api/v1/homepage", { sections: [who("Critical original")] })).status, 201);
    }
    let v = await data(editor("POST", `${at}/submit`, { revision: (await data(owner("GET", at))).revision }));
    v = await data(owner("POST", `${at}/approve`, { revision: v.revision }));
    assert.equal((await owner("POST", "/api/v1/publish")).status, 200);
    const v1 = await publicSnapshot();
    assert.ok(PublishedSnapshot.safeParse(v1).success);
    const publicText = () => JSON.stringify(kind === "story" ? v1.content.stories : v1.content.homepage);
    assert.ok(publicText().includes("Critical original"));
    v = await data(owner("GET", at));
    assert.deepEqual([v.record.status, v.live], ["published", true]);
    const stored = async () => mongo.db().collection(kind === "story" ? COLLECTIONS.posts : COLLECTIONS.homepages).findOne(kind === "story" ? { orgId: "org-a", "record.id": v.record.id } : { orgId: "org-a" });
    assert.equal((await stored())!.publishedRevision, v.revision, "the live revision is recorded");
    const unchanged = async (step: string) => {
      assert.deepEqual(await publicSnapshot(), v1, `public unchanged: ${step}`);
      assert.equal((await owner("POST", "/api/v1/publish")).status, 409, `nothing new to publish: ${step}`);
    };
    const change = (text: string) => (kind === "story" ? { title: text } : { sections: [who(text)] });
    // 2–3. The editor edits it.
    v = await data(editor("PATCH", at, { revision: v.revision, changes: change("Critical edited") }));
    assert.deepEqual([v.record.status, v.live], ["draft", true]);
    await unchanged("edited");
    // 4–5. Submitted.
    v = await data(editor("POST", `${at}/submit`, { revision: v.revision }));
    await unchanged("submitted");
    // 6. The owner reviews it.
    const queue = await data(owner("GET", "/api/v1/publish/status"));
    assert.deepEqual(queue.review.submitted.map((r: { section: string }) => r.section), [kind === "story" ? "Stories" : "Homepage"]);
    // 7–8. Rejected.
    v = await data(owner("POST", `${at}/reject`, { revision: v.revision }));
    assert.equal(v.record.status, "draft");
    await unchanged("rejected");
    // 9. Revised and resubmitted.
    const revised = await data(editor("PATCH", at, { revision: v.revision, changes: change("Critical revised") }));
    const resubmitted = await data(editor("POST", `${at}/submit`, { revision: revised.revision }));
    // 10–11. Approved: still not public.
    v = await data(owner("POST", `${at}/approve`, { revision: resubmitted.revision }));
    assert.equal(v.record.status, "approved");
    assert.deepEqual(await publicSnapshot(), v1, "approved is not public");
    const status = await data(owner("GET", "/api/v1/publish/status"));
    assert.equal(status.hasUnpublishedChanges, true);
    // 15. Stale edit, approval and publish.
    assert.equal((await editor("PATCH", at, { revision: revised.revision, changes: change("Critical stale") })).status, 409, "stale edit");
    assert.equal((await owner("POST", `${at}/approve`, { revision: resubmitted.revision })).status, 409, "stale approval");
    assert.equal((await owner("POST", "/api/v1/publish", { changesKey: `${v1.version}:stale` })).status, 409, "stale publish");
    assert.equal((await editor("POST", "/api/v1/publish", { changesKey: status.changesKey })).status, 403, "editors never publish");
    // 12–13. Published.
    const published = await owner("POST", "/api/v1/publish", { changesKey: status.changesKey });
    assert.equal(published.status, 200, await published.clone().text());
    const v2 = await publicSnapshot();
    assert.equal(v2.version, v1.version + 1);
    const text = JSON.stringify(kind === "story" ? v2.content.stories : v2.content.homepage);
    assert.ok(text.includes("Critical revised") && !text.includes("Critical original") && !text.includes("Critical edited") && !text.includes("Critical stale"));
    const after = await data(owner("GET", at));
    assert.deepEqual([after.record.status, after.revision, after.live], ["published", v.revision, true]);
    assert.equal((await stored())!.publishedRevision, v.revision);
    // 14. Atomic replacement: the previous version is intact and immutable; one active pointer.
    assert.deepEqual(await data(call(appA, `/api/v1/public/snapshot/${v1.version}`)), v1);
    const state = await mongo.db().collection(COLLECTIONS.publishState).find({ orgId: "org-a" }).toArray();
    assert.equal(state.length, 1);
    assert.equal(state[0]!.active.version, v2.version);
  });
