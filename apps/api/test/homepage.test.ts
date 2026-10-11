import { test } from "node:test";
import assert from "node:assert/strict";
import { Homepage, PublishedSnapshot } from "@rbb/content-schema";
import { ApiError } from "../src/errors.ts";
import { HOMEPAGE_CONFLICT, homepageChanges } from "../src/modules/homepage/service.ts";
import { secretProblems } from "../src/modules/publishing/service.ts";
import { settingsRecord } from "./fixtures/settings.ts";
import { FACTS, member } from "./media/memory.ts";
import { addMedia, harness, sharedData } from "./settings/memory.ts";
import { approvePage, createApproved } from "./support/workflow.ts";

/* The homepage (M8): one per organization, ordered blocks, references to
   published posts/events/appeals, owner-only publishing, and the homepage
   in the snapshot. Test records only. */

const owner = member("org-a", "OWNER");
const editor = member("org-a", "EDITOR");
const rich = [{ type: "paragraph", children: [{ type: "text", text: "A test paragraph." }] }];
const rejects = async (promise: Promise<unknown>, code: string, pathPart?: string) =>
  assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError, String(error));
    assert.equal(error.code, code, error.message);
    if (pathPart) assert.ok(error.details?.some((d) => d.path.includes(pathPart) || d.message.includes(pathPart)), JSON.stringify(error.details));
    return true;
  });

const block = (id: string, type: string, data: unknown, enabled = true) => ({ id, type, enabled, version: 1, data });
const hero = (imageId: string) =>
  block("hero", "hero", { slides: [{ id: "one", headline: ["A test line."], cta: { label: "Go", href: "/work" }, imageId, insetId: imageId }], secondaryCta: { label: "More", href: "/get-involved" }, intervalMs: 7000 });
const who = (imageId: string) => block("who", "imageText", { heading: "Who we are", body: ["A paragraph."], imageId });
const faq = (enabled = true) => block("faq", "faq", { heading: "Questions", items: [{ question: "A question?", answer: "An answer." }] }, enabled);

function setup() {
  const data = sharedData();
  const h = harness("org-a", data);
  const image = addMedia(data, "org-a", "ready", { alt: "A test image" });
  return { data, h, image };
}

test("one homepage per organization: read before it exists, create once, then revision-checked", async () => {
  const { h, image } = setup();
  assert.deepEqual(await h.homepage.get(editor), { record: null, revision: 0, updatedAt: null, updatedBy: null, live: false, schedule: null });
  const created = await h.homepage.create(editor, { sections: [hero(image.id), who(image.id)] }, FACTS);
  assert.equal(created.record!.status, "draft");
  assert.equal(created.record!.orgId, "org-a");
  assert.equal(created.revision, 1);
  assert.ok(Homepage.safeParse(created.record).success);
  await rejects(h.homepage.create(owner, { sections: [] }, FACTS), "CONFLICT");
  await rejects(h.homepage.update(editor, { revision: 0, changes: { sections: [] } }, FACTS), "CONFLICT");
  const stale = (await h.homepage.update(editor, { revision: 7, changes: { sections: [] } }, FACTS).catch((e) => e)) as ApiError;
  assert.equal(stale.message, HOMEPAGE_CONFLICT);
  await rejects(h.homepage.update(editor, { revision: 1, changes: { orgId: "org-b" } }, FACTS), "VALIDATION_ERROR", "orgId");
  const audit = h.audit.find((e) => e.action === "homepage.created")!;
  assert.deepEqual(audit.metadata, { fields: ["sections", "status"], status: "draft", sections: 2 });
});

test("revision 0 creates too (the donation page's pattern)", async () => {
  const { h, image } = setup();
  const created = await h.homepage.update(editor, { revision: 0, changes: { sections: [who(image.id)] } }, FACTS);
  assert.equal(created.revision, 1);
});

