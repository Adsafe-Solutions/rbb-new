import { test } from "node:test";
import assert from "node:assert/strict";
import { About, PublishedSnapshot, TeamMember } from "@rbb/content-schema";
import { ApiError } from "../src/errors.ts";
import { ABOUT_CONFLICT } from "../src/modules/about/service.ts";
import { secretProblems } from "../src/modules/publishing/service.ts";
import { settingsRecord } from "./fixtures/settings.ts";
import { FACTS, member } from "./media/memory.ts";
import { addMedia, harness, sharedData } from "./settings/memory.ts";
import { approve, approvePage, createApproved } from "./support/workflow.ts";

/* The About page and the team (M9): the About page is a block page (the
   homepage's machinery), team members a content collection with their
   own order; owner-only publishing; both in the snapshot. Test records
   only — no real people. */

const owner = member("org-a", "OWNER");
const editor = member("org-a", "EDITOR");
const rejects = async (promise: Promise<unknown>, code: string, pathPart?: string) =>
  assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError, String(error));
    assert.equal(error.code, code, error.message);
    if (pathPart) assert.ok(error.details?.some((d) => d.path.includes(pathPart) || d.message.includes(pathPart)), JSON.stringify(error.details));
    return true;
  });
const block = (id: string, type: string, data: unknown, enabled = true) => ({ id, type, enabled, version: 1, data });
const intro = () => block("intro", "pageHero", { title: "About a test organization", body: "A test line.", cta: { label: "Explore", href: "/work" } });
const who = () => block("who", "statement", { kicker: "Who we are", heading: "A test heading", body: ["One.", "Two."] });
const values = (enabled = true) => block("values", "numberedCards", { heading: "Test values", items: [{ title: "A value", description: "A line." }] }, enabled);
const person = (o: Record<string, unknown> = {}) => ({ name: "Test Role", role: "A test area", group: "team", shortBio: "A test line.", ...o });

function setup() {
  const data = sharedData();
  const h = harness("org-a", data);
  const image = addMedia(data, "org-a", "ready", { alt: "A test portrait" });
  return { data, h, image };
}

/* ---------------- About ---------------- */

test("about: one per organization, revision-checked, its own conflict message", async () => {
  const { h } = setup();
  assert.deepEqual(await h.about.get(editor), { record: null, revision: 0, updatedAt: null, updatedBy: null, live: false, schedule: null });
  const created = await h.about.create(editor, { sections: [intro(), who()] }, FACTS);
  assert.equal(created.record!.status, "draft");
  assert.equal(created.record!.id, "about");
  assert.ok(About.safeParse(created.record).success);
  await rejects(h.about.create(owner, { sections: [] }, FACTS), "CONFLICT");
  const stale = (await h.about.update(editor, { revision: 9, changes: { sections: [] } }, FACTS).catch((e) => e)) as ApiError;
  assert.equal(stale.message, ABOUT_CONFLICT);
  await rejects(h.about.update(editor, { revision: 1, changes: { orgId: "org-b" } }, FACTS), "VALIDATION_ERROR", "orgId");
  assert.deepEqual(h.audit.find((e) => e.action === "about.created")!.metadata, { fields: ["sections", "status"], status: "draft", sections: 2 });
});

test("about: only the page's own blocks; unknown, HTML, homepage-only and sample-marked blocks refused", async () => {
  const { h } = setup();
  await h.about.create(owner, { sections: [intro()] }, FACTS);
  const bad: unknown[][] = [
    [block("x", "carousel", {})],
    [block("x", "html", { html: "<script>alert(1)</script>" })],
    [block("x", "postList", { heading: "P", postIds: ["x"] })],
    [who(), intro()],
    [block("v", "numberedCards", { heading: "V", items: [{ title: "T", releaseMarker: "sample" }] })],
    [block("t", "transparency", { heading: "made up" })],
  ];
  for (const sections of bad) await rejects(h.about.update(owner, { revision: 1, changes: { sections } }, FACTS), "VALIDATION_ERROR");
  assert.equal((await h.about.get(owner)).revision, 1, "nothing was saved");
});

