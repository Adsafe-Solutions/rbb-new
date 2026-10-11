import { test } from "node:test";
import assert from "node:assert/strict";
import { PublishedSnapshot } from "@rbb/content-schema";
import { ApiError } from "../src/errors.ts";
import { settingsRecord } from "./fixtures/settings.ts";
import { FACTS, member } from "./media/memory.ts";
import { addMedia, harness, sharedData } from "./settings/memory.ts";
import { approve, approvePage, createApproved } from "./support/workflow.ts";

/* The editorial workflow (M14): draft → submitted → approved → published
   (by the website publish only), the explicit transitions, who may make
   them, revisions, the audit trail — and the rule everything else serves:
   an edit to published content changes NOTHING public until it is
   approved AND the website is published; the live version stays
   meanwhile. Test records only. */

const owner = member("org-a", "OWNER");
const editor = member("org-a", "EDITOR");
const body = [{ type: "paragraph", children: [{ type: "text", text: "A test paragraph." }] }];
const story = (o: Record<string, unknown> = {}) => ({ title: "Test story", category: "field", body, ...o });
const program = (o: Record<string, unknown> = {}) => ({ title: "Education", slug: "education", icon: "education", description: "A test line.", ...o });
const block = (id: string, type: string, data: unknown, enabled = true) => ({ id, type, enabled, version: 1, data });
const faq = (question: string) => block("faq", "faq", { heading: "Questions", items: [{ question, answer: "An answer." }] });
const who = (imageId: string, heading = "Who we are") => block("who", "imageText", { heading, body: ["A paragraph."], imageId });

const rejects = async (promise: Promise<unknown>, code: string, part?: string) =>
  assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError, String(error));
    assert.equal(error.code, code, error.message);
    if (part) assert.ok(error.message.includes(part) || error.details?.some((d) => d.path.includes(part) || d.message.includes(part)), `${error.message} ${JSON.stringify(error.details)}`);
    return true;
  });

async function live() {
  const data = sharedData();
  const h = harness("org-a", data);
  const image = addMedia(data, "org-a", "ready", { alt: "A described test image" });
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  return { data, h, image };
}
/* The public snapshot, as the website build reads it. */
const publicOf = async (h: ReturnType<typeof harness>) => structuredClone((await h.publishing.publicSnapshot())!);

/* ---------------- Transitions ---------------- */

test("transitions: every action from every state, for owners and editors — only the documented moves succeed", async () => {
  type State = "draft" | "submitted" | "approved" | "published" | "archived";
  const STATES: State[] = ["draft", "submitted", "approved", "published", "archived"];
  const ALLOWED: Record<string, Partial<Record<State, string>>> = {
    submit: { draft: "submitted" },
    withdraw: { submitted: "draft" },
    approve: { submitted: "approved" },
    reject: { submitted: "draft", approved: "draft" },
  };
  for (const [who, auth] of [["owner", owner], ["editor", editor]] as const)
    for (const action of ["submit", "withdraw", "approve", "reject"] as const) {
      const { h } = await live();
      const ids = {} as Record<State, string>;
      // The published one first (the website publish takes it), then the rest.
      const make = async (state: State) => {
        const v = await h.posts.create(owner, { type: "news", title: `${action} from ${state}`, body }, FACTS);
        ids[state] = v.record.id;
        if (state === "submitted") await h.posts.act(owner, v.record.id, "submit", { revision: v.revision }, FACTS);
        if (state === "approved" || state === "published") await approve(h.posts, owner, v.record.id, FACTS);
        if (state === "archived") await h.posts.archive(owner, v.record.id, FACTS);
      };
      await make("published");
      await h.publishing.publish(owner, FACTS);
      for (const state of STATES.filter((s) => s !== "published")) await make(state);
      for (const state of STATES) {
        const before = await h.posts.get(owner, ids[state]);
        assert.equal(before.record.status, state);
        const attempt = h.posts.act(auth, ids[state], action, { revision: before.revision }, FACTS);
        const ownersOnly = action === "approve" || action === "reject";
        if (who === "editor" && ownersOnly) await rejects(attempt, "FORBIDDEN");
        else if (ALLOWED[action]![state]) {
          const after = await attempt;
          assert.equal(after.record.status, ALLOWED[action]![state], `${who} ${action} from ${state}`);
          assert.equal(after.revision, before.revision + 1, "a transition is a new revision");
        } else {
          await rejects(attempt, "CONFLICT", `${action} is not possible from ${state}`);
          const unchanged = await h.posts.get(owner, ids[state]);
          assert.deepEqual([unchanged.record.status, unchanged.revision], [state, before.revision], "a refused transition changes nothing");
        }
      }
    }
});

