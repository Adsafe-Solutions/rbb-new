import { test } from "node:test";
import assert from "node:assert/strict";
import { actionsFor, badgeOf, explain, formatSchedule, isLocked, isReady, readinessWord } from "../../src/content/workflowRules.ts";

/* The editorial workflow as the admin offers it (M14): which moves each
   member sees in each state, the badges, and what may be named. The API
   enforces all of it; these must never offer a move it would refuse. */

const moves = (status, canEdit, canApprove) => actionsFor(status, canEdit, canApprove).map((a) => a.action);

test("editors: submit a draft, withdraw a submission — never approve or reject", () => {
  assert.deepEqual(moves("draft", true, false), ["submit"]);
  assert.deepEqual(moves("submitted", true, false), ["withdraw"]);
  assert.deepEqual(moves("approved", true, false), []);
  assert.deepEqual(moves("published", true, false), []);
  assert.deepEqual(moves("archived", true, false), []);
  for (const status of ["draft", "submitted", "approved", "published", "archived"])
    assert.ok(!moves(status, true, false).some((a) => a === "approve" || a === "reject"), status);
});

test("owners: approve or return a submission; return an approval; nothing from published or archived", () => {
  assert.deepEqual(moves("draft", true, true), ["submit"]);
  assert.deepEqual(moves("submitted", true, true), ["approve", "reject"]);
  assert.deepEqual(moves("approved", true, true), ["reject"]);
  assert.deepEqual(moves("published", true, true), []);
  assert.deepEqual(moves("archived", true, true), []);
  assert.deepEqual(moves("draft", false, false), [], "a member who cannot edit sees no moves");
});

test("badges: the five states, and a live version with changes pending", () => {
  assert.deepEqual(badgeOf("draft"), { status: "draft" });
  assert.deepEqual(badgeOf("submitted"), { status: "submitted" });
  assert.deepEqual(badgeOf("approved"), { status: "approved" });
  assert.deepEqual(badgeOf("published", true), { status: "published" });
  assert.deepEqual(badgeOf("archived", false), { status: "archived" });
  assert.deepEqual(badgeOf("draft", true), { status: "published", label: "Published · changes pending approval" });
  assert.deepEqual(badgeOf("submitted", true), { status: "published", label: "Published · changes pending approval" });
  assert.deepEqual(badgeOf("approved", true), { status: "published", label: "Published · changes approved" });
  assert.deepEqual(badgeOf(undefined), { status: "draft" });
});

test("locked while under review or archived; ready once approved, published or live", () => {
  assert.deepEqual(["draft", "submitted", "approved", "published", "archived"].map(isLocked), [false, true, false, false, true]);
  assert.deepEqual(["draft", "submitted", "approved", "published", "archived"].map((s) => isReady(s)), [false, false, true, true, false]);
  assert.equal(isReady("draft", true), true, "its published version is on the website");
  assert.equal(isReady("archived", true), false);
  assert.deepEqual([readinessWord("draft", true), readinessWord("submitted"), readinessWord("missing"), readinessWord("approved")], ["published", "needs review", "not found", "approved"]);
});

test("the explanation says what the website shows", () => {
  assert.match(explain("draft", true, "story", false), /website shows the last published version/);
  assert.match(explain("submitted", false, "story", false), /withdraw it/);
  assert.match(explain("submitted", false, "story", true), /Approve it/);
  assert.match(explain("approved", true, "story", true), /next publishes the website.*keeps showing the last published version/);
  assert.match(explain("published", true, "story", false), /this exact version is published/);
});

/* ---------------- M15: scheduled publication ---------------- */
const scheduled = { at: "2026-10-15T04:30:00.000Z", timeZone: "Asia/Kolkata", revision: 5, by: { name: "Owner" }, createdAt: "2026-10-08T00:00:00.000Z" };
const failed = { ...scheduled, failedAt: "2026-10-15T04:31:00.000Z", problems: ["content.stories.x.imageId"] };
const owned = (status, schedule = null) => actionsFor(status, true, true, { canPublish: true, schedule }).map((a) => a.action);

test("owners: an approved revision can be published now, scheduled, or returned; a scheduled one unscheduled; a failed one rescheduled", () => {
  assert.deepEqual(owned("approved"), ["publish", "schedule", "reject"]);
  assert.deepEqual(owned("approved", scheduled), ["unschedule", "reject"]);
  assert.deepEqual(owned("approved", failed), ["schedule", "unschedule", "reject"]);
  for (const status of ["draft", "submitted", "published", "archived"]) assert.ok(!owned(status).some((a) => ["publish", "schedule", "unschedule"].includes(a)), `${status}: never scheduled`);
});

test("editors never see Publish now, Schedule or Unschedule", () => {
  for (const schedule of [null, scheduled, failed])
    assert.deepEqual(actionsFor("approved", true, false, { canPublish: false, schedule }).map((a) => a.action), [], "approved: nothing for an editor");
});

test("Scheduled is its own badge — never Published — and says when, in the schedule's own zone", () => {
  assert.deepEqual(badgeOf("approved", false, scheduled), { status: "scheduled", label: "Scheduled" });
  assert.deepEqual(badgeOf("approved", true, scheduled), { status: "scheduled", label: "Published · changes scheduled" });
  assert.deepEqual(badgeOf("approved", false, failed), { status: "warning", label: "Schedule failed" });
  assert.deepEqual(badgeOf("approved", false, null), { status: "approved" }, "approved, not scheduled");
  assert.equal(formatSchedule(scheduled.at, scheduled.timeZone), "Oct 15, 2026 · 10:00 AM Asia/Kolkata");
  assert.equal(formatSchedule(scheduled.at, "America/Toronto"), "Oct 15, 2026 · 12:30 AM America/Toronto");
  assert.match(explain("approved", false, "story", true, scheduled), /queued for the website publication on Oct 15, 2026 · 10:00 AM Asia\/Kolkata\. It is not public before then\./);
  assert.match(explain("approved", true, "story", true, failed), /was refused — nothing changed on the website.*keeps showing the last published version/);
});

test("templates (team): no review moves, only an owner's unmark from a draft; the badge and the words say template", () => {
  const t = { template: true };
  assert.deepEqual(actionsFor("draft", true, true, t).map((a) => a.action), ["unmark"]);
  assert.deepEqual(actionsFor("draft", true, false, t), [], "an editor cannot unmark");
  assert.deepEqual(actionsFor("submitted", true, true, t), []);
  assert.deepEqual(actionsFor("approved", true, true, { ...t, canPublish: true }), [], "never publish, schedule, approve");
  assert.deepEqual(badgeOf("draft", false, null, true), { status: "draft", label: "Template" });
  assert.deepEqual(badgeOf("draft", false, null, false), { status: "draft" }, "unchanged without the flag");
  assert.match(explain("draft", false, "team member", true, null, true), /A template — a role, not a person/);
  assert.match(explain("draft", false, "team member", false, null, true), /An owner can unmark it/);
  assert.deepEqual(actionsFor("draft", true, true), [{ action: "submit", label: "Submit for review", primary: true }], "ordinary members are unchanged");
});
