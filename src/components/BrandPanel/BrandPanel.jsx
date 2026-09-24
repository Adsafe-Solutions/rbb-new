import { cx } from "../../lib/cx.js";
import Mark from "../Mark/Mark.jsx";

/* A picture made of the brand itself: the RBB mark, large and white, on a
   Deep Trust Blue panel with a Sky Blue quarter-circle behind it. For page
   heroes that have no approved photograph — it fills the same space a
   photograph would, and it depicts nothing that has to be true.

   Decorative (`aria-hidden`): it carries no information the heading next
   to it does not. */
export default function BrandPanel({ className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={cx(
        "relative aspect-[4/3] overflow-hidden rounded-3xl rounded-tr-[6rem] bg-trust-blue lg:aspect-square",
        className
      )}
    >
      <span className="absolute -bottom-1/4 -left-1/4 h-3/4 w-3/4 rounded-full bg-bumble-honey/25" />
      {/* Sized inline: Mark's default `h-8 w-8` would race a second size
          utility on the same element. */}
      <Mark
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-paper-white"
        style={{ width: "48%", height: "auto", aspectRatio: "1 / 1" }}
      />
    </div>
  );
}
