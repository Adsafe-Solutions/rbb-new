/* Our Impact — Document 05: the headline figures, and the two sub-pages'
   content, Our Approach (/impact/our-approach) and Where We Work
   (/impact/where-we-work).

   2026-10-13: the Impact page and its figures are the CMS's only
   (PUBLISHED_IMPACT below, and the published figures set IMPACT.metrics).
   The built-in Impact page this file used to hold — program impact,
   measurement, stories, reports and the sample figures — was removed once
   the live snapshot was shown to replace every part of it. What remains
   is not published from the CMS yet: Our Approach's intro and principles
   (D11) and Where We Work's geography (D14) — a published Impact page's
   `approach` / `geography` blocks set them.

   Every block carries an editorial `status` — for the people maintaining
   this file, never shown on the site.

   ⚠ Nothing here may name a country, region, beneficiary group, partner,
   donor, outcome, percentage, methodology, date or campaign AS IF RBB HAD
   SUPPLIED IT unless RBB has. */

import { BRAND } from "./brand.js";
import { SITE } from "./site.js";

export const IMPACT = {
  /* The headline figures, as the CMS published them (Admin → Impact
     figures). Empty without a snapshot. */
  metrics: [],

  /* Where RBB works. `countries` are verified country names; `regions` are
     { name, countries: [] } groupings. No geography is shown until RBB
     supplies verified countries and regions (decision D14).
     release/approvals.mjs `geography` stays pending, which keeps the
     release blocked. */
  geography: {
    summary: null,
    regions: [],
    countries: [],
    status: "placeholder",
  },

  /* How RBB works — /impact/our-approach. The foundation is SOURCE: the
     mission, quoted from the published About page (content/about.js).
     D11 (2026-10-13): Our Approach REUSES this existing, approved content
     — the intro and principles below, as they stand — and nothing new is
     written for it.

     The Listen → Partner → Act → Sustain framework was REJECTED by RBB
     (D11, 2026-10-13). It is not RBB's method and must not be introduced
     on any page. */
  approach: {
    intro:
      "The people closest to a challenge usually understand it best. Our work is shaped with the communities it is meant to serve, and designed to keep going after any single project ends.",
    principles: [
      "Listening first — work starts from the priorities communities name for themselves",
      "Working together — we collaborate with communities, supporters and organisations who share our aims",
      "Dignity and choice — support is offered with respect, and people keep control over decisions that affect them",
      "Connecting people with opportunity — we help people reach the resources, skills and services that open up new options",
      "Building for the long term — we favour solutions that communities can sustain",
      "Learning and improving — we reflect on what works, and change course when something does not",
    ],
    status: "approved",
  },
};

/* ---------------- Page copy ----------------
   Headings and labels are PROPOSED interface copy. Every factual line is
   SOURCE, a pending-review figure, or a placeholder. */
/* The verification note shown with the headline figures wherever they
   appear (Home, /impact) — present while ANY figure is unverified, exactly
   as the financial overview in the Transparency section of /about is treated (Document
   19). Verify every figure and it disappears on its own. */
export const metricsNote = () =>
  IMPACT.metrics.every((m) => ["verified", "approved"].includes(m.status)) ? null : SITE.figuresPending;

/* The headline figures as branded cards (components/ImpactStats, Home and
   /impact): each figure's own label and value, and a glyph chosen by its
   id. Nothing is added to the figures.

   `status` travels with each one — the same editorial status recorded
   above, not a new fact about it. The card reads it to decide whether
   the figure may COUNT UP when it arrives on screen: a count-up is a
   small flourish of confidence, and a figure RBB has not verified yet
   has not earned it (src/animations/counters.js). Today every figure is
   pending-review, so nothing counts; each one starts on its own the day
   its status here changes. */
const STAT_ICONS = { lives: "people", countries: "globe", partners: "partners" };
export const impactStats = () =>
  IMPACT.metrics.map((m) => ({
    label: m.label,
    value: m.value,
    icon: STAT_ICONS[m.id],
    status: m.status,
  }));

/* The figures a `stats` block names (the homepage's, the Impact page's),
   in the block's order: named, never restated, so both pages always show
   the same values. A name that is not a figure stops the build. */
export const metricStats = (ids, where) => {
  const all = impactStats();
  return ids.map((id) => {
    const i = IMPACT.metrics.findIndex((m) => m.id === id);
    if (i < 0) throw new Error(`${where}: no impact figure "${id}" (content/impact.js or the CMS's published figures)`);
    return all[i];
  });
};

/* The Impact page as the CMS published it (pages/Impact/CmsImpact draws
   it), set from the published snapshot. The build refuses a snapshot
   without one (scripts/published-snapshot.mjs). */
export const PUBLISHED_IMPACT = { page: undefined };

export const IMPACT_PAGES = {
  /* The interface wording CmsImpact draws around the published blocks,
     and the one line the Get Involved page quotes (`body`). */
  overview: {
    /* PROPOSED wording, built from SOURCE: the annual report's positioning
       and the mission's "sustainable growth and lasting change". */
    body: `${BRAND.fullName} works with communities towards sustainable growth and lasting change — measured honestly, and reported only once it is verified.`,
    glance: { id: "at-a-glance" },
    programs: { pending: "Program impact information to be provided by Rising Beyond Borders." },
    measurement: { empty: "Impact measurement and evidence information to be provided and reviewed by Rising Beyond Borders." },
    stories: {
      id: "stories",
      fallback: "Impact stories to be provided and reviewed by Rising Beyond Borders.",
      readLabel: "Read Story",
    },
  },

  whereWeWork: {
    kicker: "Our impact",
    heading: "Where We Work",
    body: "Our work is shaped by the communities we work with and the priorities they set — across education, health and wellbeing, livelihoods and community support.",
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
