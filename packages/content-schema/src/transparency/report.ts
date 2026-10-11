import { z } from "zod";
import { recordFields } from "../common/record.ts";
import { Slug, text } from "../common/primitives.ts";
import { HttpsUrl } from "../common/link.ts";

/* A transparency document (M11) — an annual report, a financial
   statement or a governance paper, listed in the Transparency chapter of
   the About page under its category. Exactly what that list draws:

     category  which card it is listed on
     title     the link's words
     year      shown beside it, when given
     type      a short label shown beside it ("PDF", "Summary"), when given
               — never a claim the document itself does not make
               ("audited")
     fileUrl   the document itself: an https:// address. The media library
               holds images only, so a document is a link to where the
               organization publishes the file — never a placeholder
     slug      a stable key (the content service's address), not a page:
               documents have no page of their own
     order     position within its category, lower first

   Only a PUBLISHED document is listed; nothing is listed without one. */

export const REPORT_CATEGORIES = ["annualReport", "financial", "governance"] as const;
export const ReportCategory = z.enum(REPORT_CATEGORIES);

export const Report = z.strictObject({
  ...recordFields,
  slug: Slug,
  category: ReportCategory,
  title: text(160),
  year: z.int().min(1900).max(2100).optional(),
  type: text(40).optional(),
  fileUrl: HttpsUrl,
  order: z.int().min(0).max(10_000),
});
export type Report = z.infer<typeof Report>;
