/* Our Work — Document 04. The program areas and the projects under them,
   as ONE data model. /work, the four program pages, /work/projects, the
   project detail pages AND the homepage's program cards and project
   timeline all read from here, so a program's description or a project's
   facts can only ever be stated once.

   Source labels, as in homepage.js and about.js:
     SOURCE     in the materials RBB supplied (annual report)
     PROPOSED   written for the website; RBB has to approve it
     WORKING    a temporary placeholder record, kept while RBB's own
                catalogue is not yet supplied (Document 27) — every field
                says so ("· demo", "(demo figure)"), and none of it is
                presented as verified. Replace with RBB's own catalogue
                before launch; nothing here is invented as if real.

   ⚠ Nothing here may name a project, campaign, country, school, clinic,
   partner, figure, date or outcome that RBB has not supplied AS IF IT WERE
   REAL. The site this replaced carried another charity's country appeals;
   none of them were RBB's, and none come back as "projects". */

import { BRAND } from "./brand.js";
import { pathCards } from "./getInvolved.js";
import { WORKING_PHOTOS as IMG } from "./photos.js";

/* ---------------- Programs ----------------
   The four program areas: SOURCE (annual report) — exactly these four, in
   this order. `description` is the safe current description Document 04
   gives for each. `icon` names a glyph in components/LineIcon. `to` must
   match content/nav.js.

   The program page template also reads:
     why         string | [string]  — "Why this matters"
     activities  [string]           — "What we do"
     impact      [string]           — program metrics, as text
     stories     [string]           — stories, as text
     image       { src, alt }       — a photograph
   WORKING below until RBB supplies its own; `missing` is shown only for a
   field genuinely not supplied in either source. */
export const PROGRAMS = [
  {
    slug: "education",
    title: "Education",
    to: "/work/education",
    icon: "education",
    description: "Access to quality education and skill-building opportunities.",
    missing: "Education program information to be provided by Rising Beyond Borders.",
    why: [
      "WORKING text — Education opens doors that stay open for a lifetime. Children who can read, write and count confidently have more choices about their future, and adults who keep learning can adapt as their communities change.",
      "This paragraph stands in for Rising Beyond Borders' own explanation of why education matters to its mission.",
    ],
    activities: [
      "WORKING — after-school reading and homework clubs",
      "WORKING — classroom supplies and learning materials for partner schools",
      "WORKING — training and mentoring for community teachers",
      "WORKING — skills courses for young adults leaving school",
    ],
    impact: ["Demo figure: 1,200 learners taking part in reading clubs", "Demo figure: 40 community teachers trained"],
    stories: ["WORKING — “Learning to read, together”: a field story from a reading club", "WORKING — “A classroom with enough books”: an impact story"],
  },
  {
    slug: "health-wellbeing",
    title: "Health & Wellbeing",
    to: "/work/health-wellbeing",
    icon: "health",
    description: "Improving health outcomes through care, awareness and support.",
    missing: "Health & Wellbeing program information to be provided by Rising Beyond Borders.",
    why: [
      "WORKING text — Good health is the ground everything else stands on. When families can reach basic care, clean water and reliable health information, children stay in school and adults stay in work.",
      "This paragraph stands in for Rising Beyond Borders' own explanation of why health and wellbeing matter to its mission.",
    ],
    activities: [
      "WORKING — community health check days with local health workers",
      "WORKING — clean water points and hygiene sessions",
      "WORKING — health and nutrition awareness for parents",
      "WORKING — referral support to local clinics",
    ],
    impact: ["Demo figure: 3,500 people reached by health check days", "Demo figure: 12 water points maintained"],
    stories: ["WORKING — “Water close to home”: a community story"],
  },
  {
    slug: "livelihoods",
    title: "Livelihoods",
    to: "/work/livelihoods",
    icon: "livelihoods",
    description: "Sustainable livelihoods and economic empowerment.",
    missing: "Livelihoods program information to be provided by Rising Beyond Borders.",
    why: [
      "WORKING text — A steady income gives a family room to plan. Practical skills, access to markets and small starting capital help people build livelihoods that last beyond any single project.",
      "This paragraph stands in for Rising Beyond Borders' own explanation of why livelihoods matter to its mission.",
    ],
    activities: [
      "WORKING — vocational training in tailoring and small trades",
      "WORKING — support for small market traders",
      "WORKING — farming inputs and training for smallholders",
      "WORKING — savings groups and basic business skills",
    ],
    impact: ["Demo figure: 260 people completing skills training", "Demo figure: 90 small businesses supported"],
    stories: ["WORKING — “From one sewing machine to a workshop”: an impact story"],
  },
  {
    slug: "community-support",
    title: "Community Support",
    to: "/work/community-support",
    icon: "community",
    description: "Strengthening communities through advocacy, resources and partnerships.",
    missing: "Community Support program information to be provided by Rising Beyond Borders.",
    why: [
      "WORKING text — Strong communities look after their own. Local volunteers, shared resources and good partnerships mean support reaches people quickly when they need it most.",
      "This paragraph stands in for Rising Beyond Borders' own explanation of why community support matters to its mission.",
    ],
    activities: [
      "WORKING — food and essentials distributions with local volunteers",
      "WORKING — community gatherings and information days",
      "WORKING — partnerships with local organisations",
      "WORKING — volunteer training and coordination",
    ],
    impact: ["Demo figure: 1,800 households receiving essentials packs", "Demo figure: 150 volunteers trained"],
    stories: ["WORKING — “Packing day”: a field story from a volunteer team"],
  },
];

