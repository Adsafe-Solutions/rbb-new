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

/* ---------------- Team templates ---------------- */

const NOTE = "Sample profile — this page shows how a team member's profile will appear. It describes a role, not a real person.";
const template = (o: Record<string, unknown> = {}) => person({ name: "Executive Director", slug: "executive-director", role: "Leadership", group: "leadership", releaseMarker: NOTE, ...o });

test("templates: created marked in ONE request (no unmarked draft ever exists), by editors; a template cannot be submitted or approved; a save cannot clear the marker", async () => {
  const { h } = setup();
  const created = await h.team.create(editor, template(), FACTS);
  assert.equal(created.record.status, "draft");
  assert.equal(created.record.releaseMarker, NOTE);
  assert.equal(created.record.imageId, undefined, "no photograph");
  assert.ok(h.audit.some((e: { action: string; metadata?: { fields?: string[] } }) => e.action === "team_member.created" && e.metadata?.fields?.includes("releaseMarker")), "audited by field name");
  await rejects(h.team.act(editor, created.record.id, "submit", { revision: created.revision }, FACTS), "CONFLICT", "template");
  await rejects(h.team.act(owner, created.record.id, "submit", { revision: created.revision }, FACTS), "CONFLICT", "template");
  await rejects(h.team.act(owner, created.record.id, "approve", { revision: created.revision }, FACTS), "CONFLICT");
  await rejects(h.team.update(owner, created.record.id, { revision: created.revision, changes: { releaseMarker: null } }, FACTS), "VALIDATION_ERROR", "releaseMarker");
  const edited = await h.team.update(editor, created.record.id, { revision: created.revision, changes: { shortBio: "Leads the organisation's direction, partnerships and team." } }, FACTS);
  assert.equal(edited.record.releaseMarker, NOTE, "an ordinary edit keeps the marker");
  assert.equal(edited.record.status, "draft");
  await rejects(h.team.update(editor, created.record.id, { revision: edited.revision, changes: { status: "submitted" } }, FACTS), "VALIDATION_ERROR");
});

test("templates: unmark is an owner's action on the revision open — the marker goes, the record stays a draft, it is audited; then it submits like any member", async () => {
  const { h } = setup();
  const created = await h.team.create(editor, template(), FACTS);
  await rejects(h.team.act(editor, created.record.id, "unmark", { revision: created.revision }, FACTS), "FORBIDDEN");
  await rejects(h.team.act(owner, created.record.id, "unmark", { revision: created.revision + 1 }, FACTS), "CONFLICT");
  const real = await h.team.act(owner, created.record.id, "unmark", { revision: created.revision }, FACTS);
  assert.equal(real.record.status, "draft", "unmark never submits, approves or publishes");
  assert.equal(real.record.releaseMarker, undefined);
  assert.equal(real.revision, created.revision + 1);
  const audit = h.audit.find((e: { action: string }) => e.action === "team_member.unmarked") as { metadata?: { from?: string; to?: string; revision?: number } } | undefined;
  assert.deepEqual(audit?.metadata, { from: "draft", to: "draft", revision: real.revision });
  await rejects(h.team.act(owner, created.record.id, "unmark", { revision: real.revision }, FACTS), "CONFLICT", "template only");
  const submitted = await h.team.act(editor, created.record.id, "submit", { revision: real.revision }, FACTS);
  assert.equal(submitted.record.status, "submitted");
  const approved = await h.team.act(owner, created.record.id, "approve", { revision: submitted.revision }, FACTS);
  assert.equal(approved.record.status, "approved");
  /* A member who has been on the website never becomes a template. */
  const published = await createApproved(h.team, owner, person({ name: "A Real Person", slug: "a-real-person" }), FACTS);
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  await h.publishing.publish(owner, FACTS);
  const live = await h.team.get(owner, published.record.id);
  await rejects(h.team.update(owner, published.record.id, { revision: live.revision, changes: { releaseMarker: NOTE } }, FACTS), "VALIDATION_ERROR", "published");
});

test("templates: never published — six marked drafts change nothing in the snapshot, a template forced to approved is refused and the live version stays, the published members are untouched", async () => {
  const { data, h } = setup();
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  const one = await createApproved(h.team, owner, person({ name: "Aquib Test", slug: "aquib-test" }), FACTS);
  const two = await createApproved(h.team, owner, person({ name: "Maaz Test", slug: "maaz-test" }), FACTS);
  const first = await h.publishing.publish(owner, FACTS);
  const slugs = ["executive-director", "head-of-programs", "volunteer-coordinator", "partnerships-lead", "finance-lead", "communications-lead"];
  const templates: Awaited<ReturnType<typeof h.team.create>>[] = [];
  for (const [i, slug] of slugs.entries()) templates.push(await h.team.create(editor, template({ slug, name: slug, group: i < 2 ? "leadership" : "team" }), FACTS));
  const before = JSON.stringify([await h.team.get(owner, one.record.id), await h.team.get(owner, two.record.id)]);
  await rejects(h.publishing.publish(owner, FACTS), "CONFLICT");
  const snap = (await h.publishing.publicSnapshot())!;
  assert.equal(snap.version, first.version, "no changes to publish: the templates are not content");
  assert.deepEqual(snap.content.team!.map((m) => m.slug).sort(), ["aquib-test", "maaz-test"]);
  /* Tampered with below the API (a template marked approved): refused, the live version stays. */
  const forced = data.team.find((r) => r.record.id === templates[0]!.record.id)!;
  forced.record = { ...forced.record, status: "approved" } as typeof forced.record;
  await rejects(h.publishing.publish(owner, FACTS), "VALIDATION_ERROR", "template");
  assert.equal((await h.publishing.publicSnapshot())!.version, first.version, "the active version is unchanged");
  assert.ok(h.audit.some((e: { action: string }) => e.action === "publish.rejected"));
  assert.equal(JSON.stringify([await h.team.get(owner, one.record.id), await h.team.get(owner, two.record.id)]), before, "the published members are exactly as they were");
  assert.equal(data.team.filter((r) => r.record.releaseMarker).length, 6);
});
