import { useId } from "react";
import { cx } from "../../lib/cx.js";
import Button from "../Button/Button.jsx";
import EditorialImage from "../EditorialImage/EditorialImage.jsx";
import MarkStamp from "../Mark/MarkStamp.jsx";
import Section from "../Section/Section.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";

/* A feature opening: a large statement and the paragraphs that expand on
   it, beside one photograph pinned up as a print — with the mark stamped
   on the corner of the page where the two meet.

   Asymmetric on purpose (7 : 5, the photograph narrower), and the
   photograph sits lower than the copy, so the two read as a composition
   rather than as two halves of a grid.

     index, kicker, heading, highlight   the heading block
     body      a string or paragraphs; the first is set larger
     cta       { label, to }; `secondary` an underlined link beside it
     image     { src, alt, focal? }; `imageLabel` a sticker on the print
     reverse   photograph on the left
     tone      the band's colour

   A `sequence` for the motion system; the photograph's frame is not
   animated (see EditorialImage) — its wrapper is. */
export default function EditorialSplit({
  id,
  index,
  kicker,
  heading,
  highlight,
  body,
  cta,
  secondary,
  image,
  imageLabel,
  reverse = false,
  tone = "white",
  pad = "lg",
}) {
  const headingId = useId();
  const paragraphs = Array.isArray(body) ? body : body ? [body] : [];

  return (
    <Section id={id} tone={tone} pad={pad} aria-labelledby={headingId}>
      <div className={cx("grid items-center gap-14 lg:gap-20", reverse ? "lg:grid-cols-[5fr_7fr]" : "lg:grid-cols-[7fr_5fr]")}>
        <div className={cx(reverse && "lg:order-2")}>
          <SectionHeading id={headingId} index={index} kicker={kicker} heading={heading} highlight={highlight} />
          <div data-anim="sequence">
            {paragraphs.map((text, i) => (
              <p
                key={text}
                data-anim-item
                data-anim="soft"
                className={cx(i === 0 ? "type-lead mt-8 max-w-[44ch] text-copy" : "mt-5 max-w-[60ch] text-quiet")}
              >
                {text}
              </p>
            ))}
            {(cta || secondary) && (
              <div data-anim-item data-anim="soft" className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
                {cta && <Button to={cta.to}>{cta.label}</Button>}
                {secondary && (
                  <Button variant="link" to={secondary.to}>
                    {secondary.label}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <div data-anim="soft" className={cx("relative mx-auto w-full max-w-md lg:mt-24 lg:max-w-none", reverse && "lg:order-1 lg:mt-0 lg:mb-24")}>
          <EditorialImage image={image} ratio="aspect-[4/5]" tilt={reverse ? "r" : "l"} label={imageLabel} />
          <MarkStamp className="absolute -right-3 -top-6 h-16 w-16 rotate-[8deg] sm:-right-6 sm:-top-8 sm:h-20 sm:w-20" />
        </div>
      </div>
    </Section>
  );
}
