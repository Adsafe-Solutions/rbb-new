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
     activities  [string]           — "What we focus on"
     impact      [string]           — "The change we work towards", in
                                      words; never a figure until RBB
                                      verifies one
     stories     [string]           — stories, as text
     image       { src, alt }       — a photograph
   `why`, `activities` and `impact` are PROPOSED general copy (content
   brief, 2026-10-04; decision D12): what each area is about, with no
   project, place, partner, beneficiary or outcome named. `stories` names the
   SAMPLE stories (content/stories.js). `missing` is shown only for a field
   genuinely not supplied. */
export const PROGRAMS = [
  {
    slug: "education",
    title: "Education",
    to: "/work/education",
    icon: "education",
    description: "Access to quality education and skill-building opportunities.",
    missing: "Education program information to be provided by Rising Beyond Borders.",
    why: [
      "Education opens doors that stay open for a lifetime. Learning builds knowledge and skills, but also confidence — the belief that your choices matter and that your future is yours to shape.",
      "Yet access to learning is still uneven. Cost, distance, disability, displacement and discrimination keep many children, young people and adults from the education they need. Our education work focuses on widening that access, so that learning becomes a real opportunity rather than a privilege.",
    ],
    activities: [
      "Widening access to learning for children, young people and adults",
      "Supporting inclusive learning environments where every learner is welcome",
      "Building practical skills that lead towards further learning and work",
      "Encouraging the confidence and curiosity to keep learning",
      "Connecting learners with resources and long-term opportunity",
    ],
    impact: [
      "More people able to take part in learning, whatever their circumstances",
      "Learners with the skills and confidence to take their next step",
      "Learning environments that welcome and include everyone",
    ],
    stories: ["“Learning to read, together” — why confidence comes before fluency", "“When every learner has a book” — what changes when materials stop being the bottleneck"],
  },
  {
    slug: "health-wellbeing",
    title: "Health & Wellbeing",
    to: "/work/health-wellbeing",
    icon: "health",
    description: "Improving health outcomes through care, awareness and support.",
    missing: "Health & Wellbeing program information to be provided by Rising Beyond Borders.",
    why: [
      "Good health is the ground everything else stands on. When people can reach essential support and reliable information, children can keep learning, adults can keep working, and families can plan for the future.",
      "Wellbeing is more than physical health. Mental and emotional wellbeing shape how people cope, connect and recover — and both deserve to be met with dignity. Our health and wellbeing work focuses on access, awareness and prevention, alongside the people and services communities already rely on.",
    ],
    activities: [
      "Improving access to essential health and wellbeing support",
      "Promoting physical wellbeing and healthy everyday practices",
      "Recognising mental and emotional wellbeing as part of good health",
      "Raising awareness, so people can make informed choices about their health",
      "Supporting prevention, so problems are met before they grow",
    ],
    impact: [
      "People able to reach the support they need, with dignity",
      "Communities better informed about health and wellbeing",
      "Mental and emotional wellbeing treated as part of everyday health",
    ],
    stories: ["“Water close to home” — what keeps a water point working", "“A health day, start to finish” — bringing care closer without replacing local services"],
  },
  {
    slug: "livelihoods",
    title: "Livelihoods",
    to: "/work/livelihoods",
    icon: "livelihoods",
    description: "Sustainable livelihoods and economic empowerment.",
    missing: "Livelihoods program information to be provided by Rising Beyond Borders.",
    why: [
      "A steady livelihood gives people room to plan, to recover from setbacks and to invest in their families' futures. It is also a source of dignity and independence.",
      "Our livelihoods work focuses on the foundations of economic opportunity: practical skills, employability and the confidence to start something of your own — so that people can build incomes that last beyond any single project.",
    ],
    activities: [
      "Building practical, market-relevant skills",
      "Supporting employability and pathways into work",
      "Encouraging enterprise and small-scale entrepreneurship",
      "Strengthening resilience, so households can withstand setbacks",
      "Favouring livelihoods that are sustainable over the long term",
    ],
    impact: [
      "People with the skills and confidence to earn a living",
      "Fairer access to economic opportunity",
      "Households better able to withstand setbacks",
    ],
    stories: ["“A skill you can practise at home” — earning around caring responsibilities", "“Keeping count on market day” — what record-keeping shows a small trader"],
  },
  {
    slug: "community-support",
    title: "Community Support",
    to: "/work/community-support",
    icon: "community",
    description: "Strengthening communities through advocacy, resources and partnerships.",
    missing: "Community Support program information to be provided by Rising Beyond Borders.",
    why: [
      "Strong communities look after one another. When people are connected, informed and able to act together, support reaches those who need it — and challenges are met with shared strength.",
      "Our community support work responds to the priorities communities set for themselves. It focuses on essential support in times of need, on inclusion, and on building the local capacity that helps communities stay resilient over time.",
    ],
    activities: [
      "Responding to the priorities communities identify for themselves",
      "Providing essential support when people need it most",
      "Encouraging inclusion, so no one is left on the margins",
      "Strengthening local capacity and community leadership",
      "Building connection between people, groups and services",
    ],
    impact: [
      "Communities more resilient in the face of challenges",
      "People connected to the support and services around them",
      "Local capacity that keeps working after a project ends",
    ],
    stories: ["“What goes into a packing day” — the planning behind essential support"],
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
       context, activities, approach, outcomes, impact, partners, story,
       featured
     }

   The ten projects below are SAMPLE projects, not RBB's catalogue
   (decision D13). Each carries `releaseMarker: "Sample project"` — an
   INTERNAL field, never shown to visitors (content brief, 2026-10-04),
   that the release markers detect in the record, in the bundle and in
   the `data-release-marker` attribute the cards and pages carry. They are written as editorial previews of how a project
   page reads: no place, date, partner, figure or measured result,
   because none has been supplied. `approach` and `outcomes` (intended
   change, never a result) are the detail page's own sections. Replace
   with RBB's approved projects before launch. */
const SAMPLE = "Sample project";
export const PROJECT_RECORDS = [
  {
    id: "reading-clubs",
    editorialStatus: "approved",
    slug: "community-reading-clubs",
    title: "Community Reading Clubs",
    program: "education",
    description: "After-school reading clubs that give children regular, relaxed time with books and an encouraging adult.",
    releaseMarker: SAMPLE,
    image: IMG.readingCircle,
    context: [
      "Many children finish their first years of school still unsure of their reading. Classrooms are busy, books at home can be scarce, and a child who falls behind early often stays behind.",
      "Reading clubs offer something simple: time, books and encouragement, away from the pressure of marks.",
    ],
    activities: ["Regular reading time in a calm, welcoming space", "Books chosen for different ages and reading levels", "Reading aloud, storytelling and games that build confidence"],
    approach: [
      "Clubs are shaped with families and schools, so they fit around the school day and the languages children speak at home.",
      "Volunteers are prepared to support reading without turning it into another lesson, and children help each other as they grow in confidence.",
    ],
    outcomes: ["Children who enjoy reading and choose to read", "More confidence in class", "Families more involved in their children's learning"],
    featured: true,
  },
  {
    id: "classroom-supplies",
    editorialStatus: "approved",
    slug: "classroom-supplies",
    title: "Learning Materials for Classrooms",
    program: "education",
    description: "Books, notebooks and teaching materials for classrooms that have too few — chosen with the teachers who use them.",
    releaseMarker: SAMPLE,
    image: IMG.ruralClassroom,
    context: [
      "When learners share one book between several, lessons slow to the pace of the page-turn. Teachers spend their time copying onto the board instead of teaching, and the children who most need help get the least of it.",
    ],
    activities: ["Materials matched to what is being taught", "Guidance for teachers on using them well", "Replacing what wears out, so the difference lasts"],
    approach: [
      "Teachers decide what is needed — not a standard list chosen from far away.",
      "Materials are sourced as close to the school as possible, and checked on later to make sure they are in use rather than in a cupboard.",
    ],
    outcomes: ["Every learner with the materials to take part", "More of the lesson spent teaching", "Teachers better equipped to support every child"],
  },
  {
    id: "teacher-mentoring",
    editorialStatus: "approved",
    slug: "teacher-mentoring",
    title: "Teacher Mentoring Network",
    program: "education",
    description: "Pairing newer teachers with experienced colleagues, for support through their first years in the classroom.",
    releaseMarker: SAMPLE,
    image: IMG.teacherClassroom,
    context: [
      "New teachers often start alone: a full classroom, little preparation time and no one to ask. Many leave the profession early — and their pupils lose a teacher just as they were getting to know them.",
    ],
    activities: ["Regular conversations between mentor and teacher", "Small peer groups to share what works", "Practical help with planning and inclusive teaching"],
    approach: [
      "Mentoring is built on trust, not inspection: teachers set their own goals and decide what they want help with.",
      "What works in one classroom is shared with others, so good practice spreads between schools.",
    ],
    outcomes: ["Teachers who feel confident and supported", "Classrooms that include every learner", "Experienced teachers whose knowledge is passed on"],
  },
  {
    id: "health-days",
    editorialStatus: "approved",
    slug: "community-health-days",
    title: "Community Health Days",
    program: "health-wellbeing",
    description: "Open days that bring basic health checks, information and advice closer to families who live far from a clinic.",
    releaseMarker: SAMPLE,
    image: IMG.checkup,
    context: [
      "Distance, cost and a day's lost earnings can all delay a visit to a clinic. Small health problems go unchecked until they become serious ones.",
    ],
    activities: ["Basic health checks in a familiar community setting", "Clear, practical health information", "Referrals to the services people can use afterwards"],
    approach: [
      "Health days are planned alongside the health services people already use, so they strengthen those services rather than replace them.",
      "Checks are private and respectful, and anyone who needs more care leaves knowing where to go next.",
    ],
    outcomes: ["Health concerns noticed earlier", "Families better informed about their health", "Stronger links between communities and local services"],
    featured: true,
  },
  {
    id: "water-points",
    editorialStatus: "approved",
    slug: "clean-water-points",
    title: "Clean Water Close to Home",
    program: "health-wellbeing",
    description: "Keeping community water points working, so clean water stays close to home.",
    releaseMarker: SAMPLE,
    image: IMG.waterPump,
    context: [
      "When a water point breaks, the walk for water gets longer — often for women and children — and some families turn to sources that are not safe to drink.",
    ],
    activities: ["Repair and regular maintenance of water points", "Communities caring for their own water points", "Hygiene awareness, especially in schools"],
    approach: [
      "A water point lasts when the people who use it can look after it, so communities are supported to organise its care and pay for small repairs.",
      "Repairs use skills and parts that can be found locally, so the next breakdown does not have to wait for outside help.",
    ],
    outcomes: ["Water that is reliable and safe", "Time given back to the people who fetch it", "Fewer illnesses linked to unsafe water"],
  },
  {
    id: "tailoring",
    editorialStatus: "approved",
    slug: "tailoring-skills",
    title: "Tailoring Skills Course",
    program: "livelihoods",
    description: "A practical tailoring course for people who want to earn from a skill they can practise close to home.",
    releaseMarker: SAMPLE,
    image: IMG.sewing,
    context: [
      "For people with caring responsibilities, work far from home is often out of reach. A practical skill that can be used from home or nearby opens a door to earning that fits around the rest of life.",
    ],
    activities: ["Hands-on tailoring skills, learned by making", "The basics of pricing, costs and record-keeping", "Help with tools and getting started"],
    approach: [
      "Sessions are arranged around participants' other responsibilities, and learning happens through real pieces of work.",
      "Those who complete the course are encouraged to share their skills with the next group.",
    ],
    outcomes: ["A skill that can earn an income", "Confidence to set prices and find customers", "A network of people who support one another"],
    featured: true,
  },
  {
    id: "market-traders",
    editorialStatus: "approved",
    slug: "market-traders",
    title: "Support for Small Traders",
    program: "livelihoods",
    description: "Training and peer support that help small market traders keep records, plan ahead and grow.",
    releaseMarker: SAMPLE,
    image: IMG.market,
    context: [
      "Small traders often work on thin margins, where a single bad week can wipe out savings. Without records, it is hard to see which goods make money and which quietly lose it.",
    ],
    activities: ["Simple record-keeping that fits a busy stall", "Planning for slow seasons", "Savings and peer groups"],
    approach: [
      "Training starts from traders' own experience of their market, not a textbook.",
      "Peer groups let traders compare notes, solve problems together and keep each other going.",
    ],
    outcomes: ["Steadier incomes", "Savings to fall back on", "Traders able to plan rather than react"],
  },
  {
    id: "smallholders",
    editorialStatus: "approved",
    slug: "smallholder-farming",
    title: "Resilient Smallholder Farming",
    program: "livelihoods",
    description: "Practical support that helps small-scale farmers grow more reliably as seasons become harder to predict.",
    releaseMarker: SAMPLE,
    image: IMG.harvest,
    context: [
      "Small farms feed families and local markets, but they have little margin for a failed season. Unpredictable rain and tired soil make every harvest a risk.",
    ],
    activities: ["Seeds and tools suited to local conditions", "Soil and water practices that protect the land", "Farmers learning from one another"],
    approach: [
      "Local knowledge comes first: farmers already know their land, and new practices are tested alongside what already works.",
      "Farmer-to-farmer learning means good ideas travel further than any single training day.",
    ],
    outcomes: ["More reliable harvests", "Households better able to withstand a poor season", "Land kept productive for the next generation"],
  },
  {
    id: "essentials",
    editorialStatus: "approved",
    slug: "essentials-distribution",
    title: "Essential Support Packs",
    program: "community-support",
    description: "Food and essentials for households facing a hard period, planned and delivered with local volunteers.",
    releaseMarker: SAMPLE,
    image: IMG.packing,
    context: [
      "Illness, the loss of work or a sudden emergency can leave a household without the basics. Support that arrives quickly — and respectfully — can stop a hard month from becoming a crisis.",
    ],
    activities: ["Packs of food and everyday essentials", "Delivery to households who cannot easily travel", "Connecting families with longer-term support"],
    approach: [
      "Support is given with dignity: discreetly, and with choice wherever possible.",
      "Local volunteers, who know their neighbourhoods, help plan who is reached and follow up afterwards.",
    ],
    outcomes: ["Households supported through a difficult period", "Families connected to services that can help further", "A volunteer network ready to respond"],
  },
  {
    id: "community-days",
    editorialStatus: "approved",
    slug: "community-information-days",
    title: "Community Information Days",
    program: "community-support",
    description: "Open days where people can find out about the services, support and opportunities around them.",
    releaseMarker: SAMPLE,
    image: IMG.gathering,
    context: [
      "Help often exists but goes unused: people do not know about it, cannot tell whether it is for them, or find it hard to approach. Information days bring it into one welcoming place.",
    ],
    activities: ["Clear information in everyday language", "A chance to meet local services face to face", "Space to ask questions without pressure"],
    approach: [
      "Each day is shaped by the questions residents raise beforehand.",
      "Times, venues and languages are chosen so that the people most likely to miss out can take part.",
    ],
    outcomes: ["People who know where to turn", "Services that reach more of the people they are for", "Stronger connections within the community"],
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
    body: `${BRAND.fullName} works to empower communities and create sustainable solutions across four connected areas: education, health and wellbeing, livelihoods and community support.`,
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
    body: "Projects across our four program areas. Filter by program to narrow the list.",
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
    what: { heading: "What we focus on" },
    projectsHeading: "Featured projects",
    impact: {
      heading: "The change we work towards",
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
        primary: { label: "Get Involved", to: "/get-involved" },
        secondary: { label: "All Program Areas", to: "/work" },
      },
    },
  },

  /* The project detail template's labels. The summary is the project's
     own `description`, set under its title. */
  detail: {
    context: "The challenge",
    activities: "What this work focuses on",
    approach: "How the work is approached",
    /* Intended change, in words — a result is only ever `impact`, and
       only once RBB has verified it. */
    outcomes: "What it aims to change",
    connection: "Part of our program area",
    impact: "Impact",
    partners: "Partners",
    story: "Story",
    related: "Related work",
    program: "Program area",
    location: "Location",
    status: "Status",
    closing: "Continue exploring.",
    cta: { label: "Get Involved", to: "/get-involved" },
  },
};

export default WORK;
