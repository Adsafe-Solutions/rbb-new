import { useId } from "react";
import { cx } from "../../lib/cx.js";
import Button from "../Button/Button.jsx";
import DisplayHeading from "../DisplayHeading/DisplayHeading.jsx";
import Section from "../Section/Section.jsx";

/* The page's last word before the footer: a band of solid colour, the
   heading at billboard size — with the words the page chooses on the
   highlight (`highlight`, HighlightText), or none — and one or two
   buttons.

   Sky Blue by default — the footer under it is Deep Trust Blue, so the
   two read as a call and then a close rather than as one block. A page
   whose previous band is already Sky Blue passes `tone="paper"`. Never
   `ink`: it would merge into the footer.

     heading   the ask
     body      one supporting line
     ctas      { primary, secondary? }, each { label, to }
     aside     an object to the right of the copy from `lg` — a framed
               photograph, a ticket. Without one the copy is centred.
     children  rendered under the buttons (links to sibling pages)

   A `sequence` for the motion system: heading, line, buttons, in the
   order they are read. */
export default function CtaSection({ heading, body, ctas, aside, tone = "accent", id, children, highlight }) {
  const headingId = useId();
  const centred = !aside;

  return (
    <Section id={id} tone={tone} pad="lg" watermark={centred ? "center" : "left"} aria-labelledby={headingId}>
      <div className={cx(aside && "grid items-center gap-14 lg:grid-cols-[6fr_5fr] lg:gap-20")}>
        <div data-anim="sequence" className={cx(centred && "mx-auto max-w-4xl text-center")}>
          <DisplayHeading data-anim-item id={headingId} size="billboard" highlight={highlight}>
            {heading}
          </DisplayHeading>
          {body && (
            <p data-anim-item data-anim="soft" className={cx("type-lead mt-7 max-w-[48ch] text-copy", centred && "mx-auto")}>
              {body}
            </p>
          )}
          {ctas && (
            <div data-anim-item data-anim="soft" className={cx("mt-9 flex flex-wrap items-center gap-4", centred && "justify-center")}>
              <Button size="lg" to={ctas.primary.to}>
                {ctas.primary.label}
              </Button>
              {ctas.secondary && (
                <Button size="lg" variant="outline" to={ctas.secondary.to}>
                  {ctas.secondary.label}
                </Button>
              )}
            </div>
          )}
          {children}
        </div>
        {aside && <div className="reveal">{aside}</div>}
      </div>
    </Section>
  );
}
