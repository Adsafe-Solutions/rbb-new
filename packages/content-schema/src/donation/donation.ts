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

/* The provider checkout a donation page embeds instead of the site's own
   form — the payment provider's widget, configured by PUBLIC identifiers
   only. Givebutter is the provider; payment, amounts, frequencies and
   donor records stay entirely Givebutter's.

     campaignId        Givebutter's numeric campaign id. The API verifies
                       it with Givebutter (server-side) before a page that
                       uses it can be published
     widgetId          the Form widget's id from the Givebutter dashboard.
                       Givebutter's API cannot list widgets or say which
                       campaign a widget belongs to, so this is stored as
                       the editor configured it — never inferred
     widgetType        "form": the one widget type the site embeds
     defaultAmount     optional preselection: one of the amounts the
                       campaign already offers (major units)
     defaultFrequency  optional preselection: one of the campaign's own
                       frequencies

   No account id: that is deployment configuration (the web build's
   VITE_GIVEBUTTER_ACCOUNT_ID). No API key, ever: it is server-only. */
export const GIVEBUTTER_FREQUENCIES = ["once", "monthly", "quarterly", "yearly"] as const;

export const DonationCheckout = z.strictObject({
  provider: z.literal("givebutter"),
  campaignId: z.string().regex(/^\d{1,20}$/, "must be a Givebutter campaign id (digits)"),
  widgetId: z.string().regex(/^[A-Za-z0-9]{4,16}$/, "must be a Givebutter widget id (4–16 letters or digits)"),
  widgetType: z.literal("form"),
  defaultAmount: z
    .number()
    .positive()
    .max(1_000_000)
    .refine((n) => Math.round(n * 100) === n * 100, "must have at most two decimal places")
    .optional(),
  defaultFrequency: z.enum(GIVEBUTTER_FREQUENCIES).optional(),
});
export type DonationCheckout = z.infer<typeof DonationCheckout>;

/* Site-wide donation settings (SiteSettings.donations — retired 2026-10-13: kept only so stored settings stay valid; online donations come later through Givebutter). */
export const DonationSettings = z.strictObject({
  form: DonationFormConfig,
  /* The closing band of every donation page: a heading and the button
     that takes the reader back to the form. */
  closing: z.strictObject({ heading: text(160), buttonLabel: text(40) }),
});
export type DonationSettings = z.infer<typeof DonationSettings>;
