import { test } from "node:test";
import assert from "node:assert/strict";
import { PublishedSnapshot, instantToZonedTime } from "@rbb/content-schema";
import { ApiError } from "../src/errors.ts";
import type { DeploymentOutcome, DeploymentTrigger } from "../src/modules/publishing/deploy.ts";
import { MAX_DEPLOY_ATTEMPTS } from "../src/modules/publishing/service.ts";
import { settingsRecord } from "./fixtures/settings.ts";
import { FACTS, member } from "./media/memory.ts";
import { addMedia, harness, sharedData } from "./settings/memory.ts";
import { approve, approvePage, createApproved } from "./support/workflow.ts";

/* Scheduled publishing (M15): only approved revisions, only owners, only
   future times in an explicit IANA zone; held back from every publish until
   due; then taken — exactly the approved content — by ONE central scheduler
   run (or any publish after the time), idempotently, under the publish
   lock. A refused publication keeps the live snapshot and marks the
   schedule failed; a failed deployment trigger is retried, bounded; a run
   that stopped part-way is finished by the next. Test records only. */

const owner = member("org-a", "OWNER");
const editor = member("org-a", "EDITOR");
const body = [{ type: "paragraph", children: [{ type: "text", text: "A test paragraph." }] }];
const story = (o: Record<string, unknown> = {}) => ({ title: "Test story", category: "field", body, ...o });
const HOUR = 3_600_000;

const rejects = async (promise: Promise<unknown>, code: string, part?: string) =>
  assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError, String(error));
    assert.equal(error.code, code, error.message);
    if (part) assert.ok(error.message.includes(part) || error.details?.some((d) => d.path.includes(part) || d.message.includes(part)), `${error.message} ${JSON.stringify(error.details)}`);
    return true;
  });

/* A deployment trigger that fails the first `failures` times. */
class FlakyDeploy implements DeploymentTrigger {
  readonly name = "webhook";
  calls: number[] = [];
  failures: number;
  constructor(failures = 0) {
    this.failures = failures;
  }
  async trigger(event: { version: number }): Promise<DeploymentOutcome> {
    this.calls.push(event.version);
    return this.calls.length <= this.failures ? { status: "failed", reason: "rejected" } : { status: "triggered" };
  }
}

async function site(deploy: DeploymentTrigger = new FlakyDeploy()) {
  const data = sharedData();
  const h = harness("org-a", data, deploy);
  const image = addMedia(data, "org-a", "ready", { alt: "A described test image" });
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  /* A wall-clock time `ms` from the harness's now, in `zone`. */
  const later = (ms: number, timeZone = "Asia/Kolkata") => ({ localTime: instantToZonedTime(new Date(h.time.now().getTime() + ms).toISOString(), timeZone), timeZone });
  const stories = async () => ((await h.publishing.publicSnapshot())?.content.stories ?? []).map((s) => s.title).sort();
  return { data, h, image, later, stories };
}

/* ---------------- The rules ---------------- */

test("only an APPROVED revision is scheduled — never a draft, a submission, a rejected, archived or published one", async () => {
  const { h, later } = await site();
  const v = await h.stories.create(editor, story(), FACTS);
  await rejects(h.stories.schedule(owner, v.record.id, { revision: 1, ...later(HOUR) }, FACTS), "CONFLICT", "only an approved story can be scheduled");
  const submitted = await h.stories.act(editor, v.record.id, "submit", { revision: 1 }, FACTS);
  await rejects(h.stories.schedule(owner, v.record.id, { revision: submitted.revision, ...later(HOUR) }, FACTS), "CONFLICT", "submitted for review");
  const rejected = await h.stories.act(owner, v.record.id, "reject", { revision: submitted.revision }, FACTS);
  await rejects(h.stories.schedule(owner, v.record.id, { revision: rejected.revision, ...later(HOUR) }, FACTS), "CONFLICT", "schedule is not possible from draft");
  const approved = await approve(h.stories, owner, v.record.id, FACTS);
  const scheduled = await h.stories.schedule(owner, v.record.id, { revision: approved.revision, ...later(HOUR) }, FACTS);
  assert.equal(scheduled.record.status, "approved", "scheduling never changes the workflow state");
  assert.ok(scheduled.schedule);
  const archived = await h.stories.archive(owner, v.record.id, FACTS);
  assert.equal(archived.schedule, null, "archiving drops the schedule");
  await rejects(h.stories.schedule(owner, v.record.id, { revision: archived.revision, ...later(HOUR) }, FACTS), "CONFLICT", "archived");
  const p = await createApproved(h.stories, owner, story({ title: "Published one" }), FACTS);
  await h.publishing.publish(owner, FACTS);
  await rejects(h.stories.schedule(owner, p.record.id, { revision: p.revision, ...later(HOUR) }, FACTS), "CONFLICT", "published");
});

