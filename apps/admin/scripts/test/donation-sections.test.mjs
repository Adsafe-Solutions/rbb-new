import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MAX_LISTS, freshId, listsOf, paragraphsToRichText, replaceLists, replaceOne, richTextToParagraphs, sectionOf, whyOf } from "../../src/donations/sections.ts";
import { GeneralDonationPage } from "../../../../packages/content-schema/src/index.ts";

/* Milestone 7: a donation page's sections as the editor changes them —
   kept in the order the page draws them, nothing else on the record lost,
   a statement edited as a statement. */

const s = (id, type, data, enabled = true) => ({ id, type, enabled, version: 1, data });
const why = s("why", "statement", { kicker: "Why give", heading: "Why it matters", highlight: "matters", body: ["A test paragraph."], cta: { label: "Read more", href: "/about" } });
const helps = s("helps", "numberedCards", { kicker: "How", heading: "How your support helps", items: [{ title: "A test item" }] });
const trust = s("trust", "trust", { heading: "Transparency, for this page" });
const faq = s("faq", "faq", { heading: "Questions", items: [{ question: "A test question?", answer: "A test answer." }] });
const list = (id, kind) => s(id, "appealList", { heading: `Appeals ${id}`, ...(kind && { kind }) });

test("a new section goes where the page draws it; one in the record is replaced in place, or removed", () => {
  const types = (sections) => sections.map((x) => x.type);
  assert.deepEqual(types(replaceOne([why, faq], (x) => x.type === "trust", trust)), ["statement", "trust", "faq"]);
  assert.deepEqual(types(replaceOne([why, trust, faq], (x) => x.type === "numberedCards", helps)), ["statement", "numberedCards", "trust", "faq"]);
  assert.deepEqual(types(replaceOne([why, helps, trust], (x) => x.type === "trust", null)), ["statement", "numberedCards"]);
  const edited = replaceOne([why, helps, trust], (x) => x.type === "trust", { ...trust, enabled: false });
  assert.equal(sectionOf(edited, "trust").enabled, false, "switched off, kept: none on this page");
  const other = s("other", "stats", { heading: "H", metricIds: ["m"] });
  assert.ok(replaceOne([other, why], (x) => x.type === "faq", faq).includes(other), "a section of another type is kept");
});

test("appeal lists: replaced together, where they were (or where lists are drawn); up to three", () => {
  const ids = (sections) => sections.map((x) => x.id);
  assert.deepEqual(ids(replaceLists([why, helps, trust, faq], [list("a"), list("b", "emergency")])), ["why", "helps", "a", "b", "trust", "faq"]);
  assert.deepEqual(ids(replaceLists([why, list("a"), helps, trust], [list("c")])), ["why", "c", "helps", "trust"], "where the first one was");
  assert.deepEqual(ids(replaceLists([why, list("a"), trust], [])), ["why", "trust"], "none: the page's own bands");
  assert.equal(MAX_LISTS, 3);
  assert.deepEqual(listsOf([why, list("a"), trust, list("b")]).map((x) => x.id), ["a", "b"]);
  assert.equal(freshId([list("appeals"), list("appeals-2")], "appeals"), "appeals-3");
  assert.equal(whyOf([helps, why]), why);
});

test("switching a passage's form keeps the heading and the words", () => {
  assert.deepEqual(richTextToParagraphs(paragraphsToRichText(["One.", "Two."])), ["One.", "Two."]);
  const rich = [
    { type: "heading", level: 2, children: [{ type: "text", text: "A heading" }] },
    { type: "paragraph", children: [{ type: "text", text: "A " }, { type: "link", href: "/about", children: [{ type: "text", text: "link" }] }, { type: "text", text: "." }] },
    { type: "list", style: "bullet", items: [[{ type: "text", text: "First" }], [{ type: "text", text: "Second" }]] },
  ];
  assert.deepEqual(richTextToParagraphs(rich), ["A heading", "A link.", "First", "Second"]);
});

test("everything the editor writes is a valid donation page — the contract's own check", () => {
  const sections = replaceLists(replaceOne(replaceOne([why, helps], (x) => x.type === "trust", trust), (x) => x.type === "faq", { ...faq, enabled: false }), [list("appeals", "campaign"), list("appeals-2")]);
  const page = { id: "general-donation", orgId: "rbb", schemaVersion: 1, status: "draft", hero: { title: "T", description: "D.", imageId: "m" }, sections, donation: { designation: "where-needed-most" } };
  const r = GeneralDonationPage.safeParse(page);
  assert.ok(r.success, JSON.stringify(r.error?.issues));
});

test("the editor: a statement edited as a statement (never silently turned into formatted text); kicker, highlight, intro, link; the three new sections", () => {
  const src = readFileSync(new URL("../../src/donations/DonationSections.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(src, /Saving turns this passage into formatted text/, "the old silent conversion is gone");
  assert.match(src, /form === "statement" \?/, "a statement is edited as one");
  assert.match(src, /<HeadingFields data=\{statement\}/);
  assert.match(src, /<Cta data=\{statement\}/);
  assert.match(src, /<HeadingFields data=\{helps\}/);
  assert.match(src, /label="Introduction"/);
  for (const label of ["Appeal lists", "Trust panel", "Questions"]) assert.match(src, new RegExp(`label="${label}"`), label);
  assert.match(src, /Show a trust panel on this/);
  assert.match(src, /Show questions on this/);
  const appeal = readFileSync(new URL("../../src/pages/appeals/AppealEditorPage.tsx", import.meta.url), "utf8");
  assert.match(appeal, /<DonationSections [^\n]*noun="appeal"/);
});
