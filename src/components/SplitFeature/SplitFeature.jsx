import { cx } from "../../lib/cx.js";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";

/* Copy beside a photograph, alternating sides down a page — `flip` puts
   the picture on the left. The photo carries one swooped corner, on the
   side facing the copy, so consecutive sections mirror each other. */
export default function SplitFeature({ heading, paragraphs, cta, src, alt, flip = false }) {
  return (
    <section className="py-16 md:py-24">
      <Container>
        <div className="reveal grid items-center gap-10 lg:grid-cols-2 lg:gap-20">
          <div className={cx("min-w-0", flip && "lg:order-2")}>
            <h2 className="font-bold text-[length:var(--text-heading-lg)] leading-heading-lg tracking-heading-lg [overflow-wrap:anywhere]">
              {heading}
            </h2>
            {paragraphs.map((text) => (
              <p key={text} className="mt-5 max-w-prose text-graphite">
                {text}
              </p>
            ))}
            {cta && (
              /* Labels here can run to a sentence ("Give your Zakat today
                 and make a difference"); Button's nowrap would then widen
                 the column past a phone screen. */
              <Button to={cta.to} className="mt-8 whitespace-normal! text-center">
                {cta.label}
              </Button>
            )}
          </div>

          <div
            className={cx(
              "aspect-[4/3] overflow-hidden rounded-3xl",
              flip ? "rounded-tr-[5rem] lg:order-1" : "rounded-tl-[5rem]"
            )}
          >
            <img
              src={src}
              alt={alt}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