test("owners only (publish:execute); revisions checked; organizations isolated; strict bodies", async () => {
  const data = sharedData();
  const h = harness("org-a", data);
  const b = harness("org-b", data);
  const later = (ms: number) => ({ localTime: instantToZonedTime(new Date(h.time.now().getTime() + ms).toISOString(), "America/Toronto"), timeZone: "America/Toronto" });
  const v = await createApproved(h.posts, owner, { type: "news", title: "Owners schedule", body }, FACTS);
  await rejects(h.posts.schedule(editor, v.record.id, { revision: v.revision, ...later(HOUR) }, FACTS), "FORBIDDEN", "Only an owner");
  await rejects(h.posts.schedule(owner, v.record.id, { revision: v.revision - 1, ...later(HOUR) }, FACTS), "CONFLICT");
  await rejects(h.posts.schedule(owner, v.record.id, { revision: v.revision, ...later(HOUR), status: "published" }, FACTS), "VALIDATION_ERROR");
  await rejects(b.posts.schedule(member("org-b", "OWNER"), v.record.id, { revision: v.revision, ...later(HOUR) }, FACTS), "NOT_FOUND");
  await rejects(h.posts.schedule(member("org-b", "OWNER"), v.record.id, { revision: v.revision, ...later(HOUR) }, FACTS), "FORBIDDEN");
  const s = await h.posts.schedule(owner, v.record.id, { revision: v.revision, ...later(HOUR) }, FACTS);
  assert.equal(s.revision, v.revision + 1, "a schedule is a new revision");
  await rejects(h.posts.unschedule(editor, v.record.id, { revision: s.revision }, FACTS), "FORBIDDEN");
  await rejects(h.posts.unschedule(owner, v.record.id, { revision: v.revision }, FACTS), "CONFLICT");
  const u = await h.posts.unschedule(owner, v.record.id, { revision: s.revision }, FACTS);
  assert.deepEqual([u.record.status, u.schedule], ["approved", null]);
  await rejects(h.posts.unschedule(owner, v.record.id, { revision: u.revision }, FACTS), "CONFLICT", "not scheduled");
});

test("time: future only, within a year, an IANA zone, and never a time the clocks skip or repeat", async () => {
  const { h, later } = await site();
  const v = await createApproved(h.posts, owner, { type: "news", title: "Times", body }, FACTS);
  const at = (localTime: string, timeZone: string) => h.posts.schedule(owner, v.record.id, { revision: v.revision, localTime, timeZone }, FACTS);
  await rejects(at(later(-HOUR).localTime, "Asia/Kolkata"), "VALIDATION_ERROR", "must be in the future");
  await rejects(at(later(0).localTime, "Asia/Kolkata"), "VALIDATION_ERROR", "must be in the future");
  await rejects(at(later(400 * 24 * HOUR).localTime, "Asia/Kolkata"), "VALIDATION_ERROR", "within 366 days");
  for (const zone of ["IST", "EST", "Asia/Nowhere", "+05:30"]) await rejects(at(later(HOUR).localTime, zone), "VALIDATION_ERROR", "body.timeZone");
  await rejects(at("2027-03-14T02:30", "America/New_York"), "VALIDATION_ERROR", "the clocks skip it");
  await rejects(at("2026-11-01T01:30", "America/New_York"), "VALIDATION_ERROR", "the clocks repeat it");
  await rejects(at("2026-13-01T10:00", "UTC"), "VALIDATION_ERROR", "body.localTime");
  const s = await at("2026-10-15T10:00", "Asia/Kolkata");
  assert.deepEqual([s.schedule!.at, s.schedule!.timeZone], ["2026-10-15T04:30:00.000Z", "Asia/Kolkata"], "stored as one UTC instant, with its zone");
  assert.ok(!("fingerprint" in s.schedule!), "the fingerprint stays on the server");
});

