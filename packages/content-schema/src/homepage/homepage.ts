import { z } from "zod";
import { recordFields } from "../common/record.ts";
import { EntityId, IsoDate, MediaId, ReleaseMarker, Slug, YouTubeId, text } from "../common/primitives.ts";
import { Link } from "../common/link.ts";
import { SeoOverrides } from "../seo/seo.ts";
import { CtaData, FaqData, ImageTextData, StatsData, TrustData, highlightIn, highlightIssue } from "../sections/blocks.ts";

/* The homepage — a singleton with NAMED SLOTS, not a free list of
   sections. Its order and the colour sequence of its bands are designed
   as one composition (apps/web pages/Home), so an editor fills each slot
   rather than reordering the page. Slots reuse the block data shapes
   where they are the same thing (whoWeAre is an imageText, faq is a faq).

   Several slots only hold their own heading: the cards beneath them come
   from other records — programs from the program records, stories from
   the latest published story Posts, the ways to take part from the Get
   Involved paths — so nothing is written twice. A slot whose item list is
   empty (timeline) or absent (video) is left off the page. */

/* A slot's own heading, with an optional line and link. */
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

export const Homepage = z.strictObject({
  ...recordFields,
  hero: HomepageHero,
  whoWeAre: ImageTextData,
  programs: SlotHeading,
  approach: SlotHeading,
  impact: StatsData,
  timeline: SlotHeading.safeExtend({ items: z.array(TimelineItem).max(12) }),
  stories: SlotHeading.safeExtend({ count: z.int().min(1).max(6) }),
  video: HomepageVideo.optional(),
  transparency: TrustData,
  /* One photograph per way to take part, by the path's id. */
  getInvolved: SlotHeading.safeExtend({ imageIds: z.record(Slug, MediaId) }),
  faq: FaqData,
  finalCta: CtaData.safeExtend({ cardImageId: MediaId.optional() }),
  seo: SeoOverrides.optional(),
});
export type Homepage = z.infer<typeof Homepage>;
