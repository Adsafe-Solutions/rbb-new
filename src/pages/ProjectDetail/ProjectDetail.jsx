import { useParams } from "react-router-dom";
import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import ContentRows from "../../components/ContentRows/ContentRows.jsx";
import ProjectList from "../../components/ProjectList/ProjectList.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import NotFound from "../NotFound/NotFound.jsx";
import useSeo from "../../hooks/useSeo.js";
import { notFoundMeta, projectMeta } from "../../content/seo.js";
import { SITE, WORK, programBySlug, projectBySlug, projectsIn } from "../../content/index.js";
import EditorialImage from "../../components/EditorialImage/EditorialImage.jsx";
import TicketCard from "../../components/TicketCard/TicketCard.jsx";
import Button from "../../components/Button/Button.jsx";

/* /work/projects/:slug — one verified project (Document 04's detail
   template), built entirely from its entry in content/work.js.

   A slug with no project is a 404, not a placeholder page: with no
   verified projects yet, every project URL is one — and a "project to be
   confirmed" page at a made-up address would be a project that does not
   exist.

   ONLY supplied fields render. The meta row shows program, location and
   status only where the entry has them; a row below shows only if its
   field is filled. Nothing is ever padded with a placeholder here: a
   project page exists because its facts do. Status is text, never colour
   alone. */
function Detail({ project }) {
  const t = WORK.detail;
  const program = programBySlug(project.program);

  const meta = [
    program && { label: t.program, value: program.title },
    project.location && { label: t.location, value: project.location },
    project.status && { label: t.status, value: project.status },
  ].filter(Boolean);

  const rows = [
    project.context && { id: "context", heading: t.context, body: project.context },
    project.activities?.length && { id: "what-we-do", heading: t.activities, items: project.activities },
    project.approach?.length && { id: "approach", heading: t.approach, body: project.approach },
    project.outcomes?.length && { id: "outcomes", heading: t.outcomes, items: project.outcomes },
    project.impact?.length && {
      id: "impact",
      heading: t.impact,
      items: project.impact.map((m) => `${m.value} — ${m.label}`),
    },
    project.partners?.length && { id: "partners", heading: t.partners, items: project.partners },
    project.story && { id: "story", heading: t.story, body: [project.story.title, project.story.excerpt] },
    /* Where the project sits: its program, in the program's own approved
       description. */
    program && { id: "program", heading: t.connection, body: [`${program.title} — ${program.description}`] },
  ].filter(Boolean);

  const related = projectsIn(project.program).filter((p) => p.slug !== project.slug);

  return (
    <>
      <PageHeader
        title={project.title}
        parent={{ label: "Projects", to: "/work/projects" }}
        kicker={program?.title}
        aside={
          project.image && (
            <EditorialImage image={project.image} tilt="r-lg" cast="cast-lg" priority sizes="(min-width: 1024px) 40vw, 90vw" label={program?.title} />
          )
        }
      >
        {project.description && (
          <p className="type-lead mt-7 max-w-[46ch] text-copy">
            {project.description}
          </p>
        )}
        {meta.length > 0 && (
          <dl className="mt-9 inline-flex flex-wrap gap-px overflow-hidden rounded-xl border-2 border-edge bg-[var(--tone-edge)]">
            {meta.map((m) => (
              <div key={m.label} className="bg-ground px-5 py-3">
                <dt className="type-meta text-quiet">{m.label}</dt>
                <dd className="mt-1 font-extrabold text-fg">{m.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </PageHeader>

      {/* The release marker, for HTML scans only (never shown). */}
      {project.releaseMarker && <span hidden data-release-marker={project.releaseMarker} />}

      {rows.length > 0 && (
        <ContentRows
          rows={rows}
          /* The project's facts, as a ticket in a sticky rail beside the
             long-form rows — only the facts the record has. */
          aside={
            meta.length > 0 && (
              <TicketCard
                kicker={project.title}
                tilt="l"
                rows={meta.map((m) => (
                  <div key={m.label}>
                    <p className="type-meta text-quiet">{m.label}</p>
                    <p className="mt-1 text-[20px] font-extrabold leading-snug text-fg">{m.value}</p>
                  </div>
                ))}
                foot={
                  <Button to={t.cta.to} className="w-full">
                    {t.cta.label}
                  </Button>
                }
              />
            )
          }
        />
      )}

      {related.length > 0 && (
        <ProjectList heading={t.related} projects={related} showProgram={false} empty={SITE.placeholder} tone="paper" />
      )}

      <ClosingCta
        heading={t.closing}
        ctas={{ primary: t.cta, secondary: program && { label: program.title, to: program.to } }}
      />
    </>
  );
}

export default function ProjectDetail() {
  const { slug } = useParams();
  const project = projectBySlug(slug);
  useSeo(project ? projectMeta(project) : notFoundMeta());

  return project ? <Detail project={project} /> : <NotFound />;
}
