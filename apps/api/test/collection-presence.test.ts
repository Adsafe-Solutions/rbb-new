import { test } from "node:test";
import assert from "node:assert/strict";
import { PublishedSnapshot } from "@rbb/content-schema";
import { settingsRecord } from "./fixtures/settings.ts";
import { FACTS, member } from "./media/memory.ts";
import { addMedia, harness, sharedData } from "./settings/memory.ts";
import { createApproved } from "./support/workflow.ts";

/* Milestone 1 — when a collection takes over the website's own list.
   News, blogs, events, appeals and the team appear in the snapshot only
   once the collection has been on the website: a record is publishable
   now, or one was ever published (archived since included), or the live
   snapshot holds records of it. A collection of drafts, submissions or
   records archived before they were ever published never replaces the
   website's list with an empty one. An intentionally emptied collection
   (published, then every record archived) stays empty. Test records only. */

const owner = member("org-a", "OWNER");
const body = [{ type: "paragraph", children: [{ type: "text", text: "A test paragraph." }] }];
const rich = body;

function setup() {
  const data = sharedData();
  const h = harness("org-a", data);
  const image = addMedia(data, "org-a", "ready", { alt: "A test image" });
  return { h, image };
}
const site = async () => {
  const s = setup();
  await s.h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  return s;
};

/* One record of each kind, by the collection's own service. */
type Kind = "news" | "blogs" | "events" | "appeals" | "team";
const KINDS: Kind[] = ["news", "blogs", "events", "appeals", "team"];
const input = (kind: Kind, imageId: string, title: string): Record<string, unknown> =>
  ({
    news: { type: "news", title, body },
    blogs: { type: "blog", title, body },
    events: { title, summary: "A test summary.", about: body, date: "2026-11-14", startTime: "6:30 PM", endTime: "9:00 PM", timezone: "Europe/London", venue: "Test hall", address: "1 Test Street", imageId },
    appeals: { kind: "emergency", title, summary: "A test summary.", imageId, sections: [{ id: "why", type: "richText", enabled: true, version: 1, data: { heading: "Why it matters", content: rich } }] },
    team: { name: title, role: "A test area", group: "team", shortBio: "A test line." },
  })[kind];
const service = (h: ReturnType<typeof harness>, kind: Kind) => ({ news: h.posts, blogs: h.posts, events: h.events, appeals: h.appeals, team: h.team })[kind] as unknown as {
  create(a: unknown, i: unknown, f: unknown): Promise<{ record: { id: string }; revision: number }>;
  archive(a: unknown, id: string, f: unknown): Promise<unknown>;
  act(a: unknown, id: string, action: string, i: unknown, f: unknown): Promise<unknown>;
  update(a: unknown, id: string, i: unknown, f: unknown): Promise<unknown>;
};
const titleOf = (r: { title?: string; name?: string }) => r.title ?? r.name;
const snapshotAfterPublish = async (h: ReturnType<typeof harness>) => {
  await h.publishing.publish(owner, FACTS);
  const snapshot = (await h.publishing.publicSnapshot())!;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  return snapshot.content as Record<string, { title?: string; name?: string }[] | undefined>;
};
/* What the NEXT publish would hold (read only; a publish with nothing new is refused). */
const nextContent = async (h: ReturnType<typeof harness>) => {
  const preview = await h.publishing.preview(owner);
  assert.deepEqual(preview.problems, []);
  return preview.snapshot!.content as Record<string, { title?: string; name?: string }[] | undefined>;
};

test("no records: no collection key — the website keeps its own lists", async () => {
  const { h } = await site();
  const content = await snapshotAfterPublish(h);
  for (const kind of KINDS) assert.equal(content[kind], undefined, kind);
});

test("draft-only and submitted-only: never on the website — the website keeps its own lists", async () => {
  for (const kind of KINDS) {
    const { h, image } = await site();
    await service(h, kind).create(owner, input(kind, image.id, "Draft only"), FACTS);
    const submitted = await service(h, kind).create(owner, input(kind, image.id, "Submitted only"), FACTS);
    await service(h, kind).act(owner, submitted.record.id, "submit", { revision: submitted.revision }, FACTS);
    const content = await snapshotAfterPublish(h);
    assert.equal(content[kind], undefined, `${kind}: drafts and submissions replace nothing`);
    assert.deepEqual((await h.publishing.status(owner)).changedSections.filter((s) => s === kind), [], `${kind}: nothing to publish`);
  }
});

test("archived-only, never published: never on the website", async () => {
  for (const kind of KINDS) {
    const { h, image } = await site();
    const approved = await createApproved(service(h, kind) as never, owner, input(kind, image.id, "Approved then archived"), FACTS);
    await service(h, kind).archive(owner, (approved as { record: { id: string } }).record.id, FACTS);
    const draft = await service(h, kind).create(owner, input(kind, image.id, "Draft then archived"), FACTS);
    await service(h, kind).archive(owner, draft.record.id, FACTS);
    const content = await snapshotAfterPublish(h);
    assert.equal(content[kind], undefined, `${kind}: archived before ever being published replaces nothing`);
  }
});

test("mixed statuses: only the published records, never the drafts, submissions or archived ones", async () => {
  for (const kind of KINDS) {
    const { h, image } = await site();
    await createApproved(service(h, kind) as never, owner, input(kind, image.id, "Ready one"), FACTS);
    await service(h, kind).create(owner, input(kind, image.id, "Draft one"), FACTS);
    const archived = await createApproved(service(h, kind) as never, owner, input(kind, image.id, "Archived one"), FACTS);
    await service(h, kind).archive(owner, (archived as { record: { id: string } }).record.id, FACTS);
    const content = await snapshotAfterPublish(h);
    assert.deepEqual(content[kind]!.map(titleOf), ["Ready one"], kind);
  }
});

test("an intentionally emptied collection stays empty: published, then every record archived", async () => {
  for (const kind of KINDS) {
    const { h, image } = await site();
    const only = await createApproved(service(h, kind) as never, owner, input(kind, image.id, "Once live"), FACTS);
    assert.deepEqual((await snapshotAfterPublish(h))[kind]!.map(titleOf), ["Once live"], `${kind}: published`);
    await service(h, kind).archive(owner, (only as { record: { id: string } }).record.id, FACTS);
    assert.deepEqual((await snapshotAfterPublish(h))[kind], [], `${kind}: the CMS is the source — an empty list, not the website's samples`);
    /* …and it stays so after that: the next publish would hold it empty too. */
    assert.deepEqual((await nextContent(h))[kind], [], `${kind}: still empty`);
  }
});

test("a published record edited back to draft keeps its live version on the website", async () => {
  const { h, image } = await site();
  const live = await createApproved(h.posts as never, owner, input("news", image.id, "Live version"), FACTS);
  await snapshotAfterPublish(h);
  const view = await h.posts.get(owner, (live as { record: { id: string } }).record.id);
  await h.posts.update(owner, view.record.id, { revision: view.revision, changes: { title: "Edited, not yet approved" } }, FACTS);
  assert.deepEqual((await nextContent(h)).news!.map(titleOf), ["Live version"]);
});

test("one type does not bring in another: a published news item leaves blogs the website's own", async () => {
  const { h, image } = await site();
  await createApproved(h.posts as never, owner, input("news", image.id, "Published news"), FACTS);
  await h.posts.create(owner, input("blogs", image.id, "Draft blog"), FACTS);
  const content = await snapshotAfterPublish(h);
  assert.deepEqual(content.news!.map(titleOf), ["Published news"]);
  assert.equal(content.blogs, undefined);
});
