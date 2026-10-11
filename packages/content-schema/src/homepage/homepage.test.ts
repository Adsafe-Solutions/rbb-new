import { test } from "node:test";
import assert from "node:assert/strict";
import { HOMEPAGE_BLOCKS, HOMEPAGE_BLOCK_TYPES, HOMEPAGE_SECTION_SCHEMAS, Homepage, PublishedSnapshot, homepageMediaIds, homepageReferences } from "../index.ts";
import * as fx from "../test/fixtures.ts";

/* The homepage contract (M8): ordered blocks in the shared envelope, the
   registry, and the homepage inside a published snapshot. Test data only. */

const block = (id: string, type: string, data: unknown, enabled = true) => ({ id, type, enabled, version: 1, data });
const hero = () =>
  block("hero", "hero", {
    slides: [{ id: "one", headline: ["A line."], cta: { label: "Go", href: "/work" }, imageId: "img", insetId: "img" }],
    secondaryCta: { label: "More", href: "/get-involved" },
    intervalMs: 7000,
  });
const page = (sections: unknown[], o: Record<string, unknown> = {}) => ({ id: "homepage", orgId: fx.settings().orgId, schemaVersion: 1, status: "published", sections, ...o });
const issues = (schema: { safeParse(v: unknown): { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, value: unknown) => {
  const r = schema.safeParse(value);
  return r.success ? [] : r.error!.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};

test("registry: one schema per block type, one entry per type", () => {
  assert.deepEqual(Object.keys(HOMEPAGE_SECTION_SCHEMAS).sort(), [...HOMEPAGE_BLOCK_TYPES].sort());
  assert.deepEqual(HOMEPAGE_BLOCKS.map((b) => b.type).sort(), [...HOMEPAGE_BLOCK_TYPES].sort());
  for (const b of HOMEPAGE_BLOCKS) assert.ok(!/[A-Z]|List$/.test(b.label.split(" ")[0]!.slice(1)) && b.label.length > 3, `an editor-facing name for ${b.type}`);
});

test("homepage: ordered blocks in the shared envelope; disabled blocks stay in the record", () => {
  const ok = page([hero(), block("who", "imageText", { heading: "Who we are", body: ["A paragraph."], imageId: "img" }), block("faq", "faq", { heading: "Questions", items: [{ question: "Q?", answer: "A." }] }, false)]);
  assert.deepEqual(issues(Homepage, ok), []);
  assert.deepEqual(homepageMediaIds(Homepage.parse(ok)), ["img"]);
});

test("homepage: unknown, malformed and misplaced blocks are refused", () => {
  const bad: [string, unknown[]][] = [
    ["unknown block", [block("x", "carousel", { heading: "H" })]],
    ["html block", [block("x", "html", { html: "<script>alert(1)</script>" })]],
    ["html inside a block", [block("x", "imageText", { heading: "H", body: ["p"], imageId: "img", html: "<b>x</b>" })]],
    ["unsafe link", [block("x", "cta", { heading: "H", primary: { label: "Go", href: "javascript:alert(1)" } })]],
    ["hero not first", [block("who", "imageText", { heading: "H", body: ["p"], imageId: "img" }), hero()]],
    ["two heroes", [hero(), { ...hero(), id: "hero-2" }]],
    ["duplicate ids", [block("a", "faq", { heading: "Q", items: [{ question: "Q?", answer: "A." }] }), block("a", "faq", { heading: "Q", items: [{ question: "Q?", answer: "A." }] })]],
    ["two program blocks", [block("p1", "programs", { heading: "H" }), block("p2", "programs", { heading: "H" })]],
    ["post chosen twice", [block("p", "postList", { heading: "News", postIds: ["a", "a"] })]],
    ["no posts chosen", [block("p", "postList", { heading: "News", postIds: [] })]],
    ["wrong version", [{ ...block("p", "programs", { heading: "H" }), version: 2 }]],
  ];
  for (const [name, sections] of bad) assert.ok(issues(Homepage, page(sections)).length > 0, name);
  assert.ok(issues(Homepage, { ...page([]), sections: undefined }).length > 0, "sections are required");
  assert.ok(issues(Homepage, { ...page([]), layout: "custom" }).length > 0, "unknown fields are refused");
});

test("references: posts, events and appeals by id, never copies", () => {
  const sections = Homepage.parse(
    page([
      block("news", "postList", { heading: "News", postIds: ["p1", "p2"] }),
      block("events", "eventList", { heading: "Events", eventIds: ["e1"] }),
      block("appeals", "appealList", { heading: "Appeals", appealIds: ["a1"] }),
      block("all-appeals", "appealList", { heading: "Every appeal", kind: "emergency" }),
    ])
  ).sections;
  assert.deepEqual(homepageReferences(sections), { posts: ["p1", "p2"], events: ["e1"], appeals: ["a1"] });
  assert.ok(issues(Homepage, page([block("p", "postList", { heading: "News", postIds: ["p1"], posts: [{ title: "copy" }] })])).length > 0, "a copy of a record is refused");
});

test("snapshot: only the published homepage, enabled blocks, resolvable references, its media", () => {
  const media = { img: { id: "img", url: "https://media.example.org/rbb/media/u/a.png", mimeType: "image/png", alt: "" }, "logo-mark": { id: "logo-mark", url: "https://media.example.org/rbb/media/u/logo.png", mimeType: "image/png", alt: "" } };
  const post = { ...fx.post(), id: "p1", type: "news", status: "published", imageId: "img" };
  const snapshot = (homepage: unknown, content: Record<string, unknown> = {}) => ({
    version: 2,
    schemaVersion: 1,
    generatedAt: "2026-10-07T10:00:00.000Z",
    organization: { id: fx.settings().orgId },
    settings: { ...fx.settings(), status: "published", branding: { logoId: "logo-mark" } },
    media,
    content: { homepage, ...content },
  });
  const good = page([hero(), block("news", "postList", { heading: "News", postIds: ["p1"] })]);
  assert.deepEqual(issues(PublishedSnapshot, snapshot(good, { news: [post] })), []);
  const bad: [string, unknown][] = [
    ["draft homepage", snapshot({ ...good, status: "draft" }, { news: [post] })],
    ["other organization", snapshot({ ...good, orgId: "other" }, { news: [post] })],
    ["disabled block published", snapshot(page([{ ...hero(), enabled: false }]))],
    ["release marker", snapshot(page([block("t", "timeline", { heading: "H", items: [{ id: "i", date: "2026-01-01", programId: "education", title: "T", summary: "S", youtubeId: "QP5Fs3AYuWE", videoTitle: "V", posterId: "img", releaseMarker: "sample" }] })]))],
    ["reference to an unpublished post", snapshot(good)],
    ["reference to a draft appeal", snapshot(page([block("a", "appealList", { heading: "A", appealIds: ["a1"] })]))],
    ["image not in the snapshot", snapshot(page([block("w", "imageText", { heading: "H", body: ["p"], imageId: "missing" })]))],
  ];
  for (const [name, value] of bad) assert.ok(issues(PublishedSnapshot, value).length > 0, name);
});
