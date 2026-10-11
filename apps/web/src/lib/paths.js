/**
 * True when `pathname` is `to` itself or any page beneath it — how the
 * header decides a section is active. `/work/education` is within
 * `/work`; `/workshop` is not, which a bare `startsWith` would get wrong.
 */
export function isWithin(pathname, to) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

/* True when `pathname` is anywhere in a menu entry's tree — its own
   address or any descendant's. A section's pages do not all live under
   its address: About Us holds Our Impact (/impact), and Media Center
   holds the stories directory (/stories). */
export function isInTree(pathname, entry) {
  return isWithin(pathname, entry.to) || (entry.children ?? []).some((child) => isInTree(pathname, child));
}

export default isWithin;

/* A path as the site writes its own addresses: no trailing slash, except
   the root itself. Static hosts serve a page's folder `index.html` at
   "/work/education/" too (Cloudflare Pages redirects to that form), so
   every lookup that matches a page by its address compares the
   normalised path — otherwise the pre-rendered page would hydrate into
   the error boundary. Anything that is not a string passes through. */
export const withoutTrailingSlash = (path) =>
  typeof path === "string" && path.length > 1 ? path.replace(/\/+$/, "") || "/" : path;

/* Where a menu entry goes: a page's own address, or — for a page that
   lives as a section of its parent (`section` in content/nav.js) — the
   section itself, so the menu never routes through a redirect. */
export const navTarget = (entry) => entry.section ?? entry.to;

/* Whether a menu entry is the reader's current place. A section entry
   ("/about#values") is current only on that section — matching the path
   alone would mark every About section current at once on /about, and
   `aria-current` would then say five things are "this page". */
export function isCurrentEntry({ pathname, hash }, entry) {
  if (entry.section) return `${pathname}${hash}` === entry.section;
  return pathname === entry.to;
}