test("an edit, a return to draft or an archive drops the schedule — the unapproved edit is never published by it", async () => {
  const { h, later } = await site();
  const v = await createApproved(h.stories, owner, story({ title: "Scheduled then edited" }), FACTS);
  const s = await h.stories.schedule(owner, v.record.id, { revision: v.revision, ...later(HOUR) }, FACTS);
  const edited = await h.stories.update(editor, v.record.id, { revision: s.revision, changes: { title: "Unapproved edit" } }, FACTS);
  assert.deepEqual([edited.record.status, edited.schedule], ["draft", null]);
  h.time.advance(2 * HOUR);
  assert.deepEqual(await h.publishing.runScheduled(FACTS), { outcome: "idle", due: 0 });
  await h.publishing.publish(owner, FACTS);
  assert.ok(!JSON.stringify(await h.publishing.publicSnapshot()).includes("Unapproved edit"), "the edit is never published");
  assert.equal((await h.publishing.publicSnapshot())!.content.stories, undefined);
  const trail = h.audit.filter((e) => e.action === "story.unscheduled").map((e) => e.metadata.reason);
  const again = await approve(h.stories, owner, v.record.id, FACTS);
  const s2 = await h.stories.schedule(owner, v.record.id, { revision: again.revision, ...later(HOUR) }, FACTS);
  await h.stories.act(owner, v.record.id, "reject", { revision: s2.revision }, FACTS);
  const third = await approve(h.stories, owner, v.record.id, FACTS);
  const s3 = await h.stories.schedule(owner, v.record.id, { revision: third.revision, ...later(HOUR) }, FACTS);
  await h.stories.archive(owner, v.record.id, FACTS);
  assert.deepEqual([...trail, ...h.audit.filter((e) => e.action === "story.unscheduled").slice(1).map((e) => e.metadata.reason)], ["edited", "rejected", "archived"]);
  assert.ok(s3.schedule);
});

test("moving a scheduled record in an ordered collection keeps its schedule (no content changed)", async () => {
  const { h, later } = await site();
  const program = (title: string, slug: string) => ({ title, slug, icon: "education", description: "A test line." });
  const a = await createApproved(h.programs, owner, program("Alpha", "alpha"), FACTS);
  const b = await createApproved(h.programs, owner, program("Beta", "beta"), FACTS);
  const s = await h.programs.schedule(owner, a.record.id, { revision: a.revision, ...later(HOUR) }, FACTS);
  await h.programs.reorder(owner, { items: [b, s].map((x) => ({ id: x.record.id, revision: x.revision })) }, FACTS);
  const moved = await h.programs.get(owner, a.record.id);
  assert.ok(moved.schedule, "still scheduled");
  await h.publishing.publish(owner, FACTS);
  assert.deepEqual((await h.publishing.publicSnapshot())!.content.programs!.map((p) => p.slug), ["beta"], "held back until due");
  h.time.advance(2 * HOUR);
  assert.equal((await h.publishing.runScheduled(FACTS)).outcome, "published");
  assert.deepEqual((await h.publishing.publicSnapshot())!.content.programs!.map((p) => p.slug), ["beta", "alpha"], "in the current order");
});

/* ---------------- Publishing what is scheduled ---------------- */

