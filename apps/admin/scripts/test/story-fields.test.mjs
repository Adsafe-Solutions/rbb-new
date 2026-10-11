import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ATTRIBUTION_MAX, IMPACT_LINE_MAX, IMPACT_MAX, QUOTES_MAX, QUOTE_TEXT_MAX, impactProblems, listOrNone, quoteProblems } from "../../src/content/storyFields.ts";
import { STORY_IMPACT_MAX, STORY_QUOTES_MAX, StoryImpact, StoryQuotes } from "../../../../packages/content-schema/src/index.ts";

/* Milestone 5: the story editor's quotes and impact. The helpers mirror
   the contract so problems show beside the item; the contract (and the
   API) stay the rule. */

test("limits are the contract's", () => {
  assert.deepEqual([QUOTES_MAX, IMPACT_MAX], [STORY_QUOTES_MAX, STORY_IMPACT_MAX]);
  const ok = (schema, value) => schema.safeParse(value).success;
  assert.ok(ok(StoryQuotes, [{ text: "x".repeat(QUOTE_TEXT_MAX), attribution: "y".repeat(ATTRIBUTION_MAX) }]) && !ok(StoryQuotes, [{ text: "x".repeat(QUOTE_TEXT_MAX + 1), attribution: "y" }]) && !ok(StoryQuotes, [{ text: "x", attribution: "y".repeat(ATTRIBUTION_MAX + 1) }]));
  assert.ok(ok(StoryImpact, ["x".repeat(IMPACT_LINE_MAX)]) && !ok(StoryImpact, ["x".repeat(IMPACT_LINE_MAX + 1)]));
});

test("an emptied list is cleared, never saved as []", () => {
  assert.equal(listOrNone([]), undefined);
  assert.deepEqual(listOrNone(["A line."]), ["A line."]);
});

test("item problems agree with the contract, case for case", () => {
  const quoteCases = [
    [{ text: "Words.", attribution: "A parent" }],
    [{ text: "Words.", attribution: "A parent" }, { text: "Other words.", attribution: "A volunteer" }],
    [{ text: "Words." }],
    [{ text: "Words.", attribution: "" }],
    [{ text: "", attribution: "A parent" }],
    [{ text: "   ", attribution: "  " }],
    [{ text: "Same.", attribution: "A" }, { text: " Same. ", attribution: "B" }],
  ];
  for (const quotes of quoteCases) {
    const r = StoryQuotes.safeParse(quotes);
    const contract = new Set(r.success ? [] : r.error.issues.map((i) => (i.path.length > 1 ? `${i.path[0]}.${i.path[1]}` : `${i.path[0]}.text`)));
    const mirrored = new Set([...quoteProblems(quotes)].flatMap(([i, p]) => [p.text && `${i}.text`, p.attribution && `${i}.attribution`].filter(Boolean)));
    assert.deepEqual(mirrored, contract, JSON.stringify(quotes));
  }
  for (const lines of [["A line."], ["A line.", "Another."], [""], ["  "], ["Same.", "Same."], ["A.", "B.", "A."]]) {
    const r = StoryImpact.safeParse(lines);
    const contract = new Set(r.success ? [] : r.error.issues.map((i) => i.path[0]));
    assert.deepEqual(new Set(impactProblems(lines).keys()), contract, JSON.stringify(lines));
  }
});

test("the story editor offers both and sends them", () => {
  const editor = readFileSync(new URL("../../src/pages/stories/StoryEditorPage.tsx", import.meta.url), "utf8");
  assert.match(editor, /const FIELDS = \[[^\]]*"quotes", "impact"/);
  assert.match(editor, /<ItemList<StoryQuote>[\s\S]*?onChange=\{\(next\) => editor\.set\(\{ quotes: listOrNone\(next\) \}\)\}/);
  assert.match(editor, /<ItemList<string>[\s\S]*?onChange=\{\(next\) => editor\.set\(\{ impact: listOrNone\(next\) \}\)\}/);
  assert.match(editor, /permission/, "the editor says a real person's words need their permission");
  for (const file of ["pages/posts/PostEditorPage.tsx"]) assert.doesNotMatch(readFileSync(new URL(`../../src/${file}`, import.meta.url), "utf8"), /quotes|"impact"/, "news and blog posts have neither");
});
