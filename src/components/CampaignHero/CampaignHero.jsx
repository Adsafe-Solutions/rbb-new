import { cx } from "../../lib/cx.js";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";

/* A campaign lead: headline and call to action left, a large photograph
   right with one huge swoop cut out of its bottom-left corner.

   The `accent` word is set directly in Sky Blue — large bold heading type
   clears colour-contrast at that weight and size, and a Sky Blue FILL
   behind text reads badly as a section-sized wash if it ever grows past
   one word, so the colour lives in the glyphs, not a highlight box. */
export default function CampaignHero({ heading, accent, body, cta, src, alt }) {
  const [before, after] = accent ? heading.split(accent) : [heading, ""];

  return (
    <section className="py-20 md:py-32">
      <Container>
        <div className="reveal grid items-center gap-12 lg:grid-cols-[5fr_7fr] lg:gap-20">
          <div>
            <h2
              className={cx(
                "font-bold text-[length:var(--text-heading-lg)] leading-heading-lg tracking-heading-lg",
                "md:text-[length:clamp(3.5rem,5vw,4.5rem)]"
              )}
            >
              {before}
              {accent && (
                <span className="text-bumble-honey">{accent}</span>
              )}
              {after}
            </h2>

            <p className="mt-6 max-w-prose text-graphite">{body}</p>

            <Button to={cta.to} className="mt-8">
              {cta.label}
            </Button>
          </div>

          <div className="aspect-[4/3] overflow-hidden rounded-3xl rounded-bl-[8rem]">
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
