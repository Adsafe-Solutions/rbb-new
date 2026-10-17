import { test } from "node:test";
import assert from "node:assert/strict";
import { CTA_OPTIONS, HUB_PARTS, PAGE_IDS, PAGE_INFO, PATH_PARTS, RESERVED_SECTION_IDS, changedParts, hubApprovalGaps, hubDraftOf, hubPayloadOf, hubProblems, isPageId, pathApprovalGaps, pathDraftOf, pathPayloadOf, pathProblems, rowOf } from "../../src/getInvolved/rules.ts";
import { CTA_TARGETS, GET_INVOLVED_PAGE_IDS, GET_INVOLVED_ROUTES, GetInvolvedHub, GetInvolvedPath, RESERVED_SECTION_IDS as CONTRACT_RESERVED } from "../../../../packages/content-schema/src/index.ts";

/* M20: the Get Involved editors' rules. The API enforces all of them;
   these must never offer what it would refuse, must agree with the
   contract, and must never write any wording. Test data only. */

const record = { orgId: "rbb", schemaVersion: 1, status: "draft" };

test("the admin's pages, routes, targets and reserved ids are the contract's", () => {
  assert.deepEqual([...PAGE_IDS], [...GET_INVOLVED_PAGE_IDS]);
  for (const id of PAGE_IDS) assert.equal(PAGE_INFO[id].route, GET_INVOLVED_ROUTES[id]);
  assert.deepEqual(CTA_OPTIONS.map((o) => o.value), [...CTA_TARGETS]);
  assert.deepEqual(RESERVED_SECTION_IDS, [...CONTRACT_RESERVED]);
  assert.ok(isPageId("hub") && isPageId("travel") && isPageId("fundraise") && !isPageId("donate") && !isPageId(""));
});

test("new pages are empty: nothing is written for the editor", () => {
  assert.deepEqual(pathPayloadOf(pathDraftOf(null)), { sections: [] });
  assert.deepEqual(hubPayloadOf(hubDraftOf(null)), {});
  assert.deepEqual(pathApprovalGaps(pathPayloadOf(pathDraftOf(null))), ["a short description", "at least one section"]);
  assert.deepEqual(hubApprovalGaps(hubPayloadOf(hubDraftOf(null))), ["a heading", "an introduction"]);
  assert.ok(GetInvolvedPath.safeParse({ ...record, id: "volunteer", ...pathPayloadOf(pathDraftOf(null)) }).success, "an empty draft saves");
  assert.ok(GetInvolvedHub.safeParse({ ...record, id: "hub", ...hubPayloadOf(hubDraftOf(null)) }).success);
});

test("a saved path round-trips unchanged; edits send whole parts, clearing sends null", () => {
  const saved = { shortDescription: "Line.", hubNote: "Note.", sections: [{ id: "a", heading: "A", body: ["P one.", "P two."], items: ["i", "j"] }, { id: "b", heading: "B", body: [], items: ["k"] }], faq: { heading: "Q", items: [{ question: "Q?", answer: "A." }] }, seo: { description: "D." } };
  const d = pathDraftOf(saved);
  assert.deepEqual(pathPayloadOf(d), saved);
  assert.deepEqual(changedParts(PATH_PARTS, pathPayloadOf(d), pathPayloadOf(pathDraftOf(saved))), {});
  assert.deepEqual(changedParts(PATH_PARTS, pathPayloadOf({ ...d, hubNote: " ", faqOn: false, seoDescription: "" }), pathPayloadOf(d)), { hubNote: null, faq: null, seo: null });
  assert.ok(GetInvolvedPath.safeParse({ ...record, id: "partner", ...pathPayloadOf(d) }).success, "what the editor sends is what the contract accepts");
});

test("a saved hub round-trips; structured calls to action only", () => {
  const saved = { heading: "H", intro: "I.", ways: { kicker: "K", heading: "W" }, choose: { kicker: "K2", heading: "C" }, why: { heading: "Why", body: ["P."] }, closing: { heading: "Close.", primary: { label: "Go", target: "appeals" }, secondary: { label: "Work", target: "work" } } };
  const d = hubDraftOf(saved);
  assert.deepEqual(hubPayloadOf(d), saved);
  assert.deepEqual(changedParts(HUB_PARTS, hubPayloadOf({ ...d, whyOn: false, secondaryOn: false }), hubPayloadOf(d)), { why: null, closing: { heading: "Close.", primary: { label: "Go", target: "appeals" } } });
  assert.ok(GetInvolvedHub.safeParse({ ...record, id: "hub", ...hubPayloadOf(d) }).success);
  assert.deepEqual([...hubProblems({ ...d, primary: { label: "", target: "" } }).keys()], ["closing.primary.label", "closing.primary.target"]);
  assert.deepEqual([...hubProblems({ ...d, waysKicker: "", choose: undefined }).keys()], ["ways.kicker"], "a heading pair is both or neither");
  assert.equal(hubProblems({ ...d, waysKicker: "", waysHeading: "" }).size, 0, "an empty pair keeps the website's words");
});

test("path problems match the contract: anchors, reserved id, duplicates, empty sections, questions", () => {
  const d = { ...pathDraftOf(null), sections: [
    { id: "inquiry", heading: "One", bodyText: "P.", itemsText: "" },
    { id: "Bad Id", heading: "", bodyText: "", itemsText: "" },
    { id: "dup", heading: "Same", bodyText: "P.", itemsText: "" },
    { id: "dup", heading: "Same", bodyText: "", itemsText: "Item" },
  ], faqOn: true, faqHeading: "", faqItems: [{ question: "Q?", answer: "" }, { question: "Q?", answer: "A." }] };
  assert.deepEqual([...pathProblems(d).keys()].sort(), ["faq.heading", "faq.items.0.answer", "faq.items.1.question", "sections.0.id", "sections.1.body", "sections.1.heading", "sections.1.id", "sections.3.heading", "sections.3.id"].sort());
  assert.equal(pathProblems(pathDraftOf(null)).size, 0);
});

test("the list row", () => {
  assert.deepEqual(rowOf({ record: null, live: false, schedule: null }), { exists: false, status: null, live: false, scheduledAt: null });
  assert.equal(rowOf({ record: { status: "approved" }, live: true, schedule: { at: "2026-10-12T09:00:00.000Z" } }).scheduledAt, "2026-10-12T09:00:00.000Z");
  assert.equal(rowOf({ record: { status: "draft" }, live: false, schedule: { at: "x" } }).scheduledAt, null);
});
