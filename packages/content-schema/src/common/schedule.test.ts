import { test } from "node:test";
import assert from "node:assert/strict";
import { PublicationSchedule, ScheduleRequest, instantToZonedTime, isIanaTimeZone, zonedTimeToInstant } from "../index.ts";

/* Scheduled publishing (M15): explicit IANA zones, one UTC instant, and no
   silent conversion of a time a daylight-saving change skips or repeats. */

test("zones: IANA names only — never abbreviations, POSIX names or offsets", () => {
  for (const z of ["Asia/Kolkata", "America/Toronto", "America/New_York", "Europe/London", "UTC", "America/Argentina/Buenos_Aires"]) assert.ok(isIanaTimeZone(z), z);
  for (const z of ["IST", "EST", "PST8PDT", "GMT+5", "+05:30", "Asia/Nowhere", "", "asia kolkata"]) assert.ok(!isIanaTimeZone(z), z);
});

test("wall time → UTC instant, both sides of the world", () => {
  assert.deepEqual(zonedTimeToInstant("2026-10-15T10:00", "Asia/Kolkata"), { ok: true, instant: "2026-10-15T04:30:00.000Z" });
  assert.deepEqual(zonedTimeToInstant("2026-10-15T10:00", "America/Toronto"), { ok: true, instant: "2026-10-15T14:00:00.000Z" });
  assert.deepEqual(zonedTimeToInstant("2026-01-15T10:00", "America/Toronto"), { ok: true, instant: "2026-01-15T15:00:00.000Z" }, "standard time");
  assert.deepEqual(zonedTimeToInstant("2026-12-31T23:59", "UTC"), { ok: true, instant: "2026-12-31T23:59:00.000Z" });
  assert.equal(instantToZonedTime("2026-10-15T04:30:00.000Z", "Asia/Kolkata"), "2026-10-15T10:00");
});

test("daylight saving: a skipped time and a repeated time are refused, not moved", () => {
  // America/New_York, 8 March 2026: 02:00 → 03:00; 1 November 2026: 02:00 → 01:00.
  assert.deepEqual(zonedTimeToInstant("2026-03-08T02:30", "America/New_York"), { ok: false, reason: "nonexistent" });
  assert.deepEqual(zonedTimeToInstant("2026-11-01T01:30", "America/New_York"), { ok: false, reason: "ambiguous" });
  assert.deepEqual(zonedTimeToInstant("2026-11-01T00:59", "America/New_York"), { ok: true, instant: "2026-11-01T04:59:00.000Z" });
  assert.deepEqual(zonedTimeToInstant("2026-11-01T02:00", "America/New_York"), { ok: true, instant: "2026-11-01T07:00:00.000Z" });
  assert.deepEqual(zonedTimeToInstant("2026-03-08T03:00", "America/New_York"), { ok: true, instant: "2026-03-08T07:00:00.000Z" });
  // Europe/London, 29 March 2026: 01:00 → 02:00.
  assert.deepEqual(zonedTimeToInstant("2026-03-29T01:15", "Europe/London"), { ok: false, reason: "nonexistent" });
});

test("invalid input: impossible dates, malformed times, unknown zones", () => {
  for (const [t, z] of [["2026-02-30T10:00", "UTC"], ["2026-10-15T24:00", "UTC"], ["2026-10-15 10:00", "UTC"], ["2026-10-15T10:00", "IST"], ["2026-10-15T10:00:00", "UTC"]] as const)
    assert.deepEqual(zonedTimeToInstant(t, z), { ok: false, reason: "invalid" }, `${t} ${z}`);
});

test("contract: a schedule request and a stored schedule", () => {
  assert.ok(ScheduleRequest.safeParse({ revision: 3, localTime: "2026-10-15T10:00", timeZone: "Asia/Kolkata" }).success);
  assert.ok(!ScheduleRequest.safeParse({ revision: 3, localTime: "2026-10-15T10:00", timeZone: "IST" }).success);
  assert.ok(!ScheduleRequest.safeParse({ revision: 3, localTime: "2026-10-15T10:00", timeZone: "UTC", at: "x" }).success, "strict");
  const schedule = { at: "2026-10-15T04:30:00.000Z", timeZone: "Asia/Kolkata", revision: 4, fingerprint: "a".repeat(64), by: { id: "u1", name: "Owner" }, createdAt: "2026-10-08T00:00:00.000Z" };
  assert.ok(PublicationSchedule.safeParse(schedule).success);
  assert.ok(!PublicationSchedule.safeParse({ ...schedule, at: "2026-10-15T10:00:00+05:30" }).success, "stored instants are UTC");
  assert.ok(!PublicationSchedule.safeParse({ ...schedule, status: "scheduled" }).success, "strict");
});
