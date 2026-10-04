import { Link } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import ArrowStamp from "../ArrowStamp/ArrowStamp.jsx";
import MediaPlaceholder from "../MediaPlaceholder/MediaPlaceholder.jsx";
import Picture from "../Picture/Picture.jsx";
import { formatDate } from "../../lib/dates.js";

/* A story, set like an item in a publication rather than a blog card:
   the photograph as a framed print, a category stamp, a date, a headline
   in display type.

     story   { title, to, sample?, category?, date?, excerpt?, image? }
             — `sample` is the release marker, carried as an invisible
             `data-release-marker` attribute (never shown)
             — what content/stories.js `storyCard` returns. Only the
             fields a story has are drawn.
     layout  lead  the one feature story: photograph beside a large
                   headline, the excerpt, the full width of the page
             row   a supporting story: small print, headline, one line
             tile  a story in a grid: print on top, headline under

   priority  the lead image is the page's largest element (/stories, on a
             phone it is in the first screen): fetched at once and early,
             never lazy. Only the lead layout uses it, and only where the
             page passes it — on Home and /impact the lead sits far down
             the page and stays lazy. Every other print is always lazy.

   ONE link per story — the headline, stretched over the whole item — so
   it is one Tab stop named for the story. The arrow stamp is decoration.

   The photograph has no hover zoom. The item answers a pointer the way
   every card does: the frame's shadow steps out and the arrow turns. */
function Meta({ story }) {
  if (!story.category && !story.date) return null;
  return (
    <p className="type-meta flex flex-wrap items-center gap-x-3 gap-y-1 text-quiet">
      {story.category && <span className="rounded-lg bg-pop px-2 py-1 text-on-pop">{story.category}</span>}
      {story.date && <time dateTime={story.date}>{formatDate(story.date)}</time>}
    </p>
  );
}

function Print({ story, className, sizes, priority = false }) {
  return (
    <div
      data-tone="card"
      className={cx(
        "rounded-2xl border-rim p-2 transition-[box-shadow] duration-300 sm:p-2.5",
        "cast group-hover:cast-lg group-focus-within:cast-lg",
        className
      )}
    >
      <div className="h-full w-full overflow-hidden rounded-[10px]">
        {story.image?.src ? (
          <Picture
            sizes={sizes}
            src={story.image.src}
            alt={story.image.alt}
            /* Lazy unless this is the page's lead image (see `priority`). */
            loading={priority ? undefined : "lazy"}
            fetchpriority={priority ? "high" : undefined}
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <MediaPlaceholder className="h-full w-full" />
        )}
      </div>
    </div>
  );
}

export default function StoryCard({ story, layout = "tile", headingAs: Heading = "h3", readLabel, priority = false, className = "" }) {
  const link = (
    <Link to={story.to} className="after:absolute after:inset-0">
      {story.title}
    </Link>
  );

  if (layout === "lead") {
    return (
      <article data-release-marker={story.sample} className={cx("group relative grid gap-8 md:grid-cols-[7fr_5fr] md:items-center md:gap-14", className)}>
        <Print story={story} sizes="(min-width: 768px) 55vw, 92vw" className="aspect-[4/3] -rotate-1" priority={priority} />
        <div>
          <Meta story={story} />
          <Heading className="type-title mt-4">{link}</Heading>
          {story.excerpt && <p className="type-lead mt-5 max-w-[46ch] text-copy">{story.excerpt}</p>}
          <p className="mt-7 flex items-center gap-3 font-bold text-fg">
            <ArrowStamp />
            {readLabel}
          </p>
        </div>
      </article>
    );
  }

  if (layout === "row") {
    return (
      <article data-release-marker={story.sample} className={cx("group relative flex items-center gap-5 sm:gap-6", className)}>
        <Print story={story} sizes="10rem" className="aspect-square w-28 shrink-0 sm:w-36" />
        <div className="min-w-0">
          <Meta story={story} />
          <Heading className="type-card mt-2.5">{link}</Heading>
        </div>
      </article>
    );
  }

  return (
    <article data-release-marker={story.sample} className={cx("group relative flex h-full flex-col", className)}>
      <Print story={story} sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw" className="aspect-[4/3]" />
      <div className="mt-6 flex flex-1 flex-col">
        <Meta story={story} />
        <Heading className="type-card mt-3">{link}</Heading>
        {story.excerpt && <p className="mt-3 text-quiet">{story.excerpt}</p>}
      </div>
    </article>
  );
}
