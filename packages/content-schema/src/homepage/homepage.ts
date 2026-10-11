import { z } from "zod";
import { recordFields } from "../common/record.ts";
import { EntityId, IsoDate, MediaId, ReleaseMarker, Slug, YouTubeId, text } from "../common/primitives.ts";
import { Link } from "../common/link.ts";
import { SeoOverrides } from "../seo/seo.ts";
import { AppealListData, CtaData, FaqData, ImageTextData, StatsData, TrustData, highlightIn, highlightIssue, sectionBlock } from "../sections/blocks.ts";
import { MAX_SECTIONS } from "../sections/allowlists.ts";
import { HOMEPAGE_BLOCKS, HOMEPAGE_BLOCK_TYPES } from "./registry.ts";

/* The homepage — an ORDERED LIST OF BLOCKS (M8), each the shared section
   envelope { id, type, enabled, version, data }.

   M1 modelled the homepage as twelve NAMED SLOTS in a fixed order. M8 asks
   for blocks an editor can add, reorder and switch off, so the slots
   became block types — each keeping exactly its M1 data shape:

     M1 slot        block type    data
     hero           hero          HomepageHero
     whoWeAre       imageText     ImageTextData        (a shared block)
     programs       programs      SlotHeading
     approach       approach      SlotHeading
     impact         stats         StatsData            (a shared block)
     timeline       timeline      SlotHeading + items
     stories        stories       SlotHeading + count
     video          video         HomepageVideo
     transparency   trust         TrustData            (a shared block)
     getInvolved    getInvolved   SlotHeading + imageIds
     faq            faq           FaqData              (a shared block)
     finalCta       cta           CtaData + cardImageId (a shared block)

   plus the blocks that REFERENCE other records rather than copy them:

     appealList     AppealListData (the shared block) + optional appealIds
     postList       NEW — chosen posts, by id
     eventList      NEW — chosen events, by id

   Several blocks hold only their own heading: the cards beneath them come
   from other records — programs from the program records, stories from
   the latest published stories, the ways to take part from the Get
   Involved paths — so nothing is written twice. A disabled block stays in
   the record and is left out of the published page. registry.ts is the
   registry: names, single/first rules, references. */

/* A block's own heading, with an optional line and link. */
export const SlotHeading = z
  .strictObject({
    kicker: text(60).optional(),
    heading: text(160),
    highlight: text(60).optional(),
    body: text(600).optional(),
    cta: Link.optional(),
  })
  .refine(highlightIn, highlightIssue);

/* One slide of the hero slideshow: a headline of up to three short lines
   (the last word takes the highlight), its button and two photographs. */
export const HeroSlide = z.strictObject({
  id: EntityId,
  headline: z.array(text(40)).min(1).max(3),
  cta: Link,
  imageId: MediaId,
  insetId: MediaId,
});

export const HomepageHero = z.strictObject({
  slides: z
    .array(HeroSlide)
    .min(1)
    .max(6)
    .refine((slides) => new Set(slides.map((s) => s.id)).size === slides.length, "slide ids must be unique"),
  /* The second button, the same on every slide. */
  secondaryCta: Link,
  /* How long each slide stays. */
  intervalMs: z.int().min(3000).max(20000),
});

/* A milestone on the progress timeline: a short film with its date. */
export const TimelineItem = z.strictObject({
  id: EntityId,
  date: IsoDate,
  programId: Slug,
  title: text(120),
  summary: text(300),
  youtubeId: YouTubeId,
  videoTitle: text(160),
  posterId: MediaId,
  releaseMarker: ReleaseMarker.optional(),
});

export const HomepageVideo = z
  .strictObject({
    kicker: text(60).optional(),
    heading: text(160),
    highlight: text(60).optional(),
    body: text(600).optional(),
    youtubeId: YouTubeId,
    title: text(160),
    posterId: MediaId,
    releaseMarker: ReleaseMarker.optional(),
  })
  .refine(highlightIn, highlightIssue);

/* Chosen records, by id — never copies of them. */
const chosenIds = (what: string) =>
  z
    .array(EntityId)
    .min(1)
    .max(6)
    .refine((ids) => new Set(ids).size === ids.length, `${what} is chosen twice`);

export const PostListData = z
  .strictObject({ kicker: text(60).optional(), heading: text(160), highlight: text(60).optional(), postIds: chosenIds("a post"), cta: Link.optional() })
  .refine(highlightIn, highlightIssue);
export const EventListData = z
  .strictObject({ kicker: text(60).optional(), heading: text(160), highlight: text(60).optional(), eventIds: chosenIds("an event"), cta: Link.optional() })
  .refine(highlightIn, highlightIssue);
