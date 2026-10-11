import { z } from "zod";
import { recordFields } from "../common/record.ts";
import { Slug, text } from "../common/primitives.ts";
import { workingTextFindings } from "../common/workingText.ts";
import { SeoOverrides } from "../seo/seo.ts";

/* Get Involved (M20) — FIVE fixed pages per organization (apps/web
   src/content/getInvolved.js):

     hub          /get-involved              GetInvolvedHub
     volunteer    /get-involved/volunteer    GetInvolvedPath
     fellowship   /get-involved/fellowship   GetInvolvedPath
     partner      /get-involved/partner      GetInvolvedPath
     travel       /get-involved/travel       GetInvolvedPath

   The id is the record's identity AND its address. What a path IS stays
   the website's: its title and button label, route, icon, images, form,
   `featured`, the questions panel and the shared closing. The CMS holds
   only the words RBB writes for each page. A record starts EMPTY — no
   proposed copy is seeded — and what a published record leaves out keeps
   the website's own text (the hub's mission paragraph, a path's note).

   A PATH:
     shortDescription  the line on its cards and under its page title
     hubNote           its line in the hub's "What each path involves"
     sections          in order: a stable slug `id` (the page anchor), a
                       heading, paragraphs and an optional bullet list.
                       "inquiry" is reserved — the path's form section
                       uses it
     faq               an optional heading and question/answer pairs
     seo.description   its meta (and menu) description

   THE HUB:
     heading, intro    the page header
     ways, choose      the two path sections' kicker and heading
     why               "Why get involved" — absent, the website keeps the
                       mission statement it shows today
     closing           a heading and one or two calls to action, each a
                       label and a TARGET — one of the site's sections
                       (CTA_TARGETS); never a typed-in address

   Plain text only: no HTML, no rich text, no release marker, and no
   working-placeholder text (common/workingText.ts). Approval needs a
   path's short description and at least one section, and the hub's
   heading and introduction (`getInvolvedApprovalProblems`). */

export const GET_INVOLVED_PATH_IDS = ["volunteer", "fellowship", "partner", "travel"] as const;
export const GetInvolvedPathId = z.enum(GET_INVOLVED_PATH_IDS);
export type GetInvolvedPathId = z.infer<typeof GetInvolvedPathId>;

export const GET_INVOLVED_PAGE_IDS = ["hub", ...GET_INVOLVED_PATH_IDS] as const;
export type GetInvolvedPageId = (typeof GET_INVOLVED_PAGE_IDS)[number];

export const GET_INVOLVED_ROUTES: Record<GetInvolvedPageId, string> = {
  hub: "/get-involved",
  volunteer: "/get-involved/volunteer",
  fellowship: "/get-involved/fellowship",
  partner: "/get-involved/partner",
  travel: "/get-involved/travel",
};

/* Where a call to action may lead: a section of the site, by name. The
   website maps each to its own route. */
export const CTA_TARGETS = ["appeals", "work", "impact", "contact", "get-involved", "about"] as const;
export const CtaTarget = z.enum(CTA_TARGETS);
export type CtaTarget = z.infer<typeof CtaTarget>;

export const StructuredCta = z.strictObject({ label: text(60), target: CtaTarget });
export type StructuredCta = z.infer<typeof StructuredCta>;

/* The section id a path's form section already uses on its page. */
export const RESERVED_SECTION_IDS = ["inquiry"] as const;

const plain = (s: string) => workingTextFindings(s).length === 0;
/* Plain text that is the organization's own: not empty, no HTML, no
   working-placeholder marker. */
const own = (max: number) => text(max).refine(plain, "must be the organization's own text, not working placeholder text");
const Paragraphs = (max: number) => z.array(own(2000)).max(max);

const Heading = z.strictObject({ kicker: own(60), heading: own(160) });

export const GetInvolvedSection = z
  .strictObject({
    id: Slug.max(60).refine((id) => !(RESERVED_SECTION_IDS as readonly string[]).includes(id), "is reserved for the page's form section"),
    heading: own(160),
    body: Paragraphs(10),
    items: z.array(own(300)).max(20).optional(),
  })
  .refine((s) => s.body.length > 0 || (s.items?.length ?? 0) > 0, { message: "needs a paragraph or a list item", path: ["body"] });
export type GetInvolvedSection = z.infer<typeof GetInvolvedSection>;

export const GetInvolvedFaq = z
  .strictObject({
    heading: own(160),
    items: z.array(z.strictObject({ question: own(300), answer: own(2000) })).min(1).max(20),
  })
  .superRefine((faq, ctx) => {
    const seen = new Set<string>();
    faq.items.forEach((item, i) => {
      if (seen.has(item.question)) ctx.addIssue({ code: "custom", path: ["items", i, "question"], message: "is already asked above" });
      seen.add(item.question);
    });
  });

const { releaseMarker: _internal, ...fields } = recordFields;

export const GetInvolvedPath = z
  .strictObject({
    ...fields,
    id: GetInvolvedPathId,
    shortDescription: own(200).optional(),
    hubNote: own(300).optional(),
    sections: z.array(GetInvolvedSection).max(12),
    faq: GetInvolvedFaq.optional(),
    seo: SeoOverrides.pick({ description: true }).optional(),
  })
  .superRefine((path, ctx) => {
    const ids = new Set<string>();
    const headings = new Set<string>();
    path.sections.forEach((s, i) => {
      if (ids.has(s.id)) ctx.addIssue({ code: "custom", path: ["sections", i, "id"], message: `"${s.id}" is already used by another section` });
      if (headings.has(s.heading)) ctx.addIssue({ code: "custom", path: ["sections", i, "heading"], message: "another section already has this heading" });
      ids.add(s.id);
      headings.add(s.heading);
    });
    if (path.seo?.description && !plain(path.seo.description)) ctx.addIssue({ code: "custom", path: ["seo", "description"], message: "must be the organization's own text, not working placeholder text" });
  });
export type GetInvolvedPath = z.infer<typeof GetInvolvedPath>;

export const GetInvolvedHub = z.strictObject({
  ...fields,
  id: z.literal("hub"),
  heading: own(120).optional(),
  intro: own(400).optional(),
  ways: Heading.optional(),
  choose: Heading.optional(),
  why: z.strictObject({ heading: own(160), body: Paragraphs(6).min(1) }).optional(),
  closing: z.strictObject({ heading: own(160), primary: StructuredCta, secondary: StructuredCta.optional() }).optional(),
});
export type GetInvolvedHub = z.infer<typeof GetInvolvedHub>;

/* One of the five pages, by its id. */
export const GetInvolvedPage = z.discriminatedUnion("id", [GetInvolvedHub, GetInvolvedPath]);
export type GetInvolvedPage = z.infer<typeof GetInvolvedPage>;

/* What an owner cannot approve (or publish). The shape is checked by the
   contract; this is completeness. */
export function getInvolvedApprovalProblems(page: GetInvolvedPage): { path: string; message: string }[] {
  if (page.id === "hub")
    return [
      ...(page.heading ? [] : [{ path: "heading", message: "a heading is required before approval" }]),
      ...(page.intro ? [] : [{ path: "intro", message: "an introduction is required before approval" }]),
    ];
  return [
    ...(page.shortDescription ? [] : [{ path: "shortDescription", message: "a short description is required before approval" }]),
    ...(page.sections.length > 0 ? [] : [{ path: "sections", message: "at least one section is required before approval" }]),
  ];
}