test("blocks: validated against the registry; unknown, HTML, misplaced and sample-marked blocks refused", async () => {
  const { h, image } = setup();
  await h.homepage.create(owner, { sections: [hero(image.id)] }, FACTS);
  const bad: [string, unknown[]][] = [
    ["unknown block", [block("x", "carousel", { heading: "H" })]],
    ["html", [block("x", "html", { html: "<script>alert(1)</script>" })]],
    ["html field", [{ ...who(image.id), data: { heading: "H", body: ["p"], imageId: image.id, html: "<b>x</b>" } }]],
    ["hero second", [who(image.id), hero(image.id)]],
    ["duplicate id", [faq(), faq()]],
    ["release marker", [block("f", "faq", { heading: "Q", items: [{ question: "Q?", answer: "A.", releaseMarker: "sample" }] })]],
  ];
  for (const [name, sections] of bad) await rejects(h.homepage.update(owner, { revision: 1, changes: { sections } }, FACTS), "VALIDATION_ERROR", undefined).catch((e) => assert.fail(`${name}: ${e}`));
  assert.equal((await h.homepage.get(owner)).revision, 1, "nothing was saved");
});

test("order, enable/disable and edits: a new list each time; the audit names blocks, never wording", async () => {
  const { h, image } = setup();
  await h.homepage.create(owner, { sections: [hero(image.id), who(image.id), faq()] }, FACTS);
  const reordered = await h.homepage.update(editor, { revision: 1, changes: { sections: [hero(image.id), faq(), who(image.id)] } }, FACTS);
  assert.deepEqual(reordered.record!.sections.map((s) => s.id), ["hero", "faq", "who"]);
  const disabled = await h.homepage.update(editor, { revision: 2, changes: { sections: [hero(image.id), faq(false), { ...who(image.id), data: { heading: "Edited heading", body: ["A paragraph."], imageId: image.id } }] } }, FACTS);
  assert.equal(disabled.record!.sections[1]!.enabled, false, "a disabled block stays in the record");
  const updates = h.audit.filter((e) => e.action === "homepage.updated");
  assert.deepEqual(updates[0]!.metadata.fields, ["sections.order"]);
  assert.deepEqual(updates[1]!.metadata.fields, ["sections.faq.enabled", "sections.who.data.heading"]);
  assert.ok(!JSON.stringify(h.audit).includes("Edited heading"), "no wording in the audit");
});

test("media: ready images of this organization only", async () => {
  const { data, h, image } = setup();
  const pending = addMedia(data, "org-a", "pending");
  const theirs = addMedia(data, "org-b", "ready");
  await rejects(h.homepage.create(owner, { sections: [hero(pending.id)] }, FACTS), "VALIDATION_ERROR", pending.id);
  await rejects(h.homepage.create(owner, { sections: [who(theirs.id)] }, FACTS), "VALIDATION_ERROR", theirs.id);
  await rejects(h.homepage.create(owner, { sections: [who(image.id)], seo: { ogImageId: "not-a-media-id" } }, FACTS), "VALIDATION_ERROR", "not-a-media-id");
  await h.homepage.create(owner, { sections: [who(image.id)], seo: { title: "Home", ogImageId: image.id } }, FACTS);
});

