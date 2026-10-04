import { Link } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import ArrowStamp from "../ArrowStamp/ArrowStamp.jsx";
import LineIcon from "../LineIcon/LineIcon.jsx";
import Mark from "../Mark/Mark.jsx";
import OffsetCard from "../OffsetCard/OffsetCard.jsx";

/* A box that asks for one thing: Donate. Volunteer. Partner. Fundraise.

   A set of these is one family in different inks — the same size, the
   same structure, the same corner mark, each on its own surface — so
   four asks read as four doors in one wall rather than four unrelated
   designs. `actionTone(i)` hands a set its tones in a fixed order; the
   first is always the accent, because the first is always the primary
   ask.

     title        the action, in display type
     body         one line on it
     to           where it goes
     icon         a LineIcon name
     label        the link's visible text ("Donate"); the heading is not
                  the link here, because "Donate" is a button's word
     tone         card | ink | accent

   The mark in the corner is oversized and bled off the edge, in the
   box's own ink at low strength. The whole box is the hit area: one
   link, stretched. */
/* One Deep Trust Blue box in four, not two: a row of mostly dark boxes
   read heavier than the band it sits on, and made the four paths look
   like a dashboard rather than four invitations. */
const TONES = ["accent", "card", "ink", "card"];
export const actionTone = (i) => TONES[i % TONES.length];

export default function ActionCard({ title, body, to, icon, label, tone = "card", headingAs: Heading = "h3", className = "" }) {
  return (
    <OffsetCard as="article" tone={tone} pad="lg" lift className={cx("group flex h-full flex-col overflow-hidden", className)}>
      <Mark className="pointer-events-none absolute -bottom-8 -right-8 h-40 w-40 -rotate-[8deg] text-fg opacity-[0.07]" />

      <div className="relative flex items-start justify-between gap-4">
        {icon && (
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-pop text-on-pop">
            <LineIcon name={icon} className="h-6 w-6" />
          </span>
        )}
        <ArrowStamp />
      </div>

      <Heading className="type-card relative mt-8">{title}</Heading>
      {body && <p className="relative mt-3 max-w-[40ch] text-copy">{body}</p>}

      <p className="relative mt-auto pt-8">
        <Link
          to={to}
          className="font-bold text-fg underline decoration-2 underline-offset-4 after:absolute after:inset-0 after:rounded-2xl group-hover:decoration-[3px]"
        >
          {label ?? title}
        </Link>
      </p>
    </OffsetCard>
  );
}
