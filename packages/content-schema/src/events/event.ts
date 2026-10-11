import { z } from "zod";
import { recordFields } from "../common/record.ts";
import { IsoDate, MediaId, Slug, TimeOfDay, text } from "../common/primitives.ts";
import { HttpsUrl } from "../common/link.ts";
import { RichText } from "../richText/richText.ts";
import { SeoOverrides } from "../seo/seo.ts";

/* An event (/media/events/<slug>) — the fields content/media.js EVENTS
   carries today. Whether it is upcoming or past is worked out from `date`
   by the web, never stored.

   Times are written the way the site shows them ("6:30 PM"), on the
   event's own calendar date.

   FUTURE fields — no event records them today, the CMS will need them:
     timezone         IANA zone the times are in ("Europe/London")
     registrationUrl  where to register */
const IANA_ZONE = /^(UTC|[A-Za-z_]+(\/[A-Za-z0-9_+-]+)+)$/;

export const ScheduleItem = z.strictObject({
  time: TimeOfDay.optional(),
  item: text(200),
});

/* "6:30 PM" → minutes after midnight, for comparing times on one day. */
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
  timezone: z.string().regex(IANA_ZONE, "must be an IANA time zone").optional(),
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
  if (event.endTime && minutesOf(event.endTime) <= minutesOf(event.startTime))
    ctx.addIssue({ code: "custom", path: ["endTime"], message: "must be after the start time" });
});
export type Event = z.infer<typeof Event>;
