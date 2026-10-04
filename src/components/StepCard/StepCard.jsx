import { cx } from "../../lib/cx.js";
import OffsetCard from "../OffsetCard/OffsetCard.jsx";

/* A numbered card: one step of a form, one stage of a process, one
   clause of a policy. A stamped number, a heading, and whatever the step
   holds.

   Square to the page — never tilted. A step card holds things people
   read closely or fill in, and a form on a slant is a form that feels
   unreliable.

     number     1-based; printed as "01"
     title      the step's heading
     headingAs  its element. A form's steps are <h2> or <h3> depending on
                where the form sits; the caller knows, this does not.
     note       a line under the heading
     as         the card's element — <fieldset> for a group of fields
                (then `title` should be rendered by the caller as its
                <legend>; pass `title={null}`), <li> in an ordered list

   The number is decoration (`aria-hidden`): in a list the list numbers
   it; in a form the heading names it. */
export default function StepCard({
  number,
  title,
  headingAs: Heading = "h3",
  headingId,
  note,
  as = "div",
  cast = "md",
  className = "",
  children,
  ...rest
}) {
  return (
    <OffsetCard as={as} cast={cast} pad="md" className={cx("min-w-0", className)} {...rest}>
      <div className="flex items-center gap-4">
        {number != null && (
          <span
            aria-hidden="true"
            className="type-meta flex h-10 w-10 shrink-0 -rotate-3 items-center justify-center rounded-xl bg-pop text-[15px] text-on-pop"
          >
            {String(number).padStart(2, "0")}
          </span>
        )}
        {title && (
          <Heading id={headingId} className="text-[22px] font-extrabold leading-tight tracking-tight">
            {title}
          </Heading>
        )}
      </div>
      {note && <p className="mt-3 max-w-[60ch] text-quiet">{note}</p>}
      {children && <div className={cx((title || note) && "mt-6")}>{children}</div>}
    </OffsetCard>
  );
}
