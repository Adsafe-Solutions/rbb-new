import { z } from "zod";
import { recordFields } from "../common/record.ts";
import { Slug, text } from "../common/primitives.ts";

/* One headline figure ("50K+ Lives Impacted…"). Figures are their own
   records because each carries its own verification, separately from
   whether it is published: today the site shows its figures while they
   are still "pending-review", and the release stays blocked until the
   organization verifies them (apps/web/release/approvals.mjs). A `stats`
   block refers to figures by slug; it never restates one, so the homepage
   and the Impact page can never show two different values.

     slug          the key `stats` blocks name the figure by (`metricIds`)
     value         the figure as written ("50K+", "25", "200+")
     label         what it counts
     verification  whether the organization has verified it
     order         position among the figures, lower first (M11) */
export const MetricVerification = z.enum(["pending-review", "verified"]);

export const Metric = z.strictObject({
  ...recordFields,
  slug: Slug,
  value: text(16),
  label: text(120),
  verification: MetricVerification,
  order: z.int().min(0).max(10_000),
});
export type Metric = z.infer<typeof Metric>;
