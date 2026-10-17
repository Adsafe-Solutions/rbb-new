import { test } from "node:test";
import assert from "node:assert/strict";

/* The topbar's notifications (2026-10-13): the bell's number, the form
   breakdown and where each item links. */

const base = { submissions: null, publishing: null, canApprove: false, canPublish: false, checkedAt: "" };
const queue = (submitted, approved, failed = []) => ({ submitted: { total: submitted, items: [] }, approved: { total: approved, items: [] }, failedSchedules: failed });

test("the bell counts only what this person can act on", async () => {
  const { badgeCount } = await import("../../src/notifications/model.ts");
  assert.equal(badgeCount(null), 0);
  const owner = { ...base, canApprove: true, canPublish: true, submissions: { new: 3, byForm: {} }, publishing: queue(2, 4, [{ section: "Stories", title: "S", at: "" }]) };
  assert.equal(badgeCount(owner), 3 + 2 + 4 + 1);
  const editor = { ...base, publishing: queue(2, 4) };
  assert.equal(badgeCount(editor), 0, "editors see the queue but cannot approve or publish");
});

test("form breakdown in the usual order, career forms together; links per section", async () => {
  const { formBreakdown, sectionHref, itemLabel, plural } = await import("../../src/notifications/model.ts");
  assert.deepEqual(formBreakdown({ newsletter: 2, contact: 1, "career-a": 1, "career-b": 2 }), [["Contact Us", 1], ["Newsletter", 2], ["Careers", 3]]);
  assert.deepEqual(formBreakdown({ "event-b": 1, contact: 1, "event-a": 2 }), [["Contact Us", 1], ["Event registrations", 3]], "every event's registrations together");
  assert.equal(sectionHref("Stories"), "/stories");
  assert.equal(sectionHref("News and blogs"), "/posts");
  assert.equal(sectionHref("Privacy Policy"), "/policies");
  assert.equal(sectionHref("Volunteer page"), "/get-involved");
  assert.equal(sectionHref("Something new"), "/settings");
  assert.equal(itemLabel({ section: "Homepage", title: "Homepage" }), "Homepage");
  assert.equal(itemLabel({ section: "Stories", title: "A day" }), "Stories: A day");
  assert.equal(plural(1, "new submission"), "1 new submission");
  assert.equal(plural(3, "new submission"), "3 new submissions");
});
