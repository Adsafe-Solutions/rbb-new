import { test } from "node:test";
import assert from "node:assert/strict";
import { PublishedSnapshot } from "@rbb/content-schema";
import { ApiError } from "../src/errors.ts";
import { settingsRecord } from "./fixtures/settings.ts";
import { FACTS, member } from "./media/memory.ts";
import { addMedia, harness, sharedData } from "./settings/memory.ts";
import { approve, createApproved } from "./support/workflow.ts";

/* Milestone 5 — a story's quotes and impact: validated, stored, kept,
   replaced, cleared and published, in memory. Test records only. */

const owner = member("org-a", "OWNER");
const body = [{ type: "paragraph", children: [{ type: "text", text: "A test paragraph." }] }];
const story = (o: Record<string, unknown> = {}) => ({ title: "A test story", category: "field", body, ...o });
const QUOTES = [{ text: "We read together now.", attribution: "A parent at the test club" }, { text: "Another test line.", attribution: "A test volunteer" }];
const IMPACT = ["Children borrow books to read at home.", "Parents stay to listen."];
const rejects = async (promise: Promise<unknown>, path: string) =>
  assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError, String(error));
    assert.equal(error.code, "VALIDATION_ERROR", error.message);
    assert.ok(error.details?.some((d) => d.path === path || d.path.startsWith(`${path}.`) || d.message.includes(`"${path.split(".").pop()}"`)), `${path}: ${JSON.stringify(error.details)}`);
    return true;
  });
async function site() {
  const data = sharedData();
  const h = harness("org-a", data);
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  return { data, h };
}

test("stored as written; kept when an update leaves them out; replaced whole; cleared with null", async () => {
  const { h } = await site();
  const created = await h.stories.create(owner, story({ quotes: QUOTES, impact: IMPACT }), FACTS);
  assert.deepEqual([created.record.quotes, created.record.impact], [QUOTES, IMPACT]);
  const kept = await h.stories.update(owner, created.record.id, { revision: created.revision, changes: { title: "An edited test story" } }, FACTS);
  assert.deepEqual([kept.record.quotes, kept.record.impact], [QUOTES, IMPACT], "kept");
  const replaced = await h.stories.update(owner, created.record.id, { revision: kept.revision, changes: { quotes: [QUOTES[1]], impact: [IMPACT[1], IMPACT[0]] } }, FACTS);
  assert.deepEqual([replaced.record.quotes, replaced.record.impact], [[QUOTES[1]], [IMPACT[1], IMPACT[0]]], "the list as sent, in its order");
  const cleared = await h.stories.update(owner, created.record.id, { revision: replaced.revision, changes: { quotes: null, impact: null } }, FACTS);
  assert.ok(!("quotes" in cleared.record) && !("impact" in cleared.record), "cleared: absent, as a story without them always was");
});

test("refused by name: empty lists, too many, repeats, blanks, HTML, a figure object, and anything private riding along", async () => {
  const { h } = await site();
  for (const [changes, path] of [
    [{ quotes: [] }, "body.quotes"],
    [{ quotes: Array.from({ length: 7 }, (_, i) => ({ text: `Test quote ${i}`, attribution: "A tester" })) }, "body.quotes"],
    [{ quotes: [{ text: "Same words.", attribution: "A" }, { text: "Same words.", attribution: "B" }] }, "body.quotes.1"],
    [{ quotes: [{ text: "  ", attribution: "A tester" }] }, "body.quotes.0.text"],
    [{ quotes: [{ text: "<em>Words</em>", attribution: "A tester" }] }, "body.quotes.0.text"],
    [{ quotes: [{ text: "Words.", attribution: "A tester", consent: "obtained" }] }, "body.quotes.0"],
    [{ quotes: [{ text: "Words." }] }, "body.quotes.0.attribution"],
    [{ quotes: [{ text: "Words.", attribution: "" }] }, "body.quotes.0.attribution"],
    [{ impact: [] }, "body.impact"],
    [{ impact: Array.from({ length: 13 }, (_, i) => `Test line ${i}`) }, "body.impact"],
    [{ impact: ["A test line.", "A test line."] }, "body.impact.1"],
    [{ impact: [{ value: "100", label: "People" }] }, "body.impact.0"],
  ] as const)
    await rejects(h.stories.create(owner, story(changes), FACTS), path);
});

test("news and blog posts have neither: /posts refuses them as unknown fields", async () => {
  const { h } = await site();
  for (const type of ["news", "blog"]) {
    await rejects(h.posts.create(owner, { type, title: "A test post", body, quotes: QUOTES }, FACTS), "quotes");
    await rejects(h.posts.create(owner, { type, title: "A test post", body, impact: IMPACT }, FACTS), "impact");
  }
});

test("a story saved without them — every story before Milestone 5 — stays valid, editable and approvable, the fields absent", async () => {
  const { h } = await site();
  const created = await h.stories.create(owner, story(), FACTS);
  assert.ok(!("quotes" in created.record) && !("impact" in created.record));
  const edited = await h.stories.update(owner, created.record.id, { revision: created.revision, changes: { excerpt: "A test excerpt." } }, FACTS);
  assert.ok(!("quotes" in edited.record) && !("impact" in edited.record), "an unrelated edit adds nothing");
  const approved = await approve(h.stories, owner, created.record.id, FACTS);
  assert.equal(approved.record!.status, "approved");
});

test("published: quotes and impact reach the snapshot as written; the image's credit, licence and consent stay private; drafts stay out", async () => {
  const { data, h } = await site();
  const image = addMedia(data, "org-a", "ready", { alt: "A test photograph", caption: "A test caption", credit: "Test Photographer", license: "test-licence", consent: "obtained" });
  await createApproved(h.stories, owner, story({ slug: "with-fields", imageId: image.id, quotes: QUOTES, impact: IMPACT }), FACTS);
  await createApproved(h.stories, owner, story({ slug: "without-fields", title: "A plain test story" }), FACTS);
  await h.stories.create(owner, story({ slug: "draft-with-fields", title: "A draft test story", quotes: [{ text: "Draft words.", attribution: "A tester" }], impact: ["A draft line."] }), FACTS);
  await h.publishing.publish(owner, FACTS);
  const snapshot = (await h.publishing.publicSnapshot())!;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  const bySlug = new Map(snapshot.content.stories!.map((s) => [s.slug, s]));
  assert.deepEqual([...bySlug.keys()].sort(), ["with-fields", "without-fields"], "the draft stays out");
  assert.deepEqual([bySlug.get("with-fields")!.quotes, bySlug.get("with-fields")!.impact], [QUOTES, IMPACT]);
  assert.ok(!("quotes" in bySlug.get("without-fields")!) && !("impact" in bySlug.get("without-fields")!));
  const published = JSON.stringify(snapshot);
  for (const secret of ["Test Photographer", "test-licence", "\"consent\"", "\"credit\"", "\"license\""]) assert.ok(!published.includes(secret), `${secret} is never published`);
  assert.equal(snapshot.media[image.id]!.caption, "A test caption", "the caption is public, as Milestone 2 defined");
});
