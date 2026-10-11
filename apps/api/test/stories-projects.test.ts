import { test } from "node:test";
import assert from "node:assert/strict";
import { PublishedSnapshot } from "@rbb/content-schema";
import { ApiError } from "../src/errors.ts";
import { secretProblems } from "../src/modules/publishing/service.ts";
import { settingsRecord } from "./fixtures/settings.ts";
import { FACTS, member } from "./media/memory.ts";
import { addMedia, harness, sharedData } from "./settings/memory.ts";
import { approve, approvePage, createApproved } from "./support/workflow.ts";

/* Stories and projects (M12): stories are posts of type "story" in their
   own module (a store scoped to stories); projects an ordered collection.
   References are checked at save and again, atomically, at website
   publish. Test records only. */

const owner = member("org-a", "OWNER");
const editor = member("org-a", "EDITOR");
const rejects = async (promise: Promise<unknown>, code: string, pathPart?: string) =>
  assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError, String(error));
    assert.equal(error.code, code, error.message);
    if (pathPart) assert.ok(error.details?.some((d) => d.path.includes(pathPart) || d.message.includes(pathPart)), JSON.stringify(error.details));
    return true;
  });
const body = [{ type: "paragraph", children: [{ type: "text", text: "A test paragraph." }] }];
const story = (o: Record<string, unknown> = {}) => ({ title: "Test story", category: "field", body, ...o });
const project = (o: Record<string, unknown> = {}) => ({ title: "Test project", programId: "education", description: "A test line.", ...o });
const program = (o: Record<string, unknown> = {}) => ({ title: "Education", slug: "education", icon: "education", description: "A test line.", ...o });

test("stories: posts of type story, in their own module — typed, categorised, never HTML; unique addresses across posts", async () => {
  const data = sharedData();
  const h = harness("org-a", data);
  const s = await h.stories.create(editor, story({ excerpt: "A line.", featured: true, location: "Test place" }), FACTS);
  assert.deepEqual([s.record.type, s.record.status, s.record.slug], ["story", "draft", "test-story"]);
  await rejects(h.stories.create(editor, story({ title: "X", type: "news" }), FACTS), "VALIDATION_ERROR", "type");
  await rejects(h.stories.create(editor, story({ title: "X", category: undefined }), FACTS), "VALIDATION_ERROR", "category");
  await rejects(h.stories.create(editor, story({ title: "X", category: "opinion" }), FACTS), "VALIDATION_ERROR", "category");
  await rejects(h.stories.create(editor, story({ title: "X", body: "<p>x</p>" }), FACTS), "VALIDATION_ERROR", "body");
  await rejects(h.stories.create(editor, story({ title: "X", impact: ["100 people"] }), FACTS), "VALIDATION_ERROR", "impact");
  await rejects(h.stories.update(editor, s.record.id, { revision: s.revision, changes: { relatedPostIds: [s.record.id] } }, FACTS), "VALIDATION_ERROR", "itself");
  // One posts collection, two modules: neither sees the other's records; an address is unique across both.
  const news = await h.posts.create(editor, { type: "news", title: "Test news", body }, FACTS);
  await rejects(h.stories.create(editor, story({ title: "Other", slug: "test-news" }), FACTS), "VALIDATION_ERROR", "slug");
  await rejects(h.posts.get(owner, s.record.id), "NOT_FOUND");
  await rejects(h.stories.get(owner, news.record.id), "NOT_FOUND");
  await rejects(h.stories.update(owner, news.record.id, { revision: news.revision, changes: { title: "Taken over" } }, FACTS), "NOT_FOUND");
  assert.deepEqual((await h.posts.list(owner, {})).items.map((v) => v.record.type), ["news"]);
  assert.deepEqual((await h.stories.list(owner, {})).items.map((v) => v.record.type), ["story"]);
  assert.deepEqual(h.audit.find((e) => e.action === "story.created")!.metadata.fields, ["body", "category", "excerpt", "featured", "location", "title"]);
  assert.ok(!JSON.stringify(h.audit).includes("A test paragraph"), "no wording in the audit");
});

