import PosterHero from "../../components/PosterHero/PosterHero.jsx";
import EditorialSplit from "../../components/EditorialSplit/EditorialSplit.jsx";
import ProgramAreas from "../../components/ProgramAreas/ProgramAreas.jsx";
import ApproachFlow from "../../components/ApproachFlow/ApproachFlow.jsx";
import ImpactStats from "../../components/ImpactStats/ImpactStats.jsx";
import ProgressTimeline from "../../components/ProgressTimeline/ProgressTimeline.jsx";
import StoriesOfChange from "../../components/StoriesOfChange/StoriesOfChange.jsx";
import TrustPanel from "../../components/TrustPanel/TrustPanel.jsx";
import GetInvolved from "../../components/GetInvolved/GetInvolved.jsx";
import CtaSection from "../../components/CtaSection/CtaSection.jsx";
import VideoFeature from "../../components/VideoFeature/VideoFeature.jsx";
import Faq from "../../components/Faq/Faq.jsx";
import AppealGrid from "../../components/AppealGrid/AppealGrid.jsx";
import FeaturedBand from "../../components/FeaturedBand/FeaturedBand.jsx";
import StoryList from "../../components/StoryList/StoryList.jsx";
import EventCard from "../../components/EventCard/EventCard.jsx";
import useHydrated from "../../hooks/useHydrated.js";
import { resolveTones } from "../../lib/bandTones.js";
import {
  APPEALS,
  BLOGS,
  BRAND,
  EVENTS,
  HOMEPAGE,
  MEDIA_PAGES,
  NEWS,
  SITE,
  appealsOf,
  blogCard,
  blogPath,
  eventGroup,
  eventPath,
  eventStatus,
  metricStats,
  latestStories,
  metricsNote,
  newsPath,
  pathCards,
  programBySlug,
  storyCard,
  todayIso,
  transparencyLinks,
} from "../../content/index.js";

/* The homepage as the CMS published it: its blocks, in the editor's
   order, each drawn by the component the source homepage already uses
   for it (pages/Home) — same typography, colour, spacing and motion.

   RENDERERS is the explicit, allowlisted type → component table; a block
   type not in it stops the build (CMS data never names a component).

   Colour: every band keeps the tone it has on the source homepage, unless
   that would put two neighbours on the same ground — then it takes its
   alternative, so the colour-blocking holds in any order; and the page
   never closes on Deep Trust Blue, which would merge into the footer.
   Numbering counts the bands as the source page does (not the hero, not
   a call to action). A block whose records are all absent (no stories,
   no timeline events, no appeals) is left out, as on the source page. */

const TONES = {
  hero: ["paper"],
  imageText: ["white", "paper"],
  programs: ["ink", "paper", "white"],
  approach: ["accent", "paper", "white"],
  stats: ["paper", "white"],
  timeline: ["white", "paper"],
  stories: ["paper", "white"],
  video: ["white", "paper"],
  trust: ["ink", "white", "paper"],
  getInvolved: ["white", "paper"],
  faq: ["paper", "white"],
  cta: ["accent", "paper"],
  appealList: ["white", "paper"],
  postList: ["white", "paper"],
  eventList: ["paper", "white"],
};
const UNNUMBERED = new Set(["hero", "cta"]);

const programOf = (slug) => programBySlug(slug)?.title;
const statsFor = (ids) => metricStats(ids, "Homepage");
const bySlug = (list, slug, what) => {
  const found = list.find((item) => item.id === slug);
  if (!found) throw new Error(`Homepage: the ${what} "${slug}" is not on this site`);
  return found;
};

function EventBand({ index, tone, data }) {
  const hydrated = useHydrated();
  const on = hydrated ? todayIso() : null;
  const list = MEDIA_PAGES.events;
  const events = data.events.map((slug) => bySlug(EVENTS, slug, "event"));
  return (
    <FeaturedBand index={index} tone={tone} kicker={data.kicker} heading={data.heading} highlight={data.highlight} cta={data.cta}>
      <ul data-anim-stagger className="gap-cards mt-14 grid sm:grid-cols-2 lg:grid-cols-3">
        {events.map((event, i) => {
          const status = eventStatus(event, on);
          return (
            <li key={i}>
              <EventCard event={event} href={eventPath(event)} group={eventGroup(event.program)?.label} status={status} statusLabel={status === "upcoming" ? list.upcoming : list.ended} detailsLabel={list.detailsLabel} />
            </li>
          );
        })}
      </ul>
    </FeaturedBand>
  );
}

const newsCard = (n) => ({ title: n.title, sample: n.releaseMarker, category: programBySlug(n.program)?.title, excerpt: n.summary, date: n.date, image: n.image, to: newsPath(n) });

