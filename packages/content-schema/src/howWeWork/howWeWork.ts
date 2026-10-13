import { z } from "zod";
import { recordFields } from "../common/record.ts";
import { Slug, text } from "../common/primitives.ts";
import { PROGRAM_ICONS } from "../programs/program.ts";

/* How We Work (#7) — ONE per organization: the How We Work page
   (/about/how-we-work), exactly as the site draws it (apps/web
   pages/HowWeWork, content/about.js HOW_WE_WORK):

     kicker, heading, body  the page header
     practices              "In practice" — a heading and up to eight
                            cards, each a title, a line and one of the
                            site's line glyphs (PROGRAM_ICONS; the header's
                            icon cluster is drawn from them)
     rows                   the numbered passages beneath, in order: a
                            heading, a passage and an optional list

   At least one card and one passage: the page draws both bands, and an
   empty band would be a bare heading.

   What stays the site's: the two posters (Our Approach, Transparency) and
   the closing ask — links between the site's own pages, not RBB's
   words — and the page's SEO. Plain text throughout. No method, framework
   or claim is supplied here: the words are RBB's (decision D11). */

const Practice = z.strictObject({ title: text(120), description: text(300), icon: z.enum(PROGRAM_ICONS) });

const Row = z.strictObject({
  id: Slug,
  heading: text(160),
  body: text(1200),
  items: z.array(text(300)).min(1).max(12).optional(),
});

export const HowWeWork = z.strictObject({
  ...recordFields,
  kicker: text(60).optional(),
  heading: text(120),
  body: text(400),
  practices: z.strictObject({
    kicker: text(60).optional(),
    heading: text(160),
    items: z.array(Practice).min(1).max(8),
  }),
  rows: z
    .array(Row)
    .min(1)
    .max(8)
    .superRefine((rows, ctx) => {
      const ids = new Set<string>();
      rows.forEach((row, i) => {
        if (ids.has(row.id)) ctx.addIssue({ code: "custom", path: [i, "id"], message: `duplicate passage id "${row.id}"` });
        ids.add(row.id);
      });
    }),
});
export type HowWeWork = z.infer<typeof HowWeWork>;
