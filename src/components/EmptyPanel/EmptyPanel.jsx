import { cx } from "../../lib/cx.js";
import Button from "../Button/Button.jsx";
import Mark from "../Mark/Mark.jsx";
import OffsetCard from "../OffsetCard/OffsetCard.jsx";

/* An empty state that looks deliberate: a sheet pinned up with one
   sentence on it saying what is still to come, the mark bled off its
   corner, and optionally a way on to something that does exist.
   Document 05's pattern — a pending section is a state of the product,
   not a failure, and should not look broken.

   The dashed rule inside the border is the "to be filled in" line of a
   printed form: it says pending before a word is read.

   `surface` is accepted for the pages that pass it; the card takes its
   shadow from whatever band it is on. */
export default function EmptyPanel({ text, cta, className = "" }) {
  return (
    <OffsetCard cast="md" pad="none" className={cx("overflow-hidden", className)}>
      <div className="relative m-2 flex flex-col gap-6 rounded-xl border-2 border-dashed border-hair p-6 sm:p-8 md:flex-row md:items-center md:justify-between md:p-10">
        <Mark className="pointer-events-none absolute -bottom-10 -right-10 h-48 w-48 text-fg opacity-[0.06]" />
        <p className="type-lead relative max-w-xl text-quiet">{text}</p>
        {cta && (
          <Button variant="outline" to={cta.to} className="relative self-start md:self-auto">
            {cta.label}
          </Button>
        )}
      </div>
    </OffsetCard>
  );
}
