import { cx } from "../../lib/cx.js";
import MarkStamp from "../Mark/MarkStamp.jsx";
import OffsetCard from "../OffsetCard/OffsetCard.jsx";

/* A ticket: a tilted card with a stamped head, rows divided by a dashed
   "tear" line, and a foot under a solid rule. For a short set of facts
   that belong together and should look like something you could be
   handed — the documents a donor would check, the facts of a project.

     kicker  the small-capitals line at the head, beside the mark
     rows    the ticket's content, already rendered; a dashed rule is
             drawn between each
     foot    the last line, under the solid rule

   The dashed rules are decoration; the rows are a list. */
export default function TicketCard({ kicker, rows = [], foot, tilt = "r-lg", className = "", children }) {
  return (
    <OffsetCard cast="lg" tilt={tilt} pad="none" className={cx("overflow-hidden", className)}>
      <div className="flex items-center gap-3 border-b-2 border-[var(--tone-rim)] px-6 py-4 md:px-7">
        <MarkStamp className="h-8 w-8" />
        {kicker && <p className="type-meta text-fg">{kicker}</p>}
      </div>
      {rows.length > 0 && (
        <ul className="px-6 md:px-7">
          {rows.map((row, i) => (
            <li key={i} className={cx("py-5", i > 0 && "border-t-2 border-dashed border-hair")}>
              {row}
            </li>
          ))}
        </ul>
      )}
      {children}
      {foot && <div className="border-t-2 border-[var(--tone-rim)] px-6 py-4 md:px-7">{foot}</div>}
    </OffsetCard>
  );
}