test("invalid moves fail: draft→approve, draft→published, submitted→submit, archived→published, published→approve", async () => {
  const { h } = await live();
  const draft = await h.posts.create(editor, { type: "news", title: "Invalid moves", body }, FACTS);
  await rejects(h.posts.act(owner, draft.record.id, "approve", { revision: 1 }, FACTS), "CONFLICT", "approve is not possible from draft");
  for (const status of ["published", "approved", "submitted"])
    await rejects(h.posts.update(owner, draft.record.id, { revision: 1, changes: { status } }, FACTS), "VALIDATION_ERROR", "body.changes.status");
  const submitted = await h.posts.act(editor, draft.record.id, "submit", { revision: 1 }, FACTS);
  await rejects(h.posts.act(editor, draft.record.id, "submit", { revision: submitted.revision }, FACTS), "CONFLICT", "submit is not possible from submitted");
  await h.posts.act(owner, draft.record.id, "approve", { revision: submitted.revision }, FACTS);
  await h.publishing.publish(owner, FACTS);
  const published = await h.posts.get(owner, draft.record.id);
  assert.equal(published.record.status, "published");
  await rejects(h.posts.act(owner, draft.record.id, "approve", { revision: published.revision }, FACTS), "CONFLICT", "approve is not possible from published");
  const archived = await h.posts.archive(owner, draft.record.id, FACTS);
  await rejects(h.posts.update(owner, draft.record.id, { revision: archived.revision, changes: { status: "published" } }, FACTS), "VALIDATION_ERROR", "body.changes.status");
  await rejects(h.posts.act(owner, draft.record.id, "submit", { revision: archived.revision }, FACTS), "CONFLICT", "submit is not possible from archived");
  await rejects(h.posts.update(owner, draft.record.id, { revision: archived.revision, changes: { title: "Edited while archived" } }, FACTS), "CONFLICT", "archived");
  // Malformed transition bodies.
  await rejects(h.posts.act(owner, draft.record.id, "submit", {}, FACTS), "VALIDATION_ERROR", "body.revision");
  await rejects(h.posts.act(owner, draft.record.id, "submit", { revision: archived.revision, status: "published" }, FACTS), "VALIDATION_ERROR");
});

test("a submitted revision is locked: edits wait until it is withdrawn or returned to draft", async () => {
  const { h } = await live();
  const v = await h.stories.create(editor, story(), FACTS);
  const submitted = await h.stories.act(editor, v.record.id, "submit", { revision: v.revision }, FACTS);
  await rejects(h.stories.update(editor, v.record.id, { revision: submitted.revision, changes: { title: "Changed under review" } }, FACTS), "CONFLICT", "submitted for review");
  await rejects(h.stories.update(owner, v.record.id, { revision: submitted.revision, changes: { title: "Changed under review" } }, FACTS), "CONFLICT", "submitted for review");
  // A save that changes nothing is not an edit.
  assert.equal((await h.stories.update(editor, v.record.id, { revision: submitted.revision, changes: { title: "Test story" } }, FACTS)).revision, submitted.revision);
  const withdrawn = await h.stories.act(editor, v.record.id, "withdraw", { revision: submitted.revision }, FACTS);
  assert.equal((await h.stories.update(editor, v.record.id, { revision: withdrawn.revision, changes: { title: "Changed after withdrawal" } }, FACTS)).record.status, "draft");
});

