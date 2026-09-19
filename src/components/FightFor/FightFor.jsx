import { Link } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import Container from "../Container/Container.jsx";

/* The "what we fight for" block: a wide photograph with a swooped
   bottom-right corner, and a white card that overlaps its right edge
   carrying the statement and a short list of ways in.

   The overlap is a grid trick, not absolute positioning: both children sit
   in the same row, the picture spans columns 1-8 and the card 8-12, so
   they share column 8. The card therefore still contributes height and the
   section grows with its copy instead of clipping it. Below lg the card
   simply tucks up under the picture with a negative margin. */

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
      className="h-6 w-6 shrink-0 transition-transform group-hover:translate-x-1"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export default function FightFor({ heading, paragraphs, links, src, alt }) {
  return (
    <section className="py-10 md:py-16">
      <Container>
        <div className="reveal lg:grid lg:grid-cols-12 lg:items-center">
          <div
            className={cx(
              "aspect-[3/2] overflow-hidden rounded-3xl rounded-br-[6rem]",
              "lg:col-start-1 lg:col-end-9 lg:row-start-1"
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

          <div
            className={cx(
              "relative -mt-10 mx-4 rounded-3xl bg-paper-white p-8 shadow-sm md:p-12",
              "lg:col-start-8 lg:col-end-13 lg:row-start-1 lg:mx-0 lg:mt-0"
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
                    className="group flex items-center justify-between gap-4 py-4 font-semibold hover:underline underline-offset-4"
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
