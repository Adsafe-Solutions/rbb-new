import { cx } from "../../lib/cx.js";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";

/* A campaign lead: headline and call to action left, a large photograph
   right with one huge swoop cut out of its bottom-left corner.

   The `accent` word is set directly in Sky Blue — large bold heading type
   clears colour-contrast at that weight and size, and a Sky Blue FILL
   behind text reads badly as a section-sized wash if it ever grows past
   one word, so the colour lives in the glyphs, not a highlight box.

   `flip` mirrors the whole thing: photograph left, copy right, and the
   swoop moves to the bottom-RIGHT corner so it still faces the copy. Two
   campaigns stacked one flipped and one not read as a zigzag — the eye
   crosses the page between them instead of running down one edge.

   ⚠ Mobile order does NOT flip. Below lg every campaign reads headline
   first, photograph second; flipping there would put two photographs
   back to back between the two headlines. `lg:order-first` moves the
   photograph only once there are columns to move it between.

   `joined` is for a campaign sitting DIRECTLY under another one. Each
   section pads itself top and bottom, so two in a row stack both paddings
   into ~250px of nothing between them — enough to break the pair apart.
   `joined` drops this one's top padding so the gap is one section's worth.

   Both are page-layout decisions, not properties of the appeal, which is
   why the page passes them rather than the content file. */
export default function CampaignHero({
  heading,
  accent,
  body,
  cta,
  src,
  alt,
  flip = false,
  joined = false,
}) {
  const [before, after] = accent ? heading.split(accent) : [heading, ""];

  return (
    <section className={joined ? "pb-20 md:pb-32" : "py-20 md:py-32"}>
      <Container>
        <div
          className={cx(
            "reveal grid items-center gap-12 lg:gap-20",
            flip ? "lg:grid-cols-[7fr_5fr]" : "lg:grid-cols-[5fr_7fr]"
          )}
        >
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

          <div
            className={cx(
              "aspect-[4/3] overflow-hidden rounded-3xl",
              flip ? "rounded-br-[8rem] lg:order-first" : "rounded-bl-[8rem]"
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
