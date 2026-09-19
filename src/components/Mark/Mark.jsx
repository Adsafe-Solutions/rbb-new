import { cx } from "../../lib/cx.js";
import { MARK_PATHS, MARK_VIEWBOX } from "./markPaths.js";

/* The Rising Beyond Borders mark, drawn whole.

   Inline rather than an <img> so it inherits `currentColor` — the same
   file serves the Sky Blue mark on white and the white mark on Deep Trust
   Blue without a second export — and so it stays crisp at the decorative
   sizes the hero and footer use it at.

   Geometry lives in markPaths.js; LogoFrame draws the same paths through
   a mask. */
export default function Mark({ className = "", ...rest }) {
  return (
    <svg
      viewBox={MARK_VIEWBOX}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={cx("h-8 w-8", className)}
      {...rest}
    >
      {MARK_PATHS.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
