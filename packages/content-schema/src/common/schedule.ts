import { z } from "zod";

/* Scheduled publishing (M15). A schedule says WHEN an owner-approved
   revision joins a website publish. It is publishing metadata, kept beside
   a record — never part of a record, never in a published snapshot.

   Times are entered as a wall-clock time in an explicit IANA time zone
   ("2026-10-15T10:00" in "Asia/Kolkata") and stored as one UTC instant.
   The zone is never the browser's or the server's, and never an
   abbreviation ("IST", "EST"): those name different offsets in different
   places. A wall-clock time that does not exist in the zone (skipped by a
   daylight-saving change) or exists twice (repeated by one) is refused,
   never silently moved. */

/* An IANA zone name, as the runtime knows it: "Area/Location" (or UTC).
   Abbreviations and POSIX-style names ("EST", "PST8PDT") are refused. */
export const IANA_ZONE_NAME = /^(UTC|[A-Za-z_]+(\/[A-Za-z0-9_+-]+)+)$/;
export const isIanaTimeZone = (name: string): boolean => {
  if (!IANA_ZONE_NAME.test(name)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: name });
    return true;
  } catch {
    return false;
  }
};
export const IanaTimeZone = z.string().max(64).refine(isIanaTimeZone, "must be an IANA time zone, like Asia/Kolkata or America/Toronto");

/* A wall-clock date and time, to the minute: "2026-10-15T10:00". */
export const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
export const LocalDateTime = z.string().regex(LOCAL_DATE_TIME, "must be a date and time like 2026-10-15T10:00");

/* A UTC instant, as stored: "2026-10-15T04:30:00.000Z". */
export const UtcInstant = z.iso.datetime({ offset: false });

/* What an owner sends to schedule: the revision on screen, the local time
   and its zone. */
export const ScheduleRequest = z.strictObject({
  revision: z.int().positive(),
  localTime: LocalDateTime,
  timeZone: IanaTimeZone,
});
export type ScheduleRequest = z.infer<typeof ScheduleRequest>;

/* A schedule as stored beside a record (and shown to the admin, minus
   `fingerprint`). */
export const PublicationSchedule = z.strictObject({
  /* When: the UTC instant, and the zone it was chosen in (for display). */
  at: UtcInstant,
  timeZone: IanaTimeZone,
  /* The approved revision it was set on, and a fingerprint of that
     revision's content: the publish takes exactly that content or nothing. */
  revision: z.int().positive(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  by: z.strictObject({ id: z.string().min(1), name: z.string() }),
  createdAt: UtcInstant,
  /* Set when the publication it was due in was refused (paths only). */
  failedAt: UtcInstant.optional(),
  problems: z.array(z.string().max(300)).max(20).optional(),
});
export type PublicationSchedule = z.infer<typeof PublicationSchedule>;

/* The wall-clock fields of `instant` in `timeZone`. */
function wallClock(instant: number, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(instant))
      .map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/* The zone's offset from UTC (ms) at `instant`. */
const offsetAt = (instant: number, timeZone: string) => {
  const [date, time] = wallClock(instant, timeZone).split("T") as [string, string];
  const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
  const [h, mi] = time.split(":").map(Number) as [number, number];
  return Date.UTC(y, mo - 1, d, h, mi) - Math.floor(instant / 60_000) * 60_000;
};

export type ZonedConversion = { ok: true; instant: string } | { ok: false; reason: "invalid" | "nonexistent" | "ambiguous" };

/* "2026-10-15T10:00" in "Asia/Kolkata" → "2026-10-15T04:30:00.000Z".
   Every instant whose wall clock in the zone reads `localTime` is found
   (the zone's offsets around that day are tried); none means the time was
   skipped by a daylight-saving change, two means it happened twice. */
export function zonedTimeToInstant(localTime: string, timeZone: string): ZonedConversion {
  const m = LOCAL_DATE_TIME.exec(localTime);
  if (!m || !isIanaTimeZone(timeZone)) return { ok: false, reason: "invalid" };
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  const back = new Date(naive);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d || h > 23 || mi > 59) return { ok: false, reason: "invalid" };
  const offsets = new Set([-36, -12, 0, 12, 36].map((hours) => offsetAt(naive + hours * 3_600_000, timeZone)));
  const instants = [...new Set([...offsets].map((o) => naive - o))].filter((t) => wallClock(t, timeZone) === localTime).sort((a, b) => a - b);
  if (instants.length === 0) return { ok: false, reason: "nonexistent" };
  if (instants.length > 1) return { ok: false, reason: "ambiguous" };
  return { ok: true, instant: new Date(instants[0]!).toISOString() };
}

/* The reverse, for display: an instant as "2026-10-15T10:00" in the zone. */
export const instantToZonedTime = (instant: string, timeZone: string) => wallClock(Date.parse(instant), timeZone);
