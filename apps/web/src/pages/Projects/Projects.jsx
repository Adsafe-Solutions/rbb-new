import { Link, useSearchParams } from "react-router-dom";
import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import ProjectList from "../../components/ProjectList/ProjectList.jsx";
import SectionLinks from "../../components/SectionLinks/SectionLinks.jsx";
import Container from "../../components/Container/Container.jsx";
import useHydrated from "../../hooks/useHydrated.js";
import { cx } from "../../lib/cx.js";
import { PROGRAMS, PROJECTS, WORK, programBySlug, projectsIn } from "../../content/index.js";

/* /work/projects — the directory of projects (Document 04).

   Every project in content/work.js, as cards; with none, the empty state
   says projects are to come, and nothing pretends otherwise.

   The program filter (Document 04, Document 23 §9) appears only once
   there are FILTER_MIN projects — before that, a filter bar implies a
   dataset that does not exist. It is a row of ordinary links to
   `?program=<slug>` (no script needed to use them), with a visible label,
   the current choice marked with aria-current and in words, and a count.
   The query is applied after hydration (hooks/useHydrated), because the
   page is pre-rendered unfiltered. A program with no projects is not
   offered. Region, status and search filters wait for a bigger dataset.

   Under the list, the four program areas as plain links. */
const FILTER_MIN = 6;
const programTitle = (slug) => programBySlug(slug)?.title;

export default function Projects() {
  const { directory, projects } = WORK;
  const [params] = useSearchParams();
  const hydrated = useHydrated();

  const requested = hydrated ? programBySlug(params.get("program")) : null;
  const current = requested && projectsIn(requested.slug).length ? requested : null;
  const shown = current ? projectsIn(current.slug) : PROJECTS;
  const f = directory.filter;
  const options = PROGRAMS.filter((p) => projectsIn(p.slug).length);

  return (
    <>
      <PageHeader title={directory.heading} parent={{ label: "Our Work", to: "/work" }} kicker={directory.kicker}>
        <p className="type-lead mt-7 max-w-[46ch] text-copy">
          {directory.body}
        </p>
      </PageHeader>

      {PROJECTS.length >= FILTER_MIN && (
        <nav aria-label={f.label} data-tone="white" className="pt-16 md:pt-20">
          <Container>
            <p className="type-meta text-fg">{f.label}</p>
            <ul className="mt-4 flex flex-wrap gap-3">
              {[{ slug: null, title: f.all }, ...options].map((p) => {
                const selected = (current?.slug ?? null) === p.slug;
                return (
                  <li key={p.slug ?? "all"}>
                    <Link
                      to={p.slug ? `/work/projects?program=${p.slug}` : "/work/projects"}
                      aria-current={selected ? "page" : undefined}
                      className={cx(
                        "inline-flex min-h-11 items-center rounded-full border-2 border-trust-blue px-5 py-2.5 font-bold transition-colors",
                        selected
                          ? "bg-bumble-honey text-night shadow-[3px_3px_0_var(--color-trust-blue)]"
                          : "bg-paper-white text-trust-blue hover:bg-mist"
                      )}
                    >
                      {p.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p role="status" className="mt-4 text-quiet">
              {f.showing} {f.projects(shown.length)}
              {current ? ` · ${current.title}` : ""}
            </p>
          </Container>
        </nav>
      )}

      <ProjectList
        heading={current ? `${directory.listHeading} · ${current.title}` : directory.listHeading}
        projects={shown}
        empty={projects.empty}
        programOf={programTitle}
      />

      <SectionLinks
        heading={directory.browse}
        items={PROGRAMS.map(({ title, to }) => ({ label: title, to }))}
      />
    </>
  );
}
