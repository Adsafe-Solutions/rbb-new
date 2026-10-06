import { useId } from "react";
import useHydrated from "../../hooks/useHydrated.js";
import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import IconPanel from "../../components/IconPanel/IconPanel.jsx";
import Section from "../../components/Section/Section.jsx";
import SectionHeading from "../../components/SectionHeading/SectionHeading.jsx";
import Button from "../../components/Button/Button.jsx";
import StoryList from "../../components/StoryList/StoryList.jsx";
import EventCard from "../../components/EventCard/EventCard.jsx";
import TeaserPair from "../../components/TeaserPair/TeaserPair.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import EmptyPanel from "../../components/EmptyPanel/EmptyPanel.jsx";
import {
  BLOGS,
  EVENTS,
  MEDIA_PAGES,
  NEWS,
  blogCard,
  eventGroup,
  eventPath,
  eventStatus,
  newsPath,
  programBySlug,
  todayIso,
} from "../../content/index.js";

/* /media — the Media Center: the newest of each kind, and the way on to
   all of it (content/media.js).

     paper   PageHeader     what the Media Center holds
     01 white  Latest news  the three newest items  → /media/news
     02 paper  Coming up    the next three events — or, until hydration
                            (or with none ahead), the three newest
                                                     → /media/events
     03 white  From the blog the three newest posts  → /media/blogs
     —  paper  TeaserPair   Impact stories · Events
        accent ClosingCta */
export default function MediaHub() {
  const t = MEDIA_PAGES.hub;
  const list = MEDIA_PAGES.events;
  const hydrated = useHydrated();
  const on = hydrated ? todayIso() : null;

  const newest = (items) => [...items].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const news = newest(NEWS).map((n) => ({
    title: n.title,
    sample: n.releaseMarker,
    category: programBySlug(n.program)?.title,
    excerpt: n.summary,
    date: n.date,
    image: n.image,
    to: newsPath(n),
  }));
  const ahead = on ? [...EVENTS].filter((e) => e.date >= on).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3) : [];
  const events = ahead.length ? ahead : newest(EVENTS);

  return (
    <>
      <PageHeader title={t.heading} kicker={t.kicker} aside={<IconPanel icons={["chart", "community", "document", "partner"]} />}>
        <p className="type-lead mt-7 max-w-[46ch] text-copy">{t.body}</p>
      </PageHeader>

      <Band index={1} tone="white" {...t.news} empty={news.length === 0 && MEDIA_PAGES.news.empty}>
        <StoryList stories={news} className="reveal mt-14" />
      </Band>

      <Band index={2} tone="paper" {...t.events} empty={events.length === 0 && list.none}>
        <ul data-anim-stagger className="gap-cards mt-14 grid sm:grid-cols-2 lg:grid-cols-3">
          {/* Keyed by POSITION, not id: after hydration the newest events
              give way to the next upcoming ones, and new <li>s would arrive
              after the motion system has staggered this list — hidden for
              good. Reusing the three nodes only changes what is in them. */}
          {events.map((event, i) => {
            const status = eventStatus(event, on);
            return (
              <li key={i}>
                <EventCard
                  event={event}
                  href={eventPath(event)}
                  group={eventGroup(event.program)?.label}
                  status={status}
                  statusLabel={status === "upcoming" ? list.upcoming : list.ended}
                  detailsLabel={list.detailsLabel}
                />
              </li>
            );
          })}
        </ul>
      </Band>

      <Band index={3} tone="white" {...t.blogs} empty={BLOGS.length === 0 && MEDIA_PAGES.blogs.empty}>
        <StoryList stories={newest(BLOGS).map(blogCard)} className="reveal mt-14" />
      </Band>

      <TeaserPair first={t.stories} second={t.timeline} />

      <ClosingCta tone="accent" {...MEDIA_PAGES.news.closing} />
    </>
  );
}

/* One "newest of a kind" band: heading, the link to all of it, the list
   — or, with nothing of that kind yet, its page's empty line and the way
   on from it (no "All news" button to an empty page). */
function Band({ index, tone, kicker, heading, cta, empty, children }) {
  const headingId = useId();
  return (
    <Section tone={tone} pad="lg" aria-labelledby={headingId}>
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <SectionHeading id={headingId} index={index} kicker={kicker} heading={heading} />
        {!empty && (
          <Button data-anim="soft" variant="outline" to={cta.to} className="self-start md:self-auto">
            {cta.label}
          </Button>
        )}
      </div>
      {empty ? <EmptyPanel text={empty.text} cta={empty.cta} className="reveal mt-14" /> : children}
    </Section>
  );
}
