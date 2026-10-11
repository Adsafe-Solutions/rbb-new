import { test } from "node:test";
import assert from "node:assert/strict";
import { latestLoads } from "../../src/content/latest.ts";
import { itemErrors, paragraphsError, referenceErrors } from "../../src/content/fieldErrors.ts";

/* M48: the content editor's load guard and the field errors it maps
   (projects and stories). The browser flows are in
   smoke-projects-stories.mjs. */

test("only the newest load is shown: an earlier reply answering late is dropped", async () => {
  const loads = latestLoads();
  const shown = [];
  /* A load as useContentEditor runs it: take a ticket, wait, apply only if current. */
  const load = async (record, delay) => {
    const current = loads.begin();
    await new Promise((r) => setTimeout(r, delay));
    if (current()) shown.push(record);
  };
  /* React's development double effect: two loads, the first answering last. */
  await Promise.all([load("first (late)", 30), load("second", 5)]);
  assert.deepEqual(shown, ["second"]);
});

test("a revision shown by a save or workflow step retires every load still on its way", async () => {
  const loads = latestLoads();
  const current = loads.begin();
  loads.supersede();
  assert.equal(current(), false, "the older load no longer applies");
  const next = loads.begin();
  assert.equal(next(), true, "a load started afterwards does");
});

test("paragraph errors: the field's own and every paragraph's, numbered from 1", () => {
  assert.equal(paragraphsError(new Map(), "context"), undefined);
  assert.equal(paragraphsError(new Map([["context", "is required"]]), "context"), "is required");
  assert.equal(paragraphsError(new Map([["context.1", "must not be empty"]]), "context"), "Paragraph 2: must not be empty");
  assert.equal(
    paragraphsError(new Map([["context.3", "must be plain text, not HTML"], ["context.0", "must not be empty"], ["approach.1", "x"], ["contextual", "y"]]), "context"),
    "Paragraph 1: must not be empty Paragraph 4: must be plain text, not HTML"
  );
  assert.deepEqual([...itemErrors(new Map([["context.10", "a"], ["context.x", "b"], ["context.1.2", "c"]]), "context")], [[10, "a"]]);
});

test("related-story errors go to the story they are about; anything else stays with the field", () => {
  const chosen = ["s-one", "s-two", "s-three"];
  const archived = 'refers to story "s-two", which is archived';
  const unapproved = 'refers to story "s-three", which is not approved yet — approve it first';
  const { field, byId } = referenceErrors(new Map([["relatedPostIds", `${archived}\n${unapproved}`], ["relatedPostIds.0", "must be an id"]]), "relatedPostIds", chosen);
  assert.equal(field, undefined);
  assert.deepEqual(Object.fromEntries(byId), { "s-one": "must be an id", "s-two": archived, "s-three": unapproved });

  const other = referenceErrors(new Map([["relatedPostIds", "names the story itself\nrefers to story \"gone\", which does not exist in this organization"], ["relatedPostIds.7", "must be an id"]]), "relatedPostIds", chosen);
  assert.equal(other.byId.size, 0);
  assert.equal(other.field, 'names the story itself refers to story "gone", which does not exist in this organization Item 8: must be an id');
  assert.deepEqual(referenceErrors(new Map(), "relatedPostIds", chosen), { field: undefined, byId: new Map() });
});
