import { test } from "node:test";
import assert from "node:assert/strict";
import { PublishedSnapshot } from "@rbb/content-schema";
import { ApiError } from "../../src/errors.ts";
import { slugify } from "../../src/modules/content/shared.ts";
import { settingsRecord } from "../fixtures/settings.ts";
import { FACTS, member } from "../media/memory.ts";
import { addMedia, harness, sharedData } from "../settings/memory.ts";
import { approve, createApproved } from "../support/workflow.ts";

/* Posts and events: the shared content lifecycle, each module's own
   rules, and how published records reach the snapshot. Test records only. */

const owner = member("org-a", "OWNER");
const editor = member("org-a", "EDITOR");
const body = [{ type: "paragraph", children: [{ type: "text", text: "A test paragraph." }] }];
const rejects = async (promise: Promise<unknown>, code: string, pathPart?: string) =>
  assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError, String(error));
    assert.equal(error.code, code, error.message);
    // Zod names an unknown key in the message, a bad value in the path.
    if (pathPart) assert.ok(error.details?.some((d) => d.path.includes(pathPart) || d.message.includes(`"${pathPart}"`)), JSON.stringify(error.details));
    return true;
  });

function setup() {
  const data = sharedData();
  const h = harness("org-a", data);
  const image = addMedia(data, "org-a", "ready", { alt: "A test image" });
  return { data, h, image };
}
const newsPost = (o: Record<string, unknown> = {}) => ({ type: "news", title: "Test news item", body, ...o });
const testEvent = (imageId: string, o: Record<string, unknown> = {}) => ({
  title: "Test gathering",
  summary: "A test summary.",
  about: body,
  date: "2026-11-14",
  startTime: "6:30 PM",
  endTime: "9:00 PM",
  timezone: "Europe/London",
  venue: "Test hall",
  address: "1 Test Street",
  imageId,
  ...o,
});

test("slugs: normalised from the title or the given address", () => {
  assert.equal(slugify("  Café Ñandú — Été 2026! "), "cafe-nandu-ete-2026");
  assert.equal(slugify("../../etc/passwd"), "etc-passwd");
  assert.equal(slugify("漢字"), "");
});

test("create: draft by default, server-owned identity and timestamps, audited by field names", async () => {
  const { h, image } = setup();
  const view = await h.posts.create(editor, newsPost({ imageId: image.id, excerpt: "An excerpt.", slug: "Test News Item!" }), FACTS);
  assert.equal(view.record.status, "draft");
  assert.equal(view.record.slug, "test-news-item");
  assert.equal(view.record.orgId, "org-a");
  assert.match(view.record.id, /^[0-9a-f-]{36}$/);
  assert.equal(view.record.publishedAt, undefined);
  assert.equal(view.revision, 1);
  const entry = h.audit.find((e) => e.action === "post.created")!;
  assert.deepEqual(entry.metadata, { status: "draft", fields: ["body", "excerpt", "imageId", "slug", "title", "type"] });
  assert.ok(!JSON.stringify(entry).includes("A test paragraph"), "the body's wording is never audited");
});

test("create: the contract, the module and the media library all have a say", async () => {
  const { data, h, image } = setup();
  const pending = addMedia(data, "org-a", "pending");
  const deleted = addMedia(data, "org-a", "deleted");
  const foreign = addMedia(data, "org-b", "ready");
  for (const [input, path] of [
    [newsPost({ body: [{ type: "html", html: "<script>alert(1)</script>" }] }), "body"],
    [newsPost({ body: [] }), "body"],
    [newsPost({ body: [{ type: "paragraph", children: [{ type: "link", href: "javascript:alert(1)", children: [{ type: "text", text: "x" }] }] }] }), "body"],
    [newsPost({ type: "story" }), "type"],
    [newsPost({ category: "reflections" }), "category"],
    [newsPost({ orgId: "org-b" }), "orgId"],
    [newsPost({ status: "approved" }), "status"],
    [newsPost({ imageId: pending.id }), "imageId"],
    [newsPost({ imageId: deleted.id }), "imageId"],
    [newsPost({ imageId: foreign.id }), "imageId"],
    [newsPost({ title: undefined }), "title"],
    [newsPost({ title: "!!!" }), "slug"],
    [newsPost({ seo: { title: "x".repeat(71) } }), "seo"],
  ] as const)
    await rejects(h.posts.create(owner, input, FACTS), "VALIDATION_ERROR", path);
  await h.posts.create(owner, newsPost({ imageId: image.id }), FACTS);
  await rejects(h.posts.create(owner, newsPost({ type: "blog" }), FACTS), "VALIDATION_ERROR", "slug");
  assert.equal(data.posts.length, 1, "nothing invalid was stored");
});

