/* Our Impact — Document 05. The single source for impact content: the
   headline figures (also shown on the homepage), impact per program,
   geography, approach, measurement, and references to stories and reports.

   Every block carries an editorial `status` — for the people maintaining
   this file, never shown on the site:
     "verified"/"approved"  confirmed by RBB, or cleared to publish as
                            working content (Document 27) — see each
                            block's own note
     "pending-review"      supplied in RBB's materials, awaiting RBB's
                            final check — shown with a verification note,
                            never silently
     "placeholder"          nothing supplied yet; the page shows a placeholder

   It REFERENCES other content rather than copying it: programs by their
   Our Work slug (content/work.js), stories by their slug
   (content/stories.js), and transparency documents through the
   shared list in content/site.js.

   ⚠ Nothing here may name a country, region, beneficiary group, partner,
   donor, outcome, percentage, methodology, date or campaign AS IF RBB HAD
   SUPPLIED IT unless RBB has. "25 countries reached" is a figure, not a
   list — do not turn it into guessed country names. The geography and
   program-impact text below are WORKING placeholders (Document 27),
   clearly self-labelled ("demo"), kept so the page has something to
   review; they are not RBB's verified coverage. */

import { BRAND } from "./brand.js";
import { SITE } from "./site.js";

export const IMPACT = {
  /* Headline figures. Supplied in the annual report; Document 05 requires
     RBB to verify each before final publication — hence pending-review,
     unaffected by the working-content merge below: a bald figure has no
     room for a "(demo)" qualifier, so it stays pending until RBB confirms
     it, exactly as before.

     ⚠ The same report carries a "120+" figure under an inconsistent
     "Lives Impacted" label. Its meaning is not established, so it is NOT
     here and must not be added until RBB clarifies what it counts. */
  metrics: [
    { id: "lives", value: "50K+", label: "Lives Impacted Across Communities", status: "pending-review" },
    { id: "countries", value: "25", label: "Countries Reached", status: "pending-review" },
    { id: "partners", value: "200+", label: "Partners & Donors Worldwide", status: "pending-review" },
  ],
  metricsSource: "Figures from the Rising Beyond Borders annual report.",

  /* Impact per program, by Our Work slug. WORKING summaries below, until
     RBB supplies its own. */
  programImpact: [
    { programId: "education", summary: "Demo summary — reading clubs, classroom supplies and teacher mentoring.", metrics: [], status: "approved" },
    { programId: "health-wellbeing", summary: "Demo summary — health check days, clean water and hygiene sessions.", metrics: [], status: "approved" },
    { programId: "livelihoods", summary: "Demo summary — skills training, market traders and smallholder farming.", metrics: [], status: "approved" },
    { programId: "community-support", summary: "Demo summary — essentials distributions and community information days.", metrics: [], status: "approved" },
  ],

  /* Where RBB works. `countries` are verified country names; `regions` are
     { name, countries: [] } groupings. WORKING placeholder regions below
     — every name says "(demo)" — kept so the page/map layout can be
     reviewed; replace with RBB's verified coverage before launch. */
  geography: {
    summary: "Demo geography for review. These regions and countries are placeholders, NOT Rising Beyond Borders' verified locations.",
    regions: [
      { name: "East Africa (demo)", countries: ["Demo country A", "Demo country B"] },
      { name: "West Africa (demo)", countries: ["Demo country C"] },
      { name: "South Asia (demo)", countries: ["Demo country D", "Demo country E"] },
      { name: "Latin America (demo)", countries: ["Demo country F"] },
    ],
    countries: [],
    status: "approved",
  },

  /* How RBB works. The foundation is SOURCE: the mission's own words
     (content/about.js). The detailed approach below is a WORKING
     placeholder.

     `proposedFramework` is the Listen → Partner → Act → Sustain structure
     Document 02 suggested for the homepage. It is kept here, not shown on
     the Approach page, because Document 05 forbids presenting it as RBB's
     methodology before RBB approves it — its status stays pending-review,
     unaffected by the working-content merge (this is a claimed
     methodology, not a self-labelled placeholder). */
  approach: {
    intro: "Demo text — We listen to communities, work through local partners, act on the needs they identify, and plan every project to be sustained locally.",
    principles: [
      "Demo — Communities lead: projects start from local priorities",
      "Demo — Local partners: we work through people who know the context",
      "Demo — Dignity: support is offered with respect and choice",
      "Demo — Learning: we measure, listen and adapt",
      "Demo — Sustainability: skills and ownership stay local",
    ],
    status: "approved",
    proposedFramework: {
      steps: ["Listen", "Partner", "Act", "Sustain"],
      status: "pending-review",
    },
  },

  /* How impact is measured. WORKING placeholders below; no measurement
     system is described as RBB's own until RBB supplies one. */
  measurement: {
    intro: "Demo text — Each project sets a small number of outcomes at the start and tracks them through simple, regular reporting.",
    methods: ["Demo — attendance and participation records", "Demo — before-and-after surveys", "Demo — community feedback sessions"],
    evidence: ["Demo — annual programme reviews published on the Transparency page"],
    status: "approved",
  },

  /* Impact stories, by slug (content/stories.js). Only approved stories
     are shown; a slug that is not an approved story is skipped. */
  stories: ["a-classroom-with-enough-books", "from-one-sewing-machine"],

  /* Reports, as { title, type, url, year, status }. No document is listed
     here without a real, RBB-approved file (Document 09) — none exists
     yet, so this stays empty and the page falls back to the shared
     transparency links. */
  reports: [],
};

