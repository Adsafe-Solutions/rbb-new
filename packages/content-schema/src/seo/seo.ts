import { z } from "zod";
import { MediaId, text } from "../common/primitives.ts";

/* Per-record SEO overrides. Every field is optional: without one, the web
   derives the value from the record itself (its title, its excerpt or
   summary, its image) — which is what it does today for every page.

   Deliberately NOT here:
     canonical   derived from the route; an editor cannot point a page's
                 canonical elsewhere
     index       indexing follows the organization's approvals and the
                 absence of sample content (apps/web/src/content/seo.js),
                 so `noIndex` can only ever take a page OUT of the index,
                 never force one in */
export const SeoOverrides = z.strictObject({
  title: text(70).optional(),
  description: text(200).optional(),
  ogImageId: MediaId.optional(),
  noIndex: z.boolean().optional(),
});
export type SeoOverrides = z.infer<typeof SeoOverrides>;

/* Site-wide defaults (SiteSettings.seo): what a page without its own
   description or share image uses. */
export const SeoDefaults = z.strictObject({
  description: text(200),
  ogImageId: MediaId.optional(),
});
export type SeoDefaults = z.infer<typeof SeoDefaults>;
