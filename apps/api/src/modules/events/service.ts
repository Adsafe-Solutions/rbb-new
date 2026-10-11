import { z } from "zod";
import { Event } from "@rbb/content-schema";
import type { ErrorDetail } from "../../errors.ts";
import type { CollectionConfig } from "../content/service.ts";

/* Events — the content contract's Event.

   Times are what the event says, on its own calendar day: a date
   (YYYY-MM-DD), a start and optional end ("6:30 PM"), and the IANA time
   zone they are in. Nothing is converted or re-interpreted; the website
   shows them in that zone. The contract checks the end is after the start;
   the CMS additionally REQUIRES a real time zone (source-controlled events
   predate the field).

   Editable: title, slug, subtitle, summary, about (rich text), date, start,
   end, time zone, venue, address, map link, registration link, featured
   image (required), SEO. Program and schedule are not edited yet: a new
   event is open to all with no schedule; existing values are kept. */

const ZONES = new Set([...Intl.supportedValuesOf("timeZone"), "UTC"]);

const editable = Object.fromEntries(
  ["title", "slug", "subtitle", "summary", "about", "date", "startTime", "endTime", "timezone", "venue", "address", "mapUrl", "registrationUrl", "imageId", "seo"].map((f) => [f, z.unknown()])
);

export const EVENT_COLLECTION: CollectionConfig<Event> = {
  kind: "event",
  contract: Event,
  fields: editable,
  required: ["title", "summary", "about", "date", "startTime", "timezone", "venue", "address", "imageId"],
  defaults: () => ({ programId: null, schedule: [] }),
  rules: (event) => {
    const problems: ErrorDetail[] = [];
    if (!event.timezone) problems.push({ path: "body.timezone", message: "is required" });
    else if (!ZONES.has(event.timezone)) problems.push({ path: "body.timezone", message: "must be a real time zone, like Europe/London" });
    return problems;
  },
  media: (event) => [
    ["body.imageId", event.imageId],
    ["body.seo.ogImageId", event.seo?.ogImageId],
  ],
  opaque: ["about"],
};
