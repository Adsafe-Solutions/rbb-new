/* The Impact page's block registry — WHICH blocks the Impact page can
   hold, in plain data (no schema library), like the About page's
   (about/registry.ts): names an editor sees, the single/first rules. The
   schemas are impact.ts (IMPACT_SECTION_SCHEMAS); a test keeps the two in
   step.

   The blocks are exactly the chapters /impact has (apps/web pages/Impact):
   nothing speculative. Each appears at most once — several are chapters
   with their own address (#at-a-glance, #measurement, #stories).

   Two are not chapters of /impact but the words of its two sub-pages
   (`page`): Our Approach (#5) and Where We Work (#6). They live on this
   record — published with it, through the same review — and are never
   drawn on /impact itself. */

export interface ImpactBlockInfo {
  type: ImpactBlockType;
  label: string;
  description: string;
  single: boolean;
  first?: boolean;
  /* Not drawn on /impact: the website page whose words it holds. */
  page?: string;
}

export const IMPACT_BLOCK_TYPES = ["intro", "stats", "programImpact", "teasers", "measurement", "stories", "trust", "cta", "approach", "geography"] as const;
export type ImpactBlockType = (typeof IMPACT_BLOCK_TYPES)[number];

export const IMPACT_BLOCKS: readonly ImpactBlockInfo[] = [
  { type: "intro", label: "Page introduction", description: "The page's title and its opening line.", single: true, first: true },
  { type: "stats", label: "Impact at a glance", description: "The headline figures, chosen from the impact figures.", single: true },
  { type: "programImpact", label: "Impact across our work", description: "Each program area with the change it works towards.", single: true },
  { type: "teasers", label: "Two posters", description: "Two linked posters side by side (our approach, our work).", single: true },
  { type: "measurement", label: "Evidence and measurement", description: "How impact is looked at, as a short passage and a list.", single: true },
  { type: "stories", label: "Stories of change", description: "Impact stories, chosen from the website's stories.", single: true },
  { type: "trust", label: "Reports and transparency", description: "A statement with the transparency links beneath it.", single: true },
  { type: "cta", label: "Closing call to action", description: "A closing ask with one or two buttons.", single: true },
  { type: "approach", label: "Our Approach page", description: "The Our Approach page's words: how the work is done, and its principles. Opens with the mission from the About page.", single: true, page: "/impact/our-approach" },
  { type: "geography", label: "Where We Work page", description: "The countries and regions the work reaches, verified by RBB. Never a sample.", single: true, page: "/impact/where-we-work" },
];

/* The block types drawn on /impact itself (the others feed a sub-page). */
export const IMPACT_CHAPTER_TYPES = IMPACT_BLOCKS.filter((b) => !b.page).map((b) => b.type);
