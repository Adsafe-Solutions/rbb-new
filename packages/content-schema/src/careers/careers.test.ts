import { test } from "node:test";
import assert from "node:assert/strict";
import { Careers, PublishedSnapshot } from "../index.ts";
import * as fx from "../test/fixtures.ts";

/* Careers (M13), and it in a published snapshot. Test data only — no
   real role is ever named here. */

const org = fx.settings().orgId;
const careers = (o: Record<string, unknown> = {}) => ({
  id: "careers",
  orgId: org,
  schemaVersion: 1,
  status: "published",
  title: "Careers",
  intro: "An intro line.",
  opportunities: { heading: "Open opportunities", empty: "None at the moment.", roles: [] },
  closing: { heading: "Explore.", primary: { label: "About Us", href: "/about" } },
  ...o,
});
const issues = (schema: { safeParse(v: unknown): { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, value: unknown) => {
  const r = schema.safeParse(value);
  return r.success ? [] : r.error!.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};

test("careers: the page as the site draws it — sections, roles by title, SEO without an image", () => {
  assert.deepEqual(issues(Careers, careers({ kicker: "Careers", why: { heading: "Why", body: ["P."] }, apply: { heading: "How", body: ["P."] }, opportunities: { heading: "Open", empty: "None.", roles: [{ title: "A test role" }] }, seo: { title: "T", description: "D.", noIndex: true } })), []);
  for (const [name, value] of [
    ["no title", careers({ title: undefined })],
    ["a role with a salary", careers({ opportunities: { heading: "O", empty: "N.", roles: [{ title: "R", salary: "£1" }] } })],
    ["a role with an application link (none on the site)", careers({ opportunities: { heading: "O", empty: "N.", roles: [{ title: "R", applicationUrl: "https://jobs.example.org" }] } })],
    ["no empty line", careers({ opportunities: { heading: "O", roles: [] } })],
    ["a share image (the page has none)", careers({ seo: { ogImageId: "img" } })],
    ["HTML", careers({ intro: "<b>x</b>" })],
    ["an unknown section", careers({ benefits: { heading: "B", body: ["P."] } })],
    ["an unsafe link", careers({ closing: { heading: "E.", primary: { label: "Go", href: "javascript:alert(1)" } } })],
    ["an empty why", careers({ why: { heading: "Why", body: [] } })],
  ] as const)
    assert.ok(issues(Careers, value).length > 0, name);
});

test("snapshot: careers only while published, this organization's, nothing internal", () => {
  const snapshot = (content: Record<string, unknown>) => ({ version: 1, schemaVersion: 1, generatedAt: "2026-10-08T10:00:00.000Z", organization: { id: org }, settings: { ...fx.settings(), status: "published" }, media: {}, content });
  assert.deepEqual(issues(PublishedSnapshot, snapshot({ careers: careers() })), []);
  for (const [name, content] of [
    ["draft", { careers: careers({ status: "draft" }) }],
    ["archived", { careers: careers({ status: "archived" }) }],
    ["other org", { careers: careers({ orgId: "other" }) }],
    ["sample marker", { careers: careers({ releaseMarker: "Sample" }) }],
    ["revision travelling", { careers: careers({ revision: 3 }) }],
  ] as const)
    assert.ok(issues(PublishedSnapshot, snapshot(content)).length > 0, name);
});
