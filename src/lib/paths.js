/**
 * True when `pathname` is `to` itself or any page beneath it — how the
 * header decides a section is active. `/work/education` is within
 * `/work`; `/workshop` is not, which a bare `startsWith` would get wrong.
 */
export function isWithin(pathname, to) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

export default isWithin;
