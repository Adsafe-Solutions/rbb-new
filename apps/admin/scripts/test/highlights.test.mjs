import { test } from "node:test";
import assert from "node:assert/strict";
import { STRIP_LIMIT, circleLabel, draftOf, notReady, payloadOf, stripProblems } from "../../src/highlights/rules.ts";
import { STORY_STRIP_LIMIT, StoryStrip } from "../../../../packages/content-schema/src/index.ts";

/* M23: the Highlights editor's rules. The API enforces all of them; these
   must never offer what it would refuse. Test data only. */

const options = [
  { id: "a", title: "Appeal A", status: "published", live: true, circleLabel: "Short A" },
  { id: "b", title: "Appeal B", status: "draft", live: false },
  { id: "c", title: "Appeal C", status: "draft", live: true },
];

test("the editor's limit is the website's and the contract's", () => {
  assert.equal(STRIP_LIMIT, STORY_STRIP_LIMIT);
});

test("a saved strip round-trips; what the editor sends is what the contract accepts", () => {
  assert.deepEqual(payloadOf(draftOf(["b", "a"])), ["b", "a"]);
  assert.deepEqual(draftOf(undefined), []);
  assert.ok(StoryStrip.safeParse({ id: "story-strip", orgId: "rbb", schemaVersion: 1, status: "draft", appealIds: payloadOf(draftOf(["b", "a"])) }).success);
});

test("problems before saving: an empty circle, an appeal twice, a missing appeal, too many", () => {
  assert.equal(stripProblems(draftOf(["a", "b"]), options).size, 0);
  assert.deepEqual([...stripProblems([{ appealId: "" }, { appealId: "a" }, { appealId: "a" }, { appealId: "gone" }], options).keys()], ["appealIds.0", "appealIds.2", "appealIds.3"]);
  assert.ok(stripProblems(draftOf(["a", "b", "c", "a", "b"]), options).has("appealIds"));
});

test("what a circle reads, and which chosen appeals still need approval", () => {
  assert.equal(circleLabel(options[0]), "Short A");
  assert.equal(circleLabel(options[1]), "Appeal B");
  assert.deepEqual(notReady(draftOf(["a", "b", "c"]), options).map((o) => o.id), ["b"], "a draft edit of a live appeal is still live");
});
