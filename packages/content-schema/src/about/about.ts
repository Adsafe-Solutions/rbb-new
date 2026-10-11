import { z } from "zod";
import { recordFields } from "../common/record.ts";
import { text } from "../common/primitives.ts";
import { Link } from "../common/link.ts";
import { SeoOverrides } from "../seo/seo.ts";
import { CtaData, NumberedCardsData, StatementData, highlightIn, highlightIssue, sectionBlock } from "../sections/blocks.ts";
import { MAX_SECTIONS } from "../sections/allowlists.ts";
import { SlotHeading } from "../homepage/homepage.ts";
import { ABOUT_BLOCKS, ABOUT_BLOCK_TYPES } from "./registry.ts";

/* The About page (M9) — one per organization, an ordered list of blocks
   in the shared envelope { id, type, enabled, version, data }, exactly as
   the homepage (M8). Its blocks are the page's existing chapters:

     pageHero       NEW — the page title, opening line, button (PageHeader)
     statement      the shared block — who we are (StatementSplit)
     missionVision  NEW — mission and vision statements (MissionVision)
     numberedCards  the shared block — the values (ValuesList)
     approach       the homepage's SlotHeading — how we work (ApproachFlow)
     transparency   no data — the block only places the chapter; its
                    content is the Transparency record and its documents
                    (M11, transparency/), drawn by TransparencySection
     cta            the shared block — the closing ask (ClosingCta)

   Milestone 8: a statement's link, mission and vision's highlight and the
   cards' intro are drawn by their components and offered by the admin. */

export const PageHeroData = z.strictObject({
  title: text(120),
  /* The breadcrumb's name for the page, when it differs from the title. */
  crumb: text(60).optional(),
  body: text(400),
  cta: Link.optional(),
});

const Statement = z.strictObject({ label: text(60), statement: text(400) });
export const MissionVisionData = z
  .strictObject({
    kicker: text(60).optional(),
    heading: text(160),
    highlight: text(60).optional(),
    mission: Statement,
    vision: Statement,
    /* Where the statements come from (shown beneath them). */
    source: text(300).optional(),
  })
  .refine(highlightIn, highlightIssue);

export const TransparencyPlacement = z.strictObject({});

export const ABOUT_SECTION_SCHEMAS = {
  pageHero: PageHeroData,
  statement: StatementData,
  missionVision: MissionVisionData,
  numberedCards: NumberedCardsData,
  approach: SlotHeading,
  transparency: TransparencyPlacement,
  cta: CtaData,
} as const satisfies Record<(typeof ABOUT_BLOCK_TYPES)[number], z.ZodType>;

/* Any About block; an unknown `type` is refused. */
export const AboutSection = z.discriminatedUnion("type", [
  sectionBlock("pageHero", PageHeroData),
  sectionBlock("statement", StatementData),
  sectionBlock("missionVision", MissionVisionData),
  sectionBlock("numberedCards", NumberedCardsData),
  sectionBlock("approach", SlotHeading),
  sectionBlock("transparency", TransparencyPlacement),
  sectionBlock("cta", CtaData),
]);
export type AboutSection = z.infer<typeof AboutSection>;

const INFO = new Map(ABOUT_BLOCKS.map((b) => [b.type, b]));

export const AboutSections = z
  .array(AboutSection)
  .max(MAX_SECTIONS)
  .superRefine((sections, ctx) => {
    const ids = new Set<string>();
    const seen = new Set<string>();
    sections.forEach((section, i) => {
      if (ids.has(section.id)) ctx.addIssue({ code: "custom", path: [i, "id"], message: `duplicate section id "${section.id}"` });
      ids.add(section.id);
      const info = INFO.get(section.type)!;
      if (info.single && seen.has(section.type)) ctx.addIssue({ code: "custom", path: [i, "type"], message: `the About page has one "${info.label}" block` });
      seen.add(section.type);
      if (info.first && i !== 0) ctx.addIssue({ code: "custom", path: [i, "type"], message: `"${info.label}" must be the first block` });
    });
  });

export const About = z.strictObject({
  ...recordFields,
  sections: AboutSections,
  seo: SeoOverrides.optional(),
});
export type About = z.infer<typeof About>;

/* Every media id an About page points at (its blocks hold no photographs
   today; the closing ask may, and the share image). */
export const aboutMediaIds = (page: { sections: AboutSection[]; seo?: { ogImageId?: string } }): string[] =>
  [...new Set([page.seo?.ogImageId, ...page.sections.map((s) => (s.data as { imageId?: string }).imageId)].filter((id): id is string => Boolean(id)))];
