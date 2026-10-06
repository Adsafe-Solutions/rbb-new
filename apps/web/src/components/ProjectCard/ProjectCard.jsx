import { Link } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import ArrowStamp from "../ArrowStamp/ArrowStamp.jsx";
import MediaPlaceholder from "../MediaPlaceholder/MediaPlaceholder.jsx";
import OffsetCard from "../OffsetCard/OffsetCard.jsx";
import Picture from "../Picture/Picture.jsx";

/* A project as a printed piece: the photograph across the top of the
   sheet, a line of metadata, the title in display type, a sentence, and
   the arrow stamp that says it opens.

   ONLY the fields a project has are drawn — no location without a
   verified location, no status without a supplied one (content/work.js).
   Status is WORDS in a chip, never colour alone.

     project   the record: { title, description?, location?, status?, image? }
     href      its page
     program   the program's title, for the label (omit where the page
               is already that program's)
     wide      the feature layout: photograph beside the copy from `md`
               up. For the first card of an editorial grid.

   One link — the title — stretched over the card. */
export default function ProjectCard({ project, href, program, tilt, wide = false, headingAs: Heading = "h3", className = "" }) {
  const meta = [program, project.location].filter(Boolean);

  return (
    <OffsetCard
      as="article"
      pad="none"
      tilt={tilt}
      lift
      /* Invisible: the release marker for HTML scans (content/work.js). */
      data-release-marker={project.releaseMarker}
      className={cx("group flex h-full flex-col overflow-hidden", wide && "md:flex-row", className)}
    >
      <div className={cx("relative shrink-0 border-b-2 border-[var(--tone-rim)]", wide ? "aspect-[16/10] md:aspect-auto md:w-1/2 md:border-b-0 md:border-r-2" : "aspect-[16/10]")}>
        {project.image?.src ? (
          <Picture
            sizes={wide ? "(min-width: 768px) 45vw, 92vw" : "(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"}
            src={project.image.src}
            alt={project.image.alt}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <MediaPlaceholder className="absolute inset-0" />
        )}
        {project.status && (
          <span className="type-meta absolute left-4 top-4 rounded-lg bg-paper-white px-2.5 py-1.5 text-trust-blue shadow-[2px_2px_0_var(--color-trust-blue)]">
            {project.status}
          </span>
        )}
      </div>

      <div className={cx("flex flex-1 flex-col p-6 md:p-7", wide && "md:justify-center md:p-10")}>
        {meta.length > 0 && <p className="type-meta text-quiet">{meta.join(" · ")}</p>}
        <Heading className={cx(wide ? "type-title" : "type-card", meta.length > 0 && "mt-3")}>
          <Link to={href} className="after:absolute after:inset-0 after:rounded-2xl">
            {project.title}
          </Link>
        </Heading>
        {project.description && <p className="mt-3 max-w-[48ch] text-quiet">{project.description}</p>}
        <div className="mt-auto flex justify-end pt-6">
          <ArrowStamp />
        </div>
      </div>
    </OffsetCard>
  );
}
