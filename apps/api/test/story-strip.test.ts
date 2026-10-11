import { test } from "node:test";
import assert from "node:assert/strict";
import { PublishedSnapshot, instantToZonedTime } from "@rbb/content-schema";
import { ApiError } from "../src/errors.ts";
import { secretProblems } from "../src/modules/publishing/service.ts";
import { settingsRecord } from "./fixtures/settings.ts";
import { FACTS, member } from "./media/memory.ts";
import { addMedia, harness, sharedData } from "./settings/memory.ts";
import { approve, approvePage } from "./support/workflow.ts";

/* Highlights — the story strip (M23): one typed record naming appeals in
   order; references to this organization's appeals, approved before the
   strip is; the strip in the snapshot only while published, its appeals
   published with it. Test data only. */

const owner = member("org-a", "OWNER");
const editor = member("org-a", "EDITOR");
const HOUR = 3_600_000;

const rejects = async (promise: Promise<unknown>, code: string, pathPart?: string) =>
  assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError, String(error));
    assert.equal(error.code, code, error.message);
    if (pathPart) assert.ok(error.details?.some((d) => d.path.includes(pathPart) || d.message.includes(pathPart)), JSON.stringify(error.details));
    return true;
  });

const site = async () => {
  const data = sharedData();
  const h = harness("org-a", data);
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  const image = addMedia(data, "org-a", "ready", { alt: "A photo" });
  const appeal = async (title: string) => (await h.appeals.create(owner, { kind: "campaign", title, summary: "S.", imageId: image.id }, FACTS)).record;
  return { data, h, appeal };
};

test("story strip: appeals of this organization, in order, each once, at most four; structure-only audit", async () => {
  const { data, h, appeal } = await site();
  const a = await appeal("Test appeal A");
  const b = await appeal("Test appeal B");
  assert.equal((await h.storyStrip.get(editor)).record, null);
  const created = await h.storyStrip.update(editor, { revision: 0, changes: {} }, FACTS);
  assert.deepEqual([created.record!.id, created.record!.status, created.record!.appealIds], ["story-strip", "draft", []]);
  await rejects(h.storyStrip.update(editor, { revision: created.revision, changes: { appealIds: ["no-such-appeal"] } }, FACTS), "VALIDATION_ERROR", "does not exist");
  const other = await harness("org-b", data).appeals.create(member("org-b", "OWNER"), { kind: "campaign", title: "Other org", summary: "S.", imageId: addMedia(data, "org-b", "ready").id }, FACTS);
  await rejects(h.storyStrip.update(editor, { revision: created.revision, changes: { appealIds: [other.record.id] } }, FACTS), "VALIDATION_ERROR", "does not exist");
  await rejects(h.storyStrip.update(editor, { revision: created.revision, changes: { appealIds: [a.id, a.id] } }, FACTS), "VALIDATION_ERROR", "twice");
  await rejects(h.storyStrip.update(editor, { revision: created.revision, changes: { appealIds: ["1", "2", "3", "4", "5"] } }, FACTS), "VALIDATION_ERROR", "appealIds");
  const saved = await h.storyStrip.update(editor, { revision: created.revision, changes: { appealIds: [b.id, a.id] } }, FACTS);
  assert.deepEqual(saved.record!.appealIds, [b.id, a.id], "the order is the editor's");
  await rejects(h.storyStrip.update(editor, { revision: created.revision, changes: { appealIds: [] } }, FACTS), "CONFLICT");
  const trail = h.audit.filter((e) => e.resourceType === "story_strip");
  assert.deepEqual(trail.map((e) => [e.action, e.resourceId, e.metadata.fields]), [["story_strip.created", "story-strip", ["appealIds", "status"]], ["story_strip.updated", "story-strip", ["appealIds"]]]);
  await h.appeals.archive(owner, a.id, FACTS);
  await rejects(h.storyStrip.update(editor, { revision: saved.revision, changes: { appealIds: [a.id] } }, FACTS), "VALIDATION_ERROR", "archived");
});

test("story strip: submitting needs approved appeals; approving needs one; owners approve", async () => {
  const { h, appeal } = await site();
  const a = await appeal("Test appeal A");
  let v = await h.storyStrip.update(editor, { revision: 0, changes: { appealIds: [a.id] } }, FACTS);
  await rejects(h.storyStrip.act(editor, "submit", { revision: v.revision }, FACTS), "VALIDATION_ERROR", "not approved yet");
  await approve(h.appeals, owner, a.id, FACTS);
  v = await h.storyStrip.act(editor, "submit", { revision: v.revision }, FACTS);
  await rejects(h.storyStrip.act(editor, "approve", { revision: v.revision }, FACTS), "FORBIDDEN");
  v = await h.storyStrip.act(owner, "approve", { revision: v.revision }, FACTS);
  assert.equal(v.record!.status, "approved");
  const empty = await h.storyStrip.update(editor, { revision: v.revision, changes: { appealIds: [] } }, FACTS);
  const submitted = await h.storyStrip.act(editor, "submit", { revision: empty.revision }, FACTS);
  await rejects(h.storyStrip.act(owner, "approve", { revision: submitted.revision }, FACTS), "VALIDATION_ERROR", "at least one appeal");
});