const RENDERERS = {
  hero: ({ data }) => <PosterHero kicker={BRAND.fullName} slides={data.slides} ctas={{ secondary: data.secondary }} controls={HOMEPAGE.hero.controls} interval={data.interval} />,
  imageText: ({ index, tone, data }) => (
    <EditorialSplit index={index} tone={tone} kicker={data.kicker} heading={data.heading} highlight={data.highlight} body={data.body} cta={data.cta} secondary={data.secondary} image={data.image} reverse={data.imagePosition === "left"} />
  ),
  programs: ({ index, tone, data }) => <ProgramAreas index={index} tone={tone} kicker={data.kicker} heading={data.heading} highlight={data.highlight} intro={data.body} cta={data.cta} items={HOMEPAGE.programs.items} />,
  approach: ({ index, tone, data }) => <ApproachFlow index={index} tone={tone} kicker={data.kicker} heading={data.heading} highlight={data.highlight} intro={data.body} steps={[]} cta={data.cta} />,
  stats: ({ index, tone, data }) => (
    <ImpactStats index={index} tone={tone} kicker={data.kicker} heading={data.heading} highlight={data.highlight} body={data.body} stats={statsFor(data.metricIds)} note={metricsNote()} source={data.source} cta={data.cta} />
  ),
  timeline: ({ index, tone, data }) => (
    <ProgressTimeline index={index} tone={tone} highlight={data.highlight} programOf={programOf} timeline={{ ...data, playLabel: HOMEPAGE.timeline.playLabel, viewportLabel: HOMEPAGE.timeline.viewportLabel }} />
  ),
  stories: ({ index, tone, data }) => (
    <StoriesOfChange index={index} tone={tone} kicker={data.kicker} heading={data.heading} highlight={data.highlight} intro={data.body} items={latestStories(data.count).map(storyCard)} fallback={HOMEPAGE.stories.fallback} readLabel={HOMEPAGE.stories.readLabel} cta={data.cta} />
  ),
  video: ({ index, tone, data }) => <VideoFeature index={index} tone={tone} highlight={data.highlight} video={{ ...data, playLabel: HOMEPAGE.video.playLabel }} />,
  trust: ({ index, tone, data }) => (
    <TrustPanel index={index} tone={tone} kicker={data.kicker} heading={data.heading} highlight={data.highlight} body={data.body} links={transparencyLinks()} linkMeta={SITE.transparencyLinkMeta} cta={data.cta} />
  ),
  getInvolved: ({ index, tone, data }) => <GetInvolved index={index} tone={tone} kicker={data.kicker} heading={data.heading} highlight={data.highlight} intro={data.body} cta={data.cta} items={pathCards()} />,
  faq: ({ id, index, tone, data }) => <Faq id={id} index={index} tone={tone} kicker={data.kicker} heading={data.heading} highlight={data.highlight} items={data.items} />,
  cta: ({ tone, data }) => <CtaSection tone={tone} highlight={data.highlight} heading={data.heading} body={data.body} ctas={data.ctas} />,
  appealList: ({ index, tone, data }) => (
    <AppealGrid index={index} tone={tone} kicker={data.kicker} heading={data.heading} highlight={data.highlight} cta={data.cta} appeals={data.appeals ? data.appeals.map((slug) => bySlug(APPEALS, slug, "appeal")) : data.kind ? appealsOf(data.kind === "campaign" ? "campaigns" : "emergency") : APPEALS} />
  ),
  postList: ({ index, tone, data }) => (
    <FeaturedBand index={index} tone={tone} kicker={data.kicker} heading={data.heading} highlight={data.highlight} cta={data.cta}>
      <StoryList
        className="reveal mt-14"
        stories={data.posts.map(({ collection, slug }) => (collection === "blogs" ? { ...blogCard(bySlug(BLOGS, slug, "blog post")), to: blogPath({ id: slug }) } : newsCard(bySlug(NEWS, slug, "news item"))))}
      />
    </FeaturedBand>
  ),
  eventList: EventBand,
};

/* Whether a block has anything to show (the source page's own rules). */
const shows = ({ type, data }) =>
  type === "timeline" ? data.events.length > 0 : type === "stories" ? latestStories(data.count).length > 0 : type === "faq" ? data.items.length > 0 : type === "appealList" ? (data.appeals?.length ?? (data.kind ? appealsOf(data.kind === "campaign" ? "campaigns" : "emergency") : APPEALS).length) > 0 : true;

export default function CmsHome({ page }) {
  const blocks = page.sections.filter(shows);
  const tones = resolveTones(blocks.map((b) => b.type), TONES);
  let n = 0;
  return (
    <>
      {blocks.map((block, i) => {
        const Renderer = RENDERERS[block.type];
        if (!Renderer) throw new Error(`Homepage: no renderer for a "${block.type}" block`);
        const index = UNNUMBERED.has(block.type) ? undefined : ++n;
        return <Renderer key={block.id} id={block.id} index={index} tone={tones[i]} data={block.data} />;
      })}
    </>
  );
}

export const CMS_HOME_RENDERERS = Object.keys(RENDERERS);
