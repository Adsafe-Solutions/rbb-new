import { cx } from "../../lib/cx.js";
import Mark from "../Mark/Mark.jsx";
import OffsetCard from "../OffsetCard/OffsetCard.jsx";

/* A picture made of the brand itself, for a page hero with no approved
   photograph: the mark printed large in two passes, out of register, on a
   tilted Deep Trust Blue poster — Sky Blue first, white over it. It fills
   the space a photograph would and depicts nothing that has to be true.

   Decorative (`aria-hidden`). */
export default function BrandPanel({ className = "" }) {
  return (
    <div aria-hidden="true" className={cx("mx-auto w-full max-w-[12rem] sm:max-w-xs lg:max-w-md", className)}>
      <OffsetCard tone="ink" cast="lg" tilt="r-lg" pad="none" className="relative aspect-square overflow-hidden">
        <Mark className="absolute left-1/2 top-1/2 h-[58%] w-[58%] -translate-x-[46%] -translate-y-[46%] text-bumble-honey" />
        <Mark className="absolute left-1/2 top-1/2 h-[58%] w-[58%] -translate-x-1/2 -translate-y-1/2 text-paper-white" />
      </OffsetCard>
    </div>
  );
}
