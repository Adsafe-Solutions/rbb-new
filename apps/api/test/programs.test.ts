import { test } from "node:test";
import assert from "node:assert/strict";
import { Program, PublishedSnapshot } from "@rbb/content-schema";
import { ApiError } from "../src/errors.ts";
import { secretProblems } from "../src/modules/publishing/service.ts";
import { settingsRecord } from "./fixtures/settings.ts";
import { FACTS, member } from "./media/memory.ts";
import { addMedia, harness, sharedData } from "./settings/memory.ts";
import { approve, approvePage, createApproved, updateApproved } from "./support/workflow.ts";

/* Programs (M10): an ordered content collection — the team's machinery —
   owner-only publishing, and programs in the snapshot (only once one is
   published; CMS records naming a program must name a published one).
   Test records only. */

const owner = member("org-a", "OWNER");
const editor = member("org-a", "EDITOR");
const rejects = async (promise: Promise<unknown>, code: string, pathPart?: string) =>
  assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError, String(error));
    assert.equal(error.code, code, error.message);
    if (pathPart) assert.ok(error.details?.some((d) => d.path.includes(pathPart) || d.message.includes(pathPart)), JSON.stringify(error.details));
    return true;
  });
const area = (o: Record<string, unknown> = {}) => ({ title: "Test Area", icon: "education", description: "A test line.", ...o });

function setup() {
  const data = sharedData();
  const h = harness("org-a", data);
  const image = addMedia(data, "org-a", "ready", { alt: "A test share image" });
  return { data, h, image };
}

test("programs: drafts at the end, the contract's own fields, slugs from titles", async () => {
  const { h } = setup();
  const a = await h.programs.create(editor, area({ why: ["P."], activities: ["A."], impact: ["I."], stories: ["S."], missingNote: "To be provided." }), FACTS);
  const b = await h.programs.create(editor, area({ title: "Health & Wellbeing", icon: "health" }), FACTS);
  assert.equal(a.record.status, "draft");
  assert.deepEqual([a.record.slug, b.record.slug], ["test-area", "health-wellbeing"], "the existing address style");
  assert.deepEqual([a.record.order, b.record.order], [0, 1]);
  assert.ok(Program.safeParse(a.record).success);
  await rejects(h.programs.create(editor, area({ title: "X", icon: "rocket" }), FACTS), "VALIDATION_ERROR", "icon");
  await rejects(h.programs.create(editor, area({ title: "X", html: "<b>x</b>" }), FACTS), "VALIDATION_ERROR", "html");
  await rejects(h.programs.create(editor, area({ title: "X", imageId: "x" }), FACTS), "VALIDATION_ERROR", "imageId");
  await rejects(h.programs.create(editor, area({ title: "X", order: 3 }), FACTS), "VALIDATION_ERROR", "order");
  await rejects(h.programs.create(editor, area(), FACTS), "VALIDATION_ERROR", "body.slug");
  await rejects(h.programs.create(editor, { title: "Y", icon: "education" }, FACTS), "VALIDATION_ERROR", "description");
  assert.deepEqual(h.audit.find((e) => e.action === "program.created")!.metadata.fields, ["activities", "description", "icon", "impact", "missingNote", "stories", "title", "why"]);
  assert.ok(!JSON.stringify(h.audit).includes("A test line"), "no wording in the audit");
});

test("programs: reorder all at once, revision-checked, one program.reordered", async () => {
  const { h } = setup();
  const a = await h.programs.create(owner, area({ title: "A" }), FACTS);
  const b = await h.programs.create(owner, area({ title: "B" }), FACTS);
  const c = await h.programs.create(owner, area({ title: "C" }), FACTS);
  const listed = await h.programs.reorder(editor, { items: [c, a, b].map((v) => ({ id: v.record.id, revision: v.revision })) }, FACTS);
  assert.deepEqual(listed.map((v) => [v.record.title, v.record.order]), [["C", 0], ["A", 1], ["B", 2]]);
  assert.deepEqual(h.audit.filter((e) => e.action === "program.reordered").map((e) => e.metadata), [{ moved: 3, total: 3 }]);
  assert.equal(h.audit.filter((e) => e.action === "program.updated").length, 0, "one reorder event, not one per program");
  await rejects(h.programs.reorder(editor, { items: [a, b, c].map((v) => ({ id: v.record.id, revision: v.revision })) }, FACTS), "CONFLICT");
  assert.deepEqual((await h.programs.list(owner, { sort: "title" })).items.map((v) => v.record.order), [1, 2, 0], "a stale reorder changed nothing");
});

