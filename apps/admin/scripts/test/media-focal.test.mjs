import { test } from "node:test";
import assert from "node:assert/strict";
import { focalAt, focalDraft, focalFromDraft } from "../../src/media/focal.ts";
import { isFocalPoint } from "../../../../packages/content-schema/src/index.ts";

/* Milestone 2: the media library's focal-point editor — two numbers, or a
   click on the preview; empty is centred; nothing set automatically. */

test("a stored focal point → the two numbers; centred or unreadable → empty", () => {
  assert.deepEqual(focalDraft("72% 45%"), { x: "72", y: "45" });
  assert.deepEqual(focalDraft("0% 100%"), { x: "0", y: "100" });
  for (const none of [null, undefined, "", "150% 20%", "50%", "left top"]) assert.deepEqual(focalDraft(none), { x: "", y: "" }, String(none));
});

test("the numbers → what is saved: both empty is centred (null); both whole 0–100 is a focal point", () => {
  assert.deepEqual(focalFromDraft({ x: "", y: "" }), { value: null });
  assert.deepEqual(focalFromDraft({ x: " ", y: "" }), { value: null });
  assert.deepEqual(focalFromDraft({ x: "0", y: "100" }), { value: "0% 100%" });
  assert.deepEqual(focalFromDraft({ x: "50", y: "40" }), { value: "50% 40%" });
  assert.deepEqual(focalFromDraft({ x: "007", y: "5" }), { value: "7% 5%" });
  for (const value of [focalFromDraft({ x: "0", y: "100" }), focalFromDraft({ x: "50", y: "40" })]) assert.ok(isFocalPoint(value.value), "what the API accepts");
});

test("half-filled, out-of-range or non-whole numbers are refused with a reason, never saved", () => {
  assert.match(focalFromDraft({ x: "50", y: "" }).problem, /both positions/);
  assert.match(focalFromDraft({ x: "", y: "40" }).problem, /both positions/);
  for (const [x, y] of [["101", "50"], ["50", "-1"], ["50.5", "40"], ["1e2", "4"], ["abc", "4"]]) assert.match(focalFromDraft({ x, y }).problem, /whole number from 0 to 100/, `${x} ${y}`);
});

test("a click on the preview → the point there, in whole percentages, clamped to the image", () => {
  const box = { left: 100, top: 50, width: 400, height: 200 };
  assert.deepEqual(focalAt({ x: 100, y: 50 }, box), { x: "0", y: "0" });
  assert.deepEqual(focalAt({ x: 500, y: 250 }, box), { x: "100", y: "100" });
  assert.deepEqual(focalAt({ x: 300, y: 150 }, box), { x: "50", y: "50" });
  assert.deepEqual(focalAt({ x: 99, y: 300 }, box), { x: "0", y: "100" }, "a click just outside is clamped");
});