/* ---------------- Projects ----------------
   One entry per project. Only `slug`, `title` and `program` are required;
   every other field renders only when present.

     {
       id:          unique key
       editorialStatus: "draft" | "pending-review" | "approved" | "archived"
                    — the PUBLISHING control (Document 18), never shown.
                    Only "approved" projects reach any page, and the
                    production build strips the rest out entirely. Not to
                    be confused with `status` below, the project's own
                    stage as RBB states it.
       slug:        URL segment — /work/projects/<slug>
       title, program, description, location, status, date, image,
       context, activities, impact, partners, story, featured
     }

   The ten projects below are WORKING placeholders, not RBB's verified
   catalogue: every location says "· demo", every figure says "(demo
   figure)", every partner name says "Demo Partner". They exist so the
   directory, filters, cards and detail pages have something to show;
   replace them with RBB's approved projects before launch — nothing here
   is presented as a real project or outcome. */
export const PROJECT_RECORDS = [
  {
    id: "reading-clubs",
    editorialStatus: "approved",
    slug: "community-reading-clubs",
    date: "2026-08-27",
    title: "Community Reading Clubs",
    program: "education",
    description: "After-school reading clubs where children practise reading with trained volunteers and a growing library of books.",
    location: "South Asia · demo",
    status: "Active",
    image: IMG.readingCircle,
    context: ["WORKING text — Many children in the communities this project imagines finish primary school without reading fluently. Reading clubs give them regular, relaxed practice outside school hours."],
    activities: ["Weekly reading sessions led by trained volunteers", "A lending library of age-appropriate books", "Reading games and storytelling days"],
    impact: [
      { value: "1,200", label: "children attending clubs (demo figure)" },
      { value: "30", label: "clubs running (demo figure)" },
    ],
    partners: ["Demo Partner — local schools network"],
    story: { title: "Learning to read, together (demo story)", excerpt: "How one reading club grew from ten children to sixty." },
    featured: true,
  },
  {
    id: "classroom-supplies",
    editorialStatus: "approved",
    slug: "classroom-supplies",
    date: "2026-08-18",
    title: "Classroom Supplies Programme",
    program: "education",
    description: "Books, notebooks and teaching materials for community schools that have too few.",
    location: "East Africa · demo",
    status: "Active",
    image: IMG.ruralClassroom,
    context: ["WORKING text — Classrooms with enough books and materials let teachers teach and children keep up."],
    activities: ["Supply packs for each classroom", "Teacher guides for the materials", "Termly restocking"],
    impact: [{ value: "85", label: "classrooms equipped (demo figure)" }],
  },
  {
    id: "teacher-mentoring",
    editorialStatus: "approved",
    slug: "teacher-mentoring",
    date: "2026-09-15",
    title: "Teacher Mentoring Network",
    program: "education",
    description: "Experienced teachers mentor newly trained community teachers through their first year.",
    location: "East Africa · demo",
    status: "Planned",
    image: IMG.teacherClassroom,
    activities: ["Monthly mentoring visits", "Peer learning circles", "Lesson-planning workshops"],
  },
  {
    id: "health-days",
    editorialStatus: "approved",
    slug: "community-health-days",
    date: "2026-08-12",
    title: "Community Health Days",
    program: "health-wellbeing",
    description: "Regular health check days bringing local health workers, screening and advice to the community.",
    location: "West Africa · demo",
    status: "Active",
    image: IMG.checkup,
    context: ["WORKING text — Health check days bring basic screening and advice closer to families who live far from a clinic."],
    activities: ["Basic health screening", "Nutrition advice for parents", "Referrals to local clinics"],
    impact: [{ value: "3,500", label: "people screened (demo figure)" }],
    partners: ["Demo Partner — district health volunteers"],
    featured: true,
  },
  {
    id: "water-points",
    editorialStatus: "approved",
    slug: "clean-water-points",
    date: "2026-07-22",
    title: "Clean Water Points",
    program: "health-wellbeing",
    description: "Repairing and maintaining hand pumps so families have clean water close to home.",
    location: "East Africa · demo",
    status: "Completed",
    image: IMG.waterPump,
    activities: ["Pump repairs and maintenance", "Water committees trained to look after each point", "Hygiene sessions at schools"],
    impact: [{ value: "12", label: "water points maintained (demo figure)" }],
  },
  {
    id: "tailoring",
    editorialStatus: "approved",
    slug: "tailoring-skills",
    date: "2026-08-01",
    title: "Tailoring Skills Course",
    program: "livelihoods",
    description: "A six-month tailoring course with a starter kit for graduates who want to set up on their own.",
    location: "South Asia · demo",
    status: "Active",
    image: IMG.sewing,
    context: ["WORKING text — Tailoring is a skill that can be practised from home and sold locally."],
    activities: ["Six-month practical course", "Starter kit for graduates", "Business basics and pricing"],
    impact: [{ value: "260", label: "graduates (demo figure)" }],
    featured: true,
  },
  {
    id: "market-traders",
    editorialStatus: "approved",
    slug: "market-traders",
    date: "2026-06-30",
    title: "Market Traders Support",
    program: "livelihoods",
    description: "Small grants and training for market traders to grow their stalls.",
    location: "West Africa · demo",
    status: "Active",
    image: IMG.market,
    activities: ["Small starting grants", "Record-keeping training", "Savings groups"],
  },
  {
    id: "smallholders",
    editorialStatus: "approved",
    slug: "smallholder-farming",
    date: "2026-09-20",
    title: "Smallholder Farming",
    program: "livelihoods",
    description: "Seeds, tools and training for smallholder farmers to improve their harvests.",
    location: "Latin America · demo",
    status: "Planned",
    image: IMG.harvest,
  },
  {
    id: "essentials",
    editorialStatus: "approved",
    slug: "essentials-distribution",
    date: "2026-09-05",
    title: "Essentials Distribution",
    program: "community-support",
    description: "Volunteers pack and deliver food and essentials to households that need them most.",
    location: "South Asia · demo",
    status: "Active",
    image: IMG.packing,
    context: ["WORKING text — Distributions are planned with local volunteers who know which households need support."],
    activities: ["Packing days with volunteers", "Household deliveries", "Follow-up visits"],
    impact: [{ value: "1,800", label: "households supported (demo figure)" }],
    partners: ["Demo Partner — community volunteers"],
  },
  {
    id: "community-days",
    editorialStatus: "approved",
    slug: "community-information-days",
    date: "2026-07-10",
    title: "Community Information Days",
    program: "community-support",
    description: "Open days where families can find out about local services, support and opportunities.",
    location: "East Africa · demo",
    status: "Completed",
    image: IMG.gathering,
  },
];

