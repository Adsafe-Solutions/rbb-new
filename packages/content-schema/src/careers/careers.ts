import { z } from "zod";
import { recordFields } from "../common/record.ts";
import { Paragraphs, Slug, text } from "../common/primitives.ts";
import { Link } from "../common/link.ts";
import { SeoOverrides } from "../seo/seo.ts";

/* Careers (M13) — ONE per organization: the Careers page
   (/about-us/careers), exactly as the site draws it (apps/web
   pages/Careers, content/contact.js CAREERS):

     kicker, title, intro  the page header
     why                   "Why work with us" — a heading and paragraphs;
                           left out when absent
     opportunities         "Open opportunities" — a heading, the line shown
                           while there is no role, and the open ROLES, in
                           order. A role is what the page lists: its title.
                           There are no role pages, application forms or
                           application links on the site, so none here
     apply                 "How to apply" — a heading and paragraphs; left
                           out when absent
     closing               the closing ask: a heading and one or two links
     seo                   the shared overrides, without a share image (the
                           page has none). With no role the page is not
                           indexed, as before; `noIndex` can only take it out

   Plain text throughout. No salary, benefit, location, deadline or
   requirement fields: the site shows none, and an invented vacancy is
   something a real applicant would act on. */

const Section = z.strictObject({ heading: text(160), body: Paragraphs.max(6) });

/* `id` (2026-10-13): the role's address for its application form (Admin →
   Forms), from its title; optional so earlier records stay valid. */
export const CareerRole = z.strictObject({ id: Slug.optional(), title: text(160) });

export const CareersSeo = SeoOverrides.omit({ ogImageId: true });

export const Careers = z.strictObject({
  ...recordFields,
  kicker: text(60).optional(),
  title: text(120),
  intro: text(400),
  why: Section.optional(),
  opportunities: z.strictObject({
    heading: text(160),
    empty: text(300),
    roles: z.array(CareerRole).max(30),
  }),
  apply: Section.optional(),
  closing: z.strictObject({ heading: text(160), primary: Link, secondary: Link.optional() }),
  seo: CareersSeo.optional(),
});
export type Careers = z.infer<typeof Careers>;
