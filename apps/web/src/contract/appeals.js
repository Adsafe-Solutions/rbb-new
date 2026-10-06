/* Appeal record → the appeal VIEW MODEL the site's components already
   read. The records (content/appeals.js APPEAL_RECORDS) follow the
   content contract (packages/content-schema `Appeal`): serializable data,
   images by id, sections as typed blocks. Everything downstream — the
   Appeals menu, the routes, AppealGrid, StoryStrip, `appealDonation` and
   DonationExperience — keeps receiving the shape it always has:

     { id, kind, title, status, releaseMarker, summary, image, sections, story? }

   The translation:
     slug            → id        (the URL segment and the gift's context)
     kind "campaign" → "campaigns"   (the list page's id and address)
     imageId         → image     (content/photos.js record, via media ids)
     statement       → { id, heading, body }
     numberedCards   → { id, heading, items: [title] }
     highlight       → story     ({ label?, image? }, the story circles)
   Disabled sections are left out. A block type the appeal page cannot
   draw yet stops the build — it is never silently dropped. */
import { mediaImage } from "./media.js";

const VIEW_KIND = { emergency: "emergency", campaign: "campaigns" };

function sectionView(section) {
  const { id, type, data } = section;
  if (type === "statement") return { id, heading: data.heading, body: data.body };
  if (type === "numberedCards") return { id, heading: data.heading, items: data.items.map((item) => item.title) };
  throw new Error(`Appeal section "${id}": the appeal page cannot draw a "${type}" section yet (src/contract/appeals.js)`);
}

function storyView(highlight) {
  return {
    ...(highlight.label && { label: highlight.label }),
    ...(highlight.imageId && { image: mediaImage(highlight.imageId) }),
  };
}

export function appealView(record) {
  return {
    id: record.slug,
    kind: VIEW_KIND[record.kind],
    title: record.title,
    status: record.status,
    releaseMarker: record.releaseMarker,
    summary: record.summary,
    image: mediaImage(record.imageId),
    sections: record.sections.filter((section) => section.enabled).map(sectionView),
    ...(record.highlight && { story: storyView(record.highlight) }),
  };
}
