import { test } from "node:test";
import assert from "node:assert/strict";
import { ABOUT_BLOCKS, ABOUT_BLOCK_TYPES, ABOUT_SECTION_SCHEMAS, About, PublishedSnapshot, TeamMember } from "../index.ts";
import * as fx from "../test/fixtures.ts";

/* About (M9) and TeamMember (M9), and both in a published snapshot.
   Test data only. */

const block = (id: string, type: string, data: unknown, enabled = true) => ({ id, type, enabled, version: 1, data });
const hero = () => block("intro", "pageHero", { title: "About us", body: "An opening line.", cta: { label: "Explore", href: "/work" } });
const page = (sections: unknown[], o: Record<string, unknown> = {}) => ({ id: "about", orgId: fx.settings().orgId, schemaVersion: 1, status: "published", sections, ...o });
const member = (o: Record<string, unknown> = {}) => ({ id: "m1", orgId: fx.settings().orgId, schemaVersion: 1, status: "published", slug: "a-role", name: "A Role", role: "An area", group: "team", order: 0, ...o });
const issues = (schema: { safeParse(v: unknown): { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, value: unknown) => {
  const r = schema.safeParse(value);
  return r.success ? [] : r.error!.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};

test("about registry: one schema per block type, one entry per type", () => {
  assert.deepEqual(Object.keys(ABOUT_SECTION_SCHEMAS).sort(), [...ABOUT_BLOCK_TYPES].sort());
  assert.deepEqual(ABOUT_BLOCKS.map((b) => b.type).sort(), [...ABOUT_BLOCK_TYPES].sort());
});

test("about: the page's chapters as blocks; unknown, HTML and misplaced blocks refused", () => {
  const ok = page([
    hero(),
    block("who", "statement", { kicker: "Who we are", heading: "Who", highlight: "Who", body: ["One.", "Two."] }),
    block("mv", "missionVision", { heading: "Mission & Vision", mission: { label: "Our Mission", statement: "M." }, vision: { label: "Our Vision", statement: "V." } }),
    block("values", "numberedCards", { heading: "Values", items: [{ title: "Dignity", description: "D." }] }),
    block("how", "approach", { heading: "How", body: "B.", cta: { label: "More", href: "/impact/our-approach" } }),
    block("transparency", "transparency", {}),
    block("closing", "cta", { heading: "Closing.", primary: { label: "Go", href: "/get-involved" } }, false),
  ]);
  assert.deepEqual(issues(About, ok), []);
  const bad: [string, unknown[]][] = [
    ["unknown", [block("x", "carousel", {})]],
    ["html", [block("x", "html", { html: "<b>x</b>" })]],
    ["hero not first", [block("who", "statement", { heading: "H", body: ["p"] }), hero()]],
    ["two values", [block("a", "numberedCards", { heading: "V", items: [{ title: "T" }] }), block("b", "numberedCards", { heading: "V", items: [{ title: "T" }] })]],
    ["transparency with content", [block("t", "transparency", { heading: "Made up" })]],
    ["homepage-only block", [block("p", "postList", { heading: "P", postIds: ["x"] })]],
  ];
  for (const [name, sections] of bad) assert.ok(issues(About, page(sections)).length > 0, name);
});

test("team member: the fields the team page draws, nothing else", () => {
  assert.deepEqual(issues(TeamMember, member({ shortBio: "A line.", biography: ["P."], relatedLinks: [{ label: "Transparency", href: "/about#transparency" }], socialLinks: [{ label: "LinkedIn", url: "https://www.linkedin.com/in/x" }] })), []);
  for (const [name, value] of [
    ["unknown group", member({ group: "board" })],
    ["email", member({ email: "a@b.org" })],
    ["http social link", member({ socialLinks: [{ label: "X", url: "http://x.example" }] })],
    ["external related link", member({ relatedLinks: [{ label: "X", href: "https://x.example" }] })],
    ["negative order", member({ order: -1 })],
  ] as const)
    assert.ok(issues(TeamMember, value).length > 0, name);
});

test("snapshot: published About (enabled blocks) and published team members only", () => {
  const snapshot = (content: Record<string, unknown>) => ({
    version: 1,
    schemaVersion: 1,
    generatedAt: "2026-10-07T10:00:00.000Z",
    organization: { id: fx.settings().orgId },
    settings: { ...fx.settings(), status: "published", branding: { logoId: "logo-mark" } },
    media: {
      "logo-mark": { id: "logo-mark", url: "https://media.example.org/rbb/media/u/logo.png", mimeType: "image/png", alt: "" },
      ...(JSON.stringify(content).includes('"portrait"') && { portrait: { id: "portrait", url: "https://media.example.org/rbb/media/u/p.png", mimeType: "image/png", alt: "A portrait" } }),
    },
    content,
  });
  assert.deepEqual(issues(PublishedSnapshot, snapshot({ about: page([hero()]), team: [member({ imageId: "portrait" })] })), []);
  assert.deepEqual(issues(PublishedSnapshot, snapshot({ team: [] })), [], "managed, nobody published");
  const bad: [string, Record<string, unknown>][] = [
    ["draft about", { about: page([hero()], { status: "draft" }) }],
    ["disabled block", { about: page([{ ...hero(), enabled: false }]) }],
    ["other org about", { about: page([hero()], { orgId: "other" }) }],
    ["draft member", { team: [member({ status: "draft" })] }],
    ["archived member", { team: [member({ status: "archived" })] }],
    ["sample member", { team: [member({ releaseMarker: "sample" })] }],
    ["duplicate slug", { team: [member(), member({ id: "m2" })] }],
    ["photo not in the snapshot", { team: [member({ imageId: "missing" })] }],
    ["photo without alt text", { team: [member({ imageId: "logo-mark" })] }],
  ];
  for (const [name, content] of bad) assert.ok(issues(PublishedSnapshot, snapshot(content)).length > 0, name);
});