test("stories: program, project and related stories checked at save — this organization's, not archived, approved to be named by an approved story", async () => {
  const data = sharedData();
  const h = harness("org-a", data);
  const b = harness("org-b", data);
  // Nothing managed yet: the website's own programs and projects are named (its build checks them).
  const free = await h.stories.create(editor, story({ title: "Free", programId: "education", projectId: "community-reading-clubs" }), FACTS);
  assert.equal(free.record.projectId, "community-reading-clubs");
  // Once the CMS manages programs and projects, a name must be one of them.
  await createApproved(h.programs, owner, program(), FACTS);
  const draftProgram = await h.programs.create(owner, program({ title: "Livelihoods", slug: "livelihoods" }), FACTS);
  await createApproved(b.programs, member("org-b", "OWNER"), program({ title: "Health", slug: "health-wellbeing" }), FACTS);
  await rejects(h.stories.create(editor, story({ title: "A", programId: "health-wellbeing" }), FACTS), "VALIDATION_ERROR", "does not exist in this organization");
  await h.stories.create(editor, story({ title: "B", programId: "livelihoods" }), FACTS);
  const c = await h.stories.create(editor, story({ title: "C", programId: "livelihoods" }), FACTS);
  await rejects(approve(h.stories, owner, c.record.id, FACTS), "VALIDATION_ERROR", "not approved");
  await h.programs.archive(owner, draftProgram.record.id, FACTS);
  await rejects(h.stories.create(editor, story({ title: "D", programId: "livelihoods" }), FACTS), "VALIDATION_ERROR", "archived");
  const p = await h.projects.create(editor, project(), FACTS);
  await rejects(h.stories.create(editor, story({ title: "E", projectId: "community-reading-clubs" }), FACTS), "VALIDATION_ERROR", "project");
  const f = await h.stories.create(editor, story({ title: "F", projectId: p.record.slug }), FACTS);
  await rejects(approve(h.stories, owner, f.record.id, FACTS), "VALIDATION_ERROR", "not approved");
  const related = await h.stories.create(editor, story({ title: "G", relatedPostIds: [free.record.id] }), FACTS);
  // Archiving is never blocked by what a record names (the related story is archived first).
  const lone = await h.stories.create(editor, story({ title: "G2" }), FACTS);
  const naming = await h.stories.create(editor, story({ title: "G3", relatedPostIds: [lone.record.id] }), FACTS);
  await h.stories.archive(editor, lone.record.id, FACTS);
  assert.equal((await h.stories.archive(editor, naming.record.id, FACTS)).record.status, "archived");
  await rejects(h.stories.create(editor, story({ title: "H", relatedPostIds: ["no-such-story"] }), FACTS), "VALIDATION_ERROR", "story");
  const i = await h.stories.create(editor, story({ title: "I", relatedPostIds: [related.record.id] }), FACTS);
  await rejects(approve(h.stories, owner, i.record.id, FACTS), "VALIDATION_ERROR", "not approved");
  const plain = await createApproved(h.stories, owner, story({ title: "J" }), FACTS);
  assert.equal((await createApproved(h.stories, owner, story({ title: "K", relatedPostIds: [plain.record.id] }), FACTS)).record.status, "approved", "once what it names is approved");
});

