import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/* The homepage Timeline block's Program (homepage/BlockEditor.tsx): one of
   this organization's programs, chosen from a list — never a free-text
   box, where typing the program's NAME ("Health & Wellbeing") instead of
   its address was accepted by the box and refused later. */

const source = readFileSync(new URL("../../src/homepage/BlockEditor.tsx", import.meta.url), "utf8");
const timeline = source.slice(source.indexOf("timeline: ({"), source.indexOf("timeline: ({") + 4000);

test("the timeline's Program is the program picker, required, bound to the milestone's programId", () => {
  assert.match(source, /import \{ ProgramSelect \} from "\.\.\/content\/pickers";/);
  assert.match(timeline, /<ProgramSelect label="Program" required value=\{item\.programId \|\| undefined\}/);
  assert.match(timeline, /setItem\(\{ \.\.\.item, programId: programId \?\? "" \}\)/);
  assert.match(timeline, /error=\{err\(`items\.\$\{i\}\.programId`\)\}/);
});

test("no free-text Program box is left in the timeline", () => {
  assert.doesNotMatch(timeline, /<TextField label="Program"/);
});

test("the picker keeps a stored value it does not know, and falls back to typing when no program is managed", () => {
  const pickers = readFileSync(new URL("../../src/content/pickers.tsx", import.meta.url), "utf8");
  assert.match(pickers, /not found/, "an unknown stored program is shown as such, not silently dropped");
  assert.match(pickers, /No \$\{noun\}s are managed here yet/, "no programs yet: the address is typed, as before");
});
