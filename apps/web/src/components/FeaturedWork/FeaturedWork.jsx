import { useId } from "react";
import Button from "../Button/Button.jsx";
import EmptyPanel from "../EmptyPanel/EmptyPanel.jsx";
import ProjectCard from "../ProjectCard/ProjectCard.jsx";
import Section from "../Section/Section.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";

/* Projects as an editorial spread: the first across the full width with
   its photograph beside the copy, the rest as a pair of printed sheets
   under it, square to the page.

     projects  records from content/work.js, already chosen by the caller
               (the homepage passes the `featured` ones)
     href      project → its page
     programOf slug → the program's title, for the card's label
     empty     shown when there are none — never placeholder cards
     cta       the way to every project

   Only the fields a project has are drawn (ProjectCard). */
export default function FeaturedWork({ id, index, kicker, heading, projects, href, programOf, empty, cta, tone = "white", highlight }) {
  const headingId = useId();
  const [lead, ...rest] = projects;

  return (
    <Section id={id} tone={tone} pad="lg" aria-labelledby={headingId}>
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <SectionHeading id={headingId} index={index} kicker={kicker} heading={heading} highlight={highlight} />
        {cta && projects.length > 0 && (
          <Button data-anim="soft" variant="outline" to={cta.to} className="self-start md:self-auto">
            {cta.label}
          </Button>
        )}
      </div>

      {lead ? (
        <ul data-anim-stagger className="mt-14 grid gap-x-10 gap-y-12 md:mt-16 md:grid-cols-2">
          <li className="md:col-span-2">
            <ProjectCard wide project={lead} href={href(lead)} program={programOf?.(lead.program)} />
          </li>
          {rest.slice(0, 4).map((project) => (
            <li key={project.slug}>
              <ProjectCard project={project} href={href(project)} program={programOf?.(project.program)} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyPanel text={empty} cta={cta} className="reveal mt-14" />
      )}
    </Section>
  );
}
