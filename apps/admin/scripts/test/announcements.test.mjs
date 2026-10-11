import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_LINK_LABEL, MAX_MESSAGES, MAX_TEXT, draftOf, emptyMessage, intervalProblem, isSitePath, messageProblems, payloadOf, secondsOf } from "../../src/announcements/rules.ts";
import { AnnouncementBar, SiteSettings } from "../../../../packages/content-schema/src/index.ts";

/* M21: the announcement bar editor's rules. The API enforces all of them;
   these must never offer what it would refuse. Test data only. */

const bar = (items) => ({ id: "announcement-bar", orgId: "rbb", schemaVersion: 1, status: "draft", items });

test("a saved bar round-trips unchanged; what the editor sends is what the contract accepts", () => {
  const items = [{ id: "m-1", text: "First." }, { id: "m-2", text: "Second.", link: { label: "See events", href: "/media/events" } }];
  assert.deepEqual(payloadOf(draftOf(items)), items);
  assert.ok(AnnouncementBar.safeParse(bar(payloadOf(draftOf(items)))).success);
  assert.deepEqual(payloadOf([{ ...draftOf(items)[1], linkOn: false }]), [{ id: "m-2", text: "Second." }], "turning the link off drops it");
  assert.deepEqual(draftOf(undefined), [], "a new bar is empty");
});

test("new messages get unique ids the contract accepts; limits match the contract", () => {
  const a = emptyMessage(), b = emptyMessage();
  assert.notEqual(a.id, b.id);
  assert.ok(AnnouncementBar.safeParse(bar([{ id: a.id, text: "x" }])).success);
  assert.ok(!AnnouncementBar.safeParse(bar([{ id: a.id, text: "x".repeat(MAX_TEXT + 1) }])).success);
  assert.ok(!AnnouncementBar.safeParse(bar([{ id: a.id, text: "x", link: { label: "x".repeat(MAX_LINK_LABEL + 1), href: "/a" } }])).success);
  assert.ok(!AnnouncementBar.safeParse(bar(Array.from({ length: MAX_MESSAGES + 1 }, (_, i) => ({ id: `m${i}`, text: "x" })))).success);
});

test("problems before saving: an empty message, a link without text, a link that is not a page of this site", () => {
  assert.ok(isSitePath("/appeals") && isSitePath("/media/events") && !isSitePath("https://x.org") && !isSitePath("//x.org") && !isSitePath("/a?b") && !isSitePath("appeals"));
  const drafts = [
    { id: "a", text: " ", linkOn: false, label: "", href: "" },
    { id: "b", text: "Ok.", linkOn: true, label: "", href: "https://x.org" },
    { id: "c", text: "Ok.", linkOn: true, label: "Go", href: "/appeals" },
  ];
  assert.deepEqual([...messageProblems(drafts).keys()], ["items.0.text", "items.1.link.label", "items.1.link.href"]);
});

test("the display interval matches the settings contract (2–30 s)", () => {
  assert.equal(secondsOf(5000), 5);
  assert.equal(intervalProblem(2), null);
  assert.equal(intervalProblem(30), null);
  for (const bad of [1, 31, 2.5, Number.NaN]) assert.ok(intervalProblem(bad), String(bad));
  const shape = SiteSettings.shape.engagement.shape.announcementBar;
  assert.ok(shape.safeParse({ enabled: true, intervalMs: 2000 }).success && shape.safeParse({ enabled: true, intervalMs: 30000 }).success);
  assert.ok(!shape.safeParse({ enabled: true, intervalMs: 31000 }).success);
});
