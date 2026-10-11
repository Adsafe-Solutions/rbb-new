/* Does the site's content meet the content contract? BUILD-TIME ONLY —
   content/validate.js runs this on every production build and in
   `npm run validate:content`, and an error stops the build, so content
   that would not survive the move to the CMS cannot ship unnoticed.

   For every record (the appeal records as authored, everything else
   through src/contract/importers.js) it checks that the record:
     1. is plain JSON — it survives JSON.stringify → JSON.parse unchanged
        (no functions, imports, undefined values, dates or class instances)
     2. passes its packages/content-schema schema
     3. points only at things that exist: media ids in the media registry,
        metric ids at metric records, related posts at posts

   Messages name the collection, the record id and the field path, never
   the content itself. Imports zod (through @rbb/content-schema), so it
   must never be imported by anything that ships to the browser. */
import { isDeepStrictEqual } from "node:util";
import {
  About,
  Announcement,
  Careers,
  Appeal,
  Event,
  GeneralDonationPage,
  Homepage,
  Impact,
  Media,
  Metric,
  Popup,
  Post,
  Program,
  Project,
  Report,
  SiteSettings,
  TeamMember,
  Transparency,
} from "@rbb/content-schema";
import { APPEAL_RECORDS } from "../content/appeals.js";
/* Images published through the CMS snapshot are media too (server build only). */
import PUBLISHED_SNAPSHOT from "virtual:rbb-published-snapshot";
import { MEDIA_LIBRARY } from "./media.js";
import {
  aboutRecord,
  careersRecord,
  announcementRecords,
  eventRecords,
  generalDonationRecord,
  homepageRecord,
  mediaRecords,
  metricRecords,
  impactRecord,
  transparencyRecord,
  reportRecords,
  popupRecord,
  postRecords,
  programRecords,
  projectRecords,
  siteSettingsRecord,
  teamRecords,
} from "./importers.js";

/* Fields that hold media ids, wherever they appear in a record. */
const MEDIA_FIELDS = new Set(["imageId", "insetId", "posterId", "ogImageId", "cardImageId", "logoId", "faviconId", "galleryIds", "imageIds"]);

export function contractConformance() {
  const errors = [];
  const counts = {};

  let collections, refs;
  try {
    const metrics = metricRecords();
    const posts = postRecords();
    collections = [
      ["appeals", Appeal, APPEAL_RECORDS],
      ["generalDonation", GeneralDonationPage, [generalDonationRecord()]],
      ["posts", Post, posts],
      ["events", Event, eventRecords()],
      ["announcements", Announcement, announcementRecords()],
      ["popups", Popup, [popupRecord()]],
      ["homepage", Homepage, [homepageRecord()]],
      ["about", About, [aboutRecord()]],
      ["team", TeamMember, teamRecords()],
      ["programs", Program, programRecords()],
      ["careers", Careers, [careersRecord()]],
      ["projects", Project, projectRecords()],
      ["metrics", Metric, metrics],
      ["impact", Impact, [impactRecord()]],
      ["transparency", Transparency, [transparencyRecord()]],
      ["reports", Report, reportRecords()],
      ["media", Media, mediaRecords()],
      ["siteSettings", SiteSettings, [siteSettingsRecord()]],
    ];
    refs = {
      metrics: new Set(metrics.map((m) => m.slug)),
      posts: new Set(posts.map((p) => p.id)),
    };
  } catch (error) {
    return { errors: [`contract: the current content could not be converted — ${error.message}`], counts };
  }

  for (const [name, schema, records] of collections) {
    counts[name] = records.length;
    for (const record of records) {
      const where = `contract:${name}[${record?.id ?? "?"}]`;

      let copy;
      try {
        copy = JSON.parse(JSON.stringify(record));
      } catch (error) {
        errors.push(`${where}: is not JSON (${error.message})`);
        continue;
      }
      if (!isDeepStrictEqual(copy, record))
        errors.push(`${where}: changes when serialized — it holds a function, undefined value, date or class instance`);

      const result = schema.safeParse(record);
      if (!result.success)
        for (const issue of result.error.issues)
          errors.push(`${where}${issue.path.length ? `.${issue.path.join(".")}` : ""}: ${issue.message}`);

      references(record, where, refs, errors);
    }
  }

  return { errors, counts };
}

function references(value, path, refs, errors) {
  if (!value || typeof value !== "object") return;
  for (const [key, v] of Object.entries(value)) {
    const at = `${path}.${key}`;
    if (MEDIA_FIELDS.has(key)) {
      const ids = typeof v === "string" ? [v] : Array.isArray(v) ? v : Object.values(v ?? {});
      for (const id of ids) if (!MEDIA_LIBRARY[id] && !PUBLISHED_SNAPSHOT?.media?.[id]) errors.push(`${at}: no media with id "${id}"`);
    } else if (key === "metricIds") {
      for (const id of v) if (!refs.metrics.has(id)) errors.push(`${at}: no metric with id "${id}"`);
    } else if (key === "relatedPostIds") {
      for (const id of v) if (!refs.posts.has(id)) errors.push(`${at}: no post with id "${id}"`);
    } else {
      references(v, at, refs, errors);
    }
  }
}
