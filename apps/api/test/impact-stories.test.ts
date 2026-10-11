import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "../src/errors.ts";
import { settingsRecord } from "./fixtures/settings.ts";
import { FACTS, member } from "./media/memory.ts";
import { harness, sharedData } from "./settings/memory.ts";
import { approve, approvePage, createApproved } from "./support/workflow.ts";

/* M15: the Impact page's stories, in both worlds. Until the organization
   has a CMS story, the Impact page names the website's own stories (by
   id; the website build resolves them). Once the CMS manages stories, it
   names CMS stories only: one that does not exist here, is archived, or
   is not approved (or live) is refused — at save, submission, approval and
   the website publish — and never quietly replaced by a website story or
   left out. Test records only. */

const owner = member("org-a", "OWNER");
const editor = member("org-a", "EDITOR");
const body = [{ type: "paragraph", children: [{ type: "text", text: "A test paragraph." }] }];
const story = (o: Record<string, unknown> = {}) => ({ title: "Test story", category: "field", body, ...o });
const intro = { id: "intro", type: "intro", enabled: true, version: 1, data: { kicker: "Our impact", title: "Test Impact", highlight: "Impact", body: "A test line." } };
const stories = (storyIds: string[]) => ({ id: "stories", type: "stories", enabled: true, version: 1, data: { heading: "Stories of change", storyIds } });
const rejects = async (promise: Promise<unknown>, code: string, part?: string) =>
  assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError, String(error));
    assert.equal(error.code, code, error.message);
    if (part) assert.ok(error.details?.some((d) => d.message.includes(part) || d.path.includes(part)), JSON.stringify(error.details));
    return true;
  });

async function site() {
  const data = sharedData();
  const h = harness("org-a", data);
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  return { data, h };
}

test("CASE A — no CMS stories: the Impact page names the website's own stories; nothing is checked against the CMS", async () => {
  const { h } = await site();
  await h.impact.create(editor, { sections: [intro, stories(["website-story-1", "website-story-2"])] }, FACTS);
  const approved = await approvePage(h.impact, owner, FACTS);
  assert.equal(approved.record!.status, "approved");
  await h.publishing.publish(owner, FACTS);
  const snapshot = (await h.publishing.publicSnapshot())!;
  assert.equal(snapshot.content.stories, undefined, "the website keeps its own stories");
  assert.deepEqual((snapshot.content.impact!.sections[1]!.data as { storyIds: string[] }).storyIds, ["website-story-1", "website-story-2"], "resolved by the website build, against the website's stories");
});

test("CASE B — CMS stories: the Impact page names CMS stories, by id; the snapshot carries exactly those", async () => {
  const { h } = await site();
  const s = await createApproved(h.stories, owner, story({ title: "CMS story" }), FACTS);
  await rejects(h.impact.create(editor, { sections: [intro, stories(["website-story-1"])] }, FACTS), "VALIDATION_ERROR", "does not exist in this organization");
  await h.impact.create(editor, { sections: [intro, stories([s.record.id])] }, FACTS);
  await approvePage(h.impact, owner, FACTS);
  await h.publishing.publish(owner, FACTS);
  const snapshot = (await h.publishing.publicSnapshot())!;
  assert.deepEqual(snapshot.content.stories!.map((x) => x.id), [s.record.id]);
  assert.deepEqual((snapshot.content.impact!.sections[1]!.data as { storyIds: string[] }).storyIds, [s.record.id]);
});

test("CASE C — a missing CMS story: refused at save, never resolved elsewhere; the publish refuses a live page that names one", async () => {
  const { h } = await site();
  // The Impact page went live while the website's stories were the stories.
  await h.impact.create(owner, { sections: [intro, stories(["website-story-1"])] }, FACTS);
  await approvePage(h.impact, owner, FACTS);
  await h.publishing.publish(owner, FACTS);
  // The organization publishes its first CMS story: the live Impact page now names a story the snapshot cannot carry.
  await createApproved(h.stories, owner, story({ title: "First CMS story" }), FACTS);
  await rejects(h.publishing.publish(owner, FACTS), "VALIDATION_ERROR", 'refers to story "website-story-1", which is not published');
  const status = await h.publishing.status(owner);
  assert.ok(status.blockers.some((b) => b.includes("website-story-1")), "the publish panel says why");
  // Saving it refuses the name too: no CMS story has that id.
  const page = await h.impact.get(owner);
  await rejects(h.impact.update(editor, { revision: page.revision, changes: { seo: { title: "T" } } }, FACTS), "VALIDATION_ERROR", "does not exist in this organization");
  assert.equal((await h.publishing.publicSnapshot())!.content.stories, undefined, "nothing changed in public");
});

test("CASE D — an archived, draft or submitted CMS story: refused at save (archived), at approval (not approved) and at the publish", async () => {
  const { h } = await site();
  const live = await createApproved(h.stories, owner, story({ title: "Live story" }), FACTS);
  const draft = await h.stories.create(editor, story({ title: "Draft story" }), FACTS);
  const submitted = await h.stories.create(editor, story({ title: "Submitted story" }), FACTS);
  await h.stories.act(editor, submitted.record.id, "submit", { revision: 1 }, FACTS);
  const gone = await createApproved(h.stories, owner, story({ title: "Archived story" }), FACTS);
  await h.stories.archive(owner, gone.record.id, FACTS);
  await rejects(h.impact.create(editor, { sections: [intro, stories([gone.record.id])] }, FACTS), "VALIDATION_ERROR", "which is archived");
  // A draft may name unapproved stories (it is not public); submitting checks existence; approving needs them approved.
  await h.impact.create(editor, { sections: [intro, stories([live.record.id, draft.record.id, submitted.record.id])] }, FACTS);
  const sent = await h.impact.act(editor, "submit", { revision: 1 }, FACTS);
  await rejects(h.impact.act(owner, "approve", { revision: sent.revision }, FACTS), "VALIDATION_ERROR", "not approved yet");
  // Approve both stories: then the page can be approved, and everything goes live together.
  await approve(h.stories, owner, draft.record.id, FACTS);
  await approve(h.stories, owner, submitted.record.id, FACTS);
  await h.impact.act(owner, "approve", { revision: sent.revision }, FACTS);
  await h.publishing.publish(owner, FACTS);
  const snapshot = (await h.publishing.publicSnapshot())!;
  assert.deepEqual(snapshot.content.stories!.map((s) => s.title).sort(), ["Draft story", "Live story", "Submitted story"]);
  // Archiving a story the live page names: the next publish is refused until the page is changed.
  await h.stories.archive(owner, draft.record.id, FACTS);
  await rejects(h.publishing.publish(owner, FACTS), "VALIDATION_ERROR", "which is not published");
  assert.equal((await h.publishing.publicSnapshot())!.version, snapshot.version, "the live snapshot stays");
});