test("programs: published addresses need confirmation; owner-only approval; archive; isolation", async () => {
  const data = sharedData();
  const h = harness("org-a", data);
  const b = harness("org-b", data);
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  await rejects(h.programs.create(editor, area({ status: "published" }), FACTS), "VALIDATION_ERROR", "draft");
  const p = await h.programs.create(editor, area(), FACTS);
  await rejects(h.programs.update(editor, p.record.id, { revision: p.revision, changes: { status: "published" } }, FACTS), "VALIDATION_ERROR", "status");
  const submitted = await h.programs.act(editor, p.record.id, "submit", { revision: p.revision }, FACTS);
  await rejects(h.programs.act(editor, p.record.id, "approve", { revision: submitted.revision }, FACTS), "FORBIDDEN");
  await approve(h.programs, owner, p.record.id, FACTS);
  await h.publishing.publish(owner, FACTS);
  const published = await h.programs.get(owner, p.record.id);
  assert.deepEqual([published.record.status, published.live], ["published", true]);
  await rejects(h.programs.update(owner, p.record.id, { revision: published.revision, changes: { slug: "renamed" } }, FACTS), "CONFLICT", "slug");
  const edited = await h.programs.update(editor, p.record.id, { revision: published.revision, changes: { description: "Edited by an editor." } }, FACTS);
  assert.deepEqual([edited.record.status, edited.live], ["draft", true], "an edit to a published program is a pending draft; its published version stays live");
  assert.equal((await h.programs.archive(editor, p.record.id, FACTS)).record.status, "archived");
  assert.equal(h.audit.filter((e) => e.action === "program.archived").length, 1);
  await rejects(b.programs.get(member("org-b", "OWNER"), p.record.id), "NOT_FOUND");
  await rejects(b.programs.reorder(member("org-b", "OWNER"), { items: [{ id: p.record.id, revision: 1 }] }, FACTS), "NOT_FOUND");
  await rejects(h.programs.get(member("org-b", "OWNER"), p.record.id), "FORBIDDEN");
});

test("programs: the share image must be a ready image of this organization", async () => {
  const { data, h, image } = setup();
  const theirs = addMedia(data, "org-b", "ready");
  await rejects(h.programs.create(owner, area({ seo: { ogImageId: theirs.id } }), FACTS), "VALIDATION_ERROR", "body.seo.ogImageId");
  await h.programs.create(owner, area({ seo: { title: "SEO", ogImageId: image.id } }), FACTS);
});

test("snapshot: programs only once one is published, in order; CMS records must name a published program", async () => {
  const { data, h, image } = setup();
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  await h.publishing.publish(owner, FACTS);
  const first = await h.programs.create(owner, area({ title: "First Area" }), FACTS);
  assert.deepEqual((await h.publishing.status(owner)).changedSections, [], "drafts only: the website keeps its own programs");
  await updateApproved(h.programs, owner, first.record.id, { revision: first.revision, changes: { seo: { ogImageId: image.id } } }, FACTS);
  const second = await createApproved(h.programs, owner, area({ title: "Second Area", icon: "health" }), FACTS);
  await h.programs.create(owner, area({ title: "Draft Area" }), FACTS);
  const gone = await createApproved(h.programs, owner, area({ title: "Archived Area" }), FACTS);
  await h.programs.archive(owner, gone.record.id, FACTS);
  const firstNow = (await h.programs.get(owner, first.record.id));
  await h.programs.reorder(owner, { items: [second, firstNow].map((v) => ({ id: v.record.id, revision: v.revision })) }, FACTS);
  // The homepage's timeline names a program (the CMS records that can).
  const milestone = { id: "m1", date: "2026-03-14", programId: "first-area", title: "A milestone", summary: "A line.", youtubeId: "QP5Fs3AYuWE", videoTitle: "A film", posterId: image.id };
  await h.homepage.create(owner, { sections: [{ id: "timeline", type: "timeline", enabled: true, version: 1, data: { heading: "Progress", items: [milestone] } }] }, FACTS);
  await approvePage(h.homepage, owner, FACTS);
  await h.publishing.publish(owner, FACTS);
  const snapshot = (await h.publishing.publicSnapshot())!;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.deepEqual(snapshot.content.programs!.map((p) => p.title), ["Second Area", "First Area"], "program order");
  const text = JSON.stringify(snapshot);
  for (const leak of ["Draft Area", "Archived Area", "revision", "updatedBy", "slugHistory", "objectKey"]) assert.ok(!text.includes(leak), `leaked: ${leak}`);
  assert.deepEqual(secretProblems(snapshot), []);

  // The timeline names a program that is then archived: the whole publish is refused.
  const firstAgain = await h.programs.get(owner, first.record.id);
  await h.programs.archive(owner, firstAgain.record.id, FACTS);
  await rejects(h.publishing.publish(owner, FACTS), "VALIDATION_ERROR", "not published");
  assert.equal((await h.publishing.publicSnapshot())!.version, 2);
  // Reopened, changed and approved again — then the share image stops being ready: refused too.
  await h.programs.update(owner, first.record.id, { revision: (await h.programs.get(owner, first.record.id)).revision, changes: { status: "draft" } }, FACTS);
  await updateApproved(h.programs, owner, first.record.id, { revision: (await h.programs.get(owner, first.record.id)).revision, changes: { description: "A changed line." } }, FACTS);
  data.media.find((m) => m.id === image.id)!.status = "deleted";
  await rejects(h.publishing.publish(owner, FACTS), "VALIDATION_ERROR", "media");
  assert.equal((await h.publishing.publicSnapshot())!.version, 2);
});
