import { useId } from "react";
import { Link, useSearchParams } from "react-router-dom";
import useHydrated from "../../hooks/useHydrated.js";
import { cx } from "../../lib/cx.js";
import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import Section from "../../components/Section/Section.jsx";
import FilterChips from "../../components/FilterChips/FilterChips.jsx";
import EventCard from "../../components/EventCard/EventCard.jsx";
import EmptyPanel from "../../components/EmptyPanel/EmptyPanel.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import { EVENTS, EVENT_GROUPS, MEDIA_PAGES, eventGroup, eventPath, eventStatus, todayIso } from "../../content/index.js";

/* /media/events — every event, in one place (content/media.js):

         paper   PageHeader    what's on, and how to narrow it
         white   the directory  program chips, a count, the event cards
                                (newest first), and pages of nine
         accent  ClosingCta    Get Involved

   The program chips are links to `?program=`, and the pages to `?page=`,
   both on this same address — applied after hydration (hooks/
   useHydrated), so the pre-rendered list is always the whole first page.

   Upcoming / Ended is worked out from today's date in the browser, also
   after hydration: the pre-rendered page was built on another day. */
const PER_PAGE = 9;

export default function Events() {
  const t = MEDIA_PAGES.events;
  const headingId = useId();
  const [params] = useSearchParams();
  const hydrated = useHydrated();
  const on = hydrated ? todayIso() : null;

  const requested = hydrated ? eventGroup(params.get("program")) : null;
  const current = requested && EVENTS.some((e) => e.program === requested.id) ? requested : null;
  const list = current ? EVENTS.filter((e) => e.program === current.id) : EVENTS;

  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const page = hydrated ? Math.min(pages, Math.max(1, Number(params.get("page")) || 1)) : 1;
  const shown = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const query = (next) => {
    const q = new URLSearchParams();
    if (current) q.set("program", current.id);
    if (next > 1) q.set("page", String(next));
    const s = q.toString();
    return `/media/events${s ? `?${s}` : ""}#events`;
  };

  /* Only programs that have an event get a chip — no filter that leads to
     an empty list (Document 07). */
  const chips = [
    { id: null, label: t.all, to: "/media/events#events" },
    ...EVENT_GROUPS.filter((g) => EVENTS.some((e) => e.program === g.id)).map((g) => ({
      id: g.id,
      label: g.label,
      to: `/media/events?program=${g.id}#events`,
    })),
  ];

  return (
    <>
      <PageHeader title={t.heading} kicker={t.kicker} parent={{ label: "Media Center", to: "/media" }} highlight="one place">
        <p className="type-lead mt-7 max-w-[46ch] text-copy">{t.body}</p>
      </PageHeader>

      <Section id="events" tone="white" pad="lg" aria-labelledby={headingId}>
        <h2 id={headingId} className="sr-only">
          {current ? current.label : t.all}
        </h2>
        {EVENTS.length > 0 && (
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <FilterChips label={t.all} items={chips} current={current?.id ?? null} />
            <p className="type-meta shrink-0 text-quiet" aria-live="polite">
              {t.count(list.length)}
            </p>
          </div>
        )}

        {EVENTS.length === 0 ? (
          /* Nothing scheduled: no filters over nothing (Document 07). */
          <EmptyPanel text={t.none.text} cta={t.none.cta} className="reveal" />
        ) : shown.length > 0 ? (
          <ul data-anim-stagger className="gap-cards mt-12 grid sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((event) => {
              const status = eventStatus(event, on);
              return (
                <li key={event.id}>
                  <EventCard
                    event={event}
                    href={eventPath(event)}
                    group={eventGroup(event.program)?.label}
                    status={status}
                    statusLabel={status === "upcoming" ? t.upcoming : t.ended}
                    detailsLabel={t.detailsLabel}
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyPanel text={t.empty} className="reveal mt-12" />
        )}

        {pages > 1 && (
          <nav aria-label={t.pagination.label} className="mt-14 flex items-center justify-center gap-2">
            {page > 1 && (
              <PageLink to={query(page - 1)} label={t.pagination.previous}>
                ‹
              </PageLink>
            )}
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <PageLink key={n} to={query(n)} label={t.pagination.page(n)} current={n === page}>
                {n}
              </PageLink>
            ))}
            {page < pages && (
              <PageLink to={query(page + 1)} label={t.pagination.next}>
                ›
              </PageLink>
            )}
          </nav>
        )}
      </Section>

      <ClosingCta tone="accent" {...t.closing} />
    </>
  );
}

function PageLink({ to, label, current, children }) {
  return (
    <Link
      to={to}
      aria-label={label}
      aria-current={current ? "page" : undefined}
      className={cx(
        "inline-flex h-11 min-w-11 items-center justify-center rounded-xl border-2 border-edge px-3 font-bold transition-colors",
        current ? "bg-pop text-on-pop" : "text-fg hover:bg-flip hover:text-on-flip"
      )}
    >
      {children}
    </Link>
  );
}
