import { test } from "node:test";
import assert from "node:assert/strict";
import { HowWeWork, PublishedSnapshot } from "../index.ts";
import * as fx from "../test/fixtures.ts";

/* How We Work (#7). Test data only — never shown, and not RBB's words. */

const page = (o: Record<string, unknown> = {}) => ({
  id: "how_we_work",
  orgId: fx.settings().orgId,
  schemaVersion: 1,
  status: "published",
  heading: "A heading",
  body: "An opening line.",
  practices: { heading: "In practice.", items: [{ title: "A practice", description: "A line.", icon: "community" }] },
  rows: [{ id: "first", heading: "First", body: "A passage.", items: ["One.", "Two."] }, { id: "second", heading: "Second", body: "A passage." }],
  ...o,
});
const issues = (schema: { safeParse(v: unknown): { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, value: unknown) => {
  const r = schema.safeParse(value);
  return r.success ? [] : r.error!.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};

test("how we work: the page as the site draws it — header, practices, passages", () => {
  assert.deepEqual(issues(HowWeWork, page({ kicker: "About us" })), []);
  for (const [name, value] of [
    ["no heading", page({ heading: undefined })],
    ["no practice (a bare band)", page({ practices: { heading: "In practice.", items: [] } })],
    ["no passage", page({ rows: [] })],
    ["HTML", page({ body: "<b>x</b>" })],
    ["an icon the site cannot draw", page({ practices: { heading: "P", items: [{ title: "T", description: "D.", icon: "rocket" }] } })],
    ["nine practices", page({ practices: { heading: "P", items: Array.from({ length: 9 }, () => ({ title: "T", description: "D.", icon: "chart" })) } })],
    ["a duplicate passage id", page({ rows: [{ id: "a", heading: "A", body: "B." }, { id: "a", heading: "C", body: "D." }] })],
    ["an empty list", page({ rows: [{ id: "a", heading: "A", body: "B.", items: [] }] })],
    ["the posters (the site's)", page({ related: {} })],
    ["the closing ask (the site's)", page({ closing: { heading: "C." } })],
    ["SEO (the site's)", page({ seo: { title: "T" } })],
  ] as const)
    assert.ok(issues(HowWeWork, value).length > 0, name);
});

test("snapshot: how we work only while published, this organization's, nothing internal", () => {
  const snapshot = (content: Record<string, unknown>) => ({ version: 1, schemaVersion: 1, generatedAt: "2026-10-13T10:00:00.000Z", organization: { id: fx.settings().orgId }, settings: { ...fx.settings(), status: "published" }, media: {}, content });
  assert.deepEqual(issues(PublishedSnapshot, snapshot({ howWeWork: page() })), []);
  for (const [name, content] of [
    ["draft", { howWeWork: page({ status: "draft" }) }],
    ["other org", { howWeWork: page({ orgId: "other" }) }],
    ["sample marker", { howWeWork: page({ releaseMarker: "Sample" }) }],
  ] as const)
    assert.ok(issues(PublishedSnapshot, snapshot(content)).length > 0, name);
});
