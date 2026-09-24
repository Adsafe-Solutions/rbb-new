import { useParams } from "react-router-dom";
import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import ContentRows from "../../components/ContentRows/ContentRows.jsx";
import ProjectList from "../../components/ProjectList/ProjectList.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import NotFound from "../NotFound/NotFound.jsx";
import useSeo from "../../hooks/useSeo.js";
import { notFoundMeta, projectMeta } from "../../content/seo.js";
import useReveal from "../../hooks/useReveal.js";
import { SITE, WORK, programBySlug, projectBySlug, projectsIn } from "../../content/index.js";
import Picture from "../../components/Picture/Picture.jsx";

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
  useReveal();
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
    project.impact?.length && {
      id: "impact",
      heading: t.impact,
      items: project.impact.map((m) => `${m.value} — ${m.label}`),
    },
    project.partners?.length && { id: "partners", heading: t.partners, items: project.partners },
    project.story && { id: "story", heading: t.story, body: [project.story.title, project.story.excerpt] },
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
            <div className="reveal aspect-[4/3] overflow-hidden rounded-3xl rounded-tr-[6rem]">
              <Picture sizes="(min-width: 1024px) 40vw, 90vw" src={project.image.src} alt={project.image.alt} className="h-full w-full object-cover" />
            </div>
          )
        }
      >
        {project.description && (
          <p className="mt-5 max-w-prose text-[length:var(--text-subheading)] leading-subheading tracking-subheading text-graphite">
            {project.description}
          </p>
        )}
        {meta.length > 0 && (
          <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
            {meta.map((m) => (
              <div key={m.label}>
                <dt className="text-[length:var(--text-caption)] font-semibold uppercase tracking-[0.16em] text-trust-blue">
                  {m.label}
                </dt>
                <dd className="mt-1 font-medium text-bumble-ink">{m.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </PageHeader>

      {rows.length > 0 && <ContentRows rows={rows} />}

      {related.length > 0 && (
        <ProjectList heading={t.related} projects={related} showProgram={false} empty={SITE.placeholder} />
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
