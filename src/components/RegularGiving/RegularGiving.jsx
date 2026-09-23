import { useId } from "react";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";

/* The regular-giving ask: copy on a Deep Trust Blue card, the photograph
   cut into a soft organic shape on the right, with two Sky Blue shapes
   showing past its edges — a solid one in the top-right corner, a pale
   one along the lower left.

   The shapes are SVG clip paths in `objectBoundingBox` units (0–1 of the
   box they clip), so they stretch with the card at every width instead of
   being drawn for one size. `useId` keeps the ids unique if the section
   ever appears twice on a page.

   The pale shape is honey at partial opacity OVER A WHITE UNDERLAYER,
   not straight onto the card: straight onto Deep Trust Blue the same
   opacity mixes to a murky teal, and the palette has no pale-sky token
   to reach for instead. */

/* The photograph. Starts a little in from the top-left, bulges out to the
   card's left edge of the column around a third of the way down, sweeps
   to the bottom; the top-right corner is rounded away to let the solid
   sky shape show, and the bottom-right is cut on a diagonal to let the
   card's own blue back in. */
const PHOTO =
  "M0.16,0 L0.72,0 C0.85,0.02 0.94,0.08 1,0.17 L1,0.76 C0.9,0.85 0.8,0.93 0.7,1 L0.4,1 C0.17,0.87 0.02,0.64 0.02,0.42 C0.02,0.24 0.08,0.1 0.16,0 Z";

/* The pale shape, peeking out from under the photograph's lower-left
   curve. */
const PALE =
  "M0.12,0.3 C0.02,0.42 -0.02,0.64 0.06,0.82 C0.1,0.9 0.18,0.97 0.26,1 L0.6,1 L0.6,0.3 Z";

export default function RegularGiving({ heading, body, cta, src, alt }) {
  const id = useId();
  const photoClip = `${id}-photo`;
  const paleClip = `${id}-pale`;

  return (
    <section className="py-12 md:py-20">
      <Container>
        <div className="reveal grid overflow-hidden rounded-3xl bg-trust-blue md:grid-cols-[5fr_6fr]">
          <div className="px-8 py-12 md:py-20 md:pl-16 lg:pl-20">
            <h2 className="font-bold text-[length:var(--text-heading)] leading-heading tracking-heading text-paper-white">
              {heading.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h2>
            <p className="mt-6 max-w-[30rem] text-paper-white/90">{body}</p>
            <Button to={cta.to} className="mt-8">
              {cta.label}
            </Button>
          </div>

          {/* The artwork. A fixed height on a phone, where it stacks under
              the copy; beside the copy it stretches to the card. */}
          <div className="relative h-80 sm:h-96 md:h-auto md:min-h-[30rem]">
            <svg aria-hidden="true" className="absolute h-0 w-0">
              <defs>
                <clipPath id={photoClip} clipPathUnits="objectBoundingBox">
                  <path d={PHOTO} />
                </clipPath>
                <clipPath id={paleClip} clipPathUnits="objectBoundingBox">
                  <path d={PALE} />
                </clipPath>
              </defs>
            </svg>

            <div aria-hidden="true" className="absolute top-0 right-0 h-2/5 w-2/5 bg-bumble-honey" />

            <div
              aria-hidden="true"
              className="absolute inset-0 bg-paper-white"
              style={{ clipPath: `url(#${paleClip})` }}
            >
              <div className="h-full w-full bg-bumble-honey/45" />
            </div>

            <div
              className="absolute inset-y-0 right-0 left-[6%]"
              style={{ clipPath: `url(#${photoClip})` }}
            >
              <img
                src={src}
                alt={alt}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover object-[35%_center]"
              />
            </div>

          </div>
        </div>
      </Container>
    </section>
  );
}
