import { test } from "node:test";
import assert from "node:assert/strict";
import { PublishedSnapshot } from "@rbb/content-schema";
import { ApiError } from "../src/errors.ts";
import { settingsRecord } from "./fixtures/settings.ts";
import { FACTS, member } from "./media/memory.ts";
import { harness, sharedData } from "./settings/memory.ts";
import { approve, createApproved } from "./support/workflow.ts";

/* Milestone 6 — a project's location, stage, date, impact, partners and
   linked story: validated, stored, kept, cleared and published, in
   memory; the story checked like any reference (this organization's, not
   archived, approved in time). Test records only. */

const owner = member("org-a", "OWNER");
const body = [{ type: "paragraph", children: [{ type: "text", text: "A test paragraph." }] }];
const project = (o: Record<string, unknown> = {}) => ({ title: "A test project", programId: "education", description: "A test line.", ...o });
const story = (o: Record<string, unknown> = {}) => ({ title: "A test story", category: "field", body, ...o });
const program = { title: "Education", slug: "education", icon: "education", description: "A test line." };
const FIELDS = { location: "A test district", stage: "Ongoing", date: "2026-09-01", impact: [{ value: "120", label: "Children reading weekly" }], partners: ["A test school", "A test library"] };
const rejects = async (promise: Promise<unknown>, path: string, message?: RegExp) =>
  assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError, String(error));
    assert.equal(error.code, "VALIDATION_ERROR", error.message);
    const d = error.details?.find((x) => x.path === path || x.path.startsWith(`${path}.`) || x.message.includes(`"${path.split(".").pop()}"`));
    assert.ok(d, `${path}: ${JSON.stringify(error.details)}`);
    if (message) assert.match(d.message, message);
    return true;
  });
async function site(org = "org-a", data = sharedData()) {
  const h = harness(org, data);
  await h.settings.importInitial(settingsRecord(org), { id: null, name: "Settings import" });
  await createApproved(h.programs, member(org, "OWNER"), program, FACTS);
  return { data, h };
}

test("stored as written; kept when an update leaves them out; changed; each cleared with null", async () => {
  const { h } = await site();
  const created = await h.projects.create(owner, project(FIELDS), FACTS);
  const pick = (r: Record<string, unknown>) => Object.fromEntries(Object.keys(FIELDS).map((k) => [k, r[k]]));
  assert.deepEqual(pick(created.record), FIELDS);
  const kept = await h.projects.update(owner, created.record.id, { revision: created.revision, changes: { title: "An edited test project" } }, FACTS);
  assert.deepEqual(pick(kept.record), FIELDS, "kept");
  const changed = await h.projects.update(owner, created.record.id, { revision: kept.revision, changes: { stage: "Completed", partners: ["A test library"] } }, FACTS);
  assert.deepEqual([changed.record.stage, changed.record.partners], ["Completed", ["A test library"]], "a list replaces the whole list");
  const cleared = await h.projects.update(owner, created.record.id, { revision: changed.revision, changes: Object.fromEntries(Object.keys(FIELDS).map((k) => [k, null])) }, FACTS);
  for (const k of Object.keys(FIELDS)) assert.ok(!(k in cleared.record), `${k}: cleared, absent as before`);
});

test("refused by name: blank or long text, an unreal date, malformed or repeated figures and partners, the stage written as status", async () => {
  const { h } = await site();
  for (const [o, path] of [
    [{ location: "" }, "body.location"],
    [{ stage: "x".repeat(61) }, "body.stage"],
    [{ date: "2026-02-30" }, "body.date"],
    [{ impact: [] }, "body.impact"],
    [{ impact: [{ value: "120" }] }, "body.impact.0.label"],
    [{ impact: ["120 children"] }, "body.impact.0"],
    [{ impact: [{ value: "1", label: "A" }, { value: "1", label: "A" }] }, "body.impact.1"],
    [{ partners: ["<b>A school</b>"] }, "body.partners.0"],
    [{ partners: ["A school", "A school"] }, "body.partners.1"],
    [{ storyId: "not an id!" }, "body.storyId"],
    [{ story: { title: "A copied story" } }, "story"],
  ] as const)
    await rejects(h.projects.create(owner, project(o), FACTS), path);
});

test("projects saved without the new fields — every project before Milestone 6 — stay valid, editable and approvable", async () => {
  const { h } = await site();
  const created = await h.projects.create(owner, project(), FACTS);
  for (const k of [...Object.keys(FIELDS), "storyId"]) assert.ok(!(k in created.record));
  const edited = await h.projects.update(owner, created.record.id, { revision: created.revision, changes: { description: "An edited test line." } }, FACTS);
  for (const k of [...Object.keys(FIELDS), "storyId"]) assert.ok(!(k in edited.record), `${k}: an unrelated edit adds nothing`);
  assert.equal((await approve(h.projects, owner, created.record.id, FACTS)).record!.status, "approved");
});

