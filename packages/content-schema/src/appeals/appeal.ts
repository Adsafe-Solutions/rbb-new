import { z } from "zod";
import { recordFields } from "../common/record.ts";
import { EntityId, IsoDate, MediaId, Paragraphs, Slug, text } from "../common/primitives.ts";
import { SeoOverrides } from "../seo/seo.ts";
import { sectionsFor } from "../sections/allowlists.ts";
import { DonationCheckout, DonationDesignation, DonationFormOverrides } from "../donation/donation.ts";
import { AppealKind } from "./kind.ts";

/* A page whose purpose is a gift. Every one of them draws the same
   donation experience in apps/web (hero + the one donation form, then its
   sections, then the closing "back to the form" band); the content
   supplies what the page is about, never the form.

     Appeal               an emergency appeal or a campaign — many
     GeneralDonationPage  /appeals, giving where support is needed most —
                          one per organization

   A project donation (the web's `type: "project"`) is not modelled: no
   project page takes a gift today. */

/* An appeal's place in the story circles over the navbar (StoryStrip).
   Present = featured there; `label` shortens the circle's caption,
   `imageId` swaps its photograph. */
export const AppealHighlight = z.strictObject({
  label: text(40).optional(),
  imageId: MediaId.optional(),
});

/* What the appeal's gifts are for, any change to the form defaults, and
   the provider checkout that takes them (absent: the site's own form). */
export const AppealDonation = z.strictObject({
  designation: DonationDesignation.optional(),
  formOverrides: DonationFormOverrides.optional(),
  checkout: DonationCheckout.optional(),
});

export const Appeal = z
  .strictObject({
    ...recordFields,
    kind: AppealKind,
    slug: Slug,
    title: text(120),
    summary: text(400),
    imageId: MediaId,
    highlight: AppealHighlight.optional(),
    sections: sectionsFor("appeal"),
    donation: AppealDonation.optional(),
    /* FUTURE: when the appeal runs. No appeal records dates today. */
    startsOn: IsoDate.optional(),
    endsOn: IsoDate.optional(),
    seo: SeoOverrides.optional(),
  })
  .refine((a) => !a.startsOn || !a.endsOn || a.startsOn <= a.endsOn, {
    path: ["endsOn"],
    message: "endsOn must not be before startsOn",
  });
export type Appeal = z.infer<typeof Appeal>;

/* The general donation page's opening: what a general gift supports, a
   photograph, and the context line beside the form. */
export const DonationHero = z.strictObject({
  eyebrow: text(60).optional(),
  title: text(120),
  description: text(400),
  imageId: MediaId,
  context: z.strictObject({ label: text(60).optional(), body: Paragraphs }).optional(),
});

export const GeneralDonationPage = z.strictObject({
  ...recordFields,
  id: EntityId,
  hero: DonationHero,
  sections: sectionsFor("generalDonation"),
  donation: z.strictObject({
    designation: DonationDesignation,
    formOverrides: DonationFormOverrides.optional(),
    checkout: DonationCheckout.optional(),
  }),
  seo: SeoOverrides.optional(),
});
export type GeneralDonationPage = z.infer<typeof GeneralDonationPage>;