test("references: must exist here; approving the homepage needs them approved", async () => {
  const { h, image } = setup();
  const post = await h.posts.create(owner, { type: "news", title: "Referenced news", body: rich, imageId: image.id }, FACTS);
  const event = await h.events.create(owner, { title: "Referenced event", summary: "S.", about: rich, date: "2026-11-14", startTime: "6:30 PM", timezone: "Europe/London", venue: "Hall", address: "1 Street", imageId: image.id }, FACTS);
  const appeal = await h.appeals.create(owner, { kind: "campaign", title: "Referenced appeal", summary: "S.", imageId: image.id }, FACTS);
  const lists = (postId = post.record.id) => [
    block("news", "postList", { heading: "News", postIds: [postId] }),
    block("events", "eventList", { heading: "Events", eventIds: [event.record.id] }),
    block("appeals", "appealList", { heading: "Appeals", appealIds: [appeal.record.id] }),
  ];
  await rejects(h.homepage.create(owner, { sections: lists("no-such-post") }, FACTS), "VALIDATION_ERROR", "does not exist");
  await h.homepage.create(editor, { sections: lists() }, FACTS); // drafts may point at drafts
  await h.homepage.act(editor, "submit", { revision: 1 }, FACTS); // submitting checks existence only
  const refused = (await h.homepage.act(owner, "approve", { revision: 2 }, FACTS).catch((e) => e)) as ApiError;
  assert.equal(refused.code, "VALIDATION_ERROR");
  assert.deepEqual(refused.details!.map((d) => d.message), ["refers to a post that is draft, not approved", "refers to an event that is draft, not approved", "refers to an appeal that is draft, not approved"]);
  assert.equal((await h.homepage.get(owner)).record!.status, "submitted", "a refused approval changes nothing");
  await h.homepage.act(editor, "withdraw", { revision: 2 }, FACTS);
  // Another organization's records are not here.
  const b = harness("org-b", h.data);
  await rejects(b.homepage.create(member("org-b", "OWNER"), { sections: [block("news", "postList", { heading: "News", postIds: [post.record.id] })] }, FACTS), "VALIDATION_ERROR", "does not exist");
  // A DISABLED block's references are not checked: it is not published.
  await h.homepage.update(owner, { revision: 3, changes: { sections: lists().map((s) => ({ ...s, enabled: false })) } }, FACTS);
  assert.equal((await approvePage(h.homepage, owner, FACTS)).record!.status, "approved");
});

test("owner-only approval: editors submit the homepage, never approve or publish it", async () => {
  const { h, image } = setup();
  await rejects(h.homepage.create(editor, { sections: [who(image.id)], status: "published" }, FACTS), "VALIDATION_ERROR", "draft");
  await h.homepage.create(editor, { sections: [who(image.id)] }, FACTS);
  await rejects(h.homepage.update(editor, { revision: 1, changes: { status: "published" } }, FACTS), "VALIDATION_ERROR", "status");
  await rejects(h.homepage.update(editor, { revision: 1, changes: { status: "approved" } }, FACTS), "VALIDATION_ERROR", "status");
  await rejects(h.homepage.act(owner, "approve", { revision: 1 }, FACTS), "CONFLICT", "draft");
  await h.homepage.act(editor, "submit", { revision: 1 }, FACTS);
  await rejects(h.homepage.act(editor, "submit", { revision: 2 }, FACTS), "CONFLICT");
  await rejects(h.homepage.act(editor, "approve", { revision: 2 }, FACTS), "FORBIDDEN");
  await rejects(h.homepage.act(editor, "reject", { revision: 2 }, FACTS), "FORBIDDEN");
  assert.equal((await h.homepage.act(owner, "approve", { revision: 2 }, FACTS)).record!.status, "approved");
  assert.equal((await h.homepage.update(editor, { revision: 3, changes: { sections: [who(image.id), faq()] } }, FACTS)).record!.status, "draft", "an edit returns it to draft");
  assert.equal((await h.homepage.archive(editor, FACTS)).record!.status, "archived");
  assert.equal((await h.homepage.archive(editor, FACTS)).record!.status, "archived", "archiving is idempotent");
  assert.equal(h.audit.filter((e) => e.action === "homepage.archived").length, 1);
  await rejects(h.homepage.update(editor, { revision: 5, changes: { status: "published" } }, FACTS), "VALIDATION_ERROR", "status");
  await rejects(h.homepage.act(owner, "approve", { revision: 5 }, FACTS), "CONFLICT", "archived");
  assert.equal((await h.homepage.update(editor, { revision: 5, changes: { status: "draft" } }, FACTS)).record!.status, "draft", "reopened as a draft");
});

test("organization isolation", async () => {
  const data = sharedData();
  const a = harness("org-a", data);
  const b = harness("org-b", data);
  const image = addMedia(data, "org-a", "ready");
  await a.homepage.create(owner, { sections: [who(image.id)] }, FACTS);
  assert.equal((await b.homepage.get(member("org-b", "OWNER"))).record, null);
  await rejects(a.homepage.get(member("org-b", "OWNER")), "FORBIDDEN");
});

