import { Link } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import MediaPlaceholder from "../MediaPlaceholder/MediaPlaceholder.jsx";
import OffsetCard from "../OffsetCard/OffsetCard.jsx";
import Picture from "../Picture/Picture.jsx";

/* One event in the /media/events directory (content/media.js): a
   photograph with a printed date stamp in its corner, the program and
   status chips, the title, when and where, one line, and "Event details".

   `status` is "upcoming", "ended" or null. It is decided in the browser
   after hydration (pages/Events) — the pre-rendered page cannot know
   today's date — so until then no status chip is drawn. Status is WORDS
   in a chip, never colour alone.

   Square to the page: a directory is read and compared, so it does not
   lean. One link — the title — stretched over the card. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function EventCard({ event, href, group, status, statusLabel, detailsLabel, className = "" }) {
  const [, month, day] = event.date.split("-").map(Number);
  const when = [event.end ? `${event.start}–${event.end}` : event.start, event.venue].filter(Boolean).join(" · ");

  return (
    <OffsetCard as="article" pad="none" lift className={cx("group flex h-full flex-col overflow-hidden", className)}>
      {event.releaseMarker && <span hidden data-release-marker={event.releaseMarker} />}
      <div className="relative aspect-[16/10] shrink-0 border-b-2 border-[var(--tone-rim)]">
        {event.image?.src ? (
          <Picture
            src={event.image.src}
            alt={event.image.alt}
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <MediaPlaceholder className="absolute inset-0" />
        )}
        {/* The date as a printed stamp: day over month. The full date is
            in the <time> below for anyone not reading the picture. */}
        <span
          aria-hidden="true"
          className="absolute left-4 top-4 flex w-14 flex-col items-center rounded-xl border-2 border-trust-blue bg-paper-white py-1.5 text-trust-blue shadow-[3px_3px_0_var(--color-trust-blue)]"
        >
          <span className="text-[22px] font-black leading-none">{day}</span>
          <span className="type-meta mt-1 text-[11px]">{MONTHS[month - 1]}</span>
        </span>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <p className="type-meta flex flex-wrap items-center gap-2">
          {group && <span className="rounded-lg bg-pop px-2 py-1 text-on-pop">{group}</span>}
          {status && (
            <span className={cx("rounded-lg border-2 px-2 py-0.5", status === "upcoming" ? "border-edge text-fg" : "border-hair text-quiet")}>
              {statusLabel}
            </span>
          )}
        </p>
        <h3 className="type-card mt-4">
          <Link to={href} className="after:absolute after:inset-0 after:rounded-2xl">
            {event.title}
          </Link>
        </h3>
        <p className="mt-2 text-[15px] font-semibold text-quiet">
          <time dateTime={event.date} className="sr-only">
            {event.date}
          </time>
          {when}
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-copy">{event.summary}</p>
        <p aria-hidden="true" className="mt-auto pt-6 text-[15px] font-bold text-fg underline decoration-2 underline-offset-4">
          {detailsLabel} →
        </p>
      </div>
    </OffsetCard>
  );
}
