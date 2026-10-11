import { z } from "zod";
import { recordFields } from "../common/record.ts";
import { EntityId, IsoDate, MediaId, Paragraphs, Slug, text } from "../common/primitives.ts";
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

   Milestone 6 — the other fields the project template draws (apps/web
   pages/ProjectDetail; the source shape in content/work.js), each
   optional and shown only when present, as before:

     location     "Location" in the facts — where the work happens, as RBB
                  states it
     stage        "Status" in the facts — the project's own stage as RBB
                  states it (the source's `status`; renamed here because a
                  record's `status` is its editorial status)
     date         YYYY-MM-DD — the project's date on the homepage's project
                  timeline (newest first; its card shows the date, else the
                  stage). One date: the source has no range
     impact       "Impact" — figures RBB has verified, each { value, label },
                  shown as "value — label". A result, never an aim (aims are
                  `outcomes`): the owner's approval is the verification
     partners     "Partners" — one name per line
     storyId      "Story" — the story that tells this project's work, by the
                  story's id (as the Impact page names stories): one of this
                  organization's CMS stories, or — while the website's own
                  stories are the site's — one of those, by its id. Its
                  title and excerpt are the story's own, never a copy.

   Lists hold at least one item, each distinct (the page tells them apart
   by their text). Plain text only. */
export const ProjectImpact = z.strictObject({
  value: text(40),
  label: text(160),
});
export type ProjectImpact = z.infer<typeof ProjectImpact>;
const distinct = <T>(key: (item: T) => string, noun: string) => (items: T[], ctx: z.RefinementCtx) => {
  const seen = new Set<string>();
  items.forEach((item, i) => {
    const k = key(item).trim();
    if (seen.has(k)) ctx.addIssue({ code: "custom", path: [i], message: `repeats an earlier ${noun}` });
    seen.add(k);
  });
};
export const PROJECT_IMPACT_MAX = 8;
export const PROJECT_PARTNERS_MAX = 12;
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
  /* Milestone 6. */
  location: text(120).optional(),
  stage: text(60).optional(),
  date: IsoDate.optional(),
  impact: z.array(ProjectImpact).min(1).max(PROJECT_IMPACT_MAX).superRefine(distinct((m: ProjectImpact) => `${m.value} — ${m.label}`, "figure")).optional(),
  partners: z.array(text(160)).min(1).max(PROJECT_PARTNERS_MAX).superRefine(distinct((name: string) => name, "partner")).optional(),
  storyId: EntityId.optional(),
  featured: z.boolean().optional(),
  order: z.int().min(0).max(10_000),
  seo: SeoOverrides.optional(),
});
export type Project = z.infer<typeof Project>;

/* Every media id a project points at. */
export const projectMediaIds = (p: { imageId?: string; seo?: { ogImageId?: string } }): string[] => [p.imageId, p.seo?.ogImageId].filter((id): id is string => Boolean(id));
