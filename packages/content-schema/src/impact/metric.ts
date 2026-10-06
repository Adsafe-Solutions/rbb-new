import { z } from "zod";
import { recordFields } from "../common/record.ts";
import { text } from "../common/primitives.ts";

/* One headline figure ("50K+ Lives Impacted…"). Figures are their own
   records because each carries its own verification, separately from
   whether it is published: today the site shows its figures while they
   are still "pending-review", and the release stays blocked until the
   organization verifies them (apps/web/release/approvals.mjs). A `stats`
   block refers to figures by id; it never restates one. */
export const MetricVerification = z.enum(["pending-review", "verified"]);

export const Metric = z.strictObject({
  ...recordFields,
  value: text(16),
  label: text(120),
  verification: MetricVerification,
});
export type Metric = z.infer<typeof Metric>;
