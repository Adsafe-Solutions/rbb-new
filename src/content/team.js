/* Our Team & Organization — Document 10. ONE source for the people shown
   as Rising Beyond Borders' team: /about/team, each /about/team/<slug>
   profile and the team section on /about all read from here.

   ⚠ No person, name, title, department, biography, location, credential,
   photograph, social account, responsibility, reporting line or
   governance role may be written here AS IF IT BELONGED TO A REAL RBB
   STAFF MEMBER unless RBB has supplied AND approved it, with that
   person's consent.

   The six profiles below are SAMPLE profiles (decision D16), not real
   staff: each is a role, with a stock portrait, and every card and
   biography says so on its face ("Sample profile"). They exist so the
   team grid, groups and profile pages have something to review. Replace
   them — with each real person's consent — before launch. */

import { ABOUT } from "./about.js";
import { pathCards } from "./getInvolved.js";
import { isWorkingContent } from "../lib/releaseMarkers.js";
import { TEAM_PORTRAITS, TEAM_PORTRAIT_ALT } from "./photos.js";

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
/* Each sample profile is a ROLE, not a person: its `name` is the role
   and its `role` line the area it covers. `releaseMarker` ("Sample
   profile — …") is INTERNAL, never shown (content brief, 2026-10-04);
   the release markers find it in the record, the bundle and the
   `data-release-marker` attribute on cards and profile pages. No name, credential,
   employer, location or years of experience — none has been supplied.
   The slugs are unchanged so no address changes. */
const NOTE = "Sample profile — this page shows how a team member's profile will appear. It describes a role, not a real person.";

export const TEAM_MEMBERS = [
  {
    status: "approved",
    image: TEAM_PORTRAITS[0],
    imageAlt: TEAM_PORTRAIT_ALT,
    order: 0,
    id: "amara",
    slug: "amara-demo",
    name: "Executive Director",
    role: "Leadership",
    category: "leadership",
    featured: true,
    shortBio: "Leads the organisation's direction, partnerships and team.",
    releaseMarker: NOTE,
    biography: [
      "The Executive Director leads Rising Beyond Borders' overall direction: setting priorities with the board and team, building relationships with partners and supporters, and making sure the organisation stays true to its mission.",
      "A profile here will introduce the person in this role in their own words — what drew them to the work and what they hope it achieves.",
    ],
    relatedLinks: [{ label: "Our Work", to: "/work" }],
  },
  {
    status: "approved",
    image: TEAM_PORTRAITS[1],
    imageAlt: TEAM_PORTRAIT_ALT,
    order: 1,
    id: "grace",
    slug: "grace-demo",
    name: "Head of Programs",
    role: "Programs",
    category: "leadership",
    featured: true,
    shortBio: "Oversees the four program areas and how they work together.",
    releaseMarker: NOTE,
    biography: [
      "The Head of Programs oversees education, health and wellbeing, livelihoods and community support, and how the four connect in practice.",
      "The role is about listening as much as planning: making sure each program starts from the priorities communities set, and learns from what does and does not work.",
    ],
    relatedLinks: [{ label: "Our Impact", to: "/impact" }],
  },
  {
    status: "approved",
    image: TEAM_PORTRAITS[2],
    imageAlt: TEAM_PORTRAIT_ALT,
    order: 2,
    id: "samuel",
    slug: "samuel-demo",
    name: "Volunteer Coordinator",
    role: "Volunteering",
    category: "team",
    featured: true,
    shortBio: "Welcomes, prepares and supports volunteers.",
    releaseMarker: NOTE,
    biography: [
      "The Volunteer Coordinator is the first point of contact for volunteers: matching people's time and skills to where they can help, preparing them well and making sure they feel supported.",
      "Good volunteering depends on good coordination — clear roles, a named contact and a sense that every contribution counts.",
    ],
    relatedLinks: [{ label: "Volunteer", to: "/get-involved/volunteer" }],
  },
  {
    status: "approved",
    image: TEAM_PORTRAITS[3],
    imageAlt: TEAM_PORTRAIT_ALT,
    order: 3,
    id: "leila",
    slug: "leila-demo",
    name: "Partnerships Lead",
    role: "Partnerships",
    category: "team",
    shortBio: "Builds working relationships with organisations and communities.",
    releaseMarker: NOTE,
    biography: [
      "The Partnerships Lead works with organisations, institutions and community groups that want to collaborate, helping each partnership start from shared aims and stay accountable to the people it serves.",
    ],
    relatedLinks: [{ label: "Partner With Us", to: "/get-involved/partner" }],
  },
  {
    status: "approved",
    image: TEAM_PORTRAITS[4],
    imageAlt: TEAM_PORTRAIT_ALT,
    order: 4,
    id: "daniel",
    slug: "daniel-demo",
    name: "Finance Lead",
    role: "Finance",
    category: "team",
    shortBio: "Looks after budgets, financial records and reporting.",
    releaseMarker: NOTE,
    biography: [
      "The Finance Lead manages budgets and financial records, and prepares the financial information Rising Beyond Borders publishes, so supporters can see how resources are used.",
    ],
    relatedLinks: [{ label: "Transparency", to: "/about#transparency" }],
  },
  {
    status: "approved",
    image: TEAM_PORTRAITS[5],
    imageAlt: TEAM_PORTRAIT_ALT,
    order: 5,
    id: "hannah",
    slug: "hannah-demo",
    name: "Communications Lead",
    role: "Communications",
    category: "team",
    shortBio: "Shares stories and news from the work.",
    releaseMarker: NOTE,
    biography: [
      "The Communications Lead gathers stories and updates from across the programs and shares them — always with the consent of the people in them, and in a way that respects their dignity.",
    ],
    relatedLinks: [{ label: "Stories", to: "/stories" }],
  },
];

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
    body: [`Our mission is to ${ABOUT.missionVision.mission.statement.replace(/^E/, "e")}`],
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
