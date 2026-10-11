import { useId } from "react";
import Button from "../Button/Button.jsx";
import EmptyPanel from "../EmptyPanel/EmptyPanel.jsx";
import ProjectCard from "../ProjectCard/ProjectCard.jsx";
import Section from "../Section/Section.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";
import { appealKind, appealPath } from "../../content/index.js";

/* A band of appeals (content/appeals.js) as printed sheets — on /appeals,
   on each kind's list page and under an appeal as "other appeals". The
   sheet is ProjectCard's: an appeal is drawn exactly like a project, a
   photograph, its kind as the label, its title and its summary.

   Square to the page, like every directory: appeals are read and
   compared. With none, `empty` ({ text, cta }) on a pinned-up sheet —
   never fake cards.
   `cta` sits beside the heading when there is something to list. */
export default function AppealGrid({ id, index, kicker, heading, highlight, appeals, empty, cta, showKind = true, tone = "white" }) {
  const headingId = useId();

  return (
    <Section id={id} tone={tone} pad="lg" aria-labelledby={headingId}>
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <SectionHeading id={headingId} index={index} kicker={kicker} heading={heading} highlight={highlight} />
        {cta && appeals.length > 0 && (
          <Button data-anim="soft" variant="outline" to={cta.to} className="self-start md:self-auto">
            {cta.label}
          </Button>
        )}
      </div>

      {appeals.length > 0 ? (
        <ul data-anim-stagger className="gap-cards mt-14 grid sm:grid-cols-2 md:mt-16 lg:grid-cols-3">
          {appeals.map((appeal) => (
            <li key={appeal.id}>
              <ProjectCard
                project={{ title: appeal.title, description: appeal.summary, image: appeal.image }}
                href={appealPath(appeal)}
                program={showKind ? appealKind(appeal.kind).label : undefined}
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyPanel text={empty?.text} cta={empty?.cta} className="reveal mt-14" />
      )}
    </Section>
  );
}
