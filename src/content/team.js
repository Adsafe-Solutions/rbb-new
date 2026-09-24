/* Our Team & Organization — Document 10. ONE source for the people shown
   as Rising Beyond Borders' team: /about/team, each /about/team/<slug>
   profile and the team section on /about all read from here.

   ⚠ No person, name, title, department, biography, location, credential,
   photograph, social account, responsibility, reporting line or
   governance role may be written here AS IF IT BELONGED TO A REAL RBB
   STAFF MEMBER unless RBB has supplied AND approved it, with that
   person's consent.

   The six people below are WORKING placeholders (Document 27), not real
   staff: fictional names, stock portraits, and every card and biography
   says so on its face ("· Demo profile", a biography that opens by
   stating the person is fictional). They exist so the team grid, groups
   and profile pages have something to review. Replace them — and each
   real person's consent — before launch. */

import { ABOUT } from "./about.js";
import { pathCards } from "./getInvolved.js";
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
const NOTE = "This is a working placeholder profile used to preview this page — a fictional person, not a member of Rising Beyond Borders.";

export const TEAM_MEMBERS = [
  {
    /* WORKING placeholder (Document 27) — see NOTE, which opens the biography. */
    status: "approved",
    image: TEAM_PORTRAITS[0],
    imageAlt: TEAM_PORTRAIT_ALT,
    order: 0,
    id: "amara",
    slug: "amara-demo",
    name: "Amara Demo",
    role: "Executive Director · Demo profile",
    category: "leadership",
    featured: true,
    shortBio: "Leads the organisation's strategy and partnerships.",
    biography: [
      NOTE,
      "Amara leads the organisation's strategy, partnerships and team, and works closely with community partners to shape new programmes.",
      "Before this role she spent many years in community development and education.",
    ],
    relatedLinks: [{ label: "Our Work", to: "/work" }],
  },
  {
    /* WORKING placeholder (Document 27) — see NOTE, which opens the biography. */
    status: "approved",
    image: TEAM_PORTRAITS[1],
    imageAlt: TEAM_PORTRAIT_ALT,
    order: 1,
    id: "grace",
    slug: "grace-demo",
    name: "Grace Demo",
    role: "Director of Programmes · Demo profile",
    category: "leadership",
    featured: true,
    shortBio: "Oversees the four programme areas and their teams.",
    biography: [
      NOTE,"Grace oversees the education, health, livelihoods and community support programmes, and the teams who run them."],
    relatedLinks: [{ label: "Our Impact", to: "/impact" }],
  },
  {
    /* WORKING placeholder (Document 27) — see NOTE, which opens the biography. */
    status: "approved",
    image: TEAM_PORTRAITS[2],
    imageAlt: TEAM_PORTRAIT_ALT,
    order: 2,
    id: "samuel",
    slug: "samuel-demo",
    name: "Samuel Demo",
    role: "Volunteer Coordinator · Demo profile",
    category: "team",
    featured: true,
    shortBio: "Welcomes and supports volunteers across every project.",
    biography: [
      NOTE,"Samuel recruits, trains and supports volunteers, and plans the packing days and community events they run."],
    relatedLinks: [{ label: "Volunteer", to: "/get-involved/volunteer" }],
  },
  {
    /* WORKING placeholder (Document 27) — see NOTE, which opens the biography. */
    status: "approved",
    image: TEAM_PORTRAITS[3],
    imageAlt: TEAM_PORTRAIT_ALT,
    order: 3,
    id: "leila",
    slug: "leila-demo",
    name: "Leila Demo",
    role: "Partnerships Manager · Demo profile",
    category: "team",
    shortBio: "Builds partnerships with organisations and communities.",
    biography: [
      NOTE,"Leila works with organisations and community groups who want to partner on projects."],
    relatedLinks: [{ label: "Partner With Us", to: "/get-involved/partner" }],
  },
  {
    /* WORKING placeholder (Document 27) — see NOTE, which opens the biography. */
    status: "approved",
    image: TEAM_PORTRAITS[4],
    imageAlt: TEAM_PORTRAIT_ALT,
    order: 4,
    id: "daniel",
    slug: "daniel-demo",
    name: "Daniel Demo",
    role: "Finance Officer · Demo profile",
    category: "team",
    shortBio: "Looks after budgets, reporting and financial records.",
    biography: [
      NOTE,"Daniel manages budgets and financial reporting, and prepares the information published on the Transparency page."],
    relatedLinks: [{ label: "Transparency", to: "/about/transparency" }],
  },
  {
    /* WORKING placeholder (Document 27) — see NOTE, which opens the biography. */
    status: "approved",
    image: TEAM_PORTRAITS[5],
    imageAlt: TEAM_PORTRAIT_ALT,
    order: 5,
    id: "hannah",
    slug: "hannah-demo",
    name: "Hannah Demo",
    role: "Communications Officer · Demo profile",
    category: "team",
    shortBio: "Shares stories and news from the work.",
    biography: [
      NOTE,"Hannah gathers stories and updates from the programmes and shares them on the website and in the newsletter."],
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
  name: member.name,
  role: member.role,
  bio: member.shortBio,
  image: member.image ? { src: member.image, alt: member.imageAlt ?? "" } : undefined,
  to: hasProfile(member) ? memberPath(member) : undefined,
});

/* The team members shown on /about — the approved, `featured` ones. */
export const featuredMembers = () => approvedMembers().filter((m) => m.featured).map(memberCard);

/* How the team relates to governance. WORKING placeholder text below,
   self-labelled; replace with RBB's approved structure before launch. */
export const TEAM_GOVERNANCE = {
  body: "WORKING text — The staff team reports to a volunteer board, which sets strategy and oversees finances. Replace with Rising Beyond Borders' approved governance description.",
  status: "approved",
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
    cta: { label: "Governance", to: "/about/transparency#governance" },
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
