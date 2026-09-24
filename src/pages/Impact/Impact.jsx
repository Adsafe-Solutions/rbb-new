import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import ImpactStats from "../../components/ImpactStats/ImpactStats.jsx";
import ProgramIndex from "../../components/ProgramIndex/ProgramIndex.jsx";
import TeaserPair from "../../components/TeaserPair/TeaserPair.jsx";
import ContentRows from "../../components/ContentRows/ContentRows.jsx";
import StoriesOfChange from "../../components/StoriesOfChange/StoriesOfChange.jsx";
import TrustPanel from "../../components/TrustPanel/TrustPanel.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import useReveal from "../../hooks/useReveal.js";
import { IMPACT, IMPACT_PAGES, PROGRAMS, SITE, impactStats, metricsNote, storyBySlug, storyCard } from "../../content/index.js";

/* /impact — Document 05, in its section order:

     01  mist band  PageHeader       h1 and the positioning line
     02  mist band  ImpactStats      the headline figures on branded cards (#at-a-glance)
     03  white      ProgramIndex     the four programs → Our Work
     04+05 white    TeaserPair       Where we work · Our approach
     06  white      ContentRows      Evidence & measurement
     07  mist band  StoriesOfChange  approved impact stories (#stories)
     08  white      TrustPanel       reports → Transparency
     09  mist band  ClosingCta       Get Involved · Our Work

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
  useReveal();
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
      <PageHeader title={t.heading} kicker={t.kicker}>
        <p className="mt-5 max-w-prose text-[length:var(--text-subheading)] leading-subheading tracking-subheading text-graphite">
          {t.body}
        </p>
      </PageHeader>

      <ImpactStats
        id={t.glance.id}
        kicker={t.glance.kicker}
        heading={t.glance.heading}
        stats={impactStats()}
        source={IMPACT.metricsSource}
        note={metricsNote()}
        branded
      />

      <ProgramIndex kicker={t.programs.kicker} heading={t.programs.heading} programs={programs} />

      <TeaserPair
        first={{ ...t.teasers.whereWeWork, body: geography.summary ?? undefined }}
        second={{ ...t.teasers.approach, body: approach.intro ?? undefined }}
      />

      <ContentRows
        className="pt-0 md:pt-0"
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

      <StoriesOfChange {...t.stories} items={impactStories} slots={1} />

      <TrustPanel {...t.reports} links={reportLinks} />

      <ClosingCta {...t.closing} />
    </>
  );
}
