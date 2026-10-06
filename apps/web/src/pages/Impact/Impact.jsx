import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import ImpactStats from "../../components/ImpactStats/ImpactStats.jsx";
import ProgramIndex from "../../components/ProgramIndex/ProgramIndex.jsx";
import TeaserPair from "../../components/TeaserPair/TeaserPair.jsx";
import ContentRows from "../../components/ContentRows/ContentRows.jsx";
import StoriesOfChange from "../../components/StoriesOfChange/StoriesOfChange.jsx";
import TrustPanel from "../../components/TrustPanel/TrustPanel.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import { IMPACT, IMPACT_PAGES, PROGRAMS, SITE, impactStats, metricsNote, storyBySlug, storyCard } from "../../content/index.js";

/* /impact — Document 05, in its section order:

         paper   PageHeader       h1 and the positioning line
     01  ink     ImpactStats      the headline figures, poster-size (#at-a-glance)
     02  white   ProgramIndex     the four programs → Our Work
     03  paper   TeaserPair       Where we work · Our approach, as two posters
     04  white   ContentRows      Evidence & measurement
     05  paper   StoriesOfChange  approved impact stories (#stories)
     06  ink     TrustPanel       reports → Transparency
         accent  ClosingCta       Get Involved · Our Work

   Read like an impact report: numbered chapters, the figures as the
   loudest thing on the page, each still stamped with its status.

   Everything factual comes from content/impact.js, which references the
   programs (content/work.js), the stories (content/stories.js) and the
   transparency links (content/site.js) instead of copying them. */

/* Impact stories are references into the one story collection
   (content/stories.js); only approved ones resolve. */
const impactStories = IMPACT.stories.map(storyBySlug).filter(Boolean).map(storyCard);

/* Reports as links: a file gets `href`, the rest fall back to the shared
   transparency rows. */
const reportLinks = IMPACT.reports.length
  ? IMPACT.reports.map((r) => ({
      title: r.title,
      href: r.url,
      meta: [r.type, r.year].filter(Boolean).join(" · ") || undefined,
    }))
  : SITE.transparencyLinks;

export default function Impact() {
  const t = IMPACT_PAGES.overview;
  const { geography, approach, measurement } = IMPACT;

  /* Each program row reads its name, description and link from Our Work,
     and only its impact line from impact.js. */
  const programs = PROGRAMS.map((program) => {
    const impact = IMPACT.programImpact.find((p) => p.programId === program.slug);
    return { ...program, note: impact?.summary ?? t.programs.pending };
  });

  return (
    <>
      <PageHeader title={t.heading} kicker={t.kicker} highlight="Impact">
        <p className="type-lead mt-7 max-w-[46ch] text-copy">
          {t.body}
        </p>
      </PageHeader>

      <ImpactStats
        index={1}
        id={t.glance.id}
        kicker={t.glance.kicker}
        heading={t.glance.heading}
        stats={impactStats()}
        source={IMPACT.metricsSource}
        note={metricsNote()}
      />

      <ProgramIndex index={2} kicker={t.programs.kicker} heading={t.programs.heading} programs={programs} />

      <TeaserPair
        /* Where We Work only once there is verified geography to point to. */
        first={
          geography.regions.length || geography.countries.length
            ? { ...t.teasers.whereWeWork, body: geography.summary ?? undefined }
            : { ...t.teasers.approach, body: approach.intro ?? undefined }
        }
        second={
          geography.regions.length || geography.countries.length
            ? { ...t.teasers.approach, body: approach.intro ?? undefined }
            : t.teasers.work
        }
      />

      <ContentRows
        start={4}
        rows={[
          {
            id: "measurement",
            heading: t.measurement.heading,
            body: measurement.intro ?? undefined,
            items: [...measurement.methods, ...measurement.evidence],
            empty: t.measurement.empty,
          },
        ]}
      />

      <StoriesOfChange index={5} {...t.stories} items={impactStories} slots={1} />

      <TrustPanel index={6} {...t.reports} links={reportLinks} />

      <ClosingCta tone="accent" {...t.closing} />
    </>
  );
}
