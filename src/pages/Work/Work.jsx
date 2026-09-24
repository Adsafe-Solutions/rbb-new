import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import IconPanel from "../../components/IconPanel/IconPanel.jsx";
import Button from "../../components/Button/Button.jsx";
import ProgramIndex from "../../components/ProgramIndex/ProgramIndex.jsx";
import ProjectList from "../../components/ProjectList/ProjectList.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import useReveal from "../../hooks/useReveal.js";
import { PROGRAMS, PROJECTS, WORK, programBySlug } from "../../content/index.js";

/* /work — the Our Work overview (Document 04):

     mist band   PageHeader     h1, the positioning line, Explore Projects
     white       ProgramIndex   the four program areas — the primary content
     mist band   ProjectList    featured projects, or the honest empty state
     mist band   ClosingCta     onward to Get Involved and Impact

   The four programs lead: Document 04 makes them the page's primary
   hierarchy, so they get full-width editorial rows, not the homepage's
   compact cards. Projects are secondary and appear only when verified
   project data exists; until then the section says they are to come. */

const programTitle = (slug) => programBySlug(slug)?.title;

export default function Work() {
  useReveal();
  const { overview, projects } = WORK;
  const featured = PROJECTS.filter((project) => project.featured);

  return (
    <>
      <PageHeader
        title={overview.heading}
        kicker={overview.kicker}
        aside={<IconPanel icons={PROGRAMS.map((p) => p.icon)} className="reveal" />}
      >
        <p className="mt-5 max-w-prose text-[length:var(--text-subheading)] leading-subheading tracking-subheading text-graphite">
          {overview.body}
        </p>
        <Button to={overview.cta.to} className="mt-8">
          {overview.cta.label}
        </Button>
      </PageHeader>

      <ProgramIndex {...overview.programs} programs={PROGRAMS} />

      <ProjectList
        kicker={projects.kicker}
        heading={projects.heading}
        projects={featured.length ? featured : PROJECTS.slice(0, 3)}
        empty={projects.empty}
        cta={projects.cta}
        programOf={programTitle}
        surface="mist"
      />

      <ClosingCta {...overview.closing} />
    </>
  );
}
