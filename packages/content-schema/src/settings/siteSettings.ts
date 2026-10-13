import { z } from "zod";
import { recordFields } from "../common/record.ts";
import { EntityId, MediaId, text } from "../common/primitives.ts";
import { Href, HttpsUrl } from "../common/link.ts";
import { SeoDefaults } from "../seo/seo.ts";
import { DonationSettings } from "../donation/donation.ts";
import { countryList } from "../common/countryField.ts";

/* Organization-level settings — one record per organization.

   PUBLIC CONFIGURATION ONLY. Everything here may be shown to visitors or
   compiled into the public site. Secrets — database URIs, storage keys,
   email or payment API keys, webhook and session secrets — are never
   content: they live in each deployment's environment. Every object here
   is strict, so a field that is not listed (a stray `resendApiKey`) is
   refused rather than stored.

   Not settings either, because they are code or release state:
     the colour palette and type    apps/web/src/styles/theme.css
     whether donations are open     release-governed (DONATION.status)
     which approvals are recorded   apps/web/release/approvals.mjs */

export const SocialPlatform = z.enum(["instagram", "facebook", "tiktok", "linkedin", "youtube"]);

export const ContactMethod = z.strictObject({
  id: EntityId,
  type: z.enum(["email", "phone", "other"]),
  label: text(80),
  value: text(200),
  /* Defaults to mailto:/tel: from `value` for email and phone. */
  href: Href.optional(),
  description: text(300).optional(),
});

export const Office = z.strictObject({
  address: text(300),
  city: text(120).optional(),
  region: text(120).optional(),
  country: text(120).optional(),
  mapUrl: HttpsUrl.optional(),
});

export const SiteSettings = z.strictObject({
  ...recordFields,
  general: z.strictObject({
    /* The everyday mark ("RBB") and the full name it stands for. */
    shortName: text(40),
    name: text(120),
    summary: text(300),
  }),
  /* Only confirmed contact details belong here: an entry is shown as
     soon as it is published. */
  contact: z.strictObject({
    methods: z.array(ContactMethod).max(10),
    office: Office.optional(),
    hours: text(200).optional(),
    responseTime: text(200).optional(),
  }),
  social: z
    .array(z.strictObject({ platform: SocialPlatform, url: HttpsUrl }))
    .max(10)
    .refine((list) => new Set(list.map((s) => s.platform)).size === list.length, "one account per platform"),
  seo: SeoDefaults,
  /* INTERNAL — countries selected in Admin → Settings → General, from the
     full list (common/countries.ts). Optional; empty until someone
     selects. NEVER PUBLISHED: the publish leaves it out of every snapshot
     (the snapshot contract refuses it), so the website never shows it and
     it is not a "change to publish". Being on this list does not make a
     country a place RBB works: the public Where We Work list is the Impact
     page's geography block, published through review. */
  countries: countryList(0).optional(),
  /* RETIRED (scope decision, 2026-10-13): branding, analytics, donation
     defaults and features are not managed in the admin and are not read by
     the website. The website keeps its built-in logo and favicon; it
     measures nothing; online donations come later through Givebutter; the
     theme switcher stays a deployment switch. The four keys stay here,
     OPTIONAL and unchanged in shape, only so the settings record already
     stored and the snapshots already published remain valid — nothing
     writes them any more (the API refuses changes to them) and no
     destructive migration is run. Remove them once no stored or published
     settings carry them. */
  branding: z
    .strictObject({
      logoId: MediaId.optional(),
      faviconId: MediaId.optional(),
    })
    .optional(),
  analytics: z
    .strictObject({
      googleAnalyticsId: z
        .string()
        .regex(/^G-[A-Z0-9]{4,20}$/, 'must be a GA4 measurement ID like "G-XXXXXXX"')
        .optional(),
      clarityProjectId: z
        .string()
        .regex(/^[a-z0-9]{6,20}$/, "must be a Clarity project ID")
        .optional(),
    })
    .optional(),
  donations: DonationSettings.optional(),
  engagement: z.strictObject({
    announcementBar: z.strictObject({ enabled: z.boolean(), intervalMs: z.int().min(2000).max(30000) }),
    popup: z.strictObject({ enabled: z.boolean() }),
    storyStrip: z.strictObject({ enabled: z.boolean() }),
  }),
  features: z
    .strictObject({
      themeSwitcher: z.boolean(),
    })
    .optional(),
});
export type SiteSettings = z.infer<typeof SiteSettings>;
