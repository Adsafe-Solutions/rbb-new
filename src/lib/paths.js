/**
 * True when `pathname` is `to` itself or any page beneath it — how the
 * header decides a section is active. `/work/education` is within
 * `/work`; `/workshop` is not, which a bare `startsWith` would get wrong.
 */
export function isWithin(pathname, to) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

export default isWithin;

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