test("held back from every publish until due; then the scheduler publishes exactly that revision, once", async () => {
  const deploy = new FlakyDeploy();
  const { h, later, stories } = await site(deploy);
  await createApproved(h.stories, owner, story({ title: "Story A" }), FACTS);
  await h.publishing.publish(owner, FACTS);
  const b = await createApproved(h.stories, owner, story({ title: "Story B" }), FACTS);
  const s = await h.stories.schedule(owner, b.record.id, { revision: b.revision, ...later(HOUR) }, FACTS);
  const before = await h.publishing.publicSnapshot();
  // Before the time: not in a status's NOW, not in any publish, the scheduler does nothing.
  const status = await h.publishing.status(owner);
  assert.deepEqual(status.review.approved, []);
  assert.deepEqual(status.review.scheduled.map((x) => [x.title, x.at, x.timeZone, x.failed]), [["Story B", s.schedule!.at, "Asia/Kolkata", false]]);
  assert.deepEqual(status.review.totals, { approved: 0, scheduled: 1, submitted: 0 });
  await rejects(h.publishing.publish(owner, FACTS), "CONFLICT", "There are no unpublished changes");
  assert.deepEqual(await h.publishing.runScheduled(FACTS), { outcome: "idle", due: 0 });
  assert.deepEqual(await h.publishing.publicSnapshot(), before);
  assert.deepEqual(await stories(), ["Story A"]);
  // At the time: the scheduler publishes it.
  h.time.advance(HOUR);
  assert.notEqual((await h.publishing.status(owner)).changesKey, status.changesKey, "what would be published changed when it became due");
  const run = await h.publishing.runScheduled(FACTS);
  assert.deepEqual(run, { outcome: "published", due: 1, version: before!.version + 1 });
  assert.deepEqual(await stories(), ["Story A", "Story B"]);
  const after = await h.stories.get(owner, b.record.id);
  assert.deepEqual([after.record.status, after.schedule, after.revision], ["published", null, s.revision], "published at exactly the scheduled revision; the schedule is done");
  const completed = h.audit.filter((e) => e.action === "publish.completed").at(-1)!;
  assert.deepEqual([completed.actorUserId, completed.metadata.trigger, completed.metadata.scheduled], [null, "schedule", [{ section: "Stories", id: b.record.id, at: s.schedule!.at }]]);
  assert.equal((await h.publishing.publicSnapshot())!.version, run.outcome === "published" ? run.version : 0);
  // Again: nothing to do — no new snapshot, no deployment, no audit.
  const events = h.audit.length;
  assert.deepEqual(await h.publishing.runScheduled(FACTS), { outcome: "idle", due: 0 });
  assert.equal(h.audit.length, events);
  assert.deepEqual(deploy.calls, [1, 2], "one deployment per version");
  const text = JSON.stringify(await h.publishing.publicSnapshot());
  for (const leak of ["fingerprint", "schedule", "Asia/Kolkata"]) assert.ok(!text.includes(leak), `leaked: ${leak}`);
  assert.ok(PublishedSnapshot.safeParse(await h.publishing.publicSnapshot()).success);
});

test("an owner's publish after the time takes a due schedule too — then the scheduler has nothing left to do", async () => {
  const { h, later, stories } = await site();
  const b = await createApproved(h.stories, owner, story({ title: "Due by hand" }), FACTS);
  await h.stories.schedule(owner, b.record.id, { revision: b.revision, ...later(HOUR) }, FACTS);
  h.time.advance(HOUR + 1);
  const result = await h.publishing.publish(owner, FACTS);
  assert.equal(result.scheduled, 1);
  assert.deepEqual(await stories(), ["Due by hand"]);
  assert.deepEqual(await h.publishing.runScheduled(FACTS), { outcome: "idle", due: 0 });
});

test("a single page (the homepage) is scheduled as a whole revision; its live version stays until then", async () => {
  const { h, image, later } = await site();
  const who = (heading: string) => ({ id: "who", type: "imageText", enabled: true, version: 1, data: { heading, body: ["A paragraph."], imageId: image.id } });
  await h.homepage.create(owner, { sections: [who("Live heading")] }, FACTS);
  await approvePage(h.homepage, owner, FACTS);
  await h.publishing.publish(owner, FACTS);
  const page = await h.homepage.get(owner);
  const edited = await h.homepage.update(editor, { revision: page.revision, changes: { sections: [who("Scheduled heading")] } }, FACTS);
  const approved = await approvePage(h.homepage, owner, FACTS);
  await rejects(h.homepage.schedule(editor, { revision: approved.revision, ...later(HOUR) }, FACTS), "FORBIDDEN");
  const s = await h.homepage.schedule(owner, { revision: approved.revision, ...later(HOUR) }, FACTS);
  assert.ok(edited && s.schedule && s.live);
  const heading = async () => ((await h.publishing.publicSnapshot())!.content.homepage!.sections[0]!.data as { heading: string }).heading;
  assert.equal((await h.publishing.runScheduled(FACTS)).outcome, "idle");
  assert.equal(await heading(), "Live heading");
  h.time.advance(HOUR);
  assert.equal((await h.publishing.runScheduled(FACTS)).outcome, "published");
  assert.equal(await heading(), "Scheduled heading");
  const after = await h.homepage.get(owner);
  assert.deepEqual([after.record!.status, after.schedule], ["published", null]);
  assert.equal(h.audit.filter((e) => e.action === "homepage.scheduled").length, 1);
});