test("snapshot: the PUBLISHED homepage only, enabled blocks only, references resolved; failures keep the live version", async () => {
  const { data, h, image } = setup();
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  await h.publishing.publish(owner, FACTS);
  const post = await createApproved(h.posts, owner, { type: "news", title: "Referenced news", body: rich, imageId: image.id }, FACTS);
  await h.homepage.create(owner, { sections: [hero(image.id), faq(false), block("news", "postList", { heading: "News", postIds: [post.record.id] })] }, FACTS);
  assert.deepEqual((await h.publishing.status(owner)).changedSections, ["news"], "a draft homepage is not a public change");
  await approvePage(h.homepage, owner, FACTS);
  assert.deepEqual((await h.publishing.status(owner)).changedSections, ["news", "homepage"]);
  await h.publishing.publish(owner, FACTS);
  const snapshot = (await h.publishing.publicSnapshot())!;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.deepEqual(snapshot.content.homepage!.sections.map((s) => s.id), ["hero", "news"], "the disabled block stays out");
  const text = JSON.stringify(snapshot.content.homepage);
  for (const leak of ['"createdAt"', '"updatedAt"', "revision", "updatedBy", "Test Member"]) assert.ok(!text.includes(leak), leak);
  assert.deepEqual(secretProblems(snapshot), []);
  assert.deepEqual(h.audit.filter((e) => e.action === "publish.completed").at(-1)!.metadata.counts, { news: 1, homepage: 2 });

  // The referenced post is archived: the next publish is refused (the live homepage, carried
  // forward while its edit is a draft, still names it), nothing changes.
  await h.homepage.update(owner, { revision: 3, changes: { seo: { title: "Home" } } }, FACTS);
  await h.posts.archive(owner, post.record.id, FACTS);
  await rejects(h.publishing.publish(owner, FACTS), "VALIDATION_ERROR", "not published");
  // …and approving the homepage now says so too.
  await h.homepage.act(owner, "submit", { revision: 4 }, FACTS);
  await rejects(h.homepage.act(owner, "approve", { revision: 5 }, FACTS), "VALIDATION_ERROR", "archived, not approved");
  await h.homepage.act(owner, "withdraw", { revision: 5 }, FACTS);
  // An image that stopped being ready also blocks it.
  await h.posts.update(owner, post.record.id, { revision: 4, changes: { status: "draft" } }, FACTS);
  await h.homepage.update(owner, { revision: 6, changes: { sections: [hero(image.id)] } }, FACTS);
  await approvePage(h.homepage, owner, FACTS);
  data.media.find((m) => m.id === image.id)!.status = "deleted";
  await rejects(h.publishing.publish(owner, FACTS), "VALIDATION_ERROR", "media");
  const live = (await h.publishing.publicSnapshot())!;
  assert.equal(live.version, 2);
  assert.deepEqual(live.content.homepage!.sections.map((s) => s.id), ["hero", "news"]);

  // Archived again: the website returns to its own homepage.
  data.media.find((m) => m.id === image.id)!.status = "ready";
  await h.homepage.archive(owner, FACTS);
  await h.publishing.publish(owner, FACTS);
  assert.equal((await h.publishing.publicSnapshot())!.content.homepage, undefined);
});

test("homepageChanges: block-level paths", () => {
  const base = Homepage.parse({ id: "homepage", orgId: "o", schemaVersion: 1, status: "draft", sections: [faq(), who("img")] });
  assert.deepEqual(homepageChanges(base, { ...base, sections: [base.sections[1]!, base.sections[0]!] }), ["sections.order"]);
  assert.deepEqual(homepageChanges(base, { ...base, sections: [base.sections[0]!] }), ["sections.who"]);
  assert.deepEqual(homepageChanges(base, { ...base, seo: { title: "T" } }), ["seo.title"]);
});
