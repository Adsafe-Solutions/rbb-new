/* Does the site's content meet the content contract? BUILD-TIME ONLY —
   content/validate.js runs this on every production build and in
   `npm run validate:content`, and an error stops the build.

   2026-10-13: the CMS is the only source of its content. The snapshot a
   build applies is checked whole against the contract by the pre-render
   (entry-server.jsx publishedSnapshotInfo) — here it is only counted.
   What is checked here is what the website still holds itself
   (src/contract/importers.js): its image registry and its transparency
   documents — each plain JSON, valid, and pointing only at media that
   exists (in the registry or the snapshot).

   Messages name the collection, the record id and the field path, never
   the content itself. Imports zod (through @rbb/content-schema), so it
   must never be imported by anything that ships to the browser. */
import { isDeepStrictEqual } from "node:util";
import { Media, Report } from "@rbb/content-schema";
/* The snapshot this build applied (server build only), or null. */
import PUBLISHED_SNAPSHOT from "virtual:rbb-published-snapshot";
import { MEDIA_LIBRARY } from "./media.js";
import { mediaRecords, reportRecords } from "./importers.js";

/* Fields that hold media ids, wherever they appear in a record. */
const MEDIA_FIELDS = new Set(["imageId", "insetId", "posterId", "ogImageId", "cardImageId", "logoId", "faviconId", "galleryIds", "imageIds"]);

export function contractConformance() {
  const errors = [];
  const counts = {};

  if (PUBLISHED_SNAPSHOT) {
    for (const [name, value] of Object.entries(PUBLISHED_SNAPSHOT.content ?? {})) counts[name] = Array.isArray(value) ? value.length : value ? 1 : 0;
    counts.media = Object.keys(PUBLISHED_SNAPSHOT.media ?? {}).length;
  }

  let collections;
  try {
    collections = [
      ["reports", Report, reportRecords()],
      ["siteImages", Media, mediaRecords()],
    ];
  } catch (error) {
    return { errors: [...errors, `contract: the website's own records could not be converted — ${error.message}`], counts };
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

      references(record, where, errors);
    }
  }

  return { errors, counts };
}

function references(value, path, errors) {
  if (!value || typeof value !== "object") return;
  for (const [key, v] of Object.entries(value)) {
    const at = `${path}.${key}`;
    if (MEDIA_FIELDS.has(key)) {
      const ids = typeof v === "string" ? [v] : Array.isArray(v) ? v : Object.values(v ?? {});
      for (const id of ids) if (!MEDIA_LIBRARY[id] && !PUBLISHED_SNAPSHOT?.media?.[id]) errors.push(`${at}: no media with id "${id}"`);
    } else {
      references(v, at, errors);
    }
  }
}
