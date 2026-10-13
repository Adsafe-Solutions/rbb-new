/* Our Team & Organization — Document 10. ONE source for the people shown
   as Rising Beyond Borders' team: /about/team, each /about/team/<slug>
   profile and the team section on /about all read from here.

   ⚠ No person, name, title, department, biography, location, credential,
   photograph, social account, responsibility, reporting line or
   governance role may be written here AS IF IT BELONGED TO A REAL RBB
   STAFF MEMBER unless RBB has supplied AND approved it, with that
   person's consent.

   2026-10-13: the team is the CMS's only (Admin → Team): the published
   snapshot sets TEAM_MEMBERS. The sample profiles this file used to hold
   were removed once the live snapshot was shown to replace them. What
   stays here: the groups, governance, lookups and the pages' wording. */

import { missionLine } from "./about.js";
import { pathCards } from "./getInvolved.js";
import { isWorkingContent } from "../lib/releaseMarkers.js";

/* One record per person:
     {
       id, slug,            slug is the profile URL — /about/team/<slug>
       name, role,
       status:              "draft" | "pending-review" | "approved" | "archived"
       category:            a TEAM_GROUPS id — which section they appear in
       departmentOrArea:    only if RBB defines one
       shortBio:            one or two sentences (cards)
       biography:           [string] — the full approved biography; a person
                            gets a profile page ONLY when this exists
       image, imageAlt:     a photograph and an accurate description of it
       location:            only if approved for publication
       socialLinks:         [{ label, url }] — only accounts the person approves
       relatedLinks:        [{ label, to }] — internal pages, if relevant
       order:               sort order within the group (lower first)
       featured:            true to appear in the team section on /about
       approvedAt:          ISO date the record was approved
     }
   Personal contact details (email, phone) are never part of a record
   unless RBB explicitly approves them for public use. */
export const TEAM_MEMBERS = [];

/* The groups the page shows, in order. PLACEHOLDER structure: the source
   material gives no organisational chart, so this is deliberately
   minimal — rename, add or remove groups when RBB supplies its own.
   A group with no approved members is not shown. */
export const TEAM_GROUPS = [
  { id: "leadership", kicker: "Leadership", heading: "Leadership" },
  { id: "team", kicker: "Our team", heading: "Team members" },
];

/* ---------------- Lookups ---------------- */
export const approvedMembers = () =>
  TEAM_MEMBERS.filter((m) => m.status === "approved").sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
export const membersIn = (groupId) => approvedMembers().filter((m) => m.category === groupId);
export const memberBySlug = (slug) => approvedMembers().find((m) => m.slug === slug);
export const hasProfile = (member) => Array.isArray(member.biography) && member.biography.length > 0;
export const memberPath = (member) => `/about/team/${member.slug}`;

/* A person as TeamGrid draws them: only the fields they have. The card
   links to a profile only when a profile exists. */
export const memberCard = (member) => ({
  sample: isWorkingContent(member) ? "Sample profile" : undefined,
  name: member.name,
  role: member.role,
  bio: member.shortBio,
  image: member.image ? { src: member.image, alt: member.imageAlt ?? "" } : undefined,
  to: hasProfile(member) ? memberPath(member) : undefined,
});

/* The team members shown on /about — the approved, `featured` ones. */
export const featuredMembers = () => approvedMembers().filter((m) => m.featured).map(memberCard);

/* How the team relates to governance. PLACEHOLDER — a reporting line or
   a board is a fact about RBB, so nothing stands in for it; the section
   is left out until RBB supplies its approved structure (decision D7). */
export const TEAM_GOVERNANCE = {
  body: null,
  status: "placeholder",
};

/* ---------------- Page copy ----------------
   Headings and labels are PROPOSED interface copy. */
export const TEAM_COPY = {
  kicker: "Our team",
  heading: "Our Team",
  body: "The people behind the work of Rising Beyond Borders.",
  metaDescription: "The people behind the work of Rising Beyond Borders.",
  intro: {
    id: "introduction",
    heading: "Working towards our mission",
    /* SOURCE: the mission, as the annual report states it. */
    body: [missionLine()],
  },
  emptySection: { kicker: "Our team", heading: "Our people" },
  empty: "Our team information will be provided and reviewed by Rising Beyond Borders.",
  governance: {
    id: "governance",
    heading: "Team and governance",
    cta: { label: "Governance", to: "/about#governance" },
  },
  getInvolved: {
    kicker: "Get involved",
    heading: "Work alongside us.",
    /* The approved participation paths that involve people directly. No
       jobs or application process — see /about-us/careers for that. */
    items: pathCards().filter((p) => ["/get-involved/volunteer", "/get-involved/partner"].includes(p.to)),
  },
  profile: {
    back: "Our Team",
    links: "Related",
    social: "Elsewhere",
  },
  closing: {
    heading: "Learn more about Rising Beyond Borders.",
    ctas: {
      primary: { label: "About Us", to: "/about" },
      secondary: { label: "Explore Our Work", to: "/work" },
    },
  },
};

export default TEAM_MEMBERS;
