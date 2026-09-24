import { useId } from "react";
import { Link } from "react-router-dom";
import Container from "../Container/Container.jsx";
import LineIcon from "../LineIcon/LineIcon.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";

/* The program areas as an editorial index — full-width numbered rows, a
   rule between each — rather than a grid of cards. On /work these are the
   primary content, so they get the page's width and large type; the
   homepage's compact cards (ProgramAreas) are the summary of this.

   Each row is ONE link, its visible text "Explore Education", stretched
   over the row by its `after:` box: one Tab stop per program, and a link
   name that says where it goes. The title is the row's <h3>, outside the
   link. Items are { title, description, to, icon, note?, linkLabel? } —
   `note` is a line under the description (on /impact, the program's impact
   status); `linkLabel` replaces "Explore <title>" where that reads badly.
   `id` and `intro` are optional: the section's anchor, and a line under
   the heading (on /get-involved/donate, that allocation is still to come). */
export default function ProgramIndex({ id, kicker, heading, intro, programs }) {
  const headingId = useId();

  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-[var(--header-h)] py-20 md:py-28">
      <Container>
        <SectionHeading id={headingId} kicker={kicker} heading={heading} intro={intro} className="reveal" />

        <ol className="reveal mt-12 border-b border-mist md:mt-14">
          {programs.map((program, i) => (
            <li
              key={program.to}
              className="group relative grid gap-5 border-t border-mist py-8 transition-colors hover:bg-mist/60 sm:grid-cols-[auto_1fr] sm:gap-8 md:py-10 lg:grid-cols-[auto_1fr_auto] lg:items-center lg:px-6"
            >
              <div className="flex items-center gap-5">
                <span className="w-8 text-[length:var(--text-caption)] font-semibold tracking-caption text-trust-blue">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-bumble-honey/12 text-trust-blue transition-colors duration-300 group-hover:bg-bumble-honey group-hover:text-paper-white">
                  <LineIcon name={program.icon} className="h-8 w-8" />
                </span>
              </div>

              <div>
                <h3 className="font-bold text-[length:var(--text-heading-sm)] leading-heading-sm tracking-heading-sm md:text-[length:var(--text-heading)] md:leading-heading md:tracking-heading">
                  {program.title}
                </h3>
                <p className="mt-2 max-w-2xl text-[length:var(--text-body)] text-graphite">
                  {program.description}
                </p>
                {program.note && (
                  <p className="mt-2 max-w-2xl text-[length:var(--text-caption)] leading-caption tracking-caption text-graphite">
                    {program.note}
                  </p>
                )}
              </div>

              <Link
                to={program.to}
                className="inline-flex items-center gap-2 self-start font-semibold text-trust-blue underline-offset-4 after:absolute after:inset-0 group-hover:underline sm:col-start-2 lg:col-start-auto lg:self-center"
              >
                {program.linkLabel ?? `Explore ${program.title}`}
                <LineIcon
                  name="arrow"
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                />
              </Link>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
