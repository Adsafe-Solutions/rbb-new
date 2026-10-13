import { z } from "zod";
import { recordFields } from "../common/record.ts";
import { EntityId, Slug, text } from "../common/primitives.ts";
import { Link } from "../common/link.ts";
import { SeoOverrides } from "../seo/seo.ts";
import { CtaData, StatsData, TrustData, highlightIn, highlightIssue, sectionBlock } from "../sections/blocks.ts";
import { MAX_SECTIONS } from "../sections/allowlists.ts";
import { IMPACT_BLOCKS, IMPACT_BLOCK_TYPES } from "./registry.ts";
import { countryList } from "../common/countryField.ts";

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

   and, not drawn on /impact (registry `page`), the words of its two
   sub-pages:

     approach       #5 — /impact/our-approach: how the work is done, principles
     geography      #6 — /impact/where-we-work: verified regions and countries

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

/* #5 — Our Approach (/impact/our-approach). How the work is done, and its
   principles. The page opens with the mission, which is the About page's
   own (its Mission & Vision block) — never restated here. */
export const ApproachData = z.strictObject({
  intro: text(1200).optional(),
  principles: z.array(text(300)).max(12),
});

/* #6 — Where We Work (/impact/where-we-work). Coverage RBB has verified:
   regions with their countries, and countries not grouped in a region.
   Text, not a map (D14: no map); never a sample, and never a figure turned
   into names ("25 countries" is not a list). Empty lists are allowed —
   and are where it starts: the page then shows no list and stays out of
   search engines.

   D14 (2026-10-13): a country is chosen from the full list
   (common/countries.ts, ISO 3166-1) and stored by its name. The list is
   the options, not RBB's coverage: only what is selected here is shown,
   and each country appears once in the block (in one region, or among the
   ungrouped). */
const countriesOf = countryList;

export const GeographyData = z.strictObject({
  summary: text(600).optional(),
  regions: z
    .array(z.strictObject({ id: Slug, name: text(120), countries: countriesOf(1, 60) }))
    .max(20)
    .superRefine((regions, ctx) => {
      const ids = new Set<string>();
      regions.forEach((region, i) => {
        if (ids.has(region.id)) ctx.addIssue({ code: "custom", path: [i, "id"], message: `duplicate region id "${region.id}"` });
        ids.add(region.id);
      });
    }),
  countries: countriesOf(0, 100),
}).superRefine((geography, ctx) => {
  /* A country in one place only: one region, or the ungrouped list. */
  const where = new Map<string, string>();
  const place = (country: string, label: string, path: (string | number)[]) => {
    const first = where.get(country);
    if (first) ctx.addIssue({ code: "custom", path, message: `"${country}" is already listed in ${first}` });
    else where.set(country, label);
  };
  geography.regions.forEach((region, r) => region.countries.forEach((country, c) => place(country, `"${region.name}"`, ["regions", r, "countries", c])));
  geography.countries.forEach((country, c) => place(country, "the countries not in a region", ["countries", c]));
});

export const IMPACT_SECTION_SCHEMAS = {
  intro: ImpactIntroData,
  stats: StatsData,
  programImpact: ProgramImpactData,
  teasers: TeasersData,
  measurement: MeasurementData,
  stories: ImpactStoriesData,
  trust: TrustData,
  cta: CtaData,
  approach: ApproachData,
  geography: GeographyData,
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
  sectionBlock("approach", ApproachData),
  sectionBlock("geography", GeographyData),
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