test("revisions: a stale transition is a 409 and changes nothing; organizations are isolated", async () => {
  const data = sharedData();
  const h = harness("org-a", data);
  const b = harness("org-b", data);
  const v = await h.posts.create(editor, { type: "news", title: "Stale actions", body }, FACTS);
  const edited = await h.posts.update(editor, v.record.id, { revision: 1, changes: { excerpt: "Edited." } }, FACTS);
  await rejects(h.posts.act(editor, v.record.id, "submit", { revision: 1 }, FACTS), "CONFLICT");
  const submitted = await h.posts.act(editor, v.record.id, "submit", { revision: edited.revision }, FACTS);
  await rejects(h.posts.act(owner, v.record.id, "approve", { revision: edited.revision }, FACTS), "CONFLICT");
  assert.equal((await h.posts.get(owner, v.record.id)).record.status, "submitted");
  // Another organization's owner: not found in their own organization, refused in this one.
  const bOwner = member("org-b", "OWNER");
  await rejects(b.posts.act(bOwner, v.record.id, "approve", { revision: submitted.revision }, FACTS), "NOT_FOUND");
  await rejects(h.posts.act(bOwner, v.record.id, "approve", { revision: submitted.revision }, FACTS), "FORBIDDEN");
  await rejects(b.homepage.act(bOwner, "submit", { revision: 1 }, FACTS), "NOT_FOUND");
  assert.equal((await h.posts.get(owner, v.record.id)).record.status, "submitted");
});

test("audit: submitted, withdrawn, approved and rejected — who, from, to, revision; never the wording", async () => {
  const { h, image } = await live();
  const v = await h.stories.create(editor, story({ title: "Audited story never in the trail" }), FACTS);
  await h.stories.act(editor, v.record.id, "submit", { revision: 1 }, FACTS);
  await h.stories.act(editor, v.record.id, "withdraw", { revision: 2 }, FACTS);
  await h.stories.act(editor, v.record.id, "submit", { revision: 3 }, FACTS);
  await h.stories.act(owner, v.record.id, "reject", { revision: 4 }, FACTS);
  await h.stories.act(editor, v.record.id, "submit", { revision: 5 }, FACTS);
  await h.stories.act(owner, v.record.id, "approve", { revision: 6 }, FACTS);
  await h.homepage.create(editor, { sections: [who(image.id)] }, FACTS);
  await h.homepage.act(editor, "submit", { revision: 1 }, FACTS);
  await h.homepage.act(owner, "approve", { revision: 2 }, FACTS);
  const trail = h.audit.filter((e) => /\.(submitted|withdrawn|approved|rejected)$/.test(e.action));
  assert.deepEqual(
    trail.map((e) => [e.action, e.actorUserId === owner.user.id ? "owner" : "editor", e.metadata]),
    [
      ["story.submitted", "editor", { from: "draft", to: "submitted", revision: 2 }],
      ["story.withdrawn", "editor", { from: "submitted", to: "draft", revision: 3 }],
      ["story.submitted", "editor", { from: "draft", to: "submitted", revision: 4 }],
      ["story.rejected", "owner", { from: "submitted", to: "draft", revision: 5 }],
      ["story.submitted", "editor", { from: "draft", to: "submitted", revision: 6 }],
      ["story.approved", "owner", { from: "submitted", to: "approved", revision: 7 }],
      ["homepage.submitted", "editor", { from: "draft", to: "submitted", revision: 2 }],
      ["homepage.approved", "owner", { from: "submitted", to: "approved", revision: 3 }],
    ]
  );
  assert.ok(trail.every((e) => e.resourceId), "each names its record");
  assert.ok(!JSON.stringify(h.audit).includes("never in the trail"), "wording is never audited");
  // A refused transition writes nothing.
  const count = h.audit.length;
  await rejects(h.stories.act(editor, v.record.id, "approve", { revision: 7 }, FACTS), "FORBIDDEN");
  await rejects(h.stories.act(owner, v.record.id, "submit", { revision: 7 }, FACTS), "CONFLICT");
  assert.equal(h.audit.length, count);
});

/* ---------------- What the website publish takes ---------------- */

