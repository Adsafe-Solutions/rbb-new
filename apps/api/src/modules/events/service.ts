import { z } from "zod";
import { Event } from "@rbb/content-schema";
import type { ErrorDetail } from "../../errors.ts";
import type { CollectionConfig } from "../content/service.ts";
import { referenceProblems, type ReferenceTarget } from "../content/shared.ts";
import { isApproval } from "../content/workflow.ts";

/* Events — the content contract's Event.

   Times are what the event says, on its own calendar day: a date
   (YYYY-MM-DD), a start and optional end ("6:30 PM"), and the IANA time
   zone they are in. Nothing is converted or re-interpreted; the website
   shows them as written, naming the zone. The contract checks the zone is
   real (an IANA name the runtime knows, its older spellings included:
   "Asia/Kolkata" and "Asia/Calcutta"), the end is after the start, a
   timed schedule step falls within the event and in order, and a start a
   daylight-saving change skips in that zone is refused. The CMS
   additionally REQUIRES a time zone: it is never inferred from the
   browser, the server or the organization — the editor chooses it.
   (The website's own source events state none; they keep showing their
   times as written, and migrating them waits on RBB naming the zone.)

   Editable: title, slug, subtitle, summary, about (rich text), date, start,
   end, time zone, venue, address, map link, registration link, featured
   image (required), SEO; and (Milestone 4) the program area and the
   day's schedule.
     programId  a program's slug, checked at save like a story's; null (or
                cleared) = open to all
     schedule   up to 20 steps { time?, item }; cleared = no schedule */

const editable = Object.fromEntries(
  ["title", "slug", "subtitle", "summary", "about", "date", "startTime", "endTime", "timezone", "programId", "venue", "address", "mapUrl", "registrationUrl", "schedule", "imageId", "seo"].map((f) => [f, z.unknown()])
);

export const EVENT_COLLECTION: CollectionConfig<Event> = {
  kind: "event",
  contract: Event,
  fields: editable,
  required: ["title", "summary", "about", "date", "startTime", "timezone", "venue", "address", "imageId"],
  defaults: () => ({ programId: null, schedule: [] }),
  /* Required by the contract, so clearing one (null) sets its empty value. */
  cleared: { programId: null, schedule: [] },
  rules: (event) => {
    const problems: ErrorDetail[] = [];
    if (!event.timezone) problems.push({ path: "body.timezone", message: "is required" });
    return problems;
  },
  media: (event) => [
    ["body.imageId", event.imageId],
    ["body.seo.ogImageId", event.seo?.ogImageId],
  ],
  opaque: ["about"],
};

/* The collection with its program reference checked against this
   organization's programs (by slug). Archiving is never blocked. */
export const eventCollection = (refs: { programs: ReferenceTarget }): CollectionConfig<Event> => ({
  ...EVENT_COLLECTION,
  async check(event) {
    if (event.status === "archived" || !event.programId) return [];
    return referenceProblems(refs.programs, [event.programId], { path: "body.programId", noun: "program", by: "slug", publishing: isApproval(event.status) });
  },
});
