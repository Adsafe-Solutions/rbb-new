import { cx } from "../../lib/cx.js";
import Mark from "./Mark.jsx";

/* The mark, printed twice a few pixels out of register — the way a
   two-colour screen print lands when the second pass is not quite on the
   first. It is how the mark appears ON an object: the corner of a flyer,
   the head of a ticket, a contact card.

   Two <Mark>s in one box. The back pass is the surface's shadow colour,
   the front its ink, so the stamp is right on a white card, on Deep
   Trust Blue and on Sky Blue without being told which it is on.

   The artwork is untouched — same proportions, same shape, twice. That
   is the rule for every use of the mark as decoration: it may be large,
   faint, repeated or cropped by an edge, but never stretched, redrawn or
   recoloured outside the palette.

   Decoration: `aria-hidden`, like Mark itself. `className` sizes the box. */
export default function MarkStamp({ className = "", front = "text-fg", back = "text-cast", ...rest }) {
  return (
    <span {...rest} aria-hidden="true" className={cx(!/(^|\s)(absolute|fixed)(\s|$)/.test(className) && "relative", "inline-block shrink-0", !/(^|\s)(h|w|size)-/.test(className) && "h-11 w-11", className)}>
      <Mark className={cx("absolute inset-0 h-full w-full translate-x-[9%] translate-y-[9%]", back)} />
      <Mark className={cx("absolute inset-0 h-full w-full", front)} />
    </span>
  );
}
