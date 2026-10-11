import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PublishedSnapshot, instantToZonedTime } from "@rbb/content-schema";
import { createApp, type App } from "../../src/app.ts";
import { COLLECTIONS, ensureIndexes } from "../../src/db/collections.ts";
import { createMongoProvider } from "../../src/db/mongo.ts";
import { AuditService, mongoAuditStore } from "../../src/modules/audit/audit.ts";
import { mongoAuthStores } from "../../src/modules/auth/repository.ts";
import { MongoMediaStore } from "../../src/modules/media/repository.ts";
import type { DeploymentOutcome, DeploymentTrigger } from "../../src/modules/publishing/deploy.ts";
import { MongoSettingsStore } from "../../src/modules/settings/repository.ts";
import { SettingsService } from "../../src/modules/settings/service.ts";
import { CHEAP_SCRYPT, addMember, silentLog } from "../auth/memory.ts";
import { settingsRecord } from "../fixtures/settings.ts";
import { captureLogs, jsonOf, testConfig } from "../helpers.ts";
import { MemoryStorage, fixture } from "../media/memory.ts";
import { FakeDonationProvider } from "../support/fake-donations.ts";
import { testMongo } from "./mongo.ts";

/* Scheduled publishing (M15) end to end over the test database: the
   owner-only schedule routes, the secret-guarded scheduler route, schedules
   that survive a restart, and the races — two scheduler runs, a run against
   an owner's publish, an unschedule, an edit and an approval — each ending
   in exactly one publication or none, never a partial one. The clock is the
   app's (`now`), moved by the test. Test records only. */

const mongo = testMongo();
const provider = createMongoProvider({ uri: mongo.uri, dbName: mongo.dbName });
const ADMIN = "https://admin.example";
const PASSWORD = "a correct long password";
const SECRET = "test-scheduler-secret-0123456789abcdefABCDEF";
const storage = new MemoryStorage();
const logs = captureLogs();
let nowMs = Date.parse("2026-10-08T06:00:00.000Z");
const now = () => new Date(nowMs);
const HOUR = 3_600_000;

class Deploy implements DeploymentTrigger {
  readonly name = "webhook";
  calls: number[] = [];
  failNext = 0;
  async trigger(event: { version: number }): Promise<DeploymentOutcome> {
    this.calls.push(event.version);
    if (this.failNext > 0) {
      this.failNext--;
      return { status: "failed", reason: "rejected" };
    }
    return { status: "triggered" };
  }
}
const deploy = new Deploy();
const appFor = (orgId: string, scheduler: { secret: string } | null = { secret: SECRET }): App =>
  createApp({ config: { ...testConfig({ orgId, mongo: { uri: mongo.uri, dbName: mongo.dbName } }), scheduler }, mongo: provider, scrypt: CHEAP_SCRYPT, write: logs.write, storage, donationProvider: new FakeDonationProvider(), deployTrigger: deploy, now });
let appA: App, appB: App;
const tokens: Record<string, string> = {};
const call = (app: App, path: string, init: RequestInit = {}) => app.handle(new Request(`https://api.example${path}`, init), { clientIp: "203.0.113.92" });
const send = (app: App, who: string, method: string, path: string, body?: unknown) =>
  call(app, path, { method, headers: { Origin: ADMIN, Cookie: `cms_session=${tokens[who]}`, ...(body !== undefined && { "Content-Type": "application/json" }) }, ...(body !== undefined && { body: JSON.stringify(body) }) });
const owner = (method: string, path: string, body?: unknown) => send(appA, "ownerA", method, path, body);
const editor = (method: string, path: string, body?: unknown) => send(appA, "editorA", method, path, body);
const data = async (res: Response | Promise<Response>) => (await jsonOf(await res)).data;
const run = (app = appA, secret = SECRET) => call(app, "/api/v1/internal/scheduler/run", { headers: { authorization: `Bearer ${secret}` } });
const later = (ms: number, timeZone = "Asia/Kolkata") => ({ localTime: instantToZonedTime(new Date(nowMs + ms).toISOString(), timeZone), timeZone });
const body = [{ type: "paragraph", children: [{ type: "text", text: "A test paragraph." }] }];
const snapshot = async () => (await data(call(appA, "/api/v1/public/snapshot"))) as { version: number; content: { stories?: { title: string }[] } } | undefined;
const titles = async () => ((await snapshot())?.content.stories ?? []).map((s) => s.title).sort();
const state = async () => (await mongo.db().collection(COLLECTIONS.publishState).findOne({ orgId: "org-a" }))!;
const completed = async () => mongo.db().collection(COLLECTIONS.auditLogs).countDocuments({ orgId: "org-a", action: "publish.completed" });
let imageId = "";

