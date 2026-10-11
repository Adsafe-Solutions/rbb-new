import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/* Milestone 8: the homepage and About block forms offer the fields the
   website now draws — and only those. */

const src = (path) => readFileSync(new URL(`../../src/${path}`, import.meta.url), "utf8");
/* One editor's form in the EDITORS table: from `type:` to the next `type:`. */
const form = (file, type) => {
  const text = src(file);
  const start = text.indexOf(`\n  ${type}: `);
  assert.ok(start >= 0, `${file}: ${type}`);
  const next = text.slice(start + 1).search(/\n  [a-zA-Z]+: /);
  return text.slice(start, next < 0 ? undefined : start + 1 + next);
};

test("homepage: programs and get involved take a line and a link; timeline and stories a line", () => {
  for (const type of ["programs", "getInvolved"]) {
    assert.match(form("homepage/BlockEditor.tsx", type), /<Body /, `${type}: a line`);
    assert.match(form("homepage/BlockEditor.tsx", type), /<Cta /, `${type}: a link`);
  }
  for (const type of ["timeline", "stories"]) assert.match(form("homepage/BlockEditor.tsx", type), /<Body /, `${type}: a line`);
  assert.doesNotMatch(form("homepage/BlockEditor.tsx", "getInvolved"), /imageIds/, "the ways in stay icon boxes: no photographs offered");
  assert.doesNotMatch(form("homepage/BlockEditor.tsx", "cta"), /cardImageId|imageId/, "the closing band draws no photograph: none offered");
  assert.match(form("homepage/BlockEditor.tsx", "approach"), /<HeadingFields /, "approach: its highlight, with its heading");
  const appealList = src("homepage/BlockEditor.tsx").match(/function AppealListEditor[\s\S]*?\n}\n/)[0];
  assert.match(appealList, /<HeadingFields /, "appealList: its highlight, with its heading");
});

test("About: a statement's link, mission and vision's highlight, the values' intro", () => {
  assert.match(form("about/BlockEditor.tsx", "statement"), /<Cta /);
  assert.match(form("about/BlockEditor.tsx", "missionVision"), /label="Highlight"/);
  assert.match(form("about/BlockEditor.tsx", "numberedCards"), /label="Introduction"[^\n]*max=\{400\}/);
  assert.match(form("about/BlockEditor.tsx", "approach"), /<HeadingFields /, "the approach's highlight, with its heading");
});