/* ---------------- Page copy ----------------
   Headings and labels are PROPOSED interface copy. Every factual line is
   SOURCE, a pending-review figure, or a placeholder. */
/* The verification note shown with the headline figures wherever they
   appear (Home, /impact) — present while ANY figure is unverified, exactly
   as the financial overview on /about/transparency is treated (Document
   19). Verify every figure and it disappears on its own. */
export const metricsNote = () =>
  IMPACT.metrics.every((m) => ["verified", "approved"].includes(m.status)) ? null : SITE.figuresPending;

/* The approach steps as the homepage may show them: only once RBB has
   approved the framework (Document 19 §5). Until then the homepage's
   approach section is its heading, intro and link, as on /about — the
   proposed Listen → Partner → Act → Sustain is never presented as RBB's
   methodology. One copy of the steps, here. */
export const approachSteps = () =>
  ["verified", "approved"].includes(IMPACT.approach.proposedFramework.status)
    ? IMPACT.approach.proposedFramework.steps.map((title) => ({ title }))
    : [];

/* The headline figures as branded cards (components/ImpactStats, Home and
   /impact): each figure's own label and value, and a glyph chosen by its
   id. Nothing is added to the figures. */
const STAT_ICONS = { lives: "people", countries: "globe", partners: "partners" };
export const impactStats = () =>
  IMPACT.metrics.map((m) => ({ label: m.label, value: m.value, icon: STAT_ICONS[m.id] }));

export const IMPACT_PAGES = {
  overview: {
    kicker: "Our impact",
    heading: "Our Impact",
    /* PROPOSED wording, built from SOURCE: the annual report's positioning
       and the mission's "sustainable growth and lasting change". */
    body: `${BRAND.fullName} works with communities towards sustainable growth and lasting change.`,
    glance: { id: "at-a-glance", kicker: "Impact at a glance", heading: "Together, we create impact." },
    programs: {
      kicker: "Impact across our work",
      heading: "Four program areas",
      pending: "Program impact information to be provided by Rising Beyond Borders.",
    },
    teasers: {
      whereWeWork: {
        kicker: "Where we work",
        heading: "Where our work reaches",
        empty: "Where We Work information to be provided and reviewed by Rising Beyond Borders.",
        cta: { label: "Explore Where We Work", to: "/impact/where-we-work" },
      },
      approach: {
        kicker: "Our approach",
        heading: "Creating change that lasts.",
        empty: "Approach information to be provided and reviewed by Rising Beyond Borders.",
        cta: { label: "Explore Our Approach", to: "/impact/our-approach" },
      },
    },
    measurement: {
      heading: "Evidence & measurement",
      empty: "Impact measurement and evidence information to be provided and reviewed by Rising Beyond Borders.",
    },
    stories: {
      id: "stories",
      kicker: "Impact stories",
      heading: "Stories of change",
      fallback: "Impact stories to be provided and reviewed by Rising Beyond Borders.",
      placeholderLabel: "Story",
      readLabel: "Read Story",
      cta: { label: "Explore All Stories", to: "/stories" },
    },
    reports: {
      kicker: "Reports & transparency",
      heading: "See the evidence.",
      body: "Reports and transparency information to be provided by Rising Beyond Borders.",
      linkMeta: SITE.transparencyLinkMeta,
      cta: { label: "View Transparency", to: "/about/transparency" },
    },
    closing: {
      heading: "Be part of the impact.",
      ctas: {
        primary: { label: "Get Involved", to: "/get-involved" },
        secondary: { label: "Explore Our Work", to: "/work" },
      },
    },
  },

  whereWeWork: {
    kicker: "Our impact",
    heading: "Where We Work",
    body: "Where We Work information to be provided and reviewed by Rising Beyond Borders.",
    listHeading: "Countries and regions",
    empty: "Verified country and region information to be provided by Rising Beyond Borders.",
    /* Document 05's empty-state pattern: a way on to something that exists. */
    emptyCta: { label: "Explore Our Work", to: "/work" },
    closing: {
      heading: "See what the work involves.",
      ctas: {
        primary: { label: "Explore Our Work", to: "/work" },
        secondary: { label: "Back to Our Impact", to: "/impact" },
      },
    },
  },

  approach: {
    kicker: "Our impact",
    heading: "Our Approach",
    /* PROPOSED wording, built from SOURCE: the mission's own terms. */
    body: "How we work to empower communities for sustainable growth and lasting change.",
    /* SOURCE: the foundation is the mission, quoted as the annual report
       states it (content/about.js holds the same statement). */
    foundationLabel: "The foundation of our approach",
    how: {
      heading: "How we work",
      empty: "Approach information to be provided and reviewed by Rising Beyond Borders.",
    },
    principles: {
      heading: "Our principles",
      empty: "Principles to be provided and reviewed by Rising Beyond Borders.",
    },
    closing: {
      heading: "See the work in action.",
      ctas: {
        primary: { label: "Explore Our Work", to: "/work" },
        secondary: { label: "Back to Our Impact", to: "/impact" },
      },
    },
  },
};

export default IMPACT;