test("events: required timezone, real zones only, end after start, https registration", async () => {
  const { h, image } = setup();
  const ok = await h.events.create(owner, testEvent(image.id, { registrationUrl: "https://tickets.example.org/test" }), FACTS);
  assert.equal(ok.record.timezone, "Europe/London");
  assert.equal(ok.record.startTime, "6:30 PM", "stored as written — never converted");
  assert.equal(ok.record.programId, null);
  assert.deepEqual(ok.record.schedule, []);
  for (const [overrides, path] of [
    [{ timezone: undefined }, "timezone"],
    [{ timezone: "Mars/Olympus_Mons" }, "timezone"],
    [{ timezone: "europe london" }, "timezone"],
    [{ endTime: "6:00 PM" }, "endTime"],
    [{ endTime: "6:30 PM" }, "endTime"],
    [{ startTime: "18:30" }, "startTime"],
    [{ date: "2026-02-30" }, "date"],
    [{ date: undefined }, "date"],
    [{ registrationUrl: "http://tickets.example.org" }, "registrationUrl"],
    [{ imageId: undefined }, "imageId"],
    // Milestone 4: `schedule` is editable now (test/posts-events-fields.test.ts); a malformed one is still refused.
    [{ schedule: [{ time: "18:30", item: "Welcome" }] }, "schedule"],
  ] as const)
    await rejects(h.events.create(owner, testEvent(image.id, { ...overrides, slug: `e-${Math.random().toString(36).slice(2, 8)}` }), FACTS), "VALIDATION_ERROR", path);
});

test("update: revision-checked, nulls clear optional fields, audit names fields", async () => {
  const { h, image } = setup();
  const created = await h.posts.create(owner, newsPost({ excerpt: "An excerpt.", imageId: image.id }), FACTS);
  const saved = await h.posts.update(editor, created.record.id, { revision: 1, changes: { title: "A changed title", excerpt: null } }, FACTS);
  assert.equal(saved.revision, 2);
  assert.equal(saved.record.excerpt, undefined);
  assert.equal(saved.record.slug, "test-news-item", "the address does not follow the title once set");
  await rejects(h.posts.update(owner, created.record.id, { revision: 1, changes: { title: "Stale" } }, FACTS), "CONFLICT");
  await rejects(h.posts.update(owner, created.record.id, { revision: 2, changes: { orgId: "org-b" } }, FACTS), "VALIDATION_ERROR");
  await rejects(h.posts.update(owner, created.record.id, { revision: 2, changes: { createdAt: "2020-01-01T00:00:00Z" } }, FACTS), "VALIDATION_ERROR");
  const entry = h.audit.find((e) => e.action === "post.updated")!;
  assert.deepEqual(entry.metadata, { fields: ["excerpt", "title"], status: "draft" });
  assert.deepEqual(await h.posts.update(owner, created.record.id, { revision: 2, changes: { title: "A changed title" } }, FACTS).then((v) => v.revision), 2, "no change, no write");
});

test("published addresses: changing one needs confirmation, and the old one is kept", async () => {
  const { h, image } = setup();
  const approved = await createApproved(h.posts, owner, newsPost({ imageId: image.id }), FACTS);
  assert.equal(approved.record.publishedAt, undefined, "approved is not yet public");
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  await h.publishing.publish(owner, FACTS);
  const p = await h.posts.get(owner, approved.record.id);
  assert.ok(p.record.publishedAt);
  await rejects(h.posts.update(owner, p.record.id, { revision: p.revision, changes: { slug: "new-address" } }, FACTS), "CONFLICT", "slug");
  const moved = await h.posts.update(owner, p.record.id, { revision: p.revision, changes: { slug: "new-address" }, confirmSlugChange: true }, FACTS);
  assert.equal(moved.record.slug, "new-address");
  assert.deepEqual(moved.previousSlugs, ["test-news-item"]);
  const draft = await h.posts.create(owner, newsPost({ title: "Never published" }), FACTS);
  const renamed = await h.posts.update(owner, draft.record.id, { revision: 1, changes: { slug: "free-to-change" } }, FACTS);
  assert.deepEqual(renamed.previousSlugs, [], "a draft's address was never public");
});