test("a refused scheduled publication keeps the live snapshot, marks the schedule failed, and is not retried by itself", async () => {
  const { data, h, image, later, stories } = await site();
  await createApproved(h.stories, owner, story({ title: "Live story" }), FACTS);
  await h.publishing.publish(owner, FACTS);
  const before = await h.publishing.publicSnapshot();
  const b = await createApproved(h.stories, owner, story({ title: "Pictured", imageId: image.id }), FACTS);
  const s = await h.stories.schedule(owner, b.record.id, { revision: b.revision, ...later(HOUR) }, FACTS);
  data.media.find((m) => m.id === image.id)!.status = "deleted";
  h.time.advance(HOUR);
  const run = await h.publishing.runScheduled(FACTS);
  assert.equal(run.outcome, "failed");
  assert.deepEqual(await h.publishing.publicSnapshot(), before, "the live snapshot is untouched");
  assert.deepEqual(await stories(), ["Live story"]);
  const failed = await h.stories.get(owner, b.record.id);
  assert.deepEqual([failed.record.status, Boolean(failed.schedule?.failedAt), failed.schedule!.problems!.length > 0], ["approved", true, true]);
  assert.equal((await h.publishing.status(owner)).review.scheduled[0]!.failed, true);
  const rejected = h.audit.filter((e) => e.action === "publish.rejected");
  assert.deepEqual([rejected.length, rejected[0]!.metadata.trigger], [1, "schedule"]);
  // Not retried by itself: no second refusal, no second audit.
  assert.deepEqual(await h.publishing.runScheduled(FACTS), { outcome: "idle", due: 0 });
  assert.equal(h.audit.filter((e) => e.action === "publish.rejected").length, 1);
  // Fixed and rescheduled by an owner: published at the new time.
  data.media.find((m) => m.id === image.id)!.status = "ready";
  const again = await h.stories.schedule(owner, b.record.id, { revision: failed.revision, ...later(HOUR) }, FACTS);
  assert.equal(again.schedule!.failedAt, undefined, "a new schedule starts clean");
  assert.notEqual(again.schedule!.at, s.schedule!.at);
  h.time.advance(HOUR);
  assert.equal((await h.publishing.runScheduled(FACTS)).outcome, "published");
  assert.deepEqual(await stories(), ["Live story", "Pictured"]);
});

/* ---------------- Locks, races, failures ---------------- */

test("one at a time: a run while the publish lock is held does nothing; a publish while a run holds it is refused", async () => {
  const { data, h, later, stories } = await site();
  const b = await createApproved(h.stories, owner, story({ title: "Locked out" }), FACTS);
  const s = await h.stories.schedule(owner, b.record.id, { revision: b.revision, ...later(HOUR) }, FACTS);
  h.time.advance(HOUR);
  // Another instance holds the lock (a publish in flight): nothing about scheduling moves meanwhile.
  assert.ok(await h.publishStore.acquireLock("someone-else", h.time.now(), 60_000));
  assert.deepEqual(await h.publishing.runScheduled(FACTS), { outcome: "busy", due: 0 });
  await rejects(h.publishing.publish(owner, FACTS), "CONFLICT", "A website publication is in progress");
  await rejects(h.stories.unschedule(owner, b.record.id, { revision: s.revision }, FACTS), "CONFLICT", "A website publication is in progress");
  await rejects(h.stories.schedule(owner, b.record.id, { revision: s.revision, ...later(HOUR) }, FACTS), "CONFLICT", "A website publication is in progress");
  assert.ok((await h.stories.get(owner, b.record.id)).schedule, "unchanged");
  await h.publishStore.releaseLock("someone-else");
  // Two runs "at once": the memory store serialises them — one publishes, the other finds nothing.
  const [first, second] = await Promise.all([h.publishing.runScheduled(FACTS), h.publishing.runScheduled(FACTS)]);
  assert.deepEqual([first.outcome, second.outcome].sort(), ["busy", "published"]);
  assert.equal(data.snapshots.filter((x) => x.orgId === "org-a").length, 1, "one snapshot");
  assert.equal(h.audit.filter((e) => e.action === "publish.completed").length, 1, "one success");
  assert.deepEqual(await stories(), ["Locked out"]);
});

