import { test } from "node:test";
import assert from "node:assert/strict";
import { PublishedSnapshot, Report, Transparency } from "../index.ts";
import * as fx from "../test/fixtures.ts";

/* Transparency and its documents (M11), and both in a published
   snapshot. Test data only: no real figures, no real files. */

const record = (o: Record<string, unknown> = {}) => ({
  id: "transparency",
  orgId: fx.settings().orgId,
  schemaVersion: 1,
  status: "published",
  heading: "Transparency",
  intro: "An intro line.",
  financialOverview: { year: 2026, verification: "pending-review", items: [{ id: "a", label: "A", percentage: 60 }, { id: "b", label: "B", percentage: 40 }] },
  ...o,
});
const report = (o: Record<string, unknown> = {}) => ({ id: "r1", orgId: fx.settings().orgId, schemaVersion: 1, status: "published", slug: "a-report", category: "annualReport", title: "A report", fileUrl: "https://files.example.org/a.pdf", order: 0, ...o });
const issues = (schema: { safeParse(v: unknown): { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, value: unknown) => {
  const r = schema.safeParse(value);
  return r.success ? [] : r.error!.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};
const overview = (items: unknown[]) => ({ year: 2026, verification: "pending-review", items });

test("transparency: the chapter's words, shares that add up to 100, governance only with content", () => {
  assert.deepEqual(issues(Transparency, record({ governance: { intro: "How we are run.", sections: [{ heading: "Board", body: "B." }] }, accountability: ["P."] })), []);
  for (const [name, value] of [
    ["shares add up to 99", record({ financialOverview: overview([{ id: "a", label: "A", percentage: 60 }, { id: "b", label: "B", percentage: 39 }]) })],
    ["share over 100", record({ financialOverview: overview([{ id: "a", label: "A", percentage: 120 }]) })],
    ["an amount, not a share", record({ financialOverview: overview([{ id: "a", label: "A", percentage: 100, amount: "$1" }]) })],
    ["duplicate share", record({ financialOverview: overview([{ id: "a", label: "A", percentage: 50 }, { id: "a", label: "B", percentage: 50 }]) })],
    ["empty governance", record({ governance: { sections: [] } })],
    ["an audit claim field", record({ audited: true })],
    ["HTML field", record({ html: "<p>x</p>" })],
    ["no heading", record({ heading: undefined })],
    ["SEO (no page of its own)", record({ seo: { title: "T" } })],
  ] as const)
    assert.ok(issues(Transparency, value).length > 0, name);
});

test("report: a categorised document behind an https link", () => {
  assert.deepEqual(issues(Report, report({ year: 2025, type: "PDF" })), []);
  for (const [name, value] of [
    ["http link", report({ fileUrl: "http://files.example.org/a.pdf" })],
    ["site path", report({ fileUrl: "/files/a.pdf" })],
    ["javascript link", report({ fileUrl: "javascript:alert(1)" })],
    ["credentials in the link", report({ fileUrl: "https://user:pw@files.example.org/a.pdf" })],
    ["unknown category", report({ category: "audit" })],
    ["a media id (images only)", report({ mediaId: "m1" })],
    ["description (not drawn)", report({ description: "D." })],
  ] as const)
    assert.ok(issues(Report, value).length > 0, name);
});

test("snapshot: transparency only while published; published documents only", () => {
  const snapshot = (content: Record<string, unknown>) => ({
    version: 1,
    schemaVersion: 1,
    generatedAt: "2026-10-07T10:00:00.000Z",
    organization: { id: fx.settings().orgId },
    settings: { ...fx.settings(), status: "published" },
    media: {},
    content,
  });
  assert.deepEqual(issues(PublishedSnapshot, snapshot({ transparency: record(), reports: [report(), report({ id: "r2", slug: "b-report", category: "governance", order: 1 })] })), []);
  const bad: [string, Record<string, unknown>][] = [
    ["draft transparency", { transparency: record({ status: "draft" }) }],
    ["other org", { transparency: record({ orgId: "other" }) }],
    ["sample marker", { transparency: record({ releaseMarker: "sample" }) }],
    ["empty reports", { reports: [] }],
    ["draft report", { reports: [report({ status: "draft" })] }],
    ["archived report", { reports: [report({ status: "archived" })] }],
    ["duplicate report", { reports: [report(), report({ id: "r2" })] }],
  ];
  for (const [name, content] of bad) assert.ok(issues(PublishedSnapshot, snapshot(content)).length > 0, name);
});
