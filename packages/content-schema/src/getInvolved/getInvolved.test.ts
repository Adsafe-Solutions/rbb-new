import { test } from "node:test";
import assert from "node:assert/strict";
import { CTA_TARGETS, GET_INVOLVED_PAGE_IDS, GET_INVOLVED_ROUTES, GetInvolvedHub, GetInvolvedPage, GetInvolvedPath, PublishedSnapshot, getInvolvedApprovalProblems, workingTextFindings } from "../index.ts";
import * as fx from "../test/fixtures.ts";

/* Get Involved (M20): five fixed pages, plain text, structured calls to
   action, and them in a published snapshot. Test wording only. */

const org = fx.settings().orgId;
const base = { orgId: org, schemaVersion: 1, status: "published" };
const section = (o: Record<string, unknown> = {}) => ({ id: "test-section", heading: "Test heading", body: ["Test paragraph."], ...o });
const path = (o: Record<string, unknown> = {}) => ({ ...base, id: "volunteer", shortDescription: "A test line.", sections: [section()], ...o });
const hub = (o: Record<string, unknown> = {}) => ({ ...base, id: "hub", heading: "Test hub", intro: "A test introduction.", ...o });
const issues = (schema: { safeParse(v: unknown): { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, value: unknown) => {
  const r = schema.safeParse(value);
  return r.success ? [] : r.error!.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};

test("five fixed pages, each at its fixed route; six call-to-action targets", () => {
  assert.deepEqual([...GET_INVOLVED_PAGE_IDS], ["hub", "volunteer", "fellowship", "partner", "travel"]);
  assert.deepEqual(GET_INVOLVED_ROUTES, { hub: "/get-involved", volunteer: "/get-involved/volunteer", fellowship: "/get-involved/fellowship", partner: "/get-involved/partner", travel: "/get-involved/travel" });
  assert.deepEqual([...CTA_TARGETS], ["appeals", "work", "impact", "contact", "get-involved", "about"]);
  for (const id of ["volunteer", "fellowship", "partner", "travel"]) assert.deepEqual(issues(GetInvolvedPage, path({ id })), [], id);
  assert.deepEqual(issues(GetInvolvedPage, hub()), []);
  for (const id of ["fundraise", "donate", "giving", "Volunteer"]) assert.ok(issues(GetInvolvedPage, path({ id })).length > 0, id);
});

test("empty drafts are valid; full records too", () => {
  assert.deepEqual(issues(GetInvolvedPath, { ...base, status: "draft", id: "travel", sections: [] }), []);
  assert.deepEqual(issues(GetInvolvedHub, { ...base, status: "draft", id: "hub" }), []);
  assert.deepEqual(issues(GetInvolvedPath, path({ hubNote: "A note.", sections: [section({ items: ["One.", "Two."] }), section({ id: "list-only", heading: "List only", body: [], items: ["Only an item."] })], faq: { heading: "Questions", items: [{ question: "Q one?", answer: "A one." }, { question: "Q two?", answer: "A two." }] }, seo: { description: "A description." } })), []);
  assert.deepEqual(issues(GetInvolvedHub, hub({ ways: { kicker: "K", heading: "H" }, choose: { kicker: "K", heading: "H" }, why: { heading: "Why", body: ["P."] }, closing: { heading: "Next.", primary: { label: "See appeals", target: "appeals" }, secondary: { label: "Our work", target: "work" } } })), []);
});

test("refuses fixed identity, unknown fields, HTML, markers, bad sections and arbitrary links", () => {
  for (const [name, value] of [
    ["a title (fixed)", path({ title: "Volunteer" })],
    ["a route (fixed)", path({ to: "/elsewhere" })],
    ["an icon (fixed)", path({ icon: "x" })],
    ["a CTA label (fixed)", path({ ctaLabel: "Go" })],
    ["featured (fixed)", path({ featured: true })],
    ["a release marker", path({ releaseMarker: "Sample" })],
    ["HTML", path({ shortDescription: "<b>x</b>" })],
    ["HTML in a section", path({ sections: [section({ body: ["<p>x</p>"] })] })],
    ["rich text", path({ sections: [section({ body: [{ type: "paragraph" }] })] })],
    ["working text", path({ sections: [section({ body: ["Demo — not real."] })] })],
    ["a placeholder address", path({ shortDescription: "Write to hello@example.org." })],
    ["a sample label", path({ hubNote: "Sample story about it." })],
    ["an empty section", path({ sections: [section({ body: [] })] })],
    ["the reserved inquiry id", path({ sections: [section({ id: "inquiry" })] })],
    ["a section id that is not a slug", path({ sections: [section({ id: "Not A Slug" })] })],
    ["duplicate section ids", path({ sections: [section(), section({ heading: "Other" })] })],
    ["duplicate headings", path({ sections: [section(), section({ id: "other" })] })],
    ["a repeated FAQ question", path({ faq: { heading: "Q", items: [{ question: "Same?", answer: "A." }, { question: "Same?", answer: "B." }] } })],
    ["an empty FAQ", path({ faq: { heading: "Q", items: [] } })],
    ["a working SEO description", path({ seo: { description: "Demo — x." } })],
    ["an SEO title", path({ seo: { title: "T" } })],
    ["a hub kicker (not editable)", hub({ kicker: "K" })],
    ["a CTA with an address", hub({ closing: { heading: "H", primary: { label: "Go", href: "/appeals" } } })],
    ["a CTA to an unknown target", hub({ closing: { heading: "H", primary: { label: "Go", target: "donate" } } })],
    ["a CTA to a URL target", hub({ closing: { heading: "H", primary: { label: "Go", target: "https://x.org" } } })],
    ["an empty why", hub({ why: { heading: "Why", body: [] } })],
    ["hub teasers (not editable)", hub({ related: {} })],
  ] as const)
    assert.ok(issues(GetInvolvedPage, value).length > 0, name);
});

test("approval completeness", () => {
  assert.deepEqual(getInvolvedApprovalProblems(path() as never), []);
  assert.deepEqual(getInvolvedApprovalProblems({ ...base, id: "partner", sections: [] } as never).map((p) => p.path), ["shortDescription", "sections"]);
  assert.deepEqual(getInvolvedApprovalProblems({ ...base, id: "hub" } as never).map((p) => p.path), ["heading", "intro"]);
  assert.deepEqual(getInvolvedApprovalProblems(hub() as never), []);
});

test("working text: the website's markers; the email format hint is not one", () => {
  assert.deepEqual(workingTextFindings("Demo — x"), ["demo prefix"]);
  assert.deepEqual(workingTextFindings("e.g. name@example.com"), []);
  assert.deepEqual(workingTextFindings("A real paragraph about volunteering."), []);
});

test("snapshot: published, complete pages in the fixed order", () => {
  const snapshot = (pages: readonly unknown[]) => ({ version: 1, schemaVersion: 1, generatedAt: "2026-10-10T10:00:00.000Z", organization: { id: org }, settings: { ...fx.settings(), status: "published" }, media: {}, content: { getInvolved: pages } });
  assert.deepEqual(issues(PublishedSnapshot, snapshot([hub(), path(), path({ id: "travel" })])), []);
  for (const [name, pages] of [
    ["none (absent, never empty)", []],
    ["a draft", [path({ status: "draft" })]],
    ["approved, not yet published", [hub({ status: "approved" })]],
    ["another organization", [path({ orgId: "other" })]],
    ["incomplete path", [path({ sections: [] })]],
    ["incomplete hub", [hub({ intro: undefined })]],
    ["twice", [path(), path()]],
    ["out of order", [path(), hub()]],
    ["a revision travelling", [path({ revision: 2 })]],
  ] as const)
    assert.ok(issues(PublishedSnapshot, snapshot(pages)).length > 0, name);
});
