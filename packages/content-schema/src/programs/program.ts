import { z } from "zod";
import { recordFields } from "../common/record.ts";
import { Paragraphs, Slug, text } from "../common/primitives.ts";
import { SeoOverrides } from "../seo/seo.ts";

/* A program area (M10) — one of the organization's areas of work, with
   its page at /work/<slug>. Exactly the fields the program pages, the Our
   Work page, the menu and the homepage's program cards draw:

     slug         the page's address (/work/<slug>) and the id other
                  records point at (a project's, story's or event's
                  program)
     title        its name (page title, menu, cards)
     icon         the glyph on its page and card — one of the site's line
                  glyphs (PROGRAM_ICONS; apps/web components/LineIcon)
     order        position among the programs, lower first; ties by id
     description  the one line under the title, and on cards
     missingNote  what a section without content says, in the program's
                  own words, until the organization supplies it
     why          "Why this matters" — paragraphs
     activities   "What we focus on" — one line each
     impact       "The change we work towards" — in words, never a figure
     stories      stories, as one line each

   No photograph: the program pages draw an icon, not an image. Plain text
   throughout, as the pages draw it — no HTML. */

export const PROGRAM_ICONS = ["education", "health", "livelihoods", "community", "donate", "volunteer", "partner", "fellowship", "travel", "fundraise", "document", "shield", "chart"] as const;

const lines = (max: number) => z.array(text(max)).min(1).max(12);

export const Program = z.strictObject({
  ...recordFields,
  slug: Slug,
  title: text(80),
  icon: z.enum(PROGRAM_ICONS),
  order: z.int().min(0).max(10_000),
  description: text(300),
  missingNote: text(300).optional(),
  why: Paragraphs.optional(),
  activities: lines(200).optional(),
  impact: lines(200).optional(),
  stories: lines(300).optional(),
  seo: SeoOverrides.optional(),
});
export type Program = z.infer<typeof Program>;