test("a failed deployment trigger is retried by the scheduler, bounded — never a new snapshot", async () => {
  const deploy = new FlakyDeploy(10);
  const { data, h, later } = await site(deploy);
  const b = await createApproved(h.stories, owner, story({ title: "Deployed later" }), FACTS);
  await h.stories.schedule(owner, b.record.id, { revision: b.revision, ...later(HOUR) }, FACTS);
  h.time.advance(HOUR);
  assert.equal((await h.publishing.runScheduled(FACTS)).outcome, "published");
  let active = (await h.publishing.status(owner)).active!;
  assert.deepEqual([active.deployment!.status, active.deployment!.attempts], ["failed", 1]);
  for (let attempt = 2; attempt <= MAX_DEPLOY_ATTEMPTS; attempt++) assert.equal((await h.publishing.runScheduled(FACTS)).outcome, "redeployed");
  assert.deepEqual(await h.publishing.runScheduled(FACTS), { outcome: "idle", due: 0 }, "bounded");
  active = (await h.publishing.status(owner)).active!;
  assert.deepEqual([active.version, active.deployment!.attempts], [1, MAX_DEPLOY_ATTEMPTS]);
  assert.deepEqual(deploy.calls, [1, 1, 1]);
  assert.equal(data.snapshots.length, 1);
  assert.equal(h.audit.filter((e) => e.action === "publish.redeployed").length, MAX_DEPLOY_ATTEMPTS - 1);
});

test("a run that stopped after the public moved is finished by the next one — no duplicate snapshot, deployment or success", async () => {
  const deploy = new FlakyDeploy();
  const { data, h, later, stories } = await site(deploy);
  const b = await createApproved(h.stories, owner, story({ title: "Crash-safe" }), FACTS);
  await h.stories.schedule(owner, b.record.id, { revision: b.revision, ...later(HOUR) }, FACTS);
  const row = data.posts.find((r) => r.record.id === b.record.id)!;
  const schedule = structuredClone(row.schedule);
  h.time.advance(HOUR);
  await h.publishing.runScheduled(FACTS);
  // Rewind to the moment after activation: deployment pending, nothing marked, no success audited.
  data.publish.get("org-a")!.active!.deployment = { status: "pending", attempts: 0 };
  row.record = { ...row.record, status: "approved" };
  row.schedule = schedule;
  delete row.publishedRevision;
  h.audit.splice(h.audit.findIndex((e) => e.action === "publish.completed"), 1);
  deploy.calls.length = 0;
  // The next run finishes it.
  assert.equal((await h.publishing.runScheduled(FACTS)).outcome, "recovered");
  assert.equal(data.snapshots.length, 1, "no duplicate snapshot");
  assert.deepEqual(deploy.calls, [1], "the deployment told once");
  assert.equal((await h.stories.get(owner, b.record.id)).record.status, "published", "marked");
  const completed = h.audit.filter((e) => e.action === "publish.completed");
  assert.deepEqual(completed.map((e) => e.metadata.trigger), ["recovery"], "one success audited");
  assert.deepEqual(await h.publishing.runScheduled(FACTS), { outcome: "idle", due: 0 });
  assert.deepEqual(await stories(), ["Crash-safe"]);
});

test("races, in turn: unschedule before the run; approval and edits during the wait; publish vs. run", async () => {
  const { h, later, stories } = await site();
  const a = await createApproved(h.stories, owner, story({ title: "Unscheduled in time" }), FACTS);
  const sa = await h.stories.schedule(owner, a.record.id, { revision: a.revision, ...later(HOUR) }, FACTS);
  const b = await createApproved(h.stories, owner, story({ title: "Edited in time" }), FACTS);
  const sb = await h.stories.schedule(owner, b.record.id, { revision: b.revision, ...later(HOUR) }, FACTS);
  const c = await h.stories.create(editor, story({ title: "Approved during the wait" }), FACTS);
  h.time.advance(HOUR / 2);
  await h.stories.unschedule(owner, a.record.id, { revision: sa.revision }, FACTS);
  await h.stories.update(editor, b.record.id, { revision: sb.revision, changes: { excerpt: "Unapproved." } }, FACTS);
  await approve(h.stories, owner, c.record.id, FACTS);
  h.time.advance(HOUR);
  // Nothing is due any more: the run does nothing; the unscheduled approved story waits for an owner's publish.
  assert.deepEqual(await h.publishing.runScheduled(FACTS), { outcome: "idle", due: 0 });
  assert.equal(await h.publishing.publicSnapshot(), null);
  await h.publishing.publish(owner, FACTS);
  assert.deepEqual(await stories(), ["Approved during the wait", "Unscheduled in time"], "an owner's publish takes the approved, unscheduled ones — never the unapproved edit");
});
