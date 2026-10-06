import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import ProgressTimeline from "../../components/ProgressTimeline/ProgressTimeline.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import Section from "../../components/Section/Section.jsx";
import EmptyPanel from "../../components/EmptyPanel/EmptyPanel.jsx";
import { MEDIA_PAGES, NEWS, newsPath, programBySlug } from "../../content/index.js";

/* /media/news — the news as a timeline, the same component and motion as
   the homepage's "Work that reaches communities" (components/
   ProgressTimeline): oldest first, the section pins and the page's own
   scroll slides the row along, the current item ringed. Each card here
   is a photograph and a link to the item's page rather than a video.

         paper   PageHeader        what the news is
         white   ProgressTimeline  every item, oldest → newest — or, with
                                   none yet, what will appear here
         accent  ClosingCta        Media Center · Events */
export default function News() {
  const t = MEDIA_PAGES.news;
  const programOf = (slug) => programBySlug(slug)?.title;
  const timeline = {
    ...t.timeline,
    events: NEWS.map((item) => ({
      id: item.id,
      date: item.date,
      program: item.program,
      title: item.title,
      summary: item.summary,
      image: item.image,
      to: newsPath(item),
      releaseMarker: item.releaseMarker,
    })),
  };

  return (
    <>
      <PageHeader title={t.heading} kicker={t.kicker} parent={{ label: "Media Center", to: "/media" }}>
        <p className="type-lead mt-7 max-w-[46ch] text-copy">{t.body}</p>
      </PageHeader>

      {NEWS.length > 0 ? (
        <ProgressTimeline index={1} timeline={timeline} programOf={programOf} />
      ) : (
        <Section tone="white" pad="lg">
          <EmptyPanel text={t.empty.text} cta={t.empty.cta} className="reveal" />
        </Section>
      )}

      <ClosingCta tone="accent" {...t.closing} />
    </>
  );
}