/* An approved story (submitted and approved over HTTP). */
async function approvedStory(title: string, extra: Record<string, unknown> = {}) {
  const created = await data(editor("POST", "/api/v1/stories", { title, category: "field", body, ...extra }));
  const at = `/api/v1/stories/${created.record.id}`;
  const submitted = await data(editor("POST", `${at}/submit`, { revision: created.revision }));
  const approved = await data(owner("POST", `${at}/approve`, { revision: submitted.revision }));
  return { at, view: approved };
}
async function scheduledStory(title: string, ms = HOUR, extra: Record<string, unknown> = {}) {
  const { at, view } = await approvedStory(title, extra);
  const res = await owner("POST", `${at}/schedule`, { revision: view.revision, ...later(ms) });
  assert.equal(res.status, 200, await res.clone().text());
  return { at, view: (await jsonOf(res)).data };
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
  const png = fixture("sample.png");
  const intent = (await jsonOf(await owner("POST", "/api/v1/media/upload-intents", { filename: "schedule.png", mimeType: "image/png", size: png.byteLength }))).data;
  storage.put(intent.objectKey, png, "image/png");
  await owner("POST", `/api/v1/media/${intent.mediaId}/complete`);
  imageId = intent.mediaId;
  const media = await data(owner("GET", `/api/v1/media/${imageId}`));
  await owner("PATCH", `/api/v1/media/${imageId}`, { version: media.version, alt: "A described test image" });
  const audit = new AuditService(mongoAuditStore(mongo.db(), "org-a"), { orgId: "org-a", secret: "test-only-auth-secret-0123456789abcdef", log: silentLog });
  await new SettingsService(new MongoSettingsStore(mongo.db(), "org-a"), new MongoMediaStore(mongo.db(), "org-a"), audit, { orgId: "org-a" }).importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  assert.equal((await owner("POST", "/api/v1/publish")).status, 200, "a live site to start from");
});
after(async () => {
  await provider.close();
  await mongo.cleanup();
});

test("the scheduler route: off without CRON_SECRET (503), 401 without the secret, never a session's; GET only", async () => {
  assert.equal((await run(appFor("org-a", null))).status, 503);
  assert.equal((await call(appA, "/api/v1/internal/scheduler/run")).status, 401);
  assert.equal((await run(appA, "wrong-secret-0123456789abcdefghijklmnopqrstuvwxyz")).status, 401);
  assert.equal((await call(appA, "/api/v1/internal/scheduler/run", { headers: { Cookie: `cms_session=${tokens.ownerA}`, Origin: ADMIN } })).status, 401, "an owner's session is not the scheduler's secret");
  assert.equal((await call(appA, "/api/v1/internal/scheduler/run", { method: "POST", headers: { authorization: `Bearer ${SECRET}` } })).status, 405);
  const res = await run();
  assert.equal(res.status, 200);
  assert.deepEqual((await jsonOf(res)).data, { outcome: "idle", due: 0 });
  assert.ok(!logs.text().includes(SECRET), "the secret is never logged");
});

