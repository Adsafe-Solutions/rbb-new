/* The website's OWN remaining records → content-contract records
   (packages/content-schema). BUILD-TIME ONLY: the conformance check
   (src/contract/conformance.js) runs these on every build.

   2026-10-13: everything the CMS publishes is checked as published (the
   snapshot, against the contract — conformance.js); the website no longer
   keeps a built-in copy of it, so there is nothing of it to convert. What
   is left here is what the website still holds itself: its image registry
   (src/contract/media.js) and its transparency documents (none published
   from the CMS yet — content/transparency.js). */
import { ORG_ID } from "./org.js";
import { MEDIA_LIBRARY } from "./media.js";
import { TRANSPARENCY, publishedDocuments } from "../content/transparency.js";

/* Drops undefined fields: a record holds a value or no key at all. */
const compact = (object) => Object.fromEntries(Object.entries(object).filter(([, v]) => v !== undefined));

const envelope = (id, status = "published", releaseMarker) =>
  compact({ id, orgId: ORG_ID, schemaVersion: 1, status, releaseMarker });

export const mediaRecords = () =>
  Object.entries(MEDIA_LIBRARY).map(([id, image]) =>
    compact({ ...envelope(id), kind: "image", alt: image.alt, focal: image.focal })
  );

/* The website's transparency documents as Report records — the published
   ones with a file (none yet: content/transparency.js lists nothing
   without a real, approved file). */
export function reportRecords() {
  const lists = [["annualReport", TRANSPARENCY.annualReports], ["financial", TRANSPARENCY.financialDocuments], ["governance", TRANSPARENCY.governanceDocuments]];
  return lists.flatMap(([category, docs]) =>
    publishedDocuments(docs).map((d, i) => compact({ ...envelope(d.id), slug: d.id, category, title: d.title, year: d.year, type: d.type, fileUrl: d.fileUrl, order: i }))
  );
}
