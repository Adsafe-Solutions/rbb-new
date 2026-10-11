import { createHash } from "node:crypto";
import { ScheduleRequest, zonedTimeToInstant, type PublicationSchedule } from "@rbb/content-schema";
import { z } from "zod";
import { ApiError, errors } from "../../errors.ts";
import { can } from "../auth/permissions.ts";
import type { AuthContext } from "../auth/types.ts";

/* Scheduled publishing (M15) — the rules every content service shares.

   A schedule says WHEN an owner-APPROVED revision joins a website publish.
   It is never a way round approval: only an approved record is scheduled
   (409 otherwise), by an owner (publish:execute — scheduling is deciding
   when the website changes), with the revision on screen (409 if stale),
   after the same full validation as approval. It is stored beside the
   record (content-schema PublicationSchedule) and dropped by any write that
   leaves the record not approved — an edit, a return to draft, an archive —
   so a schedule always stands on exactly the approved content it was set
   on: its `fingerprint` is that content's, and the publish checks it.

   The time arrives as a wall-clock time in an explicit IANA zone and is
   stored as one UTC instant (content-schema zonedTimeToInstant): a time a
   daylight-saving change skips or repeats is refused, never moved. */

export const SCHEDULE_PERMISSION = "publish:execute" as const;
/* How far ahead a publication may be scheduled. */
export const MAX_AHEAD_DAYS = 366;

/* Canonical JSON (sorted keys) — the same rule the publish hashes with. */
export const canonical = (value: unknown): string =>
  Array.isArray(value)
    ? `[${value.map(canonical).join(",")}]`
    : value && typeof value === "object"
      ? `{${Object.keys(value as object).sort().map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(",")}}`
      : JSON.stringify(value);

/* The content a schedule stands on: the record without what changes when it
   is published (status, publishedAt) or saved without an edit (updatedAt),
   or its position in an ordered collection (moving it changes no content;
   the publish takes the current order, as it always has). */
export function fingerprintOf(record: object): string {
  const { status: _s, publishedAt: _p, updatedAt: _u, order: _o, ...content } = record as Record<string, unknown>;
  return createHash("sha256").update(canonical(content)).digest("hex");
}

export const UNSCHEDULE = z.strictObject({ revision: z.int().positive() });

export function requireScheduler(auth: AuthContext) {
  if (!can(auth, SCHEDULE_PERMISSION)) throw errors.forbidden("Only an owner can schedule website publication.");
}

const REASONS = {
  invalid: "is not a real date and time",
  nonexistent: "does not exist in this time zone — the clocks skip it (daylight saving); choose another time",
  ambiguous: "happens twice in this time zone — the clocks repeat it (daylight saving); choose another time",
} as const;

/* A schedule request → { revision, at (UTC), timeZone }, or a 400 naming the field. */
export function parseScheduleRequest(input: unknown, now: Date): { revision: number; at: string; timeZone: string } {
  const parsed = ScheduleRequest.safeParse(input);
  if (!parsed.success) throw errors.validation(parsed.error.issues.map((i) => ({ path: ["body", ...i.path.map(String)].join("."), message: i.message })));
  const { revision, localTime, timeZone } = parsed.data;
  const converted = zonedTimeToInstant(localTime, timeZone);
  if (!converted.ok) throw errors.validation([{ path: "body.localTime", message: REASONS[converted.reason] }]);
  const at = Date.parse(converted.instant);
  if (at <= now.getTime()) throw errors.validation([{ path: "body.localTime", message: "must be in the future" }]);
  if (at > now.getTime() + MAX_AHEAD_DAYS * 86_400_000) throw errors.validation([{ path: "body.localTime", message: `must be within ${MAX_AHEAD_DAYS} days` }]);
  return { revision, at: converted.instant, timeZone };
}

/* Only an approved revision is scheduled (and unscheduled). */
export const notApproved = (noun: string, status: string) =>
  new ApiError("CONFLICT", `This ${noun} is ${status === "submitted" ? "submitted for review" : status}: only an approved ${noun} can be scheduled.`, { details: [{ path: "body.action", message: `schedule is not possible from ${status}` }] });
export const notScheduled = (noun: string) => new ApiError("CONFLICT", `This ${noun} is not scheduled.`, { details: [{ path: "body.action", message: "unschedule is not possible: no schedule" }] });

export function newSchedule({ at, timeZone }: { at: string; timeZone: string }, record: object, revision: number, auth: AuthContext, now: Date): PublicationSchedule {
  return { at, timeZone, revision, fingerprint: fingerprintOf(record), by: { id: auth.user.id, name: auth.user.name }, createdAt: now.toISOString() };
}

/* What the admin sees of a schedule (no fingerprint, no member id). */
export type ScheduleView = Omit<PublicationSchedule, "fingerprint" | "by"> & { by: { name: string } };
export const scheduleView = (schedule: PublicationSchedule | null | undefined): ScheduleView | null =>
  schedule ? { at: schedule.at, timeZone: schedule.timeZone, revision: schedule.revision, by: { name: schedule.by.name }, createdAt: schedule.createdAt, ...(schedule.failedAt && { failedAt: schedule.failedAt, problems: schedule.problems ?? [] }) } : null;

/* Why a schedule was dropped by a write that left the record not approved. */
export const droppedBecause = (status: string) => (status === "archived" ? "archived" : "edited");
