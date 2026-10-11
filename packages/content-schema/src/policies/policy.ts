import { z } from "zod";
import { recordFields } from "../common/record.ts";
import { EntityId, IsoDate, Slug, text } from "../common/primitives.ts";
import { SeoOverrides } from "../seo/seo.ts";

/* Site policies (M19) — exactly THREE per organization, each one record
   with a fixed id and a fixed address (apps/web src/content/policies.js):

     privacy    /privacy           the Privacy Policy
     terms      /terms             the Terms of Use
     donation   /donation-policy   the Donation Policy

   The id is the record's identity AND its route: an editor can neither
   add a policy, rename one nor move it. Cookies is not here — the site
   has no cookie page until the production technology is assessed and RBB
   decides a disclosure is needed (Document 13 §6).

   ⚠ Nothing here is legal text and none is ever written by the system:
   the wording and both dates are RBB's, reviewed by counsel, typed in as
   supplied. A new policy starts EMPTY.

     title             the page title
     effectiveDate     RBB's ISO calendar dates ("YYYY-MM-DD") — never the
     lastUpdated       day of a deploy. Both are required to approve
     intro             lead paragraphs, plain text
     sections          in order: a stable `id` (the page's anchor), a
                       heading, paragraphs and an optional bullet list.
                       At least one section to approve
     contactReference  the `id` of a contact method in the organization's
                       published settings — never a typed-in address
     relatedPolicies   other policies by id; linked only while published
     seo.description   the page's meta description

   Plain paragraphs and bullet lists only — no rich text, no HTML. No
   release marker: a policy is RBB's text or it is not published. */

export const POLICY_IDS = ["privacy", "terms", "donation"] as const;
export const PolicyId = z.enum(POLICY_IDS);
export type PolicyId = z.infer<typeof PolicyId>;

export const POLICY_ROUTES: Record<PolicyId, string> = { privacy: "/privacy", terms: "/terms", donation: "/donation-policy" };

export const PolicySection = z
  .strictObject({
    id: Slug.max(60),
    heading: text(160),
    body: z.array(text(4000)).max(30),
    items: z.array(text(1000)).max(50).optional(),
  })
  .refine((s) => s.body.length > 0 || (s.items?.length ?? 0) > 0, { message: "needs a paragraph or a list item", path: ["body"] });
export type PolicySection = z.infer<typeof PolicySection>;

export const PolicySeo = SeoOverrides.pick({ description: true });

const { releaseMarker: _internal, ...fields } = recordFields;

export const Policy = z
  .strictObject({
    ...fields,
    id: PolicyId,
    title: text(120),
    effectiveDate: IsoDate.optional(),
    lastUpdated: IsoDate.optional(),
    intro: z.array(text(4000)).max(10),
    sections: z.array(PolicySection).max(40),
    contactReference: EntityId.optional(),
    relatedPolicies: z.array(PolicyId).max(2),
    seo: PolicySeo.optional(),
  })
  .superRefine((policy, ctx) => {
    const seen = new Set<string>();
    policy.sections.forEach((s, i) => {
      if (seen.has(s.id)) ctx.addIssue({ code: "custom", path: ["sections", i, "id"], message: `"${s.id}" is already used by another section` });
      seen.add(s.id);
    });
    if (new Set(policy.relatedPolicies).size !== policy.relatedPolicies.length) ctx.addIssue({ code: "custom", path: ["relatedPolicies"], message: "names a policy twice" });
    if (policy.relatedPolicies.includes(policy.id)) ctx.addIssue({ code: "custom", path: ["relatedPolicies"], message: "a policy cannot be related to itself" });
  });
export type Policy = z.infer<typeof Policy>;

/* What an owner cannot approve (or publish): a policy without both of
   RBB's dates, or without any section. The shape is checked by `Policy`;
   this is completeness. */
export const policyApprovalProblems = (policy: Pick<Policy, "effectiveDate" | "lastUpdated" | "sections">): { path: string; message: string }[] => [
  ...(policy.effectiveDate ? [] : [{ path: "effectiveDate", message: "an effective date is required before approval" }]),
  ...(policy.lastUpdated ? [] : [{ path: "lastUpdated", message: "a last-updated date is required before approval" }]),
  ...(policy.sections.length > 0 ? [] : [{ path: "sections", message: "at least one section is required before approval" }]),
];
