/* The site's routes that are NOT pages of the sitemap — shared by the
   router (App.jsx), the build's pre-renderer (entry-server.jsx,
   scripts/prerender.mjs) and the host redirect manifest (Document 15), so
   there is one list of them, not three.

   The sitemap's own pages come from content/nav.js (PAGES). */
import { PAGES } from "../content/nav.js";

/* The URLs these pages had before the sitemap. Kept so bookmarks, search
   results and anything already shared still land somewhere — `replace`,
   so the old URL does not sit in the history and bounce Back forward
   again. */
export const REDIRECTS = {
  "/about-us": "/about",
  "/contact-us": "/contact",
  "/blogs": "/stories",
  "/volunteer": "/get-involved/volunteer",
  /* Donation moved under Get Involved (Document 06). One donation page;
     the old address forwards to it rather than competing with it. */
  "/donate": "/get-involved/donate",
  "/fundraise": "/get-involved/fundraise",
  /* Reports are what Transparency & Financials will publish. */
  "/reports": "/about/transparency",
};

/* Older addresses with no page — RETIRED (Document 19).

   Document 01 kept twenty paths from the site this one replaced (its
   emergency appeals, Zakat sub-pages, gift catalogue, app and membership
   pages) as "content to be provided" stubs, because links still pointed at
   them. By Document 19 nothing on the site links to any of them, and since
   Document 15 each would be published as a real page headed with another
   charity's appeal — "Gaza emergency", "Sponsor an orphan", "Build a well"
   — implying RBB runs it. None is RBB's, so none is routed: those
   addresses now get the not-found page (noindex), like any unknown URL.
   They are deliberately NOT redirected — sending an appeal's address to
   Donate would imply the appeal.

   To give one of these addresses a real page, RBB supplies its content and
   it becomes a page in content/nav.js; to keep an old address working for
   a page that exists, add it to REDIRECTS above. */
export const STUB_PATHS = [];

/* Pages built before the sitemap. Outside the navigation, still linked
   from across the site, kept at their own addresses (Document 11). */
export const LEGACY_PATHS = [
  "/giving",
  "/giving/zakat",
  "/gifts",
  "/giving/major-giving",
];

/* Careers, at the address the site has always used (Document 08). */
export const CAREERS_PATH = "/about-us/careers";

/* Every permanent redirect, alias → final canonical target, in one list:
   the old addresses above, and each sitemap page that lives as a section
   of its parent (`section` in content/nav.js — /about/values →
   /about#values). Each target is FINAL: no redirect points at another
   redirect, which `redirectMap` checks. */
export function redirectMap() {
  const map = [
    ...Object.entries(REDIRECTS).map(([from, to]) => ({ from, to })),
    ...PAGES.filter((p) => p.section).map((p) => ({ from: p.to, to: p.section })),
  ];
  const sources = new Set(map.map((r) => r.from));
  for (const r of map) {
    if (sources.has(r.to.split("#")[0]))
      throw new Error(`Redirect chain: ${r.from} → ${r.to}`);
  }
  return map;
}
