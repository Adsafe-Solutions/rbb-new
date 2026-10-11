import { z } from "zod";
import { recordFields } from "../common/record.ts";
import { IanaTimeZone, zonedTimeToInstant } from "../common/schedule.ts";
import { IsoDate, MediaId, Slug, TimeOfDay, text } from "../common/primitives.ts";
import { HttpsUrl } from "../common/link.ts";
import { RichText } from "../richText/richText.ts";
import { SeoOverrides } from "../seo/seo.ts";

/* An event (/media/events/<slug>) — the fields content/media.js EVENTS
   carries today. Whether it is upcoming or past is worked out from `date`
   by the web, never stored.

   Time-zone contract (Milestone 4). An event's date and times are its own
   WALL-CLOCK values, written the way the site shows them ("6:30 PM") on
   the event's own calendar date, and they are never converted: not to
   UTC, not to the reader's zone, not to the server's. `timezone` NAMES the
   IANA zone those times are in ("Europe/London") so the page can say so;
   it is never inferred from a machine, a server or a browser. A record
   without one states no zone (the website's own source events) and shows
   its times exactly as written. The CMS requires one on every event it
   saves (apps/api events/service.ts).

   With a zone, the start must be a time that happens there on that day: a
   start a daylight-saving change skips is refused, never moved. A start a
   change repeats (the hour that happens twice) is kept as written.

   A schedule is the day's running order: an optional time and a line per
   step. A timed step is within the event (not before the start, not after
   the end) and timed steps run in order; an untimed step sits between. */
export const ScheduleItem = z.strictObject({
  time: TimeOfDay.optional(),
  item: text(200),
});

/* "6:30 PM" → minutes after midnight, for comparing times on one day
   ("12:00 AM" is 0, "12:00 PM" is 720, "11:59 PM" is 1439). */
export const minutesOf = (time: string): number => {
  const m = /^(1[0-2]|[1-9]):([0-5]\d) (AM|PM)$/.exec(time);
  if (!m) return NaN;
  return ((Number(m[1]) % 12) + (m[3] === "PM" ? 12 : 0)) * 60 + Number(m[2]);
};

export const Event = z.strictObject({
  ...recordFields,
  slug: Slug,
  title: text(160),
  subtitle: text(200).optional(),
  summary: text(400),
  about: RichText,
  date: IsoDate,
  startTime: TimeOfDay,
  endTime: TimeOfDay.optional(),
  timezone: IanaTimeZone.optional(),
  /* The program area it belongs to, or null when it is open to all. */
  programId: Slug.nullable(),
  venue: text(160),
  address: text(300),
  mapUrl: HttpsUrl.optional(),
  registrationUrl: HttpsUrl.optional(),
  schedule: z.array(ScheduleItem).max(20),
  imageId: MediaId,
  seo: SeoOverrides.optional(),
}).superRefine((event, ctx) => {
  /* One calendar day, in the event's own time: an end must come after
     the start. Times are never converted — they are what the event says. */
  const start = minutesOf(event.startTime);
  const end = event.endTime ? minutesOf(event.endTime) : undefined;
  if (end !== undefined && end <= start) ctx.addIssue({ code: "custom", path: ["endTime"], message: "must be after the start time" });
  let previous = start;
  event.schedule.forEach((step, i) => {
    if (!step.time) return;
    const at = minutesOf(step.time);
    if (at < start) ctx.addIssue({ code: "custom", path: ["schedule", i, "time"], message: "must not be before the event starts" });
    else if (end !== undefined && at > end) ctx.addIssue({ code: "custom", path: ["schedule", i, "time"], message: "must not be after the event ends" });
    else if (at < previous) ctx.addIssue({ code: "custom", path: ["schedule", i, "time"], message: "must not be before the step above it" });
    previous = Math.max(previous, at);
  });
  if (event.timezone && Number.isFinite(start)) {
    const local = `${event.date}T${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;
    const converted = zonedTimeToInstant(local, event.timezone);
    if (!converted.ok && converted.reason === "nonexistent")
      ctx.addIssue({ code: "custom", path: ["startTime"], message: `does not happen in ${event.timezone} on ${event.date} (a daylight-saving change skips it)` });
  }
});
export type Event = z.infer<typeof Event>;
