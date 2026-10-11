import { z } from "zod";
import { recordFields } from "../common/record.ts";
import { EntityId, Slug, text } from "../common/primitives.ts";
import { Link } from "../common/link.ts";
import { SeoOverrides } from "../seo/seo.ts";
import { CtaData, StatsData, TrustData, highlightIn, highlightIssue, sectionBlock } from "../sections/blocks.ts";
import { MAX_SECTIONS } from "../sections/allowlists.ts";
import { IMPACT_BLOCKS, IMPACT_BLOCK_TYPES } from "./registry.ts";

/* The Impact page (M11) — one per organization, an ordered list of blocks
   in the shared envelope { id, type, enabled, version, data }, exactly as
   the homepage (M8) and the About page (M9). Its blocks are /impact's
   existing chapters:

     intro          NEW — kicker, title, its highlight, opening line (PageHeader)
     stats          the shared block — the headline figures by metric slug (ImpactStats)
     programImpact  NEW — each program's impact line, by program slug (ProgramIndex);
                    the programs themselves come from the Program records
     teasers        NEW — two linked posters (TeaserPair)
     measurement    NEW — evidence and measurement: a passage and a list (ContentRows)
     stories        NEW — impact stories, by story id (StoriesOfChange): the
                    published stories (M12: Post records of type "story")
     trust          the shared block — reports and transparency (TrustPanel);
                    the links beneath it come from the transparency records
     cta            the shared block — the closing ask (ClosingCta)

   The figures, programs and transparency links are REFERENCED, never
   copied: a `stats` block names Metric records, so the homepage and this
   page always show the same values. */

export const ImpactIntroData = z
  .strictObject({
    kicker: text(60).optional(),
    title: text(120),
    /* The word or phrase of the title set on a highlight. */
    highlight: text(60).optional(),
    body: text(400),
  })
  .refine((d) => !d.highlight || d.title.includes(d.highlight), { path: ["highlight"], message: "highlight must be part of the title" });

export const ProgramImpactData = z.strictObject({
  kicker: text(60).optional(),
  heading: text(160),
  /* The change each program works towards, in words; a program without
     one shows the site's "to be provided" line. */
  items: z
    .array(z.strictObject({ programId: Slug, summary: text(300) }))
    .max(12)
    .superRefine((items, ctx) => {
      const seen = new Set<string>();
      items.forEach((item, i) => {
        if (seen.has(item.programId)) ctx.addIssue({ code: "custom", path: [i, "programId"], message: "names this program twice" });
        seen.add(item.programId);
      });
    }),
});

/* A poster: a page the reader can go on to (TeaserPair draws its words
   and its button — both required). */
export const Teaser = z.strictObject({
  kicker: text(60).optional(),
  heading: text(160),
  body: text(600),
  cta: Link,
});

export const TeasersData = z.strictObject({
  items: z.tuple([Teaser, Teaser]),
});

export const MeasurementData = z.strictObject({
  heading: text(160),
  body: text(1200).optional(),
  items: z.array(text(300)).max(12),
});

export const ImpactStoriesData = z
  .strictObject({
    kicker: text(60).optional(),
    heading: text(160),
    highlight: text(60).optional(),
    storyIds: z.array(EntityId).max(6),
    cta: Link.optional(),
  })
  .refine(highlightIn, highlightIssue);

export const IMPACT_SECTION_SCHEMAS = {
  intro: ImpactIntroData,
  stats: StatsData,
  programImpact: ProgramImpactData,
  teasers: TeasersData,
  measurement: MeasurementData,
  stories: ImpactStoriesData,
  trust: TrustData,
  cta: CtaData,
} as const satisfies Record<(typeof IMPACT_BLOCK_TYPES)[number], z.ZodType>;

/* Any Impact block; an unknown `type` is refused. */
export const ImpactSection = z.discriminatedUnion("type", [
  sectionBlock("intro", ImpactIntroData),
  sectionBlock("stats", StatsData),
  sectionBlock("programImpact", ProgramImpactData),
  sectionBlock("teasers", TeasersData),
  sectionBlock("measurement", MeasurementData),
  sectionBlock("stories", ImpactStoriesData),
  sectionBlock("trust", TrustData),
  sectionBlock("cta", CtaData),
]);
export type ImpactSection = z.infer<typeof ImpactSection>;

const INFO = new Map(IMPACT_BLOCKS.map((b) => [b.type, b]));

export const ImpactSections = z
  .array(ImpactSection)
  .max(MAX_SECTIONS)
  .superRefine((sections, ctx) => {
    const ids = new Set<string>();
    const seen = new Set<string>();
    sections.forEach((section, i) => {
      if (ids.has(section.id)) ctx.addIssue({ code: "custom", path: [i, "id"], message: `duplicate section id "${section.id}"` });
      ids.add(section.id);
      const info = INFO.get(section.type)!;
      if (info.single && seen.has(section.type)) ctx.addIssue({ code: "custom", path: [i, "type"], message: `the Impact page has one "${info.label}" block` });
      seen.add(section.type);
      if (info.first && i !== 0) ctx.addIssue({ code: "custom", path: [i, "type"], message: `"${info.label}" must be the first block` });
    });
  });

export const Impact = z.strictObject({
  ...recordFields,
  sections: ImpactSections,
  seo: SeoOverrides.optional(),
});
export type Impact = z.infer<typeof Impact>;

/* Every media id an Impact page points at (the closing ask may hold one,
   and the share image). */
export const impactMediaIds = (page: { sections: ImpactSection[]; seo?: { ogImageId?: string } }): string[] =>
  [...new Set([page.seo?.ogImageId, ...page.sections.map((s) => (s.data as { imageId?: string }).imageId)].filter((id): id is string => Boolean(id)))];

/* The metric slugs, program slugs and story ids an Impact page names
   (enabled or not: the snapshot carries enabled blocks only). */
export const impactReferences = (sections: ImpactSection[]) => ({
  metrics: [...new Set(sections.flatMap((s) => (s.type === "stats" ? s.data.metricIds : [])))],
  programs: [...new Set(sections.flatMap((s) => (s.type === "programImpact" ? s.data.items.map((i) => i.programId) : [])))],
  stories: [...new Set(sections.flatMap((s) => (s.type === "stories" ? s.data.storyIds : [])))],
});