test("about: order, hide and edits audited by block; media checked; owner-only publishing", async () => {
  const { data, h, image } = setup();
  await h.about.create(editor, { sections: [intro(), who(), values()] }, FACTS);
  await h.about.update(editor, { revision: 1, changes: { sections: [intro(), values(false), who()] } }, FACTS);
  assert.deepEqual(h.audit.filter((e) => e.action === "about.updated").at(-1)!.metadata.fields, ["sections.order", "sections.values.enabled"]);
  const pending = addMedia(data, "org-a", "pending");
  await rejects(h.about.update(editor, { revision: 2, changes: { seo: { ogImageId: pending.id } } }, FACTS), "VALIDATION_ERROR", pending.id);
  await h.about.update(editor, { revision: 2, changes: { seo: { title: "About", ogImageId: image.id } } }, FACTS);
  await rejects(h.about.update(editor, { revision: 3, changes: { status: "published" } }, FACTS), "VALIDATION_ERROR", "status");
  assert.equal((await h.about.act(editor, "submit", { revision: 3 }, FACTS)).record!.status, "submitted");
  await rejects(h.about.update(editor, { revision: 4, changes: { sections: [intro(), who()] } }, FACTS), "CONFLICT", "submitted");
  await rejects(h.about.act(editor, "approve", { revision: 4 }, FACTS), "FORBIDDEN");
  assert.equal((await h.about.act(owner, "approve", { revision: 4 }, FACTS)).record!.status, "approved");
  assert.equal((await h.about.update(editor, { revision: 5, changes: { sections: [intro(), who()] } }, FACTS)).record!.status, "draft", "an editor's edit returns it to draft");
  assert.equal((await h.about.archive(editor, FACTS)).record!.status, "archived");
  assert.equal(h.audit.filter((e) => e.action === "about.archived").length, 1);
});

test("about: organization isolation", async () => {
  const data = sharedData();
  const a = harness("org-a", data);
  const b = harness("org-b", data);
  await a.about.create(owner, { sections: [intro()] }, FACTS);
  assert.equal((await b.about.get(member("org-b", "OWNER"))).record, null);
  await rejects(a.about.get(member("org-b", "OWNER")), "FORBIDDEN");
});

/* ---------------- Team ---------------- */

test("team: create as drafts at the end of the team; the contract's fields only", async () => {
  const { h, image } = setup();
  const first = await h.team.create(editor, person({ imageId: image.id }), FACTS);
  const second = await h.team.create(editor, person({ name: "Second Role", group: "leadership" }), FACTS);
  assert.equal(first.record.status, "draft");
  assert.equal(first.record.slug, "test-role");
  assert.deepEqual([first.record.order, second.record.order], [0, 1], "new members go to the end");
  assert.ok(TeamMember.safeParse(second.record).success);
  await rejects(h.team.create(editor, person({ name: "Third", email: "a@b.org" }), FACTS), "VALIDATION_ERROR", "email");
  await rejects(h.team.create(editor, person({ name: "Third", order: 0 }), FACTS), "VALIDATION_ERROR", "order");
  await rejects(h.team.create(editor, person({ name: "Third", group: "board" }), FACTS), "VALIDATION_ERROR", "group");
  await rejects(h.team.create(editor, person({ name: "Third", socialLinks: [{ label: "X", url: "http://insecure.example" }] }), FACTS), "VALIDATION_ERROR", "socialLinks");
  await rejects(h.team.create(editor, person({ name: "Third", biography: ["<script>alert(1)</script>"], html: "x" }), FACTS), "VALIDATION_ERROR", "html");
  await rejects(h.team.create(editor, person({ name: "Test Role" }), FACTS), "VALIDATION_ERROR", "body.slug");
  const entry = h.audit.find((e) => e.action === "team_member.created")!;
  assert.ok(!JSON.stringify(entry).includes("A test line"), "no wording in the audit");
});

test("team: media must be ready images of this organization; a published person's photograph is described", async () => {
  const { data, h } = setup();
  const undescribed = addMedia(data, "org-a", "ready", { alt: "" });
  const draft = await h.team.create(owner, person({ imageId: undescribed.id }), FACTS);
  await rejects(approve(h.team, owner, draft.record.id, FACTS), "VALIDATION_ERROR", "alt text");
  const theirs = addMedia(data, "org-b", "ready");
  const deleted = addMedia(data, "org-a", "deleted");
  await rejects(h.team.create(owner, person({ name: "Other", imageId: theirs.id }), FACTS), "VALIDATION_ERROR", "body.imageId");
  await rejects(h.team.create(owner, person({ name: "Another", imageId: deleted.id }), FACTS), "VALIDATION_ERROR", "body.imageId");
});