/* The projects the site may show: approved ones only. Every page reads
   this, never PROJECT_RECORDS, so a record being prepared (draft /
   pending-review / archived) cannot reach a card, a detail page, the
   sitemap or structured data (scripts/content-publishing.mjs strips
   anything else at build time). */
export const PROJECTS = PROJECT_RECORDS.filter((p) => p.editorialStatus === "approved");

/* ---------------- Lookups ---------------- */
export const programBySlug = (slug) => PROGRAMS.find((p) => p.slug === slug);
export const programByPath = (path) => PROGRAMS.find((p) => p.to === path);
export const projectBySlug = (slug) => PROJECTS.find((p) => p.slug === slug);
export const projectsIn = (programSlug) => PROJECTS.filter((p) => p.program === programSlug);
export const projectPath = (project) => `/work/projects/${project.slug}`;

/* The projects as the Home timeline shows them (components/
   ProjectTimeline): newest first by date, undated ones after, in list
   order. Each card's place is its verified location, else its program; its
   pill is its date, else its status. Donate goes to the one donation page. */
const shortDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const projectHighlights = () =>
  [...PROJECTS]
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .map((p) => ({
      title: p.title,
      place: p.location ?? programBySlug(p.program)?.title,
      body: p.description,
      src: p.image?.src,
      alt: p.image?.alt,
      focal: p.image?.focal,
      date: p.date ?? null,
      dateLabel: p.date ? shortDate(p.date) : p.status ?? null,
      donate: { label: "Donate", to: "/get-involved/donate" },
      more: { label: "Learn More", to: projectPath(p) },
    }));

