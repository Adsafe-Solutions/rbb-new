import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import IconPanel from "../../components/IconPanel/IconPanel.jsx";
import Button from "../../components/Button/Button.jsx";
import ProgramIndex from "../../components/ProgramIndex/ProgramIndex.jsx";
import ProjectList from "../../components/ProjectList/ProjectList.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import { PROGRAMS, PROJECTS, WORK, programBySlug } from "../../content/index.js";

/* /work — the Our Work overview (Document 04):

         paper   PageHeader     h1, the positioning line, the icon cluster
     01  white   ProgramIndex   the four program areas, as a numbered index
     02  ink     ProjectList    featured projects, as pinned-up sheets
         accent  ClosingCta     onward to Get Involved and Impact

   The four programs lead: Document 04 makes them the page's primary
   hierarchy, so they get full-width editorial rows, not the homepage's
   compact cards. Projects are secondary and appear only when verified
   project data exists; until then the section says they are to come. */

const programTitle = (slug) => programBySlug(slug)?.title;

export default function Work() {
  const { overview, projects } = WORK;
  const featured = PROJECTS.filter((project) => project.featured);

  return (
    <>
      <PageHeader
        title={overview.heading}
        highlight="Work"
        kicker={overview.kicker}
        aside={<IconPanel icons={PROGRAMS.map((p) => p.icon)} />}
      >
        <p className="type-lead mt-7 max-w-[46ch] text-copy">
          {overview.body}
        </p>
        <Button size="lg" to={overview.cta.to} className="mt-9">
          {overview.cta.label}
        </Button>
      </PageHeader>

      <ProgramIndex index={1} {...overview.programs} programs={PROGRAMS} />

      <ProjectList
        kicker={projects.kicker}
        heading={projects.heading}
        projects={featured.length ? featured : PROJECTS.slice(0, 3)}
        empty={projects.empty}
        cta={projects.cta}
        programOf={programTitle}
        index={2}
        tone="ink"
      />

      <ClosingCta tone="accent" {...overview.closing} />
    </>
  );
}
