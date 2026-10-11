import { z } from "zod";
import { recordFields } from "../common/record.ts";
import { Paragraphs, Slug, text } from "../common/primitives.ts";
import { MetricVerification } from "../impact/metric.ts";

/* Transparency (M11) — ONE per organization: what the Transparency
   chapter of the About page shows (apps/web components/TransparencySection,
   /about#transparency), except its documents, which are Report records.

     kicker, heading, intro  the chapter's own words
     financialOverview       the year's spending shares, exactly as the
                             organization's materials give them: shares of
                             the total that add up to 100, never amounts.
                             `verification` as a headline figure's: the
                             site shows them while pending, and the release
                             stays blocked until they are verified
     governance              how the organization is governed — a passage
                             and/or headed paragraphs; absent until the
                             organization supplies an approved statement
     accountability          "How we report" — paragraphs

   Plain text throughout: no amounts, no HTML. There is no page of its
   own (the old /about/transparency forwards to the About page), so no
   SEO: the About page's applies. */

export const FinancialShare = z.strictObject({
  /* A stable key for the share (its colour follows its position). */
  id: Slug,
  label: text(60),
  percentage: z.int().min(0).max(100),
});

export const FinancialOverview = z
  .strictObject({
    year: z.int().min(2000).max(2100),
    verification: MetricVerification,
    items: z.array(FinancialShare).min(1).max(6),
  })
  .superRefine((overview, ctx) => {
    const ids = new Set<string>();
    overview.items.forEach((item, i) => {
      if (ids.has(item.id)) ctx.addIssue({ code: "custom", path: ["items", i, "id"], message: "appears twice" });
      ids.add(item.id);
    });
    const total = overview.items.reduce((sum, item) => sum + item.percentage, 0);
    if (total !== 100) ctx.addIssue({ code: "custom", path: ["items"], message: `the shares must add up to 100% (they add up to ${total}%)` });
  });

export const Governance = z
  .strictObject({
    intro: text(1200).optional(),
    sections: z.array(z.strictObject({ heading: text(120), body: text(1200) })).max(12).optional(),
  })
  .refine((g) => Boolean(g.intro) || Boolean(g.sections?.length), { message: "add a passage or a headed paragraph, or leave governance out" });

export const Transparency = z.strictObject({
  ...recordFields,
  kicker: text(60).optional(),
  heading: text(160),
  intro: text(400),
  financialOverview: FinancialOverview,
  governance: Governance.optional(),
  accountability: Paragraphs.max(6).optional(),
});
export type Transparency = z.infer<typeof Transparency>;