test("publish takes approved revisions only; the live version of an edited record is carried forward; archived records leave", async () => {
  const { h } = await live();
  const kept = await createApproved(h.stories, owner, story({ title: "Live story" }), FACTS);
  const gone = await createApproved(h.stories, owner, story({ title: "Story to archive" }), FACTS);
  await h.publishing.publish(owner, FACTS);
  assert.deepEqual((await publicOf(h)).content.stories!.map((s) => s.title).sort(), ["Live story", "Story to archive"]);

  // Never published: draft, submitted and approved revisions are not public.
  const fresh = await h.stories.create(editor, story({ title: "Fresh draft" }), FACTS);
  const pending = await h.stories.create(editor, story({ title: "Fresh submitted" }), FACTS);
  await h.stories.act(editor, pending.record.id, "submit", { revision: 1 }, FACTS);
  const approved = await createApproved(h.stories, owner, story({ title: "Fresh approved" }), FACTS);
  assert.equal(approved.live, false);
  // An edit to the live story — submitted, not approved: the live version stays.
  const edit = await h.stories.update(editor, kept.record.id, { revision: kept.revision, changes: { title: "Edited, not approved" } }, FACTS);
  assert.deepEqual([edit.record.status, edit.live], ["draft", true]);
  await h.stories.act(editor, kept.record.id, "submit", { revision: edit.revision }, FACTS);
  await h.stories.archive(owner, gone.record.id, FACTS);
  assert.equal((await h.stories.get(owner, gone.record.id)).live, false, "archived: no live version once published");

  const status = await h.publishing.status(owner);
  assert.deepEqual(status.review.approved, [{ section: "Stories", title: "Fresh approved" }]);
  assert.deepEqual(status.review.submitted.map((r) => r.title).sort(), ["Edited, not approved", "Fresh submitted"]);
  assert.deepEqual(status.review.totals, { approved: 1, scheduled: 0, submitted: 2 });
  await h.publishing.publish(owner, FACTS);
  const snapshot = await publicOf(h);
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.deepEqual(snapshot.content.stories!.map((s) => s.title).sort(), ["Fresh approved", "Live story"]);
  const text = JSON.stringify(snapshot);
  for (const leak of ["Fresh draft", "Fresh submitted", "Edited, not approved", "Story to archive"]) assert.ok(!text.includes(leak), `leaked: ${leak}`);
  // The publish marks what it took: approved → published, same revision; the edited one stays submitted.
  const marked = await h.stories.get(owner, approved.record.id);
  assert.deepEqual([marked.record.status, marked.revision, marked.live, Boolean(marked.record.publishedAt)], ["published", approved.revision, true, true]);
  assert.equal((await h.stories.get(owner, kept.record.id)).record.status, "submitted");
  assert.equal((await h.stories.get(owner, fresh.record.id)).record.status, "draft");
});

test("the review queue names up to 50 per collection and counts them all", async () => {
  const { h } = await live();
  for (let i = 0; i < 55; i++) await createApproved(h.posts, owner, { type: "news", title: `Queued ${i}`, body }, FACTS);
  const status = await h.publishing.status(owner);
  assert.equal(status.review.approved.length, 50);
  assert.deepEqual(status.review.totals, { approved: 55, scheduled: 0, submitted: 0 });
});

test("an ordered collection: a live record being edited keeps its live content but follows the working order", async () => {
  const { h } = await live();
  const a = await createApproved(h.programs, owner, program({ title: "Alpha programme", slug: "alpha", description: "Alpha, live." }), FACTS);
  const b = await createApproved(h.programs, owner, program({ title: "Beta programme", slug: "beta" }), FACTS);
  await h.publishing.publish(owner, FACTS);
  assert.deepEqual((await publicOf(h)).content.programs!.map((p) => p.slug), ["alpha", "beta"]);
  const edited = await h.programs.update(editor, a.record.id, { revision: a.revision, changes: { description: "Alpha, edited." } }, FACTS);
  const current = await h.programs.get(owner, b.record.id);
  await h.programs.reorder(owner, { items: [current, edited].map((v) => ({ id: v.record.id, revision: v.revision })) }, FACTS);
  await h.publishing.publish(owner, FACTS);
  const programs = (await publicOf(h)).content.programs!;
  assert.deepEqual(programs.map((p) => [p.slug, p.description]), [["beta", "A test line."], ["alpha", "Alpha, live."]]);
});

