import { Link } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import Container from "../Container/Container.jsx";

/* The pages inside a section, as a grid of cards — what a section's own
   page (/about, /work, /impact, /get-involved) offers below its intro.

   Text only, on purpose. The cards are read from the navigation config,
   which carries a label and a URL and nothing else; a photograph or a
   one-line summary per page would have to be written, and until RBB
   supplies that copy there is nothing true to put there. The day it
   exists, it goes on the nav entries and renders here. */
export default function SectionLinks({ heading, items, className = "" }) {
  return (
    <section className={cx("py-16 md:py-24", className)}>
      <Container>
        <h2 className="font-bold text-[length:var(--text-heading-sm)] leading-heading-sm tracking-heading-sm">
          {heading}
        </h2>
        <ul className="mt-8 grid gap-cards sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className={cx(
                  "group flex h-full items-center justify-between gap-4 rounded-3xl bg-mist p-6",
                  "transition-colors hover:bg-bumble-honey/15"
                )}
              >
                <span className="font-bold text-[length:var(--text-subheading)] leading-subheading tracking-subheading text-trust-blue underline-offset-4 group-hover:underline">
                  {item.label}
                </span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 text-trust-blue transition-transform group-hover:translate-x-1"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
