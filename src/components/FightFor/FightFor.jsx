import { Link } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import Container from "../Container/Container.jsx";

/* The "what we fight for" block: a wide photograph with a swooped
   bottom-right corner, and a white card that overlaps its right edge
   carrying the statement and a short list of ways in.

   The overlap is a grid trick, not absolute positioning: both children sit
   in the same row, the picture spans columns 1-8 and the card 8-12, so
   they share column 8. The card therefore still contributes height and the
   section grows with its copy instead of clipping it.

   From lg the CARD sets the row's height and the photograph follows it,
   staggered: the card drops 4rem from the top, the photo stops 4rem short
   of the bottom. So the photo's top-right corner shows above the card and
   the card hangs below the swoop, whatever the copy length. For that the
   <img> is absolutely placed at lg — an in-flow image contributes its own
   intrinsic height to the row and the stagger stops being exact. Below lg
   it goes back in flow and the frame holds a plain 3:2. Below lg the card
   simply tucks up under the picture with a negative margin.

   The swoop is an ELLIPTICAL radius — 38% across by 48% up — not a
   rounded corner. A single-value radius like 6rem reads as a card with a
   soft corner; the reference curve starts well in from the right edge and
   sweeps up under the card, and only two different percentages give that.
   It is lg-only: at phone width the same percentages eat the photograph,
   so the small-screen picture keeps an ordinary 6rem corner.

   The arrows are Sky Blue — the palette's accent. The reference uses its
   own brand orange there; ours has no orange and should not grow one. */

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-7 w-7 shrink-0 text-bumble-honey transition-transform group-hover:translate-x-1"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export default function FightFor({ heading, paragraphs, links, src, alt }) {
  return (
    <section className="bg-mist py-16 md:py-24">
      <Container>
        <div className="reveal lg:grid lg:grid-cols-12">
          <div
            className={cx(
              "relative aspect-[3/2] overflow-hidden rounded-3xl rounded-br-[6rem] lg:rounded-br-[38%_48%]",
              "lg:col-start-1 lg:col-end-9 lg:row-start-1 lg:mb-16 lg:aspect-auto"
            )}
          >
            <img
              src={src}
              alt={alt}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover lg:absolute lg:inset-0"
            />
          </div>

          <div
            className={cx(
              "relative -mt-10 mx-4 rounded-3xl bg-paper-white p-8 shadow-sm md:p-12 lg:p-14",
              "lg:col-start-8 lg:col-end-13 lg:row-start-1 lg:mx-0 lg:mt-16"
            )}
          >
            <h2 className="font-bold text-[length:var(--text-heading)] leading-heading tracking-heading">
              {heading}
            </h2>

            {paragraphs.map((text) => (
              <p key={text} className="mt-4 text-graphite">
                {text}
              </p>
            ))}

            <ul className="mt-6 divide-y divide-mist">
              {links.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="group flex items-center justify-between gap-4 py-5 text-[length:var(--text-subheading)] font-semibold leading-subheading tracking-subheading text-trust-blue hover:underline underline-offset-4"
                  >
                    {link.label}
                    <ArrowIcon />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}
