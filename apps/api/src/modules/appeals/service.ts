import { isApproval } from "../content/workflow.ts";
import { z } from "zod";
import { Appeal, type DonationCheckout } from "@rbb/content-schema";
import { errors, type ErrorDetail } from "../../errors.ts";
import type { ContentStore } from "../content/repository.ts";
import type { CollectionConfig } from "../content/service.ts";
import type { CheckoutVerifier } from "../donations/verify.ts";

/* Appeals — emergency appeals and campaigns (the content contract's
   Appeal), on the shared content lifecycle (modules/content): drafts,
   published, archived; unique addresses; confirmed address changes; media
   from the library; audit by field name.

   Editable: kind, title, slug, summary, featured image, highlight (the
   story circles), sections, donation (designation and the Givebutter
   checkout), start/end dates and SEO.

   Sections: the CMS accepts only the blocks an appeal page draws — one
   "why it matters" passage (a statement, or rich text) and one list of how
   support helps (numbered cards). The contract allows more; the website
   would refuse to build a page with a block it cannot draw, so they are
   refused here, at save, instead.

   Givebutter: a checkout is checked for shape on every save (the
   contract). It is VERIFIED with the provider whenever the appeal is
   published — on the save that publishes it or changes its checkout while
   published — and again when an owner publishes the website. A draft may
   hold an unverified checkout. */

export const DRAWN_SECTIONS = ["statement", "richText", "numberedCards"] as const;

/* The section rules shared by appeals and the general donation page. */
export function donationSectionProblems(sections: { type: string; enabled: boolean }[], prefix: string): ErrorDetail[] {
  const problems: ErrorDetail[] = [];
  sections.forEach((section, i) => {
    if (!(DRAWN_SECTIONS as readonly string[]).includes(section.type))
      problems.push({ path: `${prefix}.${i}.type`, message: `"${section.type}" sections are not drawn on donation pages yet` });
  });
  const enabled = sections.filter((s) => s.enabled);
  if (enabled.filter((s) => s.type === "statement" || s.type === "richText").length > 1)
    problems.push({ path: prefix, message: "a donation page has one “why it matters” passage (statement or rich text)" });
  if (enabled.filter((s) => s.type === "numberedCards").length > 1) problems.push({ path: prefix, message: "a donation page has one list of how support helps" });
  return problems;
}

const sameCheckout = (a?: DonationCheckout, b?: DonationCheckout) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/* Verify when the record is (still, or newly) published and its checkout
   is new to the public — never for a draft. */
export const checkoutToVerify = (
  record: { status: string; donation?: { checkout?: DonationCheckout } },
  previous: { status: string; donation?: { checkout?: DonationCheckout } } | null
): DonationCheckout | null => {
  /* M14: checked when the record is approved (it goes live at the next
     website publish, which checks every checkout again). */
  const checkout = record.donation?.checkout;
  if (!checkout || !isApproval(record.status)) return null;
  if (previous && isApproval(previous.status) && sameCheckout(checkout, previous.donation?.checkout)) return null;
  return checkout;
};

const editable = Object.fromEntries(
  ["kind", "title", "slug", "summary", "imageId", "highlight", "sections", "donation", "startsOn", "endsOn", "seo"].map((f) => [f, z.unknown()])
);

export const appealCollection = (verify: CheckoutVerifier): CollectionConfig<Appeal> => ({
  kind: "appeal",
  contract: Appeal,
  fields: editable,
  required: ["kind", "title", "summary", "imageId"],
  defaults: () => ({ sections: [] }),
  rules: (appeal) => donationSectionProblems(appeal.sections, "body.sections"),
  media: (appeal) => [
    ["body.imageId", appeal.imageId],
    ["body.highlight.imageId", appeal.highlight?.imageId],
    ["body.seo.ogImageId", appeal.seo?.ogImageId],
  ],
  // Sections hold the appeal's wording: audited as "sections", never walked.
  opaque: ["sections"],
  async check(appeal, previous) {
    const checkout = checkoutToVerify(appeal, previous);
    return checkout ? verify([{ path: "body.donation.checkout", checkout }]) : [];
  },
});

/* M2's internal read: a published appeal by its address, or NOT_FOUND —
   a draft or archived appeal is indistinguishable from a missing one. */
export async function publishedAppeal(store: ContentStore<Appeal>, slug: string): Promise<Appeal> {
  const stored = await store.findBySlug(slug);
  if (!stored || stored.record.status !== "published") throw errors.notFound("appeal");
  const checked = Appeal.safeParse(stored.record);
  if (!checked.success) throw errors.internal(new Error(`Stored appeal fails the content contract at: ${checked.error.issues.map((i) => i.path.join(".")).join(", ")}`));
  return checked.data;
}