test("the linked story: this organization's story, never archived, never another type or organization's; approved by the time the project is", async () => {
  const data = sharedData();
  const { h } = await site("org-a", data);
  const { h: other } = await site("org-b", data);
  /* No CMS story yet: the id names one of the website's own stories (the website build checks it). */
  assert.equal((await h.projects.create(owner, project({ slug: "website-story", storyId: "learning-to-read" }), FACTS)).record.storyId, "learning-to-read");

  const draft = await h.stories.create(owner, story({ slug: "a-draft-story" }), FACTS);
  await rejects(h.projects.create(owner, project({ storyId: "no-such-story" }), FACTS), "body.storyId", /does not exist in this organization/);
  const theirs = await other.stories.create(member("org-b", "OWNER"), story({ slug: "their-story" }), FACTS);
  await rejects(h.projects.create(owner, project({ storyId: theirs.record.id }), FACTS), "body.storyId", /does not exist in this organization/);
  const news = await h.posts.create(owner, { type: "news", title: "A test news item", body }, FACTS);
  await rejects(h.projects.create(owner, project({ storyId: news.record.id }), FACTS), "body.storyId", /does not exist/);
  const gone = await h.stories.create(owner, story({ slug: "an-archived-story" }), FACTS);
  await h.stories.archive(owner, gone.record.id, FACTS);
  await rejects(h.projects.create(owner, project({ storyId: gone.record.id }), FACTS), "body.storyId", /archived/);

  /* A draft may name a draft story; approving it needs the story approved first. */
  const named = await h.projects.create(owner, project({ slug: "names-a-draft", storyId: draft.record.id }), FACTS);
  await assert.rejects(approve(h.projects, owner, named.record.id, FACTS), (e: unknown) => e instanceof ApiError && Boolean(e.details?.some((d) => d.path === "body.storyId" && /not approved yet/.test(d.message))));
  await approve(h.stories, owner, draft.record.id, FACTS);
  assert.equal((await approve(h.projects, owner, named.record.id, FACTS)).record!.status, "approved");
});

test("a story and its project may name each other: the project is approved while the story is in review, then the story", async () => {
  const { h } = await site();
  const p = await h.projects.create(owner, project({ slug: "mutual-project" }), FACTS);
  const s = await h.stories.create(owner, story({ slug: "mutual-story", projectId: "mutual-project" }), FACTS);
  const linked = await h.projects.update(owner, p.record.id, { revision: p.revision, changes: { storyId: s.record.id } }, FACTS);
  /* The story still a draft: not yet on its way. */
  await assert.rejects(approve(h.projects, owner, linked.record.id, FACTS), (e: unknown) => e instanceof ApiError && Boolean(e.details?.some((d) => d.path === "body.storyId")));
  const submitted = await h.stories.act(owner, s.record.id, "submit", { revision: s.revision }, FACTS);
  assert.equal((await approve(h.projects, owner, linked.record.id, FACTS)).record!.status, "approved", "the story names it back and is in review");
  assert.equal((await h.stories.act(owner, s.record.id, "approve", { revision: submitted.revision }, FACTS)).record!.status, "approved");
  await h.publishing.publish(owner, FACTS);
  const snapshot = (await h.publishing.publicSnapshot())!;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.equal(snapshot.content.projects!.find((x) => x.slug === "mutual-project")!.storyId, s.record.id);
  assert.equal(snapshot.content.stories!.find((x) => x.slug === "mutual-story")!.projectId, "mutual-project");
});

test("published: every field reaches the snapshot as written; a project without them carries none; drafts stay out", async () => {
  const { h } = await site();
  const s = await createApproved(h.stories, owner, story({ slug: "its-story" }), FACTS);
  await createApproved(h.projects, owner, project({ slug: "with-fields", ...FIELDS, storyId: s.record.id }), FACTS);
  await createApproved(h.projects, owner, project({ slug: "without-fields", title: "A plain test project" }), FACTS);
  await h.projects.create(owner, project({ slug: "draft-project", title: "A draft test project", ...FIELDS }), FACTS);
  await h.publishing.publish(owner, FACTS);
  const snapshot = (await h.publishing.publicSnapshot())!;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  const bySlug = new Map(snapshot.content.projects!.map((p) => [p.slug, p]));
  assert.deepEqual([...bySlug.keys()].sort(), ["with-fields", "without-fields"]);
  const full = bySlug.get("with-fields")! as Record<string, unknown>;
  assert.deepEqual(Object.fromEntries([...Object.keys(FIELDS), "storyId"].map((k) => [k, full[k]])), { ...FIELDS, storyId: s.record.id });
  for (const k of [...Object.keys(FIELDS), "storyId"]) assert.ok(!(k in bySlug.get("without-fields")!), k);
});

test("the publish refuses a project whose story is not published with it — never a dangling story", async () => {
  const { h } = await site();
  const s = await createApproved(h.stories, owner, story({ slug: "soon-withdrawn" }), FACTS);
  await createApproved(h.stories, owner, story({ slug: "another-story", title: "Another test story" }), FACTS);
  await createApproved(h.projects, owner, project({ slug: "names-it", storyId: s.record.id }), FACTS);
  /* The story goes back to a draft after the project was approved. */
  const current = await h.stories.get(owner, s.record.id);
  await h.stories.update(owner, s.record.id, { revision: current.revision, changes: { title: "An edited test story" } }, FACTS);
  await assert.rejects(h.publishing.publish(owner, FACTS), (e: unknown) => e instanceof ApiError && JSON.stringify(e.details ?? e.message).includes("storyId"));
});