test("team: reorder sets everyone's position at once, revision-checked, all or nothing", async () => {
  const { h } = setup();
  const a = await h.team.create(owner, person({ name: "A" }), FACTS);
  const b = await h.team.create(owner, person({ name: "B" }), FACTS);
  const c = await h.team.create(owner, person({ name: "C" }), FACTS);
  const listed = await h.team.reorder(editor, { items: [c, a, b].map((v) => ({ id: v.record.id, revision: v.revision })) }, FACTS);
  assert.deepEqual(listed.map((v) => [v.record.name, v.record.order]), [["C", 0], ["A", 1], ["B", 2]]);
  assert.deepEqual(h.audit.filter((e) => e.action === "team_member.updated").map((e) => e.metadata.fields), [["order"], ["order"], ["order"]]);
  // A stale revision: nothing changes.
  await rejects(h.team.reorder(editor, { items: [a, b, c].map((v) => ({ id: v.record.id, revision: v.revision })) }, FACTS), "CONFLICT");
  assert.deepEqual((await h.team.list(owner, { pageSize: "10" })).items.map((v) => v.record.order).sort(), [0, 1, 2]);
  await rejects(h.team.reorder(editor, { items: [{ id: "nobody", revision: 1 }] }, FACTS), "NOT_FOUND");
  await rejects(h.team.reorder(editor, { items: [{ id: a.record.id, revision: 9 }, { id: a.record.id, revision: 9 }] }, FACTS), "VALIDATION_ERROR");
});

test("team: owner-only publishing; archive; isolation", async () => {
  const data = sharedData();
  const h = harness("org-a", data);
  const b = harness("org-b", data);
  await rejects(h.team.create(editor, person({ status: "published" }), FACTS), "VALIDATION_ERROR", "draft");
  const m = await h.team.create(editor, person(), FACTS);
  await rejects(h.team.update(editor, m.record.id, { revision: m.revision, changes: { status: "published" } }, FACTS), "VALIDATION_ERROR", "status");
  const submitted = await h.team.act(editor, m.record.id, "submit", { revision: m.revision }, FACTS);
  await rejects(h.team.act(editor, m.record.id, "approve", { revision: submitted.revision }, FACTS), "FORBIDDEN");
  const approved = await approve(h.team, owner, m.record.id, FACTS);
  assert.equal(approved.record.status, "approved");
  assert.equal((await h.team.archive(editor, m.record.id, FACTS)).record.status, "archived");
  assert.equal(h.audit.filter((e) => e.action === "team_member.archived").length, 1);
  await rejects(b.team.get(member("org-b", "OWNER"), m.record.id), "NOT_FOUND");
  await rejects(h.team.get(member("org-b", "OWNER"), m.record.id), "FORBIDDEN");
});

/* ---------------- Snapshot ---------------- */

test("snapshot: published About (enabled blocks) and published members in team order; failures keep the live version", async () => {
  const { data, h, image } = setup();
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  await h.publishing.publish(owner, FACTS);
  await h.about.create(owner, { sections: [intro(), values(false), who()] }, FACTS);
  const x = await createApproved(h.team, owner, person({ name: "First Role", imageId: image.id }), FACTS);
  const y = await createApproved(h.team, owner, person({ name: "Second Role" }), FACTS);
  await h.team.create(owner, person({ name: "Draft Role" }), FACTS);
  const gone = await createApproved(h.team, owner, person({ name: "Archived Role" }), FACTS);
  await h.team.archive(owner, gone.record.id, FACTS);
  await h.team.reorder(owner, { items: [y, x].map((v) => ({ id: v.record.id, revision: v.revision })) }, FACTS);
  assert.deepEqual((await h.publishing.status(owner)).changedSections, ["team"], "a draft About page is not a public change");
  await approvePage(h.about, owner, FACTS);
  await h.publishing.publish(owner, FACTS);
  const snapshot = (await h.publishing.publicSnapshot())!;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.deepEqual(snapshot.content.about!.sections.map((s) => s.id), ["intro", "who"], "the hidden block stays out");
  assert.deepEqual(snapshot.content.team!.map((m) => m.name), ["Second Role", "First Role"], "team order");
  assert.deepEqual(Object.keys(snapshot.media), [image.id]);
  const text = JSON.stringify(snapshot);
  for (const leak of ["Draft Role", "Archived Role", "revision", "updatedBy", "slugHistory", "objectKey", "Test Member"]) assert.ok(!text.includes(leak), `leaked: ${leak}`);
  assert.deepEqual(secretProblems(snapshot), []);
  assert.deepEqual(h.audit.filter((e) => e.action === "publish.completed").at(-1)!.metadata.counts, { team: 2, about: 2 });

  // A member's photograph stops being ready: the whole publish is refused.
  data.media.find((m) => m.id === image.id)!.status = "deleted";
  await h.about.update(owner, { revision: 3, changes: { seo: { title: "About" } } }, FACTS);
  await approvePage(h.about, owner, FACTS);
  await rejects(h.publishing.publish(owner, FACTS), "VALIDATION_ERROR", "media");
  assert.equal((await h.publishing.publicSnapshot())!.version, 2);
  data.media.find((m) => m.id === image.id)!.status = "ready";
  // Archived again: the website returns to its own About page.
  await h.about.archive(owner, FACTS);
  await h.publishing.publish(owner, FACTS);
  assert.equal((await h.publishing.publicSnapshot())!.content.about, undefined);
});
