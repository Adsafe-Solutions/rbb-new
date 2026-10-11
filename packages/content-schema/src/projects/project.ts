import { z } from "zod";
import { recordFields } from "../common/record.ts";
import { MediaId, Paragraphs, Slug, text } from "../common/primitives.ts";
import { SeoOverrides } from "../seo/seo.ts";

/* A project (M12) — one piece of work under a program area, with its page
   at /work/projects/<slug>. Exactly the fields the projects the site
   holds use, as the project page, the projects list, the program pages,
   /work's featured projects and the homepage's project cards draw them:

     slug         the page's address (/work/projects/<slug>) and the key
                  stories name it by (a story's `projectId`)
     title        its name
     programId    the program area it belongs to — a program's slug,
                  never a copy of the program
     description  the one-line summary under the title and on cards
     imageId      its photograph, from the media library (described)
     context      "The challenge" — paragraphs
     activities   "What this work focuses on" — lines
     approach     "How the work is approached" — paragraphs
     outcomes     "What it aims to change" — lines (intended change, never
                  a result)
     featured     shown among /work's and the homepage's featured projects
     order        position among the projects, lower first
     seo          the shared overrides

   The project template can also draw a location, a stage, verified
   impact figures, partners and a story; no project has supplied any, so
   they are not part of the contract until one does. Plain text only. */
export const Project = z.strictObject({
  ...recordFields,
  slug: Slug,
  title: text(160),
  programId: Slug,
  description: text(400),
  imageId: MediaId.optional(),
  context: Paragraphs.max(8).optional(),
  activities: z.array(text(200)).min(1).max(12).optional(),
  approach: Paragraphs.max(8).optional(),
  outcomes: z.array(text(200)).min(1).max(12).optional(),
  featured: z.boolean().optional(),
  order: z.int().min(0).max(10_000),
  seo: SeoOverrides.optional(),
});
export type Project = z.infer<typeof Project>;

/* Every media id a project points at. */
export const projectMediaIds = (p: { imageId?: string; seo?: { ogImageId?: string } }): string[] => [p.imageId, p.seo?.ogImageId].filter((id): id is string => Boolean(id));
