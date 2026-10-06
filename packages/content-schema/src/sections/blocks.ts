import { z } from "zod";
import { EntityId, MediaId, Paragraphs, ReleaseMarker, text } from "../common/primitives.ts";
import { Link } from "../common/link.ts";
import { RichText } from "../richText/richText.ts";
import { AppealKind } from "../appeals/kind.ts";

/* Section blocks — the CMS's content primitive. A page's `sections` are
   an ordered list of these. Each block is DATA ONLY: what it says, never
   how it looks. The web decides layout, colour tone, section numbering,
   motion and responsive behaviour; no block carries a component name,
   class, style, colour, HTML or script.

   Every block type maps to a component that already exists in apps/web
   (see README.md). The `data` schemas are exported on their own because
   the homepage's fixed slots reuse them. */

const kicker = text(60);
const heading = text(160);

/* `highlight` — the one word or phrase of the heading set on a highlight
   block. It must be part of the heading. */
export const highlightIn = <T extends { heading: string; highlight?: string | undefined }>(data: T) =>
  !data.highlight || data.heading.includes(data.highlight);
export const highlightIssue = { path: ["highlight"], message: "highlight must be part of the heading" };
const highlight = text(60).optional();

/* A heading with paragraphs beneath it, the first read as a statement
   (DonationExperience's "Why it matters" band). */
export const StatementData = z
  .strictObject({
    kicker: kicker.optional(),
    heading,
    highlight,
    body: Paragraphs,
    cta: Link.optional(),
  })
  .refine(highlightIn, highlightIssue);

/* A headed passage of formatted text (ContentRows' row). */
export const RichTextData = z.strictObject({
  heading,
  content: RichText,
});

/* Numbered cards — areas, steps, ways support helps (DonationExperience's
   "How your support helps"). Never costed claims; that is editorial
   policy, enforced by review. */
export const NumberedCardsData = z
  .strictObject({
    kicker: kicker.optional(),
    heading,
    highlight,
    intro: text(400).optional(),
    items: z
      .array(z.strictObject({ title: text(120), description: text(600).optional() }))
      .min(1)
      .max(8),
  })
  .refine(highlightIn, highlightIssue);

/* Text beside a photograph (EditorialSplit). */
export const ImageTextData = z
  .strictObject({
    kicker: kicker.optional(),
    heading,
    highlight,
    body: Paragraphs,
    imageId: MediaId,
    imagePosition: z.enum(["left", "right"]).optional(),
    cta: Link.optional(),
    secondaryCta: Link.optional(),
  })
  .refine(highlightIn, highlightIssue);

/* Headline figures (ImpactStats). The figures are NOT written here: the
   block names Metric records, which carry their own verification. */
export const StatsData = z
  .strictObject({
    kicker: kicker.optional(),
    heading,
    highlight,
    body: text(600).optional(),
    metricIds: z.array(EntityId).min(1).max(6),
    source: text(300).optional(),
    cta: Link.optional(),
  })
  .refine(highlightIn, highlightIssue);

export const FaqItem = z.strictObject({
  question: text(300),
  answer: text(3000),
  releaseMarker: ReleaseMarker.optional(),
});

/* Questions and answers (Faq). */
export const FaqData = z
  .strictObject({
    kicker: kicker.optional(),
    heading,
    highlight,
    items: z.array(FaqItem).min(1).max(30),
  })
  .refine(highlightIn, highlightIssue);

/* A call to action band (CtaSection / ClosingCta). */
export const CtaData = z
  .strictObject({
    heading,
    highlight,
    body: text(600).optional(),
    primary: Link,
    secondary: Link.optional(),
    imageId: MediaId.optional(),
  })
  .refine(highlightIn, highlightIssue);

/* The transparency statement (TrustPanel). The document rows beneath it
   come from the transparency records, not from the block. */
export const TrustData = z
  .strictObject({
    kicker: kicker.optional(),
    heading,
    highlight,
    body: text(600).optional(),
    cta: Link.optional(),
  })
  .refine(highlightIn, highlightIssue);

/* A list of appeals (AppealGrid) — all of one kind, or every appeal. The
   appeals themselves come from the Appeal records. */
export const AppealListData = z
  .strictObject({
    kicker: kicker.optional(),
    heading,
    highlight,
    kind: AppealKind.optional(),
    cta: Link.optional(),
  })
  .refine(highlightIn, highlightIssue);

/* The envelope every section shares:
     id       stable identity — survives reordering and editing; never an
              array index
     enabled  false keeps the section in the record but off the page
     version  the version of this block type's data schema (all 1 today),
              so a block can be migrated when its schema evolves */
const section = <T extends string, D extends z.ZodType>(type: T, data: D) =>
  z.strictObject({
    id: EntityId,
    type: z.literal(type),
    enabled: z.boolean(),
    version: z.literal(1),
    data,
  });

export const StatementSection = section("statement", StatementData);
export const RichTextSection = section("richText", RichTextData);
export const NumberedCardsSection = section("numberedCards", NumberedCardsData);
export const ImageTextSection = section("imageText", ImageTextData);
export const StatsSection = section("stats", StatsData);
export const FaqSection = section("faq", FaqData);
export const CtaSection = section("cta", CtaData);
export const TrustSection = section("trust", TrustData);
export const AppealListSection = section("appealList", AppealListData);

/* Any section. An unknown `type` is refused — there is no generic or
   free-form block. */
export const Section = z.discriminatedUnion("type", [
  StatementSection,
  RichTextSection,
  NumberedCardsSection,
  ImageTextSection,
  StatsSection,
  FaqSection,
  CtaSection,
  TrustSection,
  AppealListSection,
]);
export type Section = z.infer<typeof Section>;
export type SectionType = Section["type"];

export const SECTION_TYPES = [
  "statement",
  "richText",
  "numberedCards",
  "imageText",
  "stats",
  "faq",
  "cta",
  "trust",
  "appealList",
] as const satisfies readonly SectionType[];
