import { z } from "zod";
import { recordFields } from "../common/record.ts";
import { EntityId, MediaId, text } from "../common/primitives.ts";
import { Href, HttpsUrl } from "../common/link.ts";
import { SeoDefaults } from "../seo/seo.ts";
import { DonationSettings } from "../donation/donation.ts";

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
  /* FUTURE: brand assets as media. Today they are files in the web app. */
  branding: z.strictObject({
    logoId: MediaId.optional(),
    faviconId: MediaId.optional(),
  }),
  /* Public measurement IDs only. Measurement also needs the organization's
     consent decision and runs only in a production build. */
  analytics: z.strictObject({
    googleAnalyticsId: z
      .string()
      .regex(/^G-[A-Z0-9]{4,20}$/, 'must be a GA4 measurement ID like "G-XXXXXXX"')
      .optional(),
    clarityProjectId: z
      .string()
      .regex(/^[a-z0-9]{6,20}$/, "must be a Clarity project ID")
      .optional(),
  }),
  donations: DonationSettings,
  engagement: z.strictObject({
    announcementBar: z.strictObject({ enabled: z.boolean(), intervalMs: z.int().min(2000).max(30000) }),
    popup: z.strictObject({ enabled: z.boolean() }),
    storyStrip: z.strictObject({ enabled: z.boolean() }),
  }),
  features: z.strictObject({
    themeSwitcher: z.boolean(),
  }),
});
export type SiteSettings = z.infer<typeof SiteSettings>;
