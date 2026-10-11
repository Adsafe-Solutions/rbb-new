import { test } from "node:test";
import assert from "node:assert/strict";
import { POLICY_IDS, POLICY_INFO, anchorOf, approvalGaps, changedParts, draftOf, draftProblems, followsHeading, isCalendarDate, isPolicyId, itemsFromText, paragraphsFromText, payloadOf, rowOf } from "../../src/policies/rules.ts";
import { POLICY_IDS as CONTRACT_IDS, POLICY_ROUTES, Policy } from "../../../../packages/content-schema/src/index.ts";

/* M19: the policy editor's rules. The API enforces all of them; these
   must never offer what it would refuse, must agree with the contract,
   and must never write any wording. Test data only. */

test("the admin's policies are the contract's — ids and fixed routes", () => {
  assert.deepEqual([...POLICY_IDS], [...CONTRACT_IDS]);
  for (const id of POLICY_IDS) assert.equal(POLICY_INFO[id].route, POLICY_ROUTES[id]);
  assert.ok(isPolicyId("privacy") && !isPolicyId("cookies") && !isPolicyId("Privacy") && !isPolicyId(""));
});

test("a new policy is empty: the site's title and cross-links only, no wording, no dates", () => {
  const d = draftOf("terms", null);
  assert.deepEqual(d, { title: "Terms of Use", effectiveDate: "", lastUpdated: "", introText: "", sections: [], contactReference: "", relatedPolicies: ["privacy", "donation"], seoDescription: "" });
  assert.deepEqual(payloadOf(d), { title: "Terms of Use", intro: [], sections: [], relatedPolicies: ["privacy", "donation"] });
  assert.deepEqual(approvalGaps(payloadOf(d)), ["an effective date", "a last-updated date", "at least one section"]);
});

test("paragraphs split on blank lines, list items on lines; empty ones never saved", () => {
  assert.deepEqual(paragraphsFromText("One\nstill one.\n\n  \n\nTwo.\n \nThree."), ["One still one.", "Two.", "Three."]);
  assert.deepEqual(paragraphsFromText("\n\n"), []);
  assert.deepEqual(itemsFromText("A\n\n  B  \n"), ["A", "B"]);
});

test("a saved record round-trips through the editor unchanged — nothing to save", () => {
  const record = { title: "T", effectiveDate: "2026-09-01", lastUpdated: "2026-09-15", intro: ["P one.", "P two."], sections: [{ id: "a", heading: "A", body: ["X."], items: ["i", "j"] }, { id: "b", heading: "B", body: [], items: ["k"] }], contactReference: "mail", relatedPolicies: ["donation"], seo: { description: "D." } };
  const d = draftOf("privacy", record);
  assert.deepEqual(payloadOf(d), record);
  assert.deepEqual(changedParts(d, draftOf("privacy", record)), {});
  // Clearing an optional part sends null; changing a section sends the whole list.
  assert.deepEqual(changedParts({ ...d, contactReference: "", seoDescription: "" }, d), { contactReference: null, seo: null });
  assert.deepEqual(Object.keys(changedParts({ ...d, sections: [d.sections[1], d.sections[0]] }, d)), ["sections"]);
  // The payload is what the contract accepts.
  const full = { id: "privacy", orgId: "rbb", schemaVersion: 1, status: "draft", ...payloadOf(d) };
  assert.ok(Policy.safeParse(full).success);
});

test("section anchors follow a NEW section's heading, then stay", () => {
  assert.equal(anchorOf("  Your rights & choices — à jour! "), "your-rights-choices-a-jour");
  assert.equal(anchorOf("x".repeat(80)).length, 60);
  assert.ok(followsHeading({ id: "", heading: "" }, []));
  assert.ok(followsHeading({ id: "old-heading", heading: "Old heading" }, []));
  assert.ok(!followsHeading({ id: "custom", heading: "Old heading" }, []), "typed by hand: stays");
  assert.ok(!followsHeading({ id: "old-heading", heading: "Old heading" }, ["old-heading"]), "saved: stays");
});

test("problems the editor shows before saving match the contract's rules", () => {
  assert.ok(isCalendarDate("2028-02-29") && !isCalendarDate("2026-02-29") && !isCalendarDate("2026-1-01") && !isCalendarDate(""));
  const d = { ...draftOf("donation", null), title: " ", effectiveDate: "2026-02-30", sections: [{ id: "Bad Id", heading: "", bodyText: "", itemsText: "" }, { id: "dup", heading: "H", bodyText: "P.", itemsText: "" }, { id: "dup", heading: "H", bodyText: "", itemsText: "Item" }] };
  assert.deepEqual([...draftProblems(d).keys()].sort(), ["effectiveDate", "sections.0.body", "sections.0.heading", "sections.0.id", "sections.2.id", "title"]);
  assert.equal(draftProblems(draftOf("donation", null)).size, 0, "an empty draft can be saved");
});

test("the list row: not started, status, live, schedule (approved only) and effective date", () => {
  assert.deepEqual(rowOf({ record: null, live: false, schedule: null }), { exists: false, status: null, live: false, scheduledAt: null, effectiveDate: null });
  assert.deepEqual(rowOf({ record: { status: "approved", effectiveDate: "2026-09-01" }, live: true, schedule: { at: "2026-10-12T09:00:00.000Z" } }), { exists: true, status: "approved", live: true, scheduledAt: "2026-10-12T09:00:00.000Z", effectiveDate: "2026-09-01" });
  assert.equal(rowOf({ record: { status: "draft" }, live: true, schedule: { at: "x" } }).scheduledAt, null);
});
