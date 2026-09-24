import { useId } from "react";
import { Link } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";
import Mark from "../Mark/Mark.jsx";
import MediaPlaceholder from "../MediaPlaceholder/MediaPlaceholder.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";
import { projectPath } from "../../content/index.js";
import Picture from "../Picture/Picture.jsx";

/* A list of projects — on /work, under each program, and as the whole of
   /work/projects. Projects come from content/work.js and render ONLY the
   fields they have: no location line without a verified location, no
   status without a supplied status.

   With no projects it shows `empty` in a quiet panel instead of cards.
   Document 04 is explicit: never fake cards to fill the layout — so there
   are no placeholder cards here at all, only the statement that projects
   are to come.

   Each card is one link, on the title, stretched over the card: one Tab
   stop, named for the project. Status is WORDS on a chip, never colour
   alone. `programOf(slug)` supplies the program's title for the card's
   label; pass `showProgram={false}` where the program is the page's own.
   The call to action shows beside the heading when there are projects,
   and inside the empty panel when there are none. */
function ProjectCard({ project, programTitle, href }) {
  return (
    <li className="group relative flex flex-col">
      <div className="aspect-[4/3] overflow-hidden rounded-3xl">
        {project.image ? (
          <Picture
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
            src={project.image.src}
            alt={project.image.alt}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        ) : (
          <MediaPlaceholder className="h-full w-full" />
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        {programTitle && (
          <span className="text-[length:var(--text-caption)] font-semibold uppercase tracking-[0.16em] text-trust-blue">
            {programTitle}
          </span>
        )}
        {project.status && (
          <span className="rounded-full bg-mist px-3 py-1 text-[length:var(--text-caption)] font-medium leading-none text-bumble-ink">
            {project.status}
          </span>
        )}
      </div>

      <h3 className="mt-2 font-bold text-[length:var(--text-subheading)] leading-subheading tracking-subheading">
        <Link to={href} className="underline-offset-4 after:absolute after:inset-0 group-hover:underline">
          {project.title}
        </Link>
      </h3>
      {project.location && <p className="mt-1 font-medium text-graphite">{project.location}</p>}
      {project.description && <p className="mt-3 text-graphite">{project.description}</p>}
    </li>
  );
}

export default function ProjectList({
  id,
  kicker,
  heading,
  projects,
  empty,
  cta,
  programOf,
  showProgram = true,
  surface = "paper",
}) {
  const headingId = useId();

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cx("scroll-mt-[var(--header-h)] py-20 md:py-28", surface === "mist" && "bg-mist")}
    >
      <Container>
        <div className="reveal flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <SectionHeading id={headingId} kicker={kicker} heading={heading} />
          {cta && projects.length > 0 && (
            <Button variant="outline" to={cta.to} className="self-start md:self-auto">
              {cta.label}
            </Button>
          )}
        </div>

        {projects.length > 0 ? (
          <ul className="reveal mt-12 grid gap-cards sm:grid-cols-2 md:mt-14 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id ?? project.slug}
                project={project}
                programTitle={showProgram ? programOf?.(project.program) : undefined}
                href={projectPath(project)}
              />
            ))}
          </ul>
        ) : (
          <div
            className={cx(
              "reveal relative mt-12 flex flex-col gap-6 overflow-hidden rounded-3xl p-8 sm:p-10 md:mt-14 md:flex-row md:items-center md:justify-between md:p-12",
              surface === "mist" ? "bg-paper-white" : "bg-mist"
            )}
          >
            <Mark
              className="pointer-events-none absolute -bottom-10 -right-10 text-bumble-honey/10"
              style={{ width: "12rem", height: "12rem" }}
            />
            <p className="relative max-w-xl text-[length:var(--text-subheading)] leading-subheading tracking-subheading text-graphite">
              {empty}
            </p>
            {cta && (
              <Button variant="outline" to={cta.to} className="relative self-start md:self-auto">
                {cta.label}
              </Button>
            )}
          </div>
        )}
      </Container>
    </section>
  );
}
