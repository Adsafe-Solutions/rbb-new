import { useLocation } from "react-router-dom";
import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import IconPanel from "../../components/IconPanel/IconPanel.jsx";
import ContentRows from "../../components/ContentRows/ContentRows.jsx";
import ProjectList from "../../components/ProjectList/ProjectList.jsx";
import InvolvementPaths from "../../components/InvolvementPaths/InvolvementPaths.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import LinkChips from "../../components/LinkChips/LinkChips.jsx";
import { PROGRAMS, WORK, programByPath, projectsIn } from "../../content/index.js";

/* The program page template — ONE page for all four program areas
   (Document 04), filled from the program's entry in content/work.js:

        paper   PageHeader        name, approved description, the icon poster
     01–02 white ContentRows       Why this matters · What we do
     —   ink    ProjectList       this program's verified projects
     03–04 paper ContentRows      Impact · Stories
     —   white  InvolvementPaths  the ways to take part
         accent ClosingCta        the other three programs, and support

   Every detail section keeps its heading and, until RBB supplies its
   content, says so in the program's own words (`missing`) — never generic
   copy standing in for facts.

   The program is found by the URL, so the router can point all four
   paths at this one component (App.jsx). */
export default function Program() {
  const { pathname } = useLocation();
  const program = programByPath(pathname);
  const t = WORK.program;
  const others = PROGRAMS.filter((p) => p.slug !== program.slug);

  return (
    <>
      <PageHeader
        title={program.title}
        parent={{ label: "Our Work", to: "/work" }}
        kicker={t.kicker}
        aside={<IconPanel icons={[program.icon]} />}
      >
        <p className="type-lead mt-7 max-w-[46ch] text-copy">
          {program.description}
        </p>
      </PageHeader>

      <ContentRows
        rows={[
          { id: "why", heading: t.why.heading, body: program.why, empty: program.missing },
          { id: "what-we-do", heading: t.what.heading, items: program.activities, empty: program.missing },
        ]}
      />

      <ProjectList
        id="projects"
        kicker={program.title}
        heading={t.projectsHeading}
        projects={projectsIn(program.slug)}
        empty={WORK.projects.empty}
        cta={WORK.projects.cta}
        showProgram={false}
        tone="ink"
      />

      <ContentRows
        tone="paper"
        start={3}
        rows={[
          { id: "impact", heading: t.impact.heading, items: program.impact, empty: t.impact.empty },
          { id: "stories", heading: t.stories.heading, items: program.stories, empty: t.stories.empty },
        ]}
      />

      <InvolvementPaths {...t.getInvolved} />

      <ClosingCta tone="accent" heading={t.related.heading} ctas={t.related.ctas}>
        <LinkChips className="mt-10" items={others} />
      </ClosingCta>
    </>
  );
}
