import { useId } from "react";
import { cx } from "../../lib/cx.js";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";

/* A short sequence of steps, read left to right: the "how we work" row.

   An <ol>, because the order IS the content — a screen reader announces
   "list, 4 items" and each step's number, with no arrows to describe. The
   joining rule between steps is drawn by CSS and is decoration only.

   Steps carry a `title` and, optionally, a `body`. Titles alone are a
   complete layout: the homepage's steps have no descriptions until RBB
   writes them (see content/homepage.js), and a line of placeholder under
   each of four words would be noise.

   With no steps at all it is a heading, an intro and a call to action —
   how /about uses it, where the proposed steps must not appear as RBB's
   official method. `id` is the section's anchor. */
export default function ApproachFlow({ id, kicker, heading, intro, steps = [], cta }) {
  const headingId = useId();
  const last = steps.length - 1;

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="scroll-mt-[var(--header-h)] py-20 md:py-28"
    >
      <Container>
        <div className="reveal flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            id={headingId}
            kicker={kicker}
            heading={heading}
            intro={intro}
          />
          {cta && (
            <Button variant="outline" to={cta.to} className="self-start lg:self-auto">
              {cta.label}
            </Button>
          )}
        </div>

        {steps.length > 0 && (
          <ol className="mt-14 grid gap-4 sm:grid-cols-2 md:mt-16 lg:grid-cols-4 lg:gap-0">
            {steps.map((step, i) => (
              <li
                key={step.title}
                style={{ transitionDelay: `${i * 90}ms` }}
                className={cx(
                  "reveal relative flex items-center gap-5 rounded-3xl bg-mist p-6",
                  "lg:flex-col lg:items-start lg:gap-0 lg:rounded-none lg:bg-transparent lg:p-0 lg:pr-8",
                  /* The rule from this step's number to the next one's, from
                   `lg` where the steps sit in a row. Full class strings, not
                   built ones — Tailwind only generates what it can read. */
                  i < last &&
                    "lg:after:absolute lg:after:left-20 lg:after:right-4 lg:after:top-8 lg:after:h-0.5 lg:after:rounded-full lg:after:bg-bumble-honey/40"
                )}
              >
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-trust-blue font-bold text-[length:var(--text-subheading)] text-paper-white lg:bg-paper-white lg:text-trust-blue lg:ring-2 lg:ring-bumble-honey">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="lg:mt-7">
                  <h3 className="font-bold text-[length:var(--text-heading-sm)] leading-heading-sm tracking-heading-sm">
                    {step.title}
                  </h3>
                  {step.body && <p className="mt-3 text-graphite">{step.body}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Container>
    </section>
  );
}
