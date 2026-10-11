import { Link, useParams } from "react-router-dom";
import useHydrated from "../../hooks/useHydrated.js";
import useSeo from "../../hooks/useSeo.js";
import { RichBlock } from "../../components/RichText/RichText.jsx";
import { formatDate } from "../../lib/dates.js";
import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import Section from "../../components/Section/Section.jsx";
import EditorialImage from "../../components/EditorialImage/EditorialImage.jsx";
import OffsetCard from "../../components/OffsetCard/OffsetCard.jsx";
import Button from "../../components/Button/Button.jsx";
import EventCard from "../../components/EventCard/EventCard.jsx";
import SectionHeading from "../../components/SectionHeading/SectionHeading.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import NotFound from "../NotFound/NotFound.jsx";
import { notFoundMeta, routeMeta } from "../../content/seo.js";
import { EVENTS, MEDIA_PAGES, PROGRAMS, eventById, eventGroup, eventPath, eventStatus, todayIso } from "../../content/index.js";

/* /media/events/:slug — one event (content/media.js):

         paper   PageHeader    ← All events, the date, the program chip,
                               the title and its one line
         white   the event     the photograph, "About this event" and "How
                               the day runs" beside a sticky facts card —
                               date, time, where (with directions when
                               there is a real map link), taking part
         paper   More events   the next three in the directory
         accent  ClosingCta    Volunteer · Contact Us

   A slug that is not an event is the site's ordinary 404. Registration
   is a pending line, never a form: nothing here may look like it books a
   place until RBB has a way to take bookings. */
function Detail({ event }) {
  const t = MEDIA_PAGES.event;
  const list = MEDIA_PAGES.events;
  const hydrated = useHydrated();
  const on = hydrated ? todayIso() : null;
  const status = eventStatus(event, on);
  const group = eventGroup(event.program);
  const program = PROGRAMS.find((p) => p.slug === event.program);
  /* Times are the event's own, in its time zone when it names one
     (events published from the CMS do) — never converted. */
  const time = (event.end ? `${event.start}–${event.end}` : event.start) + (event.timezone ? ` (${event.timezone.replace(/_/g, " ")})` : "");
  const others = EVENTS.filter((e) => e.id !== event.id).slice(0, 3);

  return (
    <>
      <PageHeader title={event.title} parent={{ label: t.back, to: "/media/events" }} crumb={event.title}>
        <p className="type-meta mt-8 flex flex-wrap items-center gap-2.5 text-quiet">
          <time dateTime={event.date} className="text-fg">
            {formatDate(event.date)}
          </time>
          {group && <span className="rounded-lg bg-pop px-2 py-1 text-on-pop">{group.label}</span>}
          {status && <span className="rounded-lg border-2 border-edge px-2 py-0.5 text-fg">{status === "upcoming" ? list.upcoming : list.ended}</span>}
        </p>
        {event.subtitle && <p className="type-lead mt-6 max-w-[46ch] text-copy">{event.subtitle}</p>}
      </PageHeader>

      <Section tone="white" pad="lg">
        {event.releaseMarker && <span hidden data-release-marker={event.releaseMarker} />}
        <div className="grid gap-12 lg:grid-cols-[7fr_4fr] lg:gap-16">
          <div className="min-w-0">
            {event.image && (
              <EditorialImage image={event.image} caption={event.image.caption} ratio="aspect-[16/10]" sizes="(min-width: 1024px) 55vw, 92vw" priority />
            )}

            <section aria-labelledby="about-event" className="reveal mt-14">
              <h2 id="about-event" className="type-meta text-quiet">
                {t.about}
              </h2>
              {event.about.map((text, i) =>
                typeof text === "string" ? (
                  <p key={text} className="mt-5 max-w-[62ch] text-[length:var(--text-body)] leading-[1.75] text-copy">
                    {text}
                  </p>
                ) : (
                  <RichBlock key={i} block={text} index={i} paragraphClass={() => "mt-5 max-w-[62ch] text-[length:var(--text-body)] leading-[1.75] text-copy"} />
                )
              )}
              {program && (
                <p className="mt-6">
                  <Link to={program.to} className="font-bold text-fg underline decoration-2 underline-offset-4">
                    {t.more} {program.title}
                  </Link>
                </p>
              )}
            </section>

            {event.schedule?.length > 0 && (
              <section aria-labelledby="event-schedule" className="reveal mt-14">
                <h2 id="event-schedule" className="type-meta text-quiet">
                  {t.schedule}
                </h2>
                <ol className="mt-6 border-l-2 border-edge">
                  {event.schedule.map((step) => (
                    <li key={step.item} className="relative pb-7 pl-7 last:pb-0">
                      <span aria-hidden="true" className="absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-edge bg-pop" />
                      {step.time && <p className="type-meta text-fg">{step.time}</p>}
                      <p className="mt-1 text-copy">{step.item}</p>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>

          {/* The facts, in the order a visitor asks them. Sticky beside a
              long description on desktop; first under the photograph's
              column on a phone. */}
          <aside className="lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:self-start">
            <OffsetCard pad="md" className="reveal">
              <dl className="grid gap-6">
                <Fact label={t.date}>{formatDate(event.date)}</Fact>
                <Fact label={t.time}>{time}</Fact>
                <Fact label={t.where}>
                  <span className="block font-bold text-fg">{event.venue}</span>
                  <span className="mt-1 block">{event.address}</span>
                  {event.mapUrl && (
                    <Button href={event.mapUrl} variant="outline" size="sm" rel="noopener noreferrer" target="_blank" className="mt-4">
                      {t.directions}
                    </Button>
                  )}
                </Fact>
                <Fact label={t.takePart}>
                  {event.registrationUrl ? (
                    <Button href={event.registrationUrl} size="sm" rel="noopener noreferrer" target="_blank">
                      {t.register}
                    </Button>
                  ) : (
                    t.takePartBody
                  )}
                </Fact>
              </dl>
            </OffsetCard>
          </aside>
        </div>
      </Section>

      {others.length > 0 && (
        <Section tone="paper" pad="lg">
          <SectionHeading heading={t.others} />
          <ul data-anim-stagger className="gap-cards mt-12 grid sm:grid-cols-2 lg:grid-cols-3">
            {others.map((other) => {
              const otherStatus = eventStatus(other, on);
              return (
                <li key={other.id}>
                  <EventCard
                    event={other}
                    href={eventPath(other)}
                    group={eventGroup(other.program)?.label}
                    status={otherStatus}
                    statusLabel={otherStatus === "upcoming" ? list.upcoming : list.ended}
                    detailsLabel={list.detailsLabel}
                  />
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      <ClosingCta tone="accent" {...list.closing} />
    </>
  );
}

function Fact({ label, children }) {
  return (
    <div>
      <dt className="type-meta text-quiet">{label}</dt>
      <dd className="mt-1.5 text-copy">{children}</dd>
    </div>
  );
}

export default function EventDetail() {
  const { slug } = useParams();
  const event = eventById(slug);
  useSeo(event ? routeMeta(eventPath(event), { title: event.seo?.title ?? event.title, description: event.seo?.description ?? event.summary, image: event.seo?.image ?? event.image?.src, imageAlt: event.seo?.image ? event.seo.imageAlt : event.image?.alt, noIndex: event.seo?.noIndex }) : notFoundMeta());
  return event ? <Detail event={event} /> : <NotFound />;
}