export const HomepageAppealListData = AppealListData.safeExtend({
  /* Chosen appeals; without them, every published appeal (of `kind`). */
  appealIds: chosenIds("an appeal").optional(),
});

const TimelineData = SlotHeading.safeExtend({ items: z.array(TimelineItem).max(12) });
const StoriesData = SlotHeading.safeExtend({ count: z.int().min(1).max(6) });
const GetInvolvedData = SlotHeading.safeExtend({ imageIds: z.record(Slug, MediaId) });
const HomepageCtaData = CtaData.safeExtend({ cardImageId: MediaId.optional() });

/* type → data schema: the registry's schemas. */
export const HOMEPAGE_SECTION_SCHEMAS = {
  hero: HomepageHero,
  imageText: ImageTextData,
  programs: SlotHeading,
  approach: SlotHeading,
  stats: StatsData,
  timeline: TimelineData,
  stories: StoriesData,
  video: HomepageVideo,
  trust: TrustData,
  getInvolved: GetInvolvedData,
  faq: FaqData,
  cta: HomepageCtaData,
  appealList: HomepageAppealListData,
  postList: PostListData,
  eventList: EventListData,
} as const satisfies Record<(typeof HOMEPAGE_BLOCK_TYPES)[number], z.ZodType>;

/* Any homepage block. An unknown `type` is refused — there is no generic
   or free-form block. */
export const HomepageSection = z.discriminatedUnion("type", [
  sectionBlock("hero", HomepageHero),
  sectionBlock("imageText", ImageTextData),
  sectionBlock("programs", SlotHeading),
  sectionBlock("approach", SlotHeading),
  sectionBlock("stats", StatsData),
  sectionBlock("timeline", TimelineData),
  sectionBlock("stories", StoriesData),
  sectionBlock("video", HomepageVideo),
  sectionBlock("trust", TrustData),
  sectionBlock("getInvolved", GetInvolvedData),
  sectionBlock("faq", FaqData),
  sectionBlock("cta", HomepageCtaData),
  sectionBlock("appealList", HomepageAppealListData),
  sectionBlock("postList", PostListData),
  sectionBlock("eventList", EventListData),
]);
export type HomepageSection = z.infer<typeof HomepageSection>;

const INFO = new Map(HOMEPAGE_BLOCKS.map((b) => [b.type, b]));

/* The homepage's blocks: each valid, ids unique, single blocks at most
   once, the hero (when present) first. */
export const HomepageSections = z
  .array(HomepageSection)
  .max(MAX_SECTIONS)
  .superRefine((sections, ctx) => {
    const ids = new Set<string>();
    const seen = new Set<string>();
    sections.forEach((section, i) => {
      if (ids.has(section.id)) ctx.addIssue({ code: "custom", path: [i, "id"], message: `duplicate section id "${section.id}"` });
      ids.add(section.id);
      const info = INFO.get(section.type)!;
      if (info.single && seen.has(section.type)) ctx.addIssue({ code: "custom", path: [i, "type"], message: `the homepage has one "${info.label}" block` });
      seen.add(section.type);
      if (info.first && i !== 0) ctx.addIssue({ code: "custom", path: [i, "type"], message: `"${info.label}" must be the first block` });
    });
  });

export const Homepage = z.strictObject({
  ...recordFields,
  sections: HomepageSections,
  seo: SeoOverrides.optional(),
});
export type Homepage = z.infer<typeof Homepage>;

/* Every media id a homepage's blocks point at (enabled or not). */
export function homepageMediaIds(page: { sections: HomepageSection[]; seo?: { ogImageId?: string } }): string[] {
  const ids: (string | undefined)[] = [page.seo?.ogImageId];
  for (const s of page.sections) {
    const d = s.data as Record<string, unknown>;
    if (s.type === "hero") for (const slide of s.data.slides) ids.push(slide.imageId, slide.insetId);
    if (s.type === "timeline") for (const item of s.data.items) ids.push(item.posterId);
    if (s.type === "video") ids.push(s.data.posterId);
    if (s.type === "getInvolved") ids.push(...Object.values(s.data.imageIds));
    if (s.type === "cta") ids.push(s.data.cardImageId);
    ids.push(d.imageId as string | undefined);
  }
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

/* The records a homepage's blocks point at. */
export function homepageReferences(sections: HomepageSection[]) {
  const refs = { posts: [] as string[], events: [] as string[], appeals: [] as string[] };
  for (const s of sections) {
    if (s.type === "postList") refs.posts.push(...s.data.postIds);
    if (s.type === "eventList") refs.events.push(...s.data.eventIds);
    if (s.type === "appealList" && s.data.appealIds) refs.appeals.push(...s.data.appealIds);
  }
  return refs;
}
