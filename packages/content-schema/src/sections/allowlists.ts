import { z } from "zod";
import { SECTION_TYPES, Section, type SectionType } from "./blocks.ts";

/* Which blocks each kind of page accepts. A page type not listed here
   takes no sections at all.

   Donation pages (appeals and the general donation page) leave out `cta`
   on purpose: their closing band is the application's own "back to the
   form" action, and a second call to action would compete with the
   donation form. The form itself is never a block (see appeals/).

   The homepage is not here: it is a fixed composition with named slots
   (homepage/), because its order and colour sequence are designed as a
   whole. */
export const SECTION_ALLOWLIST = {
  appeal: ["statement", "numberedCards", "richText", "imageText", "stats", "faq", "trust", "appealList"],
  generalDonation: ["statement", "numberedCards", "richText", "imageText", "stats", "faq", "trust", "appealList"],
  page: SECTION_TYPES,
} as const satisfies Record<string, readonly SectionType[]>;

export type SectionPageType = keyof typeof SECTION_ALLOWLIST;

export const MAX_SECTIONS = 24;

/* The `sections` array for a page type: each section valid, its type
   allowed on that page, every id unique within the page. */
export const sectionsFor = (pageType: SectionPageType) => {
  const allowed: readonly string[] = SECTION_ALLOWLIST[pageType];
  return z
    .array(Section)
    .max(MAX_SECTIONS)
    .superRefine((sections, ctx) => {
      const ids = new Set<string>();
      sections.forEach((section, i) => {
        if (!allowed.includes(section.type))
          ctx.addIssue({
            code: "custom",
            path: [i, "type"],
            message: `"${section.type}" sections are not allowed on a ${pageType} page`,
          });
        if (ids.has(section.id))
          ctx.addIssue({ code: "custom", path: [i, "id"], message: `duplicate section id "${section.id}"` });
        ids.add(section.id);
      });
    });
};
