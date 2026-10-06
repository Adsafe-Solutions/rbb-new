/**
 * Joins class names, dropping anything falsy. Lets a component write
 * `cx("base", open && "open-classes")` without leaving stray spaces or the
 * string "false" in the DOM.
 */
export function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

export default cx;
