import { useId } from "react";
import { Link } from "react-router-dom";
import ArrowStamp from "../ArrowStamp/ArrowStamp.jsx";
import LineIcon from "../LineIcon/LineIcon.jsx";
import Section from "../Section/Section.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";

/* An editorial index: full-width numbered rows between 2px rules, each a
   huge two-digit number, the title in display type, a line under it and
   the arrow stamp — the contents page of a report rather than a grid of
   cards. On /work these are the primary content; the homepage's flyers
   are the summary of this.

   Each row is ONE link — its visible text is the title, stretched over
   the row by its `after:` box — so it is one Tab stop per row with a name
   that says where it goes; `linkLabel` adds words for assistive tech
   where the title alone would not ("Explore Education"). The row lights
   up on hover: the band's accent sweeps in behind it.

   Items are { title, description, to, icon, note?, linkLabel? }. `note`
   is a line under the description (on /impact, the program's impact
   status). `id`, `intro` and `tone` are optional. */
export default function ProgramIndex({ id, index, kicker, heading, intro, programs, tone = "white" }) {
  const headingId = useId();

  return (
    <Section id={id} tone={tone} pad="lg" aria-labelledby={headingId}>
      <SectionHeading id={headingId} index={index} kicker={kicker} heading={heading} intro={intro} />

      <ol data-anim-stagger className="mt-14 border-b-2 border-edge md:mt-16">
        {programs.map((program, i) => (
          <li
            key={program.to}
            className="group relative grid items-center gap-x-8 gap-y-4 border-t-2 border-edge py-8 transition-colors duration-300 hover:bg-hair sm:grid-cols-[auto_1fr_auto] md:py-10 lg:px-6"
          >
            <span aria-hidden="true" className="type-title flex items-center gap-4 text-fg">
              <span className="w-[2.2ch] tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-pop text-on-pop">
                <LineIcon name={program.icon} className="h-7 w-7" />
              </span>
            </span>

            <div className="min-w-0">
              <h3 className="type-card">
                <Link to={program.to} className="after:absolute after:inset-0">
                  {program.linkLabel && program.linkLabel !== program.title ? (
                    <>
                      {program.title}
                      <span className="sr-only"> — {program.linkLabel}</span>
                    </>
                  ) : (
                    <>
                      <span className="sr-only">Explore </span>
                      {program.title}
                    </>
                  )}
                </Link>
              </h3>
              <p className="mt-2 max-w-2xl text-copy">{program.description}</p>
              {program.note && <p className="type-note mt-2 max-w-2xl text-quiet">{program.note}</p>}
            </div>

            <ArrowStamp className="hidden sm:inline-flex" />
          </li>
        ))}
      </ol>
    </Section>
  );
}
