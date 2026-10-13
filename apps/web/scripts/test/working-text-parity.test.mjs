import { test } from "node:test";
import assert from "node:assert/strict";
import { PLACEHOLDER_CONTACT, WORKING_MARKERS, WORKING_PHOTOGRAPH, workingContentFindings } from "../../src/lib/releaseMarkers.js";
import { WORKING_TEXT_RULES, workingTextFindings } from "../../../../packages/content-schema/src/common/workingText.ts";

/* M20: the content contract refuses working-placeholder text when a CMS
   record is saved, with a COPY of this site's rules (it cannot import
   them: releaseMarkers.js ships in the bundle). The two must not drift. */

const rule = ([name, re]) => `${name} ${re}`;

test("the content contract's working-text rules are exactly this site's", () => {
  const site = [...WORKING_MARKERS, ...PLACEHOLDER_CONTACT, ["working placeholder photograph", WORKING_PHOTOGRAPH]].map(rule);
  assert.deepEqual(WORKING_TEXT_RULES.map(rule), site);
});

test("both find the same things", () => {
  for (const text of ["Demo — x", "Sample story", "write to hello@example.org", "name@example.com", "img/demo-field.jpg", "A real paragraph.", "Call +1 555 0123", "Processed by [RBB to confirm: the payment provider].", "[TBC]", "A [bracketed] aside."])
    assert.deepEqual(workingTextFindings(text), workingContentFindings(text), text);
});

test("bracketed confirmation placeholders are not working text — they never block (decision, 2026-10-13)", () => {
  for (const text of ["Processed by [RBB to confirm: the payment provider].", "Refunds within [TBC] days.", "[To be confirmed]", "[TODO: date]"]) {
    assert.deepEqual(workingTextFindings(text), [], text);
    assert.deepEqual(workingContentFindings(text), [], text);
  }
});