test("archive: DELETE archives (idempotently); archived can be reopened as a draft; nothing is destroyed", async () => {
  const { data, h, image } = setup();
  const p = await createApproved(h.posts, owner, newsPost({ imageId: image.id }), FACTS);
  const archived = await h.posts.archive(editor, p.record.id, FACTS);
  assert.equal(archived.record.status, "archived");
  assert.equal((await h.posts.archive(editor, p.record.id, FACTS)).revision, archived.revision);
  assert.ok(h.audit.some((e) => e.action === "post.archived"));
  const reopened = await h.posts.update(owner, p.record.id, { revision: archived.revision, changes: { status: "draft" } }, FACTS);
  assert.equal(reopened.record.status, "draft");
  assert.equal(data.posts.length, 1);
});

test("list: paginated, searchable, filterable by status and type", async () => {
  const { h, image } = setup();
  for (const [title, type, status] of [["Alpha", "news", "draft"], ["Beta", "blog", "approved"], ["Gamma (2)", "news", "archived"]] as const) {
    const v = await h.posts.create(owner, { type, title, body, ...(status === "approved" && { imageId: image.id }) }, FACTS);
    if (status === "approved") await approve(h.posts, owner, v.record.id, FACTS);
    if (status === "archived") await h.posts.archive(owner, v.record.id, FACTS);
    h.time.advance(1000);
  }
  const all = await h.posts.list(owner, { pageSize: "2" });
  assert.deepEqual(all.items.map((v) => v.record.title), ["Gamma (2)", "Beta"]);
  assert.deepEqual(all.pagination, { page: 1, pageSize: 2, total: 3, totalPages: 2 });
  assert.deepEqual((await h.posts.list(owner, { search: "(2)" })).items.map((v) => v.record.title), ["Gamma (2)"]);
  assert.deepEqual((await h.posts.list(owner, { type: "blog" })).items.map((v) => v.record.title), ["Beta"]);
  assert.deepEqual((await h.posts.list(owner, { status: "draft", sort: "title" })).items.map((v) => v.record.title), ["Alpha"]);
  assert.deepEqual((await h.posts.list(owner, { status: "approved" })).items.map((v) => v.record.title), ["Beta"]);
  await rejects(h.posts.list(owner, { type: "story" }), "VALIDATION_ERROR");
  await rejects(h.posts.list(owner, { orgId: "org-b" }), "VALIDATION_ERROR");
});

test("organization isolation: another organization's records are not found, and contexts are refused", async () => {
  const data = sharedData();
  const a = harness("org-a", data);
  const b = harness("org-b", data);
  addMedia(data, "org-a", "ready");
  const mine = await a.posts.create(owner, newsPost(), FACTS);
  const bOwner = member("org-b", "OWNER");
  await rejects(b.posts.get(bOwner, mine.record.id), "NOT_FOUND");
  await rejects(b.posts.update(bOwner, mine.record.id, { revision: 1, changes: { title: "Hijack" } }, FACTS), "NOT_FOUND");
  await rejects(b.posts.archive(bOwner, mine.record.id, FACTS), "NOT_FOUND");
  assert.equal((await b.posts.list(bOwner, {})).items.length, 0);
  await rejects(a.posts.get(bOwner, mine.record.id), "FORBIDDEN");
  // The same address may exist in another organization.
  await b.posts.create(bOwner, newsPost(), FACTS);
});

