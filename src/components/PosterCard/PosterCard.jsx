import { cx } from "../../lib/cx.js";
import Mark from "../Mark/Mark.jsx";
import OffsetCard from "../OffsetCard/OffsetCard.jsx";

/* A poster: a block of solid colour with a statement on it and the mark
   bled off its corner. The largest object in the card family — one
   message, set big, on Deep Trust Blue or Sky Blue.

   Used where a page has something to SAY rather than something to list:
   a mission, a vision, a pending notice that should look intended.

     kicker    small capitals over the statement
     tone      ink | accent | card
     children  the statement and anything under it

   The feature shadow (`lg`), and by default no tilt: a poster this size
   on a slant fights the page. */
export default function PosterCard({ kicker, tone = "ink", tilt, as = "div", className = "", children, ...rest }) {
  return (
    <OffsetCard as={as} tone={tone} cast="lg" tilt={tilt} pad="lg" className={cx("h-full overflow-hidden", className)} {...rest}>
      <Mark className="pointer-events-none absolute -bottom-12 -right-10 h-56 w-56 rotate-[8deg] text-fg opacity-[0.08]" />
      <div className="relative">
        {kicker && <p className="type-meta mb-5 text-fg">{kicker}</p>}
        {children}
      </div>
    </OffsetCard>
  );
}
