import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { unlistedChoices, withoutChoice } from "../../src/blocks/pickerChoices.ts";

/* A record picker's chosen ids that are not in its list (blocks/
   pickerChoices.ts): the stale "Not found" references a page can carry
   — the Impact page still naming the website's own stories, say — must
   be visible and removable, or the website publish stays blocked. */

const records = [{ id: "story-a" }, { id: "story-b" }];

test("ids not in the list are found, in their chosen order, once each", () => {
  assert.deepEqual(unlistedChoices(["classroom-books", "story-a", "sewing"], records), ["classroom-books", "sewing"]);
  assert.deepEqual(unlistedChoices(["sewing", "sewing"], records), ["sewing"]);
  assert.deepEqual(unlistedChoices(["story-a", "story-b"], records), [], "listed ids are never reported");
  assert.deepEqual(unlistedChoices([], records), []);
  assert.deepEqual(unlistedChoices(["anything"], []), ["anything"], "an empty list: every choice is unlisted");
});

test("nothing is reported while the list is still loading", () => {
  assert.deepEqual(unlistedChoices(["classroom-books"], null), []);
});

test("removing one keeps every other choice, in its order", () => {
  assert.deepEqual(withoutChoice(["classroom-books", "story-a", "sewing"], "classroom-books"), ["story-a", "sewing"]);
  assert.deepEqual(withoutChoice(["story-a", "sewing", "story-b"], "sewing"), ["story-a", "story-b"]);
  assert.deepEqual(withoutChoice(["story-a"], "missing"), ["story-a"], "an id not chosen changes nothing");
});

test("the picker uses them: an unlisted id gets a Remove button that calls withoutChoice", () => {
  const source = readFileSync(new URL("../../src/blocks/fields.tsx", import.meta.url), "utf8");
  assert.match(source, /unlistedChoices\(value, records\)/);
  assert.match(source, /onChange\(withoutChoice\(value, id\)\)/);
  assert.match(source, />\s*Remove\s*</);
  assert.doesNotMatch(source, /title: "Not found"/, "no anonymous 'Not found' entries any more");
});