test("stories and projects: images of this organization, ready, described once submitted; owner-only approval; archive; revisions", async () => {
  const data = sharedData();
  const h = harness("org-a", data);
  const described = addMedia(data, "org-a", "ready", { alt: "A described test image" });
  const bare = addMedia(data, "org-a", "ready", { alt: "" });
  const theirs = addMedia(data, "org-b", "ready");
  await rejects(h.stories.create(editor, story({ title: "A", imageId: theirs.id }), FACTS), "VALIDATION_ERROR", "imageId");
  await rejects(h.stories.create(editor, story({ title: "B", galleryIds: [described.id, theirs.id] }), FACTS), "VALIDATION_ERROR", "galleryIds.1");
  const draft = await h.stories.create(editor, story({ title: "C", imageId: bare.id }), FACTS);
  await rejects(approve(h.stories, owner, draft.record.id, FACTS), "VALIDATION_ERROR", "alt text");
  const fixed = await h.stories.update(editor, draft.record.id, { revision: draft.revision, changes: { imageId: described.id, galleryIds: [described.id] } }, FACTS);
  await rejects(h.stories.update(editor, draft.record.id, { revision: fixed.revision, changes: { status: "published" } }, FACTS), "VALIDATION_ERROR", "status");
  const submitted = await h.stories.act(editor, draft.record.id, "submit", { revision: fixed.revision }, FACTS);
  await rejects(h.stories.act(editor, draft.record.id, "approve", { revision: submitted.revision }, FACTS), "FORBIDDEN");
  const approved = await approve(h.stories, owner, draft.record.id, FACTS);
  await rejects(h.stories.update(editor, draft.record.id, { revision: fixed.revision, changes: { title: "Stale" } }, FACTS), "CONFLICT");
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  await h.publishing.publish(owner, FACTS);
  await rejects(h.stories.update(owner, draft.record.id, { revision: approved.revision, changes: { slug: "renamed" } }, FACTS), "CONFLICT", "slug");
  assert.equal((await h.stories.archive(editor, draft.record.id, FACTS)).record.status, "archived");
  assert.equal(h.audit.filter((e) => e.action === "story.archived").length, 1);
  const undescribedProject = await h.projects.create(owner, project({ imageId: bare.id }), FACTS);
  await rejects(approve(h.projects, owner, undescribedProject.record.id, FACTS), "VALIDATION_ERROR", "alt text");
  await rejects(h.projects.create(editor, project({ title: "Other", status: "published" }), FACTS), "VALIDATION_ERROR", "draft");
  await rejects(harness("org-b", data).stories.get(member("org-b", "OWNER"), draft.record.id), "NOT_FOUND");
  await rejects(h.stories.get(member("org-b", "OWNER"), draft.record.id), "FORBIDDEN");
});

test("projects: at the end, in a program, one reorder event, a stale order changes nothing; no fields the projects do not use", async () => {
  const data = sharedData();
  const h = harness("org-a", data);
  const a = await h.projects.create(editor, project({ title: "A", context: ["P."], activities: ["A."], approach: ["P."], outcomes: ["O."], featured: true }), FACTS);
  const b = await h.projects.create(editor, project({ title: "B" }), FACTS);
  assert.deepEqual([a.record.order, b.record.order, a.record.status], [0, 1, "draft"]);
  await rejects(h.projects.create(editor, project({ title: "C", programId: undefined }), FACTS), "VALIDATION_ERROR", "programId");
  await rejects(h.projects.create(editor, project({ title: "D", impact: [{ value: "100", label: "People" }] }), FACTS), "VALIDATION_ERROR", "impact");
  await rejects(h.projects.create(editor, project({ title: "E", order: 4 }), FACTS), "VALIDATION_ERROR", "order");
  await h.projects.reorder(editor, { items: [b, a].map((v) => ({ id: v.record.id, revision: v.revision })) }, FACTS);
  assert.deepEqual(h.audit.filter((e) => e.action === "project.reordered").map((e) => e.metadata), [{ moved: 2, total: 2 }]);
  await rejects(h.projects.reorder(editor, { items: [a, b].map((v) => ({ id: v.record.id, revision: v.revision })) }, FACTS), "CONFLICT");
  assert.deepEqual((await h.projects.list(owner, { sort: "title" })).items.map((v) => v.record.order), [1, 0]);
  await createApproved(h.programs, owner, program(), FACTS);
  await rejects(h.projects.create(editor, project({ title: "F", programId: "livelihoods" }), FACTS), "VALIDATION_ERROR", "program");
});

