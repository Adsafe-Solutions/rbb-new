/* Media ids → the site's photographs. Content records point at images by
   id (packages/content-schema `MediaId`), never by import; this registry
   is what resolves an id today: to the same local photograph record
   content/photos.js already exports ({ src, alt, focal? }). When media
   moves to R2 the ids stay and only this resolver changes.

   Ids are derived from the photographs' names in content/photos.js —
   RBB_PHOTOS.kids is "rbb-kids", WORKING_PHOTOS.reliefPacking is
   "working-relief-packing" — so renaming one there renames its id. */
import { RBB_PHOTOS, TEAM_PORTRAITS, TEAM_PORTRAIT_ALT, WORKING_PHOTOS } from "../content/photos.js";

const kebab = (key) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

export const MEDIA_LIBRARY = Object.fromEntries([
  ...Object.entries(RBB_PHOTOS).map(([key, image]) => [`rbb-${kebab(key)}`, image]),
  ...Object.entries(WORKING_PHOTOS).map(([key, image]) => [`working-${kebab(key)}`, image]),
  /* The team's stock portraits are bare URLs in content/team.js. */
  ...TEAM_PORTRAITS.map((src, i) => [`team-portrait-${i + 1}`, { src, alt: TEAM_PORTRAIT_ALT }]),
]);

/* The photograph for an id. An unknown id is a broken reference, so it
   stops the build rather than drawing an empty image. */
export function mediaImage(id) {
  const image = MEDIA_LIBRARY[id];
  if (!image) throw new Error(`Unknown media id "${id}" (src/contract/media.js)`);
  return image;
}