test("snapshot: the strip only once published, with its appeals published in the same snapshot; a pending edit keeps the live strip", async () => {
  const { h, appeal } = await site();
  const a = await appeal("Test appeal A");
  const b = await appeal("Test appeal B");
  for (const id of [a.id, b.id]) await approve(h.appeals, owner, id, FACTS);
  await h.publishing.publish(owner, FACTS);
  assert.equal((await h.publishing.publicSnapshot())!.content.storyStrip, undefined, "no strip: the website keeps its rule");
  await h.storyStrip.update(editor, { revision: 0, changes: { appealIds: [b.id, a.id] } }, FACTS);
  await rejects(h.publishing.publish(owner, FACTS), "CONFLICT");
  await approvePage(h.storyStrip, owner, FACTS);
  await h.publishing.publish(owner, FACTS);
  let snapshot = (await h.publishing.publicSnapshot())!;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.deepEqual([snapshot.content.storyStrip!.status, snapshot.content.storyStrip!.appealIds], ["published", [b.id, a.id]]);
  for (const leak of ["revision", "updatedBy", "createdAt", "updatedAt"]) assert.ok(!JSON.stringify(snapshot.content.storyStrip).includes(leak), leak);
  assert.deepEqual(secretProblems(snapshot), []);

  const live = await h.storyStrip.get(owner);
  await h.storyStrip.update(editor, { revision: live.revision, changes: { appealIds: [a.id] } }, FACTS);
  await rejects(h.publishing.publish(owner, FACTS), "CONFLICT");
  snapshot = (await h.publishing.publicSnapshot())!;
  assert.deepEqual(snapshot.content.storyStrip!.appealIds, [b.id, a.id], "the pending edit is not published");

  // An appeal leaving the website takes the strip's publish with it: refused, nothing public changes.
  const pending = await h.storyStrip.get(owner);
  await h.storyStrip.update(editor, { revision: pending.revision, changes: { appealIds: [b.id, a.id] } }, FACTS);
  await approvePage(h.storyStrip, owner, FACTS);
  await h.appeals.archive(owner, b.id, FACTS);
  const status = await h.publishing.status(owner);
  assert.ok(status.blockers.some((x) => x.includes("storyStrip") && x.includes("not published")), JSON.stringify(status.blockers));

  await h.storyStrip.archive(owner, FACTS);
  assert.equal((await h.storyStrip.get(owner)).record!.status, "archived", "archiving is never refused by its references");
  await h.publishing.publish(owner, FACTS);
  assert.equal((await h.publishing.publicSnapshot())!.content.storyStrip, undefined, "archived: the website's rule returns");
});

test("scheduling: the approved strip joins the publish that falls due; organizations stay apart", async () => {
  const { data, h, appeal } = await site();
  const a = await appeal("Test appeal A");
  await approve(h.appeals, owner, a.id, FACTS);
  await h.publishing.publish(owner, FACTS);
  await h.storyStrip.update(editor, { revision: 0, changes: { appealIds: [a.id] } }, FACTS);
  const approved = await approvePage(h.storyStrip, owner, FACTS);
  const at = { localTime: instantToZonedTime(new Date(h.time.now().getTime() + HOUR).toISOString(), "UTC"), timeZone: "UTC" };
  await rejects(h.storyStrip.schedule(editor, { revision: approved.revision, ...at }, FACTS), "FORBIDDEN");
  await h.storyStrip.schedule(owner, { revision: approved.revision, ...at }, FACTS);
  assert.ok((await h.publishing.status(owner)).review.scheduled.some((s) => s.section === "Highlights"));
  h.time.advance(HOUR + 1);
  assert.equal((await h.publishing.runScheduled(FACTS)).outcome, "published");
  assert.deepEqual((await h.publishing.publicSnapshot())!.content.storyStrip!.appealIds, [a.id]);
  const b = harness("org-b", data);
  await rejects(b.storyStrip.get(owner), "FORBIDDEN");
  assert.equal((await b.storyStrip.get(member("org-b", "OWNER"))).record, null);
});
