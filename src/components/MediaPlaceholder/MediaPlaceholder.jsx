import { cx } from "../../lib/cx.js";
import Mark from "../Mark/Mark.jsx";

/* Where a photograph will go once RBB supplies one. A Light Gray frame
   with the mark, pale, in its corner — it holds the card's shape so the
   layout reads as designed, and it is plainly not a picture of anything,
   which is the point: a stock photograph here would imply a project or a
   person that does not exist.

   Decorative: the card around it carries the text that says content is
   to come. */
export default function MediaPlaceholder({ className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={cx("relative overflow-hidden bg-mist", className)}
    >
      {/* Sized inline: Mark carries a default `h-8 w-8`, and a second
          height utility on the same element wins or loses by the order
          Tailwind emits them, not by which is written last. */}
      <Mark
        className="absolute -bottom-[18%] -right-[12%] text-bumble-honey/15"
        style={{ width: "70%", height: "auto", aspectRatio: "1 / 1" }}
      />
    </div>
  );
}
