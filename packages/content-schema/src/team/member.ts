import { z } from "zod";
import { recordFields } from "../common/record.ts";
import { MediaId, Paragraphs, Slug, text } from "../common/primitives.ts";
import { HttpsUrl } from "../common/link.ts";

/* A team member (M9) — one person shown on /about/team, with a profile
   page at /about/team/<slug> when they have a biography. Only the fields
   the team page and profile already draw; no contact details (email,
   phone) — the public page never shows them.

     group        which band they appear in: "leadership" or "team" (the
                  website's TEAM_GROUPS headings name them)
     order        position within the team, lower first; ties by id
     featured     marked for a featured-people section (the source records
                  carry it; no page draws one today)
     shortBio     the card's line
     biography    the profile page's paragraphs — a profile exists only
                  with one
     socialLinks  accounts the person approves, https only
     relatedLinks pages of this site, by path */

/* A page of this site, optionally to one of its sections ("/about#transparency"). */
const SitePath = z.string().regex(/^\/(?!\/)[^\s?#\\]*(#[A-Za-z0-9_-]+)?$/, 'must be a site path like "/contact" or "/about#transparency"');

export const TeamGroup = z.enum(["leadership", "team"]);

export const TeamMember = z.strictObject({
  ...recordFields,
  slug: Slug,
  name: text(120),
  role: text(120),
  group: TeamGroup,
  order: z.int().min(0).max(10_000),
  featured: z.boolean().optional(),
  shortBio: text(300).optional(),
  biography: Paragraphs.optional(),
  imageId: MediaId.optional(),
  departmentOrArea: text(120).optional(),
  location: text(120).optional(),
  socialLinks: z.array(z.strictObject({ label: text(60), url: HttpsUrl })).max(6).optional(),
  relatedLinks: z.array(z.strictObject({ label: text(60), href: SitePath })).max(6).optional(),
});
export type TeamMember = z.infer<typeof TeamMember>;
