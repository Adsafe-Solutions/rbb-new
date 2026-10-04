import { Link } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import ArrowStamp from "../ArrowStamp/ArrowStamp.jsx";
import LineIcon from "../LineIcon/LineIcon.jsx";
import MarkStamp from "../Mark/MarkStamp.jsx";
import OffsetCard from "../OffsetCard/OffsetCard.jsx";

/* A flyer: one idea on one piece of paper, pinned up a little crooked.
   The double-printed mark (or an icon tile) in the corner, a display
   heading, a line or two of text.

   FlyerCard is the object. FlyerLinkCard is the same object as a link —
   it gains the arrow stamp, straightens and lifts on hover, and its
   whole surface is the hit area.

   ONE LINK PER CARD (FlyerLinkCard). The link is the heading's own
   text, stretched over the card by its `after:` box: one Tab stop, named
   for where it goes ("Education"), and a screen reader's links list
   reads as a list of destinations rather than four "Learn more"s.
   `label` adds words to that name for assistive tech only ("Explore"),
   where the title alone would not say it is a way on.

   `number` prints a two-digit index in the corner instead of the mark —
   for a set that is a sequence (values, steps).

   ⚠ The card is tilted; reveal the element AROUND it (OffsetCard). */
function Body({ icon, number, meta, title, headingAs: Heading = "h3", children, linked, to, label, footer }) {
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        {number != null ? (
          <span className="hl type-card" aria-hidden="true">
            {String(number).padStart(2, "0")}
          </span>
        ) : icon ? (
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-pop text-on-pop">
            <LineIcon name={icon} className="h-6 w-6" />
          </span>
        ) : (
          <MarkStamp />
        )}
        {linked && <ArrowStamp />}
      </div>

      {meta && <p className="type-meta mt-6 text-quiet">{meta}</p>}

      <Heading className={cx("type-card", meta ? "mt-2" : "mt-6")}>
        {linked ? (
          <Link to={to} className="after:absolute after:inset-0 after:rounded-2xl">
            {label && <span className="sr-only">{label} </span>}
            {title}
          </Link>
        ) : (
          title
        )}
      </Heading>

      {children && <div className="mt-3 max-w-[42ch] text-quiet">{children}</div>}
      {footer}
    </>
  );
}

export default function FlyerCard({ tilt, className = "", as = "article", ...body }) {
  return (
    <OffsetCard as={as} tilt={tilt} className={cx("flex h-full flex-col", className)}>
      <Body {...body} />
    </OffsetCard>
  );
}

export function FlyerLinkCard({ tilt, className = "", as = "article", ...body }) {
  return (
    <OffsetCard as={as} tilt={tilt} lift className={cx("group flex h-full flex-col", className)}>
      <Body {...body} linked />
    </OffsetCard>
  );
}
