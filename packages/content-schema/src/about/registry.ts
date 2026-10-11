/* The About page's block registry — WHICH blocks the About page can hold,
   in plain data (no schema library), like the homepage's
   (homepage/registry.ts): names an editor sees, the single/first rules.
   The schemas are about.ts (ABOUT_SECTION_SCHEMAS); a test keeps the two
   in step.

   The blocks are exactly the chapters the About page has (apps/web
   pages/About): nothing speculative. Each appears at most once — each is
   a chapter with its own address (#who-we-are, #mission-vision, …). */

export interface AboutBlockInfo {
  type: AboutBlockType;
  label: string;
  description: string;
  single: boolean;
  first?: boolean;
}

export const ABOUT_BLOCK_TYPES = ["pageHero", "statement", "missionVision", "numberedCards", "approach", "transparency", "cta"] as const;
export type AboutBlockType = (typeof ABOUT_BLOCK_TYPES)[number];

export const ABOUT_BLOCKS: readonly AboutBlockInfo[] = [
  { type: "pageHero", label: "Page introduction", description: "The page's title, its opening line and a button.", single: true, first: true },
  { type: "statement", label: "Who we are", description: "A heading and paragraphs, the first set as a statement.", single: true },
  { type: "missionVision", label: "Mission and vision", description: "The mission and the vision, side by side.", single: true },
  { type: "numberedCards", label: "Values", description: "The values, as numbered cards.", single: true },
  { type: "approach", label: "How we work", description: "A statement of how the work is done, with a link.", single: true },
  { type: "transparency", label: "Transparency and governance", description: "Financial information, reports and governance — from the website's transparency records.", single: true },
  { type: "cta", label: "Closing call to action", description: "A closing ask with one or two buttons.", single: true },
];
