import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import ImpactStats from "../../components/ImpactStats/ImpactStats.jsx";
import ProgramIndex from "../../components/ProgramIndex/ProgramIndex.jsx";
import TeaserPair from "../../components/TeaserPair/TeaserPair.jsx";
import ContentRows from "../../components/ContentRows/ContentRows.jsx";
import StoriesOfChange from "../../components/StoriesOfChange/StoriesOfChange.jsx";
import TrustPanel from "../../components/TrustPanel/TrustPanel.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import { resolveTones } from "../../lib/bandTones.js";
import { IMPACT_PAGES, PROGRAMS, SITE, STORIES, metricStats, metricsNote, storyBySlug, storyCard, transparencyLinks } from "../../content/index.js";

/* The Impact page as the CMS published it: its chapters, in the editor's
   order, each drawn by the component pages/Impact already uses for it —
   same typography, colour, spacing and motion.

   RENDERERS is the explicit, allowlisted type → component table; a block
   type not in it stops the build. Chapters keep their addresses
   (#at-a-glance, #measurement, #stories — the menu links to two of them),
   whatever the block's own id. Numbering counts the chapters, not the
   introduction or the closing ask; the two posters take a number without
   showing one, as on /impact. Colour follows lib/bandTones.

   What the blocks NAME is resolved here, never copied: the figures (the
   published figures — content/impact.js), the programs (content/work.js),
   the stories, by id (content/stories.js — the CMS's published stories
   once it has any; an id that is no story stops the build, and the
   website's own unapproved stories are left out, as on /impact) and the
   transparency links (content/transparency.js). The "to be provided"
   lines stay the site's own (IMPACT_PAGES). */

const TONES = {
  intro: { start: "paper", end: "paper" },
  stats: ["ink", "white", "paper"],
  programImpact: ["white", "paper"],
  teasers: ["paper", "white"],
  measurement: ["white", "paper"],
  stories: ["paper", "white"],
  trust: ["ink", "white", "paper"],
  cta: ["accent", "paper"],
};
const UNNUMBERED = new Set(["intro", "cta"]);
const t = IMPACT_PAGES.overview;

const programNotes = (items) => {
  const notes = new Map(items.map((i) => [i.programId, i.summary]));
  for (const slug of notes.keys()) if (!PROGRAMS.some((p) => p.slug === slug)) throw new Error(`Impact page: no program "${slug}" (content/work.js or the CMS's published programs)`);
  return PROGRAMS.map((program) => ({ ...program, note: notes.get(program.slug) ?? t.programs.pending }));
};
const storiesOf = (ids) =>
  ids
    .map((id) => {
      const story = STORIES.find((s) => s.id === id);
      if (!story) throw new Error(`Impact page: no story "${id}" (content/stories.js or the CMS's published stories)`);
      // Never silently left out (M15): a story the page names must be one the site shows.
      const shown = storyBySlug(story.slug);
      if (!shown) throw new Error(`Impact page: story "${id}" is not published`);
      return shown;
    })
    .filter(Boolean)
    .map(storyCard);

const RENDERERS = {
  intro: ({ data }) => (
    <PageHeader title={data.title} kicker={data.kicker} highlight={data.highlight}>
      <p className="type-lead mt-7 max-w-[46ch] text-copy">{data.body}</p>
    </PageHeader>
  ),
  stats: ({ index, tone, data }) => <ImpactStats index={index} id={t.glance.id} tone={tone} kicker={data.kicker} heading={data.heading} highlight={data.highlight} body={data.body} stats={metricStats(data.metricIds, "Impact page")} source={data.source} note={metricsNote()} cta={data.cta} />,
  programImpact: ({ index, tone, data }) => <ProgramIndex index={index} tone={tone} kicker={data.kicker} heading={data.heading} programs={programNotes(data.items)} />,
  teasers: ({ tone, data }) => <TeaserPair tone={tone} first={data.first} second={data.second} />,
  measurement: ({ index, tone, data }) => <ContentRows tone={tone} start={index} rows={[{ id: "measurement", heading: data.heading, body: data.body, items: data.items, empty: t.measurement.empty }]} />,
  stories: ({ index, tone, data }) => <StoriesOfChange index={index} tone={tone} id={t.stories.id} kicker={data.kicker} heading={data.heading} highlight={data.highlight} items={storiesOf(data.storyIds)} fallback={t.stories.fallback} readLabel={t.stories.readLabel} cta={data.cta} />,
  trust: ({ index, tone, data }) => <TrustPanel index={index} tone={tone} kicker={data.kicker} heading={data.heading} highlight={data.highlight} body={data.body} links={transparencyLinks()} linkMeta={SITE.transparencyLinkMeta} cta={data.cta} />,
  cta: ({ tone, data }) => <ClosingCta tone={tone} heading={data.heading} highlight={data.highlight} body={data.body} ctas={data.ctas} image={data.image} />,
};

export default function CmsImpact({ page }) {
  const blocks = page.sections;
  const tones = resolveTones(blocks.map((b) => b.type), TONES);
  let n = 0;
  return (
    <>
      {blocks.map((block, i) => {
        const Renderer = RENDERERS[block.type];
        if (!Renderer) throw new Error(`Impact page: no renderer for a "${block.type}" block`);
        const index = UNNUMBERED.has(block.type) ? undefined : ++n;
        return <Renderer key={block.id} index={index} tone={tones[i]} data={block.data} />;
      })}
    </>
  );
}
