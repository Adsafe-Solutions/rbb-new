import { useEffect, useState } from "react";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";
import LogoFrame from "../LogoFrame/LogoFrame.jsx";
import { BRAND } from "../../content/index.js";
/* Catalogue-only sample data (/components), imported directly rather than
   through content/index.js so it never enters the public build. */
import { HERO } from "../../content/home.js";

/* The hero: a full-bleed Deep Trust Blue band with the appeal photography
   held in a logo-shaped frame on the left and the headline on the right.

   The photographs cross-fade in place rather than sliding. The frame is a
   fixed silhouette — a card flying out of it would have to be clipped to
   that silhouette on the way, and a shape that complex dragging across the
   compositor is where the old card deck got expensive on mid-range phones.
   Opacity is one composited property and the frame never moves.

   Two decorations sit behind the copy, both `aria-hidden`:
     · the white curve along the bottom, which hands the page over to the
       white section beneath it,
     · the vertical wordmark down the right edge.

   ⚠ None of them may be allowed to widen the page. The band carries
   `overflow-hidden` for exactly that — and note this is the ONE place it
   is safe, because it is the band that clips, not `body`. Putting
   `overflow-x-hidden` on `body` would make body a scroll container and
   silently break the header's `position: sticky` (see styles/index.css). */

const CYCLE_MS = 5000;

export default function Hero() {
  const [active, setActive] = useState(0);
  const cards = HERO.cards;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(
      () => setActive((i) => (i + 1) % cards.length),
      CYCLE_MS
    );
    return () => window.clearInterval(timer);
  }, [cards.length]);

  return (
    <section className="relative -mt-[var(--header-h)] overflow-hidden bg-trust-blue pt-[var(--header-h)]">
      {/* The vertical wordmark down the right edge. `writing-mode` rather
          than a rotation so the glyphs stay on the text baseline and the
          element still reserves its true width in the layout. Hidden below
          lg, where there is no gutter left to spare. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 text-[length:clamp(2rem,4vw,4rem)] font-bold uppercase leading-none tracking-[0.2em] text-paper-white/10 lg:block"
        style={{ writingMode: "vertical-rl" }}
      >
        {BRAND.name}
      </span>

      <Container className="relative grid items-center gap-14 pb-28 pt-10 md:pb-40 md:pt-16 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-10">
        {/* No max-width below `lg`, and a generous one above it: the
            photograph carries this section. Capping it at the copy's
            measure — the obvious `max-w-md` — is what made it read as an
            illustration next to the headline rather than the subject of
            the page. */}
        <div className="reveal mx-auto w-full max-w-[660px]">
          {/* The caption is a sibling of the frame inside a wrapper that
              hugs it, so its `bottom` percentage is measured against the
              SQUARE and lands on the photograph. Measured against the
              column it would drift down as the dots below it grow, and it
              cannot live inside LogoFrame — the children there are clipped
              to the photograph's circle. */}
          <div className="relative">
            <LogoFrame className="text-bumble-honey">
              {cards.map((card, i) => (
                <img
                  key={card.name}
                  src={card.src}
                  alt={card.alt}
                  /* Only the first is eager: it is almost always the LCP
                     element, and the other two are a cycle away. */
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-out"
                  style={{ opacity: i === active ? 1 : 0 }}
                />
              ))}
            </LogoFrame>

            {/* Which appeal is on screen, in words. The dots carry it for
                a screen reader already; this is for everyone else, and it
                is the one thing a photograph of a camp cannot say for
                itself. */}
            <p
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-[18%] flex justify-center"
            >
              <span className="rounded-full bg-trust-blue/80 px-5 py-2 text-[length:var(--text-caption)] font-medium tracking-caption text-paper-white backdrop-blur-sm">
                {cards[active].name}
              </span>
            </p>
          </div>

          {/* Dots, as real buttons: the cross-fade is the only way to reach
              the other two appeals otherwise, and a five-second wait is not
              a control. */}
          <div className="mt-6 flex justify-center gap-2.5">
            {cards.map((card, i) => (
              <button
                key={card.name}
                type="button"
                onClick={() => setActive(i)}
                aria-label={card.name}
                aria-current={i === active}
                className={
                  i === active
                    ? "h-2.5 w-2.5 cursor-pointer rounded-full bg-bumble-honey transition-colors"
                    : "h-2.5 w-2.5 cursor-pointer rounded-full bg-paper-white/35 transition-colors hover:bg-paper-white/60"
                }
              />
            ))}
          </div>
        </div>

        <div className="reveal text-paper-white">
          {/* `text-paper-white` belongs on the h1 ITSELF, not only on the
              wrapper: styles/index.css sets `:where(h1,h2,h3,h4)` to
              Deep Trust Blue, and a colour declared on the element beats
              one inherited from an ancestor whatever the selector's
              specificity. Left to inherit, the headline is Deep Trust Blue
              on a Deep Trust Blue band — invisible, not merely low
              contrast. */}
          <h1 className="text-balance text-paper-white">
            <span className="block text-[length:clamp(1.75rem,3.2vw,2.5rem)] font-normal leading-tight tracking-heading">
              {HERO.lead}
            </span>
            <span className="mt-1 block text-[length:clamp(2.5rem,5.2vw,4.25rem)] font-bold leading-[1.05] tracking-heading-lg">
              {HERO.emphasis}
            </span>
          </h1>

          <p className="mt-5 max-w-lg text-[length:clamp(1.05rem,1.6vw,1.375rem)] font-light uppercase leading-snug tracking-[0.06em] text-paper-white/85">
            {HERO.subheading}
          </p>

          <p className="mt-6 max-w-prose text-paper-white/75">{HERO.body}</p>

          <Button to={HERO.cta.to} className="mt-9">
            {HERO.cta.label}
          </Button>
        </div>
      </Container>

      {/* The handover curve. `preserveAspectRatio="none"` lets one path
          stretch to any viewport width without the wave flattening out at
          the ends, which is what a fixed-ratio viewBox would do. */}
      <svg
        viewBox="0 0 1440 140"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[70px] w-full text-paper-white md:h-[110px]"
      >
        <path
          fill="currentColor"
          d="M0,96 C240,16 480,16 720,64 C960,112 1200,112 1440,48 L1440,140 L0,140 Z"
        />
      </svg>
    </section>
  );
}
