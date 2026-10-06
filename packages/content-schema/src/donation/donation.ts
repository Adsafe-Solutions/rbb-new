import { z } from "zod";
import { Slug, text } from "../common/primitives.ts";

/* The donation form's configuration — the same fields as the web's
   DONATION.form.config today. The FORM ITSELF is application code
   (apps/web DonationForm) and is never a content block: editors configure
   what may be given, never what the form is.

   Amounts are in MAJOR units ("500"); the form turns them into integer
   minor units. `currency` is an ISO 4217 code, or null while none is
   approved (amounts then show as plain numbers).

   Whether giving is open at all, and whether monthly giving can be
   offered, depend on a verified payment provider — that is release and
   infrastructure state, not content, and is not part of this contract. */
const formFields = {
  frequencyOptions: z.strictObject({ oneTime: z.boolean(), monthly: z.boolean() }),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/, "must be an ISO 4217 currency code")
    .nullable(),
  presetAmounts: z.array(z.number().positive().finite()).max(8),
  allowCustomAmount: z.boolean(),
  minimumAmount: z.number().positive().finite(),
  maximumAmount: z.number().positive().finite(),
};

type FormConfig = { [K in keyof typeof formFields]: z.infer<(typeof formFields)[K]> };

const checkForm = (form: FormConfig, ctx: z.RefinementCtx) => {
  if (!form.frequencyOptions.oneTime && !form.frequencyOptions.monthly)
    ctx.addIssue({ code: "custom", path: ["frequencyOptions"], message: "at least one frequency must be offered" });
  if (form.minimumAmount > form.maximumAmount)
    ctx.addIssue({ code: "custom", path: ["minimumAmount"], message: "minimumAmount must not exceed maximumAmount" });
  if (new Set(form.presetAmounts).size !== form.presetAmounts.length)
    ctx.addIssue({ code: "custom", path: ["presetAmounts"], message: "preset amounts must not repeat" });
  form.presetAmounts.forEach((amount, i) => {
    if (amount < form.minimumAmount || amount > form.maximumAmount)
      ctx.addIssue({ code: "custom", path: ["presetAmounts", i], message: "preset amount is outside the minimum–maximum range" });
  });
  if (form.presetAmounts.length === 0 && !form.allowCustomAmount)
    ctx.addIssue({ code: "custom", path: ["presetAmounts"], message: "offer preset amounts, a custom amount, or both" });
};

export const DonationFormConfig = z.strictObject(formFields).superRefine(checkForm);
export type DonationFormConfig = z.infer<typeof DonationFormConfig>;

/* A page's changes to the site-wide form defaults. Any subset; the merged
   result must still be a valid DonationFormConfig. */
export const DonationFormOverrides = z.strictObject(formFields).partial();
export type DonationFormOverrides = z.infer<typeof DonationFormOverrides>;

/* The form a page actually draws: the defaults with its overrides. */
export const resolveDonationForm = (defaults: DonationFormConfig, overrides: DonationFormOverrides = {}) =>
  DonationFormConfig.safeParse({ ...defaults, ...overrides });

/* What a gift is internally designated to, e.g. "where-needed-most".
   Never shown to the donor. */
export const DonationDesignation = Slug;

/* Site-wide donation settings (SiteSettings.donations). */
export const DonationSettings = z.strictObject({
  form: DonationFormConfig,
  /* The closing band of every donation page: a heading and the button
     that takes the reader back to the form. */
  closing: z.strictObject({ heading: text(160), buttonLabel: text(40) }),
});
export type DonationSettings = z.infer<typeof DonationSettings>;