test("references: an approved record may name a live record whose edit is pending; a draft never makes the publish name it", async () => {
  const { h } = await live();
  await createApproved(h.programs, owner, program(), FACTS);
  const s = await createApproved(h.stories, owner, story({ title: "Related story" }), FACTS);
  await h.publishing.publish(owner, FACTS);
  // The related story is edited (a draft) but live: approving a story that names it is allowed.
  await h.stories.update(editor, s.record.id, { revision: s.revision, changes: { title: "Related story, edited" } }, FACTS);
  const naming = await createApproved(h.stories, owner, story({ title: "Naming story", relatedPostIds: [s.record.id], programId: "education" }), FACTS);
  assert.equal(naming.record.status, "approved");
  await h.publishing.publish(owner, FACTS);
  const stories = (await publicOf(h)).content.stories!;
  assert.deepEqual(stories.map((x) => x.title).sort(), ["Naming story", "Related story"], "the related story's live version, not its draft");
  // A never-published draft cannot be named by an approved record.
  const draft = await h.stories.create(editor, story({ title: "Unpublished draft" }), FACTS);
  const v = await h.stories.create(editor, story({ title: "Names a draft", relatedPostIds: [draft.record.id] }), FACTS);
  await rejects(approve(h.stories, owner, v.record.id, FACTS), "VALIDATION_ERROR", "not approved");
});

test("status: the review queue and blockers; blockers stop the whole publish and the live snapshot stays", async () => {
  const { data, h, image } = await live();
  const v = await createApproved(h.stories, owner, story({ title: "Pictured story", imageId: image.id }), FACTS);
  await h.publishing.publish(owner, FACTS);
  const before = await publicOf(h);
  await h.stories.update(editor, v.record.id, { revision: v.revision, changes: { title: "Pictured story, edited" } }, FACTS);
  await approve(h.stories, owner, v.record.id, FACTS);
  data.media.find((m) => m.id === image.id)!.status = "deleted";
  const status = await h.publishing.status(owner);
  assert.deepEqual(status.review.approved, [{ section: "Stories", title: "Pictured story, edited" }]);
  assert.ok(status.blockers.some((b) => b.includes("media")), status.blockers.join("\n"));
  await rejects(h.publishing.publish(owner, FACTS), "VALIDATION_ERROR", "media");
  assert.deepEqual(await publicOf(h), before, "the live snapshot is untouched");
  assert.equal((await h.stories.get(owner, v.record.id)).record.status, "approved", "nothing is marked by a refused publish");
  // Editors see the queue but cannot publish.
  const asEditor = await h.publishing.status(editor);
  assert.equal(asEditor.canPublish, false);
  assert.equal(asEditor.review.approved.length, 1);
});

test("a stale publish is a 409: what would be published changed after the owner reviewed it", async () => {
  const { h } = await live();
  await createApproved(h.stories, owner, story({ title: "First" }), FACTS);
  const reviewed = (await h.publishing.status(owner)).changesKey!;
  assert.ok(reviewed);
  // Another owner approves more content after this review.
  await createApproved(h.stories, owner, story({ title: "Approved after the review" }), FACTS);
  await rejects(h.publishing.publish(owner, FACTS, { changesKey: reviewed }), "CONFLICT", "changed since you reviewed it");
  assert.equal(await h.publishing.publicSnapshot(), null, "nothing published");
  const fresh = (await h.publishing.status(owner)).changesKey!;
  // Time passes between the review and the click: a first publish's date does not make it stale.
  h.time.advance(90_000);
  assert.equal((await h.publishing.status(owner)).changesKey, fresh, "the review key does not depend on the clock");
  await h.publishing.publish(owner, FACTS, { changesKey: fresh });
  const published = await publicOf(h);
  assert.ok(published.content.stories!.every((x) => x.publishedAt && !Number.isNaN(Date.parse(x.publishedAt))), "the snapshot carries real dates");
  assert.equal((await h.publishing.status(owner)).hasUnpublishedChanges, false, "right after a publish, nothing is pending");
  // Another publish happened since this review: also stale.
  await createApproved(h.stories, owner, story({ title: "Third" }), FACTS);
  const reviewedAgain = (await h.publishing.status(owner)).changesKey!;
  await h.publishing.publish(owner, FACTS);
  await rejects(h.publishing.publish(owner, FACTS, { changesKey: reviewedAgain }), "CONFLICT");
});

/* ---------------- The critical end-to-end proof ---------------- */

