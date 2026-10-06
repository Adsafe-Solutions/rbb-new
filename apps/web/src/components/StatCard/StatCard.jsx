import { cx } from "../../lib/cx.js";
import OffsetCard from "../OffsetCard/OffsetCard.jsx";

/* One figure, made the biggest thing in its section: the number in the
   poster scale on a block of the accent, its label in small capitals,
   and — whenever the figure is not yet confirmed — its status in words.

     value    the figure, exactly as the content file gives it ("50K+")
     label    what it counts
     note     a line under the label
     status   the content's verification status. "verified" / "approved"
              are the only two that mean RBB has confirmed the figure.
     pending  the words shown for any other status

   ⚠ THE STATUS IS PART OF THE CARD, NOT A FOOTNOTE. A number this large
   reads as a fact. Until RBB confirms it, the card says so on its face,
   in text (never colour alone) — and it does not count up: `data-count`
   (animations/counters.js) is a flourish that says "this is final", and
   is only passed for a confirmed figure.

   `tone` is the card's own surface (card | ink | accent): the headline
   figure of a set goes on a different ink from the rest. */
const CONFIRMED = new Set(["verified", "approved"]);

export default function StatCard({ value, label, note, status, pending, tone = "card", tilt, className = "" }) {
  const confirmed = CONFIRMED.has(status);

  return (
    <OffsetCard tone={tone} tilt={tilt} pad="md" className={cx("flex h-full flex-col", className)}>
      <p className="type-meta text-fg">{label}</p>
      <p className="mt-5">
        <span data-count={confirmed ? "" : undefined} className="hl type-figure">
          {value}
        </span>
      </p>
      {note && <p className="mt-5 text-quiet">{note}</p>}
      {!confirmed && pending && (
        <p className="type-meta mt-auto border-t-2 border-dashed border-hair pt-4 text-quiet [&:not(:first-child)]:mt-6">
          {pending}
        </p>
      )}
    </OffsetCard>
  );
}
