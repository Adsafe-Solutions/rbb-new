import { cx } from "../../lib/cx.js";
import Mark from "../Mark/Mark.jsx";

/* The chapter marker over a heading: the mark, a number, the section's
   name — "01 / Our work" — in small tracked capitals.

   It is what makes a page read as an edited sequence rather than a stack
   of boxes: the numbers say there is an order and that you are somewhere
   in it. `index` is the section's position on its page (1-based) and is
   optional; without it the kicker is the mark and the name.

   The mark is the bullet. It takes the accent on every surface except
   Sky Blue, where the accent IS the ground and it takes the ink instead
   (`text-pop` resolves to Night there).

   A <p>, not a heading: it labels the heading under it and must not
   appear in the document outline. */
export default function SectionKicker({ index, children, className = "", ...rest }) {
  return (
    <p className={cx("type-meta flex items-center gap-2.5 text-fg", className)} {...rest}>
      <Mark className="h-5 w-5 shrink-0 text-pop" />
      {index != null && (
        <>
          <span>{String(index).padStart(2, "0")}</span>
          <span aria-hidden="true" className="text-quiet">
            /
          </span>
        </>
      )}
      <span>{children}</span>
    </p>
  );
}
