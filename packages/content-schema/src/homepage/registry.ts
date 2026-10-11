/* The homepage's block registry — WHICH blocks a homepage can hold, in
   plain data (no schema library), so the admin and the website can read it
   without shipping the contract's validators. The schemas themselves are
   homepage.ts (HOMEPAGE_SECTION_SCHEMAS); a test keeps the two in step.

     type         the block's `type` — the contract's own name
     label        what an editor sees (never the type)
     description  one line on what the block shows
     single       at most one on the homepage
     first        must be the first block (the hero opens the page)
     references   records the block points at (validated at publish)

   Every type maps to a component the website already has (apps/web
   pages/Home/CmsHome.jsx keeps the explicit type → renderer table). */

export interface HomepageBlockInfo {
  type: HomepageBlockType;
  label: string;
  description: string;
  single: boolean;
  first?: boolean;
  references?: "posts" | "events" | "appeals";
}

export const HOMEPAGE_BLOCK_TYPES = [
  "hero",
  "imageText",
  "programs",
  "approach",
  "stats",
  "timeline",
  "stories",
  "video",
  "trust",
  "getInvolved",
  "faq",
  "cta",
  "appealList",
  "postList",
  "eventList",
] as const;
export type HomepageBlockType = (typeof HOMEPAGE_BLOCK_TYPES)[number];

export const HOMEPAGE_BLOCKS: readonly HomepageBlockInfo[] = [
  { type: "hero", label: "Hero slideshow", description: "The opening slides: a short headline, a button and two photographs each.", single: true, first: true },
  { type: "imageText", label: "Text and photograph", description: "A heading and paragraphs beside a photograph — who we are.", single: false },
  { type: "programs", label: "Areas of work", description: "The program areas, as cards from the programs themselves.", single: true },
  { type: "approach", label: "Our approach", description: "A statement of how the work is done, with a link.", single: true },
  { type: "stats", label: "Impact figures", description: "Verified impact figures, chosen from the published metrics.", single: true },
  { type: "timeline", label: "Progress timeline", description: "Milestones with short films, along a timeline.", single: true },
  { type: "stories", label: "Stories of change", description: "The newest published stories.", single: true },
  { type: "video", label: "Featured film", description: "One film with a heading and a poster image.", single: true },
  { type: "trust", label: "Transparency", description: "The transparency statement and its documents.", single: true },
  { type: "getInvolved", label: "Ways to get involved", description: "The ways to take part, each with a photograph.", single: true },
  { type: "faq", label: "Questions", description: "Questions and answers.", single: false },
  { type: "cta", label: "Call to action", description: "A closing ask with one or two buttons.", single: false },
  { type: "appealList", label: "Appeals", description: "Chosen appeals, or every published appeal of a kind.", single: false, references: "appeals" },
  { type: "postList", label: "Featured posts", description: "Chosen news and blog posts.", single: false, references: "posts" },
  { type: "eventList", label: "Featured events", description: "Chosen events.", single: false, references: "events" },
];