test("the schedule routes: owners only, CSRF, organizations, revisions, states, times", async () => {
  const draft = await data(editor("POST", "/api/v1/stories", { title: "Route rules", category: "field", body }));
  const at = `/api/v1/stories/${draft.record.id}`;
  assert.equal((await call(appA, `${at}/schedule`, { method: "POST", headers: { Origin: ADMIN, "Content-Type": "application/json" }, body: "{}" })).status, 401);
  assert.equal((await call(appA, `${at}/schedule`, { method: "POST", headers: { Cookie: `cms_session=${tokens.ownerA}`, Origin: "https://evil.example", "Content-Type": "application/json" }, body: "{}" })).status, 403);
  assert.equal((await editor("POST", `${at}/schedule`, { revision: 1, ...later(HOUR) })).status, 403, "editors: 403");
  assert.equal((await owner("POST", `${at}/schedule`, { revision: 1, ...later(HOUR) })).status, 409, "draft → schedule");
  const submitted = await data(editor("POST", `${at}/submit`, { revision: 1 }));
  assert.equal((await owner("POST", `${at}/schedule`, { revision: submitted.revision, ...later(HOUR) })).status, 409, "submitted → schedule");
  const approved = await data(owner("POST", `${at}/approve`, { revision: submitted.revision }));
  assert.equal((await owner("POST", `${at}/schedule`, { revision: approved.revision - 1, ...later(HOUR) })).status, 409, "stale");
  assert.equal((await owner("POST", `${at}/schedule`, { revision: approved.revision, ...later(-HOUR) })).status, 400, "past");
  assert.equal((await owner("POST", `${at}/schedule`, { revision: approved.revision, localTime: later(HOUR).localTime, timeZone: "IST" })).status, 400, "abbreviation");
  assert.equal((await owner("POST", `${at}/schedule`, { revision: approved.revision, localTime: "2027-03-14T02:30", timeZone: "America/New_York" })).status, 400, "skipped by daylight saving");
  assert.equal((await send(appB, "ownerB", "POST", `${at}/schedule`, { revision: approved.revision, ...later(HOUR) })).status, 404, "another organization");
  const ok = await owner("POST", `${at}/schedule`, { revision: approved.revision, ...later(HOUR) });
  assert.equal(ok.status, 200);
  const view = (await jsonOf(ok)).data;
  assert.deepEqual([view.record.status, view.schedule.timeZone, "fingerprint" in view.schedule], ["approved", "Asia/Kolkata", false]);
  assert.equal((await editor("POST", `${at}/unschedule`, { revision: view.revision })).status, 403);
  assert.equal((await owner("POST", `${at}/unschedule`, { revision: view.revision })).status, 200);
  const audits = await mongo.db().collection(COLLECTIONS.auditLogs).find({ orgId: "org-a", resourceId: draft.record.id, action: { $in: ["story.scheduled", "story.unscheduled"] } }).toArray();
  assert.deepEqual(audits.map((a) => a.action), ["story.scheduled", "story.unscheduled"]);
  assert.ok(!JSON.stringify(audits).includes("A test paragraph"));
});

test("persisted: a schedule survives a restart; the run after the time publishes exactly once", async () => {
  const before = await snapshot();
  const { at, view } = await scheduledStory("Survives a restart");
  const stored = await mongo.db().collection(COLLECTIONS.posts).findOne({ orgId: "org-a", "record.id": view.record.id });
  assert.deepEqual([stored!.schedule.at, stored!.schedule.timeZone, stored!.schedule.fingerprint.length], [view.schedule.at, "Asia/Kolkata", 64]);
  assert.deepEqual((await jsonOf(await run())).data, { outcome: "idle", due: 0 }, "not yet");
  nowMs += HOUR;
  const restarted = appFor("org-a"); // a fresh instance: nothing in memory
  const first = (await jsonOf(await run(restarted))).data;
  assert.deepEqual(first, { outcome: "published", due: 1, version: before!.version + 1 });
  assert.ok((await titles()).includes("Survives a restart"));
  assert.ok(PublishedSnapshot.safeParse(await snapshot()).success);
  const after = await data(owner("GET", at));
  assert.deepEqual([after.record.status, after.schedule, after.live], ["published", null, true]);
  const count = await completed();
  assert.deepEqual((await jsonOf(await run())).data, { outcome: "idle", due: 0 }, "idempotent");
  assert.equal(await completed(), count, "no second success");
  assert.ok(!JSON.stringify(await snapshot()).includes("fingerprint"));
});

test("two scheduler runs at once: one publication, one snapshot, one deployment, one success", async () => {
  await scheduledStory("Raced runs");
  nowMs += HOUR;
  const [version, count, calls] = [(await state()).lastVersion, await completed(), deploy.calls.length];
  const outcomes = (await Promise.all([run(), run(), run()].map(async (r) => (await jsonOf(await r)).data.outcome))).sort();
  assert.equal(outcomes.filter((o) => o === "published").length, 1, outcomes.join());
  assert.ok(outcomes.every((o) => ["published", "busy", "idle"].includes(o)), outcomes.join());
  assert.equal((await state()).lastVersion, version + 1);
  assert.equal(await completed(), count + 1);
  assert.equal(deploy.calls.length, calls + 1);
});

test("a run against an owner's publish: exactly one publication takes the due story", async () => {
  await scheduledStory("Run versus publish");
  nowMs += HOUR;
  const version = (await state()).lastVersion;
  const [manual, scheduled] = await Promise.all([owner("POST", "/api/v1/publish"), run()]);
  const outcome = (await jsonOf(scheduled)).data?.outcome;
  assert.ok((manual.status === 200 && ["busy", "idle", "already-published"].includes(outcome)) || (manual.status === 409 && outcome === "published"), `${manual.status} / ${outcome}`);
  assert.equal((await state()).lastVersion, version + 1, "one new version");
  assert.ok((await titles()).includes("Run versus publish"));
  assert.ok(PublishedSnapshot.safeParse(await snapshot()).success);
});

