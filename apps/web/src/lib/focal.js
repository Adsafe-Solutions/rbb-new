/* Milestone 2: an image's focal point — the point to keep in frame when a
   layout crops it. "X% Y%", whole percentages 0–100, horizontal then
   vertical: CSS `object-position`, as content/photos.js writes it and as
   the CMS stores it (packages/content-schema FocalPoint — mirrored here
   because that module does not ship to the browser;
   scripts/test/image-framing.test.mjs keeps the two in step). Anything
   else — absent, empty or malformed — is no focal point: the image stays
   centred, exactly as before. */
const FOCAL_POINT = /^(\d{1,3})% (\d{1,3})%$/;

export function focalPosition(focal) {
  const m = typeof focal === "string" ? FOCAL_POINT.exec(focal) : null;
  return m && Number(m[1]) <= 100 && Number(m[2]) <= 100 ? focal : undefined;
}

/* The focal point a CARD uses: a media-library image's (one set in the
   CMS, for every place the image is drawn). The website's own
   photographs keep today's card crop — their focal points
   (content/photos.js) were written for the editorial frames
   (EditorialImage), which still use them; applying them to cards would
   re-crop existing pages. */
export const cardFocal = (image) => (image?.mediaId ? image.focal : undefined);
