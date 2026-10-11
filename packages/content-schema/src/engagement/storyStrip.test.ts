import { test } from "node:test";
import assert from "node:assert/strict";
import { PublishedSnapshot, STORY_STRIP_LIMIT, StoryStrip, storyStripApprovalProblems } from "../index.ts";
import * as fx from "../test/fixtures.ts";

/* Highlights — the story strip (M23): which published appeals the circles
   show, in order. Test data only. */

const org = fx.settings().orgId;
const strip = (o: Record<string, unknown> = {}) => ({ id: "story-strip", orgId: org, schemaVersion: 1, status: "published", appealIds: ["appeal-b", "appeal-a"], ...o });
const { releaseMarker: _sample, ...appealBase } = fx.appeal();
const appeal = (id: string, o: Record<string, unknown> = {}) => ({ ...appealBase, id, slug: id, status: "published", ...o });
const IMAGE = fx.appeal().imageId;
const snapshot = (s: unknown, appeals = [appeal("appeal-a"), appeal("appeal-b")]) => ({
  version: 1, schemaVersion: 1, generatedAt: "2026-10-10T10:00:00.000Z", organization: { id: org }, settings: { ...fx.settings(), status: "published" },
  media: { [IMAGE]: { id: IMAGE, url: "https://media.rbb.test/a.jpg", mimeType: "image/jpeg", alt: "A photo" } },
  content: { appeals, storyStrip: s },
});
const issues = (schema: { safeParse(v: unknown): { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, value: unknown) => {
  const r = schema.safeParse(value);
  return r.success ? [] : r.error!.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};

test("story strip: up to the website's four appeals, by id, in order, each once; an empty draft is valid", () => {
  assert.equal(STORY_STRIP_LIMIT, 4);
  assert.deepEqual(issues(StoryStrip, strip()), []);
  assert.deepEqual(issues(StoryStrip, strip({ status: "draft", appealIds: [] })), []);
  for (const [name, value] of [
    ["five appeals", strip({ appealIds: ["a", "b", "c", "d", "e"] })],
    ["an appeal twice", strip({ appealIds: ["a", "a"] })],
    ["a URL", strip({ appealIds: ["https://x.test/a"] })],
    ["labels (the appeal's own)", strip({ labels: { a: "x" } })],
    ["a release marker", strip({ releaseMarker: "Sample" })],
    ["another id", strip({ id: "highlights" })],
  ] as const)
    assert.ok(issues(StoryStrip, value).length > 0, name);
  assert.deepEqual(storyStripApprovalProblems({ appealIds: [] }).map((p) => p.path), ["appealIds"]);
});

test("snapshot: the strip only while published, naming appeals published in the same snapshot", () => {
  assert.deepEqual(issues(PublishedSnapshot, snapshot(strip())), []);
  for (const [name, s, appeals] of [
    ["draft", strip({ status: "draft" }), undefined],
    ["approved", strip({ status: "approved" }), undefined],
    ["other org", strip({ orgId: "other" }), undefined],
    ["no appeal", strip({ appealIds: [] }), undefined],
    ["an appeal that is not published", strip({ appealIds: ["appeal-c"] }), undefined],
    ["no published appeals at all", strip(), []],
  ] as const)
    assert.ok(issues(PublishedSnapshot, snapshot(s, appeals as never)).length > 0, name);
});