/* ---------------- Page copy ----------------
   Headings and labels are PROPOSED interface copy; every factual line is
   either SOURCE or a placeholder. */
export const WORK = {
  /* /work */
  overview: {
    kicker: "Our work",
    heading: "Our Work",
    /* PROPOSED wording built only from SOURCE facts: the annual report's
       positioning and its four program areas. */
    body: `${BRAND.fullName} works to empower communities and create sustainable solutions across four program areas.`,
    cta: { label: "Explore Projects", to: "/work/projects" },
    programs: {
      kicker: "Program areas",
      heading: "Four areas of focus",
    },
    closing: {
      heading: "Be part of the work.",
      ctas: {
        primary: { label: "Get Involved", to: "/get-involved" },
        secondary: { label: "Explore Our Impact", to: "/impact" },
      },
    },
  },

  /* Shared by every list of projects: /work, each program page, and
     /work/projects. */
  projects: {
    kicker: "Projects",
    heading: "Projects",
    empty: "Projects to be provided by Rising Beyond Borders.",
    cta: { label: "Explore Projects", to: "/work/projects" },
  },

  /* /work/projects. */
  directory: {
    kicker: "Our work",
    heading: "All Projects",
    body: "WORKING text — Every project across our four program areas. Filter by program to narrow the list.",
    listHeading: "Project directory",
    browse: "Browse by program area",
    /* The program filter — shown only once there are FILTER_MIN projects
       or more, so it never implies a dataset that does not exist. */
    filter: {
      label: "Filter projects by program area",
      all: "All programs",
      showing: "Showing",
      of: "of",
      projects: (n) => `${n} ${n === 1 ? "project" : "projects"}`,
    },
  },

  /* The program page template — the same eight sections for all four. */
  program: {
    kicker: "Program area",
    why: { heading: "Why this matters" },
    what: { heading: "What we do" },
    projectsHeading: "Featured projects",
    impact: {
      heading: "Impact",
      empty: "Program impact information to be provided by Rising Beyond Borders.",
    },
    stories: {
      heading: "Stories",
      empty: "Stories to be provided by Rising Beyond Borders.",
    },
    getInvolved: {
      kicker: "Get involved",
      heading: "Ways to support this work.",
      items: pathCards(),
    },
    related: {
      heading: "Explore related work.",
      ctas: {
        primary: { label: "Support Our Mission", to: "/get-involved" },
        secondary: { label: "All Program Areas", to: "/work" },
      },
    },
  },

  /* The project detail template's labels. The summary is the project's
     own `description`, set under its title. */
  detail: {
    context: "Context",
    activities: "What we do",
    impact: "Impact",
    partners: "Partners",
    story: "Story",
    related: "Related work",
    program: "Program area",
    location: "Location",
    status: "Status",
    closing: "Continue exploring.",
    cta: { label: "Support Our Mission", to: "/get-involved" },
  },
};

export default WORK;
