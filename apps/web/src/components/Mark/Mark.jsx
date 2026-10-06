import { cx } from "../../lib/cx.js";
import { MARK_SYMBOL_ID, MARK_VIEWBOX } from "./markPaths.js";

/* The Rising Beyond Borders mark, drawn whole.

   Inline SVG rather than an <img> so it inherits `currentColor` — one
   piece of artwork serves the Sky Blue mark on white, the white mark on
   a Deep Trust Blue band and every faint watermark in between, without
   a second file — and so it stays crisp at the decorative sizes the
   bands use it at.

   A <use> rather than the paths themselves: the geometry lives in one
   <symbol> that MarkSprite puts in the document once (markPaths.js says
   why that matters).

   ⚠ The 32px default applies ONLY when the caller gives no size. `cx`
   concatenates, and two size utilities on one element resolve by the
   order Tailwind emits them, not the order they are written — so a
   default left in place silently beat any smaller size asked for. */
const SIZED = /(^|\s)(h|w|size)-/;

export default function Mark({ className = "", ...rest }) {
  return (
    <svg
      viewBox={MARK_VIEWBOX}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={cx(!SIZED.test(className) && "h-8 w-8", className)}
      {...rest}
    >
      <use href={`#${MARK_SYMBOL_ID}`} />
    </svg>
  );
}
