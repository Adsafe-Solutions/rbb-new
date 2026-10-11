import { test } from "node:test";
import assert from "node:assert/strict";
import { STARTING_EXCLUDES, changedParts, draftOf, newKey, payloadOf, popupProblems } from "../../src/popups/rules.ts";
import { Popup, popupCmsProblems } from "../../../../packages/content-schema/src/index.ts";

/* M22: the popup editor's rules. The API enforces all of them; these
   must never offer what it would refuse, and write no wording. */

const envelope = { id: "site-popup", orgId: "rbb", schemaVersion: 1, status: "draft" };
const saved = { key: "popup-a", kicker: "K", heading: "A heading to read.", highlight: "read.", body: "A line.", imageId: "img-1", cta: { label: "Go", href: "/appeals" }, dismissLabel: "Later", delayMs: 4000, frequency: "once", excludePaths: ["/contact"] };

test("a new popup: the site's current behaviour as settings, no words", () => {
  const d = draftOf(null);
  assert.match(d.key, /^popup-\d{4}-\d{2}-\d{2}-[a-z0-9]+$/);
  assert.deepEqual([d.heading, d.body, d.ctaLabel, d.dismissLabel, d.kicker, d.imageId], ["", "", "", "", "", ""]);
  assert.deepEqual([d.delaySeconds, d.frequency, d.excludeText.split("\n")], [6, "session", STARTING_EXCLUDES]);
  assert.notEqual(newKey(), newKey());
});

test("a saved popup round-trips unchanged; what the editor sends is what the contract and the website accept", () => {
  const d = draftOf(saved);
  assert.deepEqual(payloadOf(d), saved);
  assert.deepEqual(changedParts(payloadOf(d), saved), {});
  assert.deepEqual(changedParts(payloadOf({ ...d, kicker: " ", highlight: "" }), saved), { kicker: null, highlight: null });
  const record = { ...envelope, ...payloadOf(d) };
  assert.ok(Popup.safeParse(record).success);
  assert.deepEqual(popupCmsProblems(record), []);
  assert.deepEqual(payloadOf({ ...d, excludeText: "/contact\n\n /privacy \n/contact" }).excludePaths, ["/contact", "/privacy"]);
});

test("problems before saving match the contract and the website's rules", () => {
  assert.equal(popupProblems(draftOf(saved)).size, 0);
  const bad = { ...draftOf(saved), key: "Not A Key", heading: "", highlight: "absent", body: "", imageId: "", ctaLabel: "", ctaHref: "https://partner.test", dismissLabel: "", delaySeconds: 61, excludeText: "contact" };
  assert.deepEqual([...popupProblems(bad).keys()].sort(), ["body", "cta.href", "cta.label", "delayMs", "dismissLabel", "excludePaths", "heading", "highlight", "imageId", "key"].sort());
});
