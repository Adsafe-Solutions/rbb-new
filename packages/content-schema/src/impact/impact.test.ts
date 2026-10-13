import { test } from "node:test";
import assert from "node:assert/strict";
import { IMPACT_BLOCKS, IMPACT_BLOCK_TYPES, IMPACT_CHAPTER_TYPES, IMPACT_SECTION_SCHEMAS, Impact, Metric, PublishedSnapshot } from "../index.ts";
import * as fx from "../test/fixtures.ts";

/* Metric and the Impact page (M11), and both in a published snapshot.
   Test data only — figures here are made up for the contract, never
   shown. */

const block = (id: string, type: string, data: unknown, enabled = true) => ({ id, type, enabled, version: 1, data });
const intro = () => block("intro", "intro", { kicker: "Our impact", title: "Our Impact", highlight: "Impact", body: "An opening line." });
const stats = (metricIds = ["a-figure"]) => block("at-a-glance", "stats", { heading: "At a glance.", metricIds, source: "A source line." });
const page = (sections: unknown[], o: Record<string, unknown> = {}) => ({ id: "impact", orgId: fx.settings().orgId, schemaVersion: 1, status: "published", sections, ...o });
const metric = (o: Record<string, unknown> = {}) => ({ id: "m1", orgId: fx.settings().orgId, schemaVersion: 1, status: "published", slug: "a-figure", value: "10+", label: "Things counted", verification: "pending-review", order: 0, ...o });
const issues = (schema: { safeParse(v: unknown): { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, value: unknown) => {
  const r = schema.safeParse(value);
  return r.success ? [] : r.error!.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};

test("impact registry: one schema per block type, one entry per type", () => {
  assert.deepEqual(Object.keys(IMPACT_SECTION_SCHEMAS).sort(), [...IMPACT_BLOCK_TYPES].sort());
  assert.deepEqual(IMPACT_BLOCKS.map((b) => b.type).sort(), [...IMPACT_BLOCK_TYPES].sort());
});

test("impact registry: Our Approach and Where We Work feed their own pages, not /impact's chapters", () => {
  assert.deepEqual(IMPACT_BLOCKS.filter((b) => b.page).map((b) => [b.type, b.page]), [["approach", "/impact/our-approach"], ["geography", "/impact/where-we-work"]]);
  assert.deepEqual([...IMPACT_CHAPTER_TYPES].sort(), ["cta", "intro", "measurement", "programImpact", "stats", "stories", "teasers", "trust"]);
});

test("approach (#5) and geography (#6): structure only — words and places are RBB's", () => {
  const approach = (data: unknown) => page([intro(), block("approach", "approach", data)]);
  const geography = (data: unknown) => page([intro(), block("where-we-work", "geography", data)]);
  assert.deepEqual(issues(Impact, approach({ intro: "How the work is done.", principles: ["One.", "Two."] })), []);
  assert.deepEqual(issues(Impact, approach({ principles: [] })), [], "nothing yet: the page shows its own 'to be provided' lines");
  assert.deepEqual(issues(Impact, geography({ regions: [], countries: [] })), [], "empty: no list, not indexed");
  /* Test data only — names from the list, not where RBB works. */
  assert.deepEqual(issues(Impact, geography({ summary: "S.", regions: [{ id: "region-a", name: "Region A", countries: ["Kenya", "Uganda"] }], countries: ["Peru"] })), []);
  const bad: [string, unknown][] = [
    ["approach: the mission restated", approach({ mission: "M.", principles: [] })],
    ["approach: a principle in HTML", approach({ principles: ["<b>x</b>"] })],
    ["approach: empty principle", approach({ principles: [" "] })],
    ["approach: twice", page([intro(), block("a", "approach", { principles: [] }), block("b", "approach", { principles: [] })])],
    ["geography: a region with no country", geography({ regions: [{ id: "r", name: "R", countries: [] }], countries: [] })],
    ["geography: a country twice", geography({ regions: [], countries: ["Kenya", "Kenya"] })],
    ["geography: a country not on the list", geography({ regions: [], countries: ["Atlantis"] })],
    ["geography: a name not as the list writes it", geography({ regions: [], countries: ["kenya"] })],
    ["geography: a country in two regions", geography({ regions: [{ id: "r", name: "R", countries: ["Kenya"] }, { id: "s", name: "S", countries: ["Kenya"] }], countries: [] })],
    ["geography: a country in a region and ungrouped", geography({ regions: [{ id: "r", name: "R", countries: ["Kenya"] }], countries: ["Kenya"] })],
    ["geography: duplicate region id", geography({ regions: [{ id: "r", name: "R", countries: ["Kenya"] }, { id: "r", name: "S", countries: ["Peru"] }], countries: [] })],
    ["geography: a figure, not a list", geography({ regions: [], countries: [], count: 25 })],
    ["geography: map coordinates (no map — D14)", geography({ regions: [{ id: "r", name: "R", countries: ["Kenya"], lat: 1 }], countries: [] })],
  ];
  for (const [name, value] of bad) assert.ok(issues(Impact, value).length > 0, name);
});

test("metric: a keyed figure with its verification, nothing else", () => {
  assert.deepEqual(issues(Metric, metric()), []);
  for (const [name, value] of [
    ["no slug", metric({ slug: undefined })],
    ["bad slug", metric({ slug: "Lives Impacted" })],
    ["unknown verification", metric({ verification: "audited" })],
    ["a glyph (not drawn)", metric({ icon: "people" })],
    ["a description (not drawn)", metric({ description: "More." })],
    ["value too long", metric({ value: "x".repeat(17) })],
    ["negative order", metric({ order: -1 })],
  ] as const)
    assert.ok(issues(Metric, value).length > 0, name);
});

test("impact page: /impact's chapters as blocks; unknown, HTML and misplaced blocks refused", () => {
  const ok = page([
    intro(),
    stats(),
    block("programs", "programImpact", { kicker: "Across our work", heading: "Program areas", items: [{ programId: "education", summary: "A line." }] }),
    block("teasers", "teasers", { items: [{ kicker: "Our approach", heading: "H.", body: "B.", cta: { label: "More", href: "/impact/our-approach" } }, { kicker: "Our work", heading: "W.", body: "B.", cta: { label: "Work", href: "/work" } }] }),
    block("measurement", "measurement", { heading: "Evidence", body: "B.", items: ["One.", "Two."] }),
    block("stories", "stories", { heading: "Stories", storyIds: ["a-story"], cta: { label: "All", href: "/stories" } }),
    block("reports", "trust", { heading: "Reporting.", body: "B.", cta: { label: "View", href: "/about#transparency" } }),
    block("closing", "cta", { heading: "Be part.", primary: { label: "Go", href: "/get-involved" } }, false),
  ]);
  assert.deepEqual(issues(Impact, ok), []);
  const bad: [string, unknown[]][] = [
    ["unknown", [block("x", "carousel", {})]],
    ["html", [block("x", "html", { html: "<b>x</b>" })]],
    ["intro not first", [stats(), intro()]],
    ["two stats", [stats(), block("b", "stats", { heading: "S", metricIds: ["x"] })]],
    ["figures restated, not named", [block("s", "stats", { heading: "S", metricIds: ["x"], items: [{ value: "120+" }] })]],
    ["stats with no figure", [stats([])]],
    ["one teaser", [block("t", "teasers", { items: [{ heading: "H", body: "B.", cta: { label: "Go", href: "/x" } }] })]],
    ["a teaser without a link", [block("t", "teasers", { items: [{ heading: "H", body: "B." }, { heading: "I", body: "C.", cta: { label: "Go", href: "/x" } }] })]],
    ["a program twice", [block("p", "programImpact", { heading: "P", items: [{ programId: "a", summary: "S" }, { programId: "a", summary: "T" }] })]],
    ["highlight outside the title", [block("intro", "intro", { title: "Our Impact", highlight: "Work", body: "B." })]],
    ["homepage-only block", [block("p", "postList", { heading: "P", postIds: ["x"] })]],
  ];
  for (const [name, sections] of bad) assert.ok(issues(Impact, page(sections)).length > 0, name);
});

test("snapshot: published metrics in order; every stats block names a published one; the Impact page published only", () => {
  const snapshot = (content: Record<string, unknown>) => ({
    version: 1,
    schemaVersion: 1,
    generatedAt: "2026-10-07T10:00:00.000Z",
    organization: { id: fx.settings().orgId },
    settings: { ...fx.settings(), status: "published" },
    media: {},
    content,
  });
  const homepage = (metricIds: string[]) => ({ id: "homepage", orgId: fx.settings().orgId, schemaVersion: 1, status: "published", sections: [block("impact", "stats", { heading: "Figures", metricIds })] });
  const program = { id: "p1", orgId: fx.settings().orgId, schemaVersion: 1, status: "published", slug: "education", title: "Education", icon: "education", order: 0, description: "A line." };
  assert.deepEqual(issues(PublishedSnapshot, snapshot({ metrics: [metric(), metric({ id: "m2", slug: "b-figure", order: 1 })], homepage: homepage(["a-figure", "b-figure"]), impact: page([intro(), stats(["b-figure"])]) })), []);
  assert.deepEqual(issues(PublishedSnapshot, snapshot({ homepage: homepage(["lives"]) })), [], "no metrics key: the website's own figures (its build checks the names)");
  assert.deepEqual(issues(PublishedSnapshot, snapshot({ programs: [program], impact: page([intro(), block("p", "programImpact", { heading: "P", items: [{ programId: "education", summary: "S." }] })]) })), []);
  const bad: [string, Record<string, unknown>][] = [
    ["empty metrics", { metrics: [] }],
    ["draft metric", { metrics: [metric({ status: "draft" })] }],
    ["other org", { metrics: [metric({ orgId: "other" })] }],
    ["sample marker", { metrics: [metric({ releaseMarker: "sample" })] }],
    ["duplicate slug", { metrics: [metric(), metric({ id: "m2" })] }],
    ["homepage names an unpublished figure", { metrics: [metric()], homepage: homepage(["a-figure", "lives"]) }],
    ["impact names an unpublished figure", { metrics: [metric()], impact: page([intro(), stats(["lives"])]) }],
    ["draft impact page", { impact: page([intro()], { status: "draft" }) }],
    ["disabled impact block", { impact: page([intro(), block("closing", "cta", { heading: "C.", primary: { label: "Go", href: "/x" } }, false)]) }],
    ["impact names an unpublished program", { programs: [program], impact: page([intro(), block("p", "programImpact", { heading: "P", items: [{ programId: "livelihoods", summary: "S." }] })]) }],
    ["impact share image missing", { impact: page([intro()], { seo: { ogImageId: "missing" } }) }],
  ];
  for (const [name, content] of bad) assert.ok(issues(PublishedSnapshot, snapshot(content)).length > 0, name);
});

test("countries (D14): the full ISO 3166-1 list, each code and name once — options, not RBB's coverage", async () => {
  const { COUNTRIES, COUNTRY_NAMES, isCountryName } = await import("../index.ts");
  assert.equal(COUNTRIES.length, 249);
  assert.equal(new Set(COUNTRIES.map((c) => c.code)).size, 249);
  assert.equal(new Set(COUNTRY_NAMES).size, 249);
  assert.ok(COUNTRIES.every((c) => /^[A-Z]{2}$/.test(c.code)));
  assert.ok(isCountryName("Côte d'Ivoire") && !isCountryName("Atlantis"));
});