test("snapshot: stories and projects once one is published; every relationship published in the same snapshot, or the publish is refused", async () => {
  const data = sharedData();
  const h = harness("org-a", data);
  const image = addMedia(data, "org-a", "ready", { alt: "A described test image" });
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  await createApproved(h.programs, owner, program(), FACTS);
  await h.stories.create(owner, story({ title: "Draft story never public" }), FACTS);
  await h.publishing.publish(owner, FACTS);
  assert.equal((await h.publishing.publicSnapshot())!.content.stories, undefined, "drafts only: the website keeps its own stories");

  const p1 = await createApproved(h.projects, owner, project({ title: "Second project", imageId: image.id }), FACTS);
  const p2 = await createApproved(h.projects, owner, project({ title: "First project" }), FACTS);
  await h.projects.reorder(owner, { items: [p2, p1].map((v) => ({ id: v.record.id, revision: v.revision })) }, FACTS);
  const undated = await createApproved(h.stories, owner, story({ title: "Undated first", projectId: p1.record.slug, programId: "education" }), FACTS);
  h.time.advance(1000);
  await createApproved(h.stories, owner, story({ title: "Undated second", relatedPostIds: [undated.record.id] }), FACTS);
  await createApproved(h.stories, owner, story({ title: "Dated", date: "2026-09-01", imageId: image.id, galleryIds: [image.id] }), FACTS);
  await h.impact.create(owner, { sections: [{ id: "stories", type: "stories", enabled: true, version: 1, data: { heading: "Stories", storyIds: [undated.record.id] } }] }, FACTS);
  await approvePage(h.impact, owner, FACTS);
  await h.publishing.publish(owner, FACTS);
  const snapshot = (await h.publishing.publicSnapshot())!;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.deepEqual(snapshot.content.projects!.map((p) => p.title), ["First project", "Second project"], "project order");
  assert.deepEqual(snapshot.content.stories!.map((s) => s.title), ["Dated", "Undated first", "Undated second"], "newest first, then as added");
  assert.equal(snapshot.content.news, undefined, "stories are not news");
  const text = JSON.stringify(snapshot);
  for (const leak of ["never public", "revision", "updatedBy", "slugHistory", "objectKey"]) assert.ok(!text.includes(leak), `leaked: ${leak}`);
  assert.ok(!JSON.stringify([snapshot.content.stories, snapshot.content.projects]).includes("createdAt"), "stories and projects carry no internal timestamps");
  assert.deepEqual(secretProblems(snapshot), []);

  // A project a published story names is archived: refused at website publish, the live snapshot stays.
  await h.projects.archive(owner, p1.record.id, FACTS);
  await rejects(h.publishing.publish(owner, FACTS), "VALIDATION_ERROR", "not published");
  assert.equal((await h.publishing.publicSnapshot())!.version, 2);
  // An edit to a published story is a draft: its live version stays, so nothing is broken by it.
  const target = await h.stories.get(owner, undated.record.id);
  const edited = await h.stories.update(owner, undated.record.id, { revision: target.revision, changes: { projectId: null } }, FACTS);
  assert.deepEqual([edited.record.status, edited.live], ["draft", true]);
  // The Impact page names a story that is archived: refused at save and at publish.
  await h.stories.archive(owner, undated.record.id, FACTS);
  const page = await h.impact.get(owner);
  await rejects(h.impact.update(owner, { revision: page.revision, changes: { seo: { title: "T" } } }, FACTS), "VALIDATION_ERROR", "archived");
  await rejects(h.publishing.publish(owner, FACTS), "VALIDATION_ERROR", "not published");
  assert.equal((await h.publishing.publicSnapshot())!.version, 2);
});