test("snapshot: only PUBLISHED records of managed collections, public fields only", async () => {
  const { h, image } = setup();
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  await h.publishing.publish(owner, FACTS);
  assert.deepEqual((await h.publishing.publicSnapshot())!.content, {}, "no CMS records yet: the website keeps its own collections");

  const published = await createApproved(h.posts, owner, newsPost({ imageId: image.id }), FACTS);
  await h.posts.create(owner, newsPost({ title: "Draft only", imageId: image.id }), FACTS);
  await h.posts.act(owner, (await h.posts.create(owner, newsPost({ title: "Submitted only" }), FACTS)).record.id, "submit", { revision: 1 }, FACTS);
  const archived = await createApproved(h.posts, owner, newsPost({ title: "Archived one" }), FACTS);
  await h.posts.archive(owner, archived.record.id, FACTS);
  await h.events.create(owner, testEvent(image.id, { title: "Draft gathering" }), FACTS);
  const status = await h.publishing.status(owner);
  /* Milestone 1: a draft-only collection is not on the website — events stay the website's own. */
  assert.deepEqual(status.changedSections, ["news"]);

  const result = await h.publishing.publish(owner, FACTS);
  const snapshot = (await h.publishing.publicSnapshot())!;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.deepEqual(snapshot.content.news!.map((p) => p.title), ["Test news item"]);
  assert.equal(snapshot.content.blogs, undefined, "no blog records exist: blogs stay the website's own");
  assert.equal(snapshot.content.events, undefined, "only a draft event: events stay the website's own (Milestone 1)");
  assert.deepEqual(Object.keys(snapshot.media), [image.id]);
  const text = JSON.stringify(snapshot);
  for (const leak of ["Draft only", "Submitted only", "Archived one", "Draft gathering", "createdBy", "updatedBy", "revision", "slugHistory", "Test Member", "objectKey"])
    assert.ok(!text.includes(leak), `leaked: ${leak}`);
  const contentText = JSON.stringify(snapshot.content);
  assert.ok(!contentText.includes('"createdAt"') && !contentText.includes('"updatedAt"'), "content records carry no editing timestamps");
  assert.ok(snapshot.content.news![0]!.publishedAt);
  assert.equal(result.version, 2);
  assert.deepEqual(h.audit.filter((e) => e.action === "publish.completed").at(-1)!.metadata.counts, { news: 1 });
  assert.equal(published.record.status, "approved");
  const after = await h.posts.get(owner, published.record.id);
  assert.deepEqual([after.record.status, after.live, after.revision], ["published", true, published.revision], "the publish marks it, without a new revision");
});

test("snapshot: an image that stopped being ready blocks the WHOLE publish; the live version stays", async () => {
  const { data, h, image } = setup();
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  await createApproved(h.events, owner, testEvent(image.id), FACTS);
  await h.publishing.publish(owner, FACTS);
  await createApproved(h.posts, owner, newsPost({ imageId: image.id }), FACTS);
  data.media.find((m) => m.id === image.id)!.status = "deleted";
  await rejects(h.publishing.publish(owner, FACTS), "VALIDATION_ERROR", "media");
  const live = (await h.publishing.publicSnapshot())!;
  assert.equal(live.version, 1);
  assert.equal(live.content.news, undefined);
  assert.equal(live.content.events!.length, 1);
});

test("editors write content but cannot publish (the route needs publish:execute)", async () => {
  const { h } = setup();
  await h.posts.create(editor, newsPost(), FACTS);
  assert.equal((await h.publishing.status(editor)).canPublish, false);
});

test("approval is an owner's: editors submit posts and events, never approve or publish them", async () => {
  const { h, image } = setup();
  await rejects(h.posts.create(editor, newsPost({ status: "published" }), FACTS), "VALIDATION_ERROR", "status");
  await rejects(h.events.create(editor, testEvent(image.id, { status: "approved" }), FACTS), "VALIDATION_ERROR", "status");
  const post = await h.posts.create(editor, newsPost(), FACTS);
  const event = await h.events.create(editor, testEvent(image.id), FACTS);
  await rejects(h.posts.update(editor, post.record.id, { revision: 1, changes: { status: "published" } }, FACTS), "VALIDATION_ERROR", "status");
  await rejects(h.events.update(editor, event.record.id, { revision: 1, changes: { status: "submitted" } }, FACTS), "VALIDATION_ERROR", "status");
  await h.posts.act(editor, post.record.id, "submit", { revision: 1 }, FACTS);
  await rejects(h.posts.act(editor, post.record.id, "approve", { revision: 2 }, FACTS), "FORBIDDEN");
  await rejects(h.posts.act(editor, post.record.id, "reject", { revision: 2 }, FACTS), "FORBIDDEN");
  assert.equal((await approve(h.posts, owner, post.record.id, FACTS)).record.status, "approved");
  assert.equal((await approve(h.events, owner, event.record.id, FACTS)).record.status, "approved");
  assert.equal((await h.posts.update(editor, post.record.id, { revision: 3, changes: { excerpt: "Edited." } }, FACTS)).record.status, "draft", "an edit returns it to draft");
  // An archived record reopened by an editor comes back as a draft, never published.
  await h.events.archive(editor, event.record.id, FACTS);
  await rejects(h.events.update(editor, event.record.id, { revision: 4, changes: { status: "published" } }, FACTS), "VALIDATION_ERROR", "status");
  assert.equal((await h.events.update(editor, event.record.id, { revision: 4, changes: { status: "draft" } }, FACTS)).record.status, "draft");
  assert.equal(h.audit.filter((e) => e.action.endsWith(".created")).length, 2, "a refused publish writes nothing");
});
