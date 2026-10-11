/* The Impact page's block registry — WHICH blocks the Impact page can
   hold, in plain data (no schema library), like the About page's
   (about/registry.ts): names an editor sees, the single/first rules. The
   schemas are impact.ts (IMPACT_SECTION_SCHEMAS); a test keeps the two in
   step.

   The blocks are exactly the chapters /impact has (apps/web pages/Impact):
   nothing speculative. Each appears at most once — several are chapters
   with their own address (#at-a-glance, #measurement, #stories). */

export interface ImpactBlockInfo {
  type: ImpactBlockType;
  label: string;
  description: string;
  single: boolean;
  first?: boolean;
}

export const IMPACT_BLOCK_TYPES = ["intro", "stats", "programImpact", "teasers", "measurement", "stories", "trust", "cta"] as const;
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
];