test("CRITICAL (collection item — a story): edit, submit, review, reject, resubmit, approve — public unchanged until the owner publishes; then replaced atomically; stale attempts are 409", async () => {
  const { h } = await live();
  // 1. Existing public content is published.
  const original = await createApproved(h.stories, owner, story({ title: "Original public story" }), FACTS);
  const v1 = await h.publishing.publish(owner, FACTS);
  const publicV1 = await publicOf(h);
  assert.deepEqual(publicV1.content.stories!.map((s) => s.title), ["Original public story"]);
  const unchanged = async (step: string) => {
    assert.deepEqual(await publicOf(h), publicV1, `public snapshot unchanged: ${step}`);
    // Even an owner's publish now would carry the live version forward: nothing new to publish.
    await rejects(h.publishing.publish(owner, FACTS), "CONFLICT", "no unpublished changes");
  };
  const id = original.record.id;
  // 2–3. An editor modifies it: the public snapshot is unchanged.
  const edited = await h.stories.update(editor, id, { revision: original.revision, changes: { title: "Edited story", excerpt: "A new excerpt." } }, FACTS);
  assert.deepEqual([edited.record.status, edited.live], ["draft", true]);
  await unchanged("after the edit");
  // 4–5. The editor submits it: public unchanged.
  const submitted = await h.stories.act(editor, id, "submit", { revision: edited.revision }, FACTS);
  assert.equal(submitted.record.status, "submitted");
  await unchanged("after submission");
  // 6. The owner reviews it: the queue names it; the record shows the submitted revision.
  assert.deepEqual((await h.publishing.status(owner)).review.submitted, [{ section: "Stories", title: "Edited story" }]);
  assert.equal((await h.stories.get(owner, id)).record.title, "Edited story");
  // 7–8. The owner rejects it: public unchanged.
  const rejected = await h.stories.act(owner, id, "reject", { revision: submitted.revision }, FACTS);
  assert.equal(rejected.record.status, "draft");
  await unchanged("after rejection");
  // 9. The editor revises and resubmits.
  const revised = await h.stories.update(editor, id, { revision: rejected.revision, changes: { title: "Revised story" } }, FACTS);
  const resubmitted = await h.stories.act(editor, id, "submit", { revision: revised.revision }, FACTS);
  // 10–11. The owner approves: public STILL unchanged until the website publish.
  const approved = await h.stories.act(owner, id, "approve", { revision: resubmitted.revision }, FACTS);
  assert.deepEqual([approved.record.status, approved.live], ["approved", true]);
  assert.deepEqual(await publicOf(h), publicV1, "approved is not public");
  const status = await h.publishing.status(owner);
  assert.deepEqual(status.review.approved, [{ section: "Stories", title: "Revised story" }]);
  assert.equal(status.hasUnpublishedChanges, true);
  // 15 (stale): an edit, an approval and a publish based on what came before are refused.
  await rejects(h.stories.update(editor, id, { revision: revised.revision, changes: { title: "Stale edit" } }, FACTS), "CONFLICT");
  await rejects(h.stories.act(owner, id, "approve", { revision: resubmitted.revision }, FACTS), "CONFLICT");
  await rejects(h.publishing.publish(owner, FACTS, { changesKey: `${v1.version}:stale` }), "CONFLICT", "changed since you reviewed it");
  // 12. The owner publishes the website.
  const v2 = await h.publishing.publish(owner, FACTS, { changesKey: status.changesKey! });
  assert.equal(v2.version, v1.version + 1);
  // 13. The new content is public.
  const publicV2 = await publicOf(h);
  assert.equal(publicV2.version, v2.version);
  assert.deepEqual(publicV2.content.stories!.map((s) => [s.title, s.excerpt]), [["Revised story", "A new excerpt."]]);
  assert.equal((await h.stories.get(owner, id)).record.status, "published");
  // 14. The old version was replaced atomically: the previous snapshot is intact and immutable, the pointer moved once.
  assert.deepEqual(await h.publishing.publicSnapshot(v1.version), publicV1);
  assert.equal(h.audit.filter((e) => e.action === "publish.completed").length, 2);
  assert.ok(!JSON.stringify(publicV2).includes("Edited story") && !JSON.stringify(publicV2).includes("Stale edit"));
});

