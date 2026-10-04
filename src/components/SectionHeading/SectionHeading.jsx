import { cx } from "../../lib/cx.js";
import DisplayHeading from "../DisplayHeading/DisplayHeading.jsx";
import SectionKicker from "../SectionKicker/SectionKicker.jsx";

/* The heading block a section opens with: the chapter kicker, the <h2>
   in display type, and an optional intro line.

     index      the section's number on its page — "02 / Our work"
     highlight  put the heading's last word on the accent block
                (`true`, or a number of words). Use it on the headings
                that carry the page, not on every one.
     size       title (default) | billboard | card

   Colour comes from the band it is in (`data-tone`), so there is no tone
   prop any more; `tone` is accepted and ignored for the pages that still
   pass it.

   ---------------- Motion ----------------

   THE heading reveal for the site, so no section duplicates it: the
   block is a `sequence` (src/animations/reveals.js) — kicker, heading,
   intro, a hundred milliseconds apart, in the order the eye reads them.

   ⚠ Callers must NOT add `.reveal` here: that hides the container whose
   whole job is to stay visible while the three things inside it arrive. */
export default function SectionHeading({
  id,
  index,
  kicker,
  heading,
  intro,
  align = "left",
  highlight = false,
  size = "title",
  as = "h2",
  className = "",
}) {
  const centred = align === "center";

  return (
    <div data-anim="sequence" className={cx(centred && "mx-auto text-center", "max-w-4xl", className)}>
      {kicker && (
        <SectionKicker data-anim-item data-anim="soft" index={index} className={cx(centred && "justify-center")}>
          {kicker}
        </SectionKicker>
      )}
      <DisplayHeading data-anim-item as={as} id={id} size={size} highlight={highlight} className={cx(kicker && "mt-5")}>
        {heading}
      </DisplayHeading>
      {intro && (
        <p data-anim-item data-anim="soft" className={cx("type-lead mt-6 max-w-[54ch] text-copy", centred && "mx-auto")}>
          {intro}
        </p>
      )}
    </div>
  );
}
