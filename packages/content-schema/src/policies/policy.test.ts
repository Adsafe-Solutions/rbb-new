import { test } from "node:test";
import assert from "node:assert/strict";
import { POLICY_IDS, POLICY_ROUTES, Policy, PublishedSnapshot, policyApprovalProblems } from "../index.ts";
import * as fx from "../test/fixtures.ts";

/* Policies (M19): three fixed records, plain paragraphs and lists, RBB's
   dates — and them in a published snapshot. Test data only: no wording
   here is, or resembles, legal text. */

const org = fx.settings().orgId;
const section = (o: Record<string, unknown> = {}) => ({ id: "test-section", heading: "Test heading", body: ["Test paragraph."], ...o });
const policy = (o: Record<string, unknown> = {}) => ({
  id: "privacy",
  orgId: org,
  schemaVersion: 1,
  status: "published",
  title: "Test policy",
  effectiveDate: "2026-09-01",
  lastUpdated: "2026-09-15",
  intro: ["Test intro."],
  sections: [section()],
  relatedPolicies: ["terms"],
  ...o,
});
const issues = (schema: { safeParse(v: unknown): { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, value: unknown) => {
  const r = schema.safeParse(value);
  return r.success ? [] : r.error!.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};

test("policy: three fixed ids, each with its fixed route", () => {
  assert.deepEqual([...POLICY_IDS], ["privacy", "terms", "donation"]);
  assert.deepEqual(POLICY_ROUTES, { privacy: "/privacy", terms: "/terms", donation: "/donation-policy" });
  for (const id of POLICY_IDS) assert.deepEqual(issues(Policy, policy({ id, relatedPolicies: [] })), [], id);
  assert.ok(issues(Policy, policy({ id: "cookies" })).length > 0, "cookies is out of scope");
  assert.ok(issues(Policy, policy({ id: "accessibility" })).length > 0, "unknown id");
});

test("policy: an empty draft is valid; paragraphs, lists, a contact and SEO description", () => {
  assert.deepEqual(issues(Policy, policy({ status: "draft", effectiveDate: undefined, lastUpdated: undefined, intro: [], sections: [], relatedPolicies: [] })), []);
  assert.deepEqual(issues(Policy, policy({ sections: [section({ items: ["One.", "Two."] }), section({ id: "list-only", body: [], items: ["Only a list."] })], contactReference: "privacy-mail", seo: { description: "A test description." } })), []);
});

test("policy: refuses unknown fields, HTML, release markers, bad dates and bad references", () => {
  for (const [name, value] of [
    ["unknown field", policy({ route: "/elsewhere" })],
    ["unknown section field", policy({ sections: [section({ html: "x" })] })],
    ["HTML in a paragraph", policy({ sections: [section({ body: ["<p>x</p>"] })] })],
    ["HTML in an item", policy({ sections: [section({ items: ["<script>x</script>"] })] })],
    ["HTML in the intro", policy({ intro: ["<b>x</b>"] })],
    ["HTML in the title", policy({ title: "<i>T</i>" })],
    ["rich text", policy({ intro: [{ type: "paragraph", children: [] }] })],
    ["release marker", policy({ releaseMarker: "Sample text" })],
    ["impossible date", policy({ effectiveDate: "2026-02-30" })],
    ["not a calendar date", policy({ lastUpdated: "15/09/2026" })],
    ["a date-time", policy({ lastUpdated: "2026-09-15T10:00:00Z" })],
    ["an empty section", policy({ sections: [section({ body: [] })] })],
    ["an empty paragraph", policy({ sections: [section({ body: ["  "] })] })],
    ["a section id that is not a slug", policy({ sections: [section({ id: "Not A Slug" })] })],
    ["duplicate section ids", policy({ sections: [section(), section()] })],
    ["unknown related policy", policy({ relatedPolicies: ["cookies"] })],
    ["related to itself", policy({ relatedPolicies: ["privacy"] })],
    ["related twice", policy({ relatedPolicies: ["terms", "terms"] })],
    ["a share image", policy({ seo: { ogImageId: "img" } })],
    ["an SEO title (the page title is the policy's)", policy({ seo: { title: "T" } })],
    ["a typed-in contact address", policy({ contactReference: "privacy@example.org" })],
  ] as const)
    assert.ok(issues(Policy, value).length > 0, name);
});

test("policy: approval needs both dates and a section", () => {
  assert.deepEqual(policyApprovalProblems({ effectiveDate: "2026-09-01", lastUpdated: "2026-09-15", sections: [section()] as never }), []);
  assert.deepEqual(policyApprovalProblems({ sections: [] }).map((p) => p.path), ["effectiveDate", "lastUpdated", "sections"]);
  assert.deepEqual(policyApprovalProblems({ effectiveDate: "2026-09-01", sections: [section()] as never }).map((p) => p.path), ["lastUpdated"]);
});

test("snapshot: published, complete policies in the fixed order, contacts from the published settings", () => {
  const settings = { ...fx.settings(), status: "published", contact: { methods: [{ id: "privacy-mail", type: "email", label: "Privacy", value: "privacy@example.org" }] } };
  const snapshot = (policies: readonly unknown[]) => ({ version: 1, schemaVersion: 1, generatedAt: "2026-10-08T10:00:00.000Z", organization: { id: org }, settings, media: {}, content: { policies } });
  assert.deepEqual(issues(PublishedSnapshot, snapshot([policy({ contactReference: "privacy-mail" })])), []);
  assert.deepEqual(issues(PublishedSnapshot, snapshot([policy(), policy({ id: "terms", relatedPolicies: [] }), policy({ id: "donation", relatedPolicies: [] })])), []);
  for (const [name, policies] of [
    ["none (absent, never empty)", []],
    ["draft", [policy({ status: "draft" })]],
    ["approved but not yet published", [policy({ status: "approved" })]],
    ["other org", [policy({ orgId: "other" })]],
    ["no effective date", [policy({ effectiveDate: undefined })]],
    ["no last-updated date", [policy({ lastUpdated: undefined })]],
    ["no section", [policy({ sections: [] })]],
    ["a contact not in the settings", [policy({ contactReference: "missing" })]],
    ["twice", [policy(), policy()]],
    ["out of order", [policy({ id: "terms", relatedPolicies: [] }), policy()]],
    ["a revision travelling", [policy({ revision: 3 })]],
  ] as const)
    assert.ok(issues(PublishedSnapshot, snapshot(policies)).length > 0, name);
});
