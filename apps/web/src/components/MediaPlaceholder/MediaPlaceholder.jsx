import { cx } from "../../lib/cx.js";
import Mark from "../Mark/Mark.jsx";

/* Where a photograph will go once RBB supplies one. A Light Gray panel
   with the mark, pale, in its corner — it holds the frame's shape so the
   layout reads as designed, and it is plainly not a picture of anything,
   which is the point: a stock photograph here would imply a project or a
   person that does not exist.

   Decorative: the card around it carries the text that says content is
   to come. */
export default function MediaPlaceholder({ className = "" }) {
  return (
    <div aria-hidden="true" className={cx("relative overflow-hidden bg-mist", className)}>
      <Mark className="absolute -bottom-[18%] -right-[12%] aspect-square h-auto w-[70%] text-trust-blue opacity-[0.08]" />
    </div>
  );
}
