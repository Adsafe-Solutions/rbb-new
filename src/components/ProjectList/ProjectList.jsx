import { useId } from "react";
import Button from "../Button/Button.jsx";
import EmptyPanel from "../EmptyPanel/EmptyPanel.jsx";
import ProjectCard from "../ProjectCard/ProjectCard.jsx";
import Section from "../Section/Section.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";
import { projectPath } from "../../content/index.js";

/* A list of projects — on /work, under each program, and as the whole of
   /work/projects — as a grid of printed sheets (ProjectCard), square to
   the page: a directory is read and compared, so it does not lean. The
   sheets still straighten-and-lift on hover like every linked card.

   Projects come from content/work.js and render ONLY the fields they
   have. With none, `empty` on a pinned-up sheet instead of cards:
   Document 04 is explicit — never fake cards to fill the layout.

   `programOf(slug)` supplies the program's title for the card's label;
   `showProgram={false}` where the program is the page's own. The call to
   action sits beside the heading when there are projects, and inside the
   empty sheet when there are none. `surface` is accepted for the pages
   that still pass it; `tone` sets the band. */
export default function ProjectList({
  id,
  index,
  kicker,
  heading,
  projects,
  empty,
  cta,
  programOf,
  showProgram = true,
  tone = "white",
  surface,
}) {
  const headingId = useId();

  return (
    <Section id={id} tone={surface === "mist" ? "paper" : tone} pad="lg" aria-labelledby={headingId}>
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <SectionHeading id={headingId} index={index} kicker={kicker} heading={heading} />
        {cta && projects.length > 0 && (
          <Button data-anim="soft" variant="outline" to={cta.to} className="self-start md:self-auto">
            {cta.label}
          </Button>
        )}
      </div>

      {projects.length > 0 ? (
        <ul data-anim-stagger className="mt-14 grid gap-x-8 gap-y-12 sm:grid-cols-2 md:mt-16 lg:grid-cols-3">
          {projects.map((project) => (
            <li key={project.id ?? project.slug}>
              <ProjectCard
                project={project}
                href={projectPath(project)}
                program={showProgram ? programOf?.(project.program) : undefined}
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyPanel text={empty} cta={cta} className="reveal mt-14" />
      )}
    </Section>
  );
}
