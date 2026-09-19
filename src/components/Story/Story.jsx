import { cx } from "../../lib/cx.js";
import Button from "../Button/Button.jsx";
import Photo from "../Photo/Photo.jsx";
import Container from "../Container/Container.jsx";
import { STORY } from "../../content/index.js";

/* A member story — oversized quote left, portrait right.

   The portrait is the one black-and-white image on the page. Against a
   layout carried by a single warm yellow, desaturating it is what separates
   a story from an advertisement: the photograph reads as a document rather
   than as a campaign shot.

   ⚠ Real <blockquote> and <cite>, not a styled div. The quotation mark
   above it is decorative and `aria-hidden` — a screen reader announcing
   "right double quotation mark" before every testimonial is noise. */
export default function Story() {
  return (
    <section className="pb-16 md:pb-24">
      <Container>
        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
          <figure className="reveal order-2 md:order-1">
            <span
              aria-hidden="true"
              className="block text-[length:var(--text-heading-lg)] font-bold leading-none"
            >
              &rdquo;
            </span>

            <blockquote
              className={cx(
                "mt-4 font-bold text-[length:var(--text-heading)]",
                "leading-heading tracking-heading",
                "md:text-[length:clamp(2.5rem,4vw,3.5rem)]"
              )}
            >
              {STORY.quote}
            </blockquote>

            <figcaption className="mt-6 text-graphite">
              <cite className="not-italic">{STORY.attribution}</cite>
            </figcaption>

            <Button to={STORY.cta.to} className="mt-8">
              {STORY.cta.label}
            </Button>
          </figure>

          <div className="reveal order-1 md:order-2">
            <Photo
              src={STORY.src}
              ratio="4/5"
              alt={STORY.attribution}
              className="bg-mist"
              imgClassName="grayscale"
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