test("a run against an unschedule: either unscheduled first (not published) or published first (nothing to unschedule) — never both", async () => {
  for (let i = 0; i < 3; i++) {
    const title = `Run versus unschedule ${i}`;
    const { at, view } = await scheduledStory(title);
    nowMs += HOUR;
    const [unscheduled, ran] = await Promise.all([owner("POST", `${at}/unschedule`, { revision: view.revision }), run()]);
    const outcome = (await jsonOf(ran)).data?.outcome;
    const published = (await titles()).includes(title);
    if (unscheduled.status === 200) assert.ok(!published && ["idle", "busy"].includes(outcome), `unscheduled, yet ${outcome} / published ${published}`);
    else {
      assert.equal(unscheduled.status, 409);
      // Either the run had the lock (published), or it was busy behind the unschedule's lock — which then lost to … nothing: retry the run.
      if (!published) assert.equal((await jsonOf(await run())).data.outcome, "published");
      assert.ok((await titles()).includes(title));
    }
    assert.ok(PublishedSnapshot.safeParse(await snapshot()).success);
  }
});

test("a run against an edit and an approval: the unapproved edit is never published; the approval waits or joins — the snapshot stays valid", async () => {
  const edited = await scheduledStory("Run versus edit");
  const approving = await data(editor("POST", "/api/v1/stories", { title: "Approved meanwhile", category: "field", body }));
  const sent = await data(editor("POST", `/api/v1/stories/${approving.record.id}/submit`, { revision: approving.revision }));
  nowMs += HOUR;
  await Promise.all([
    editor("PATCH", edited.at, { revision: edited.view.revision, changes: { title: "Edited, never approved" } }),
    owner("POST", `/api/v1/stories/${approving.record.id}/approve`, { revision: sent.revision }),
    run(),
  ]);
  await run(); // whatever is still due
  const live = await titles();
  assert.ok(!live.includes("Edited, never approved"), "an unapproved edit is never public");
  assert.ok(PublishedSnapshot.safeParse(await snapshot()).success);
  const now2 = await data(owner("GET", edited.at));
  assert.ok(now2.record.status === "draft" ? now2.schedule === null : now2.record.status === "published", `${now2.record.status}`);
});

test("a refused scheduled publication keeps the live snapshot and fails the schedule once; a failed deployment is retried, bounded", async () => {
  const before = await snapshot();
  const pictured = await scheduledStory("Pictured, then deleted", HOUR, { imageId });
  await mongo.db().collection(COLLECTIONS.media).updateOne({ orgId: "org-a", id: imageId }, { $set: { status: "deleted" } });
  nowMs += HOUR;
  const rejectedBefore = await mongo.db().collection(COLLECTIONS.auditLogs).countDocuments({ orgId: "org-a", action: "publish.rejected" });
  assert.equal((await jsonOf(await run())).data.outcome, "failed");
  assert.deepEqual(await snapshot(), before, "the live snapshot stays");
  const failed = await data(owner("GET", pictured.at));
  assert.ok(failed.schedule.failedAt && failed.schedule.problems.length);
  assert.deepEqual((await jsonOf(await run())).data, { outcome: "idle", due: 0 }, "not retried by itself");
  assert.equal(await mongo.db().collection(COLLECTIONS.auditLogs).countDocuments({ orgId: "org-a", action: "publish.rejected" }), rejectedBefore + 1);
  await mongo.db().collection(COLLECTIONS.media).updateOne({ orgId: "org-a", id: imageId }, { $set: { status: "ready" } });
  // Rescheduled; the deployment fails at first.
  const rescheduled = await data(owner("POST", `${pictured.at}/schedule`, { revision: failed.revision, ...later(HOUR) }));
  assert.equal(rescheduled.schedule.failedAt, undefined);
  nowMs += HOUR;
  deploy.failNext = 1;
  const published = (await jsonOf(await run())).data;
  assert.equal(published.outcome, "published");
  assert.deepEqual([(await state()).active.deployment.status, (await state()).active.deployment.attempts], ["failed", 1]);
  assert.equal((await jsonOf(await run())).data.outcome, "redeployed");
  assert.deepEqual([(await state()).active.deployment.status, (await state()).active.deployment.attempts, (await state()).lastVersion], ["triggered", 2, published.version], "no new snapshot");
  assert.deepEqual((await jsonOf(await run())).data, { outcome: "idle", due: 0 });
});