test("CRITICAL (singleton page — the homepage): edit, submit, review, reject, resubmit, approve — public unchanged until the owner publishes; then replaced atomically; stale attempts are 409", async () => {
  const { h, image } = await live();
  // 1. Existing public homepage.
  await h.homepage.create(owner, { sections: [who(image.id, "Original heading"), faq("Original question?")] }, FACTS);
  await approvePage(h.homepage, owner, FACTS);
  const v1 = await h.publishing.publish(owner, FACTS);
  const publicV1 = await publicOf(h);
  assert.equal((publicV1.content.homepage!.sections[0]!.data as { heading: string }).heading, "Original heading");
  const unchanged = async (step: string) => {
    assert.deepEqual(await publicOf(h), publicV1, `public snapshot unchanged: ${step}`);
    await rejects(h.publishing.publish(owner, FACTS), "CONFLICT", "no unpublished changes");
  };
  const page = await h.homepage.get(owner);
  assert.deepEqual([page.record!.status, page.live], ["published", true]);
  // 2–3. An editor edits the whole page (one revision): public unchanged.
  const edited = await h.homepage.update(editor, { revision: page.revision, changes: { sections: [who(image.id, "Edited heading"), faq("Edited question?")] } }, FACTS);
  assert.deepEqual([edited.record!.status, edited.live], ["draft", true]);
  await unchanged("after the edit");
  // 4–5. Submitted: public unchanged; the page is locked while under review.
  const submitted = await h.homepage.act(editor, "submit", { revision: edited.revision }, FACTS);
  await rejects(h.homepage.update(editor, { revision: submitted.revision, changes: { sections: [who(image.id, "Sneaky")] } }, FACTS), "CONFLICT", "submitted for review");
  await unchanged("after submission");
  // 6. The owner reviews it.
  assert.deepEqual((await h.publishing.status(owner)).review.submitted, [{ section: "Homepage", title: "Homepage" }]);
  // 7–8. Rejected: public unchanged.
  const rejected = await h.homepage.act(owner, "reject", { revision: submitted.revision }, FACTS);
  assert.equal(rejected.record!.status, "draft");
  await unchanged("after rejection");
  // 9. Revised and resubmitted.
  const revised = await h.homepage.update(editor, { revision: rejected.revision, changes: { sections: [who(image.id, "Revised heading"), faq("Revised question?")] } }, FACTS);
  const resubmitted = await h.homepage.act(editor, "submit", { revision: revised.revision }, FACTS);
  // 10–11. Approved: public still unchanged.
  const approved = await h.homepage.act(owner, "approve", { revision: resubmitted.revision }, FACTS);
  assert.equal(approved.record!.status, "approved");
  assert.deepEqual(await publicOf(h), publicV1, "approved is not public");
  const status = await h.publishing.status(owner);
  assert.deepEqual(status.review.approved, [{ section: "Homepage", title: "Homepage" }]);
  // 15 (stale): edit, approval and publish.
  await rejects(h.homepage.update(editor, { revision: revised.revision, changes: { sections: [who(image.id, "Stale")] } }, FACTS), "CONFLICT");
  await rejects(h.homepage.act(owner, "approve", { revision: resubmitted.revision }, FACTS), "CONFLICT");
  await rejects(h.publishing.publish(owner, FACTS, { changesKey: `${v1.version}:stale` }), "CONFLICT");
  // 12–13. Published: the whole approved revision is public.
  const v2 = await h.publishing.publish(owner, FACTS, { changesKey: status.changesKey! });
  const publicV2 = await publicOf(h);
  assert.equal(publicV2.version, v2.version);
  assert.deepEqual(publicV2.content.homepage!.sections.map((s) => (s.data as { heading: string }).heading), ["Revised heading", "Questions"]);
  assert.ok(JSON.stringify(publicV2.content.homepage).includes("Revised question?"));
  assert.ok(!JSON.stringify(publicV2).includes("Edited heading"));
  const after = await h.homepage.get(owner);
  assert.deepEqual([after.record!.status, after.revision], ["published", approved.revision]);
  // 14. Atomic: the previous version is intact.
  assert.deepEqual(await h.publishing.publicSnapshot(v1.version), publicV1);
});
