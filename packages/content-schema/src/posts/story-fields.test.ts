import { test } from "node:test";
import assert from "node:assert/strict";
import { Post, PublishedSnapshot } from "../index.ts";
import * as fx from "../test/fixtures.ts";

/* Milestone 5 — a story's quotes and impact, as the contract states them. */

const story = (extra: Record<string, unknown> = {}) => ({ ...fx.post(), id: "s1", type: "story", slug: "a-story", category: "field", ...extra });
const issues = (value: unknown) => {
  const r = Post.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};

test("quotes: the words and who said them (both required, as the website requires), one to six, each distinct; plain text only", () => {
  assert.deepEqual(issues(story()), [], "a story without quotes, as every story before");
  const q = (text: string, attribution = "A parent at the club") => ({ text, attribution });
  assert.deepEqual(issues(story({ quotes: [q("We read together now.")] })), []);
  assert.deepEqual(issues(story({ quotes: [{ text: "We read together now." }] })), ["quotes.0.attribution"], "who said it is required");
  assert.deepEqual(issues(story({ quotes: Array.from({ length: 6 }, (_, i) => q(`Quote ${i}`)) })), []);
  assert.deepEqual(issues(story({ quotes: Array.from({ length: 7 }, (_, i) => q(`Quote ${i}`)) })), ["quotes"]);
  assert.deepEqual(issues(story({ quotes: [] })), ["quotes"], "an empty list is no list: leave it out");
  assert.deepEqual(issues(story({ quotes: [q("Same words."), q(" Same words. ", "Someone else")] })), ["quotes.1"]);
  assert.deepEqual(issues(story({ quotes: [q("   ")] })), ["quotes.0.text"]);
  assert.deepEqual(issues(story({ quotes: [q("<b>Bold</b>")] })), ["quotes.0.text"]);
  assert.deepEqual(issues(story({ quotes: [q("x".repeat(601))] })), ["quotes.0.text"]);
  assert.deepEqual(issues(story({ quotes: [q("Words.", "")] })), ["quotes.0.attribution"]);
  assert.deepEqual(issues(story({ quotes: [q("Words.", "y".repeat(161))] })), ["quotes.0.attribution"]);
  assert.deepEqual(issues(story({ quotes: [{ ...q("Words."), consent: true }] })), ["quotes.0"], "nothing private rides along with a quote");
  assert.deepEqual(issues(story({ quotes: ["Just a string"] })), ["quotes.0"]);
});

test("impact: one to twelve plain lines, each distinct", () => {
  assert.deepEqual(issues(story({ impact: ["Children borrow books to read at home."] })), []);
  assert.deepEqual(issues(story({ impact: Array.from({ length: 12 }, (_, i) => `Line ${i}`) })), []);
  assert.deepEqual(issues(story({ impact: Array.from({ length: 13 }, (_, i) => `Line ${i}`) })), ["impact"]);
  assert.deepEqual(issues(story({ impact: [] })), ["impact"]);
  assert.deepEqual(issues(story({ impact: ["A line.", "A line."] })), ["impact.1"]);
  assert.deepEqual(issues(story({ impact: ["", "x".repeat(201)] })), ["impact.0", "impact.1"]);
  assert.deepEqual(issues(story({ impact: [{ value: "100", label: "People" }] })), ["impact.0"], "words, not a figure object");
});

test("the snapshot carries a story's quotes and impact; a news or blog post carrying either is refused", () => {
  const snapshot = (content: Record<string, unknown>) => ({ version: 1, schemaVersion: 1, generatedAt: "2026-10-07T10:00:00.000Z", organization: { id: "rbb" }, settings: fx.settings(), media: {}, content });
  const paths = (value: unknown) => {
    const r = PublishedSnapshot.safeParse(value);
    return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
  };
  const fields = { quotes: [{ text: "We read together now.", attribution: "A parent" }], impact: ["Children borrow books."] };
  assert.deepEqual(paths(snapshot({ stories: [story({ ...fields, imageId: undefined })] })), []);
  assert.deepEqual(paths(snapshot({ blogs: [{ ...fx.post(), imageId: undefined, ...fields }] })), ["content.blogs.0.quotes", "content.blogs.0.impact"]);
  assert.deepEqual(paths(snapshot({ news: [{ ...fx.post(), id: "n1", slug: "n1", type: "news", category: undefined, imageId: undefined, impact: ["A line."] }] })), ["content.news.0.impact"]);
});
