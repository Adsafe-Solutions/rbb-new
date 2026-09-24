/* Every string on /about, in page order — Document 03, About Us Master
   Specification. The page and its sections read this and nothing else.

   The same source labels as content/homepage.js:
     SOURCE     in the materials RBB supplied (annual report, brand)
     PROPOSED   written for the website; RBB has to approve it
     PENDING    nothing supplied yet; the page shows a placeholder

   ⚠ No founding year, registration, country, office, beneficiary figure,
   team member, value or governance claim goes in here until RBB supplies
   it. The page this replaced carried seven invented project highlights and
   another charity's "who we are"; neither comes back.

   No photographs on this page, deliberately. The only field images on hand
   read as illustrative and carry garbled lettering (see homepage.js), and
   Document 03 asks that questionable imagery not be reused. The RBB mark —
   an approved brand asset — carries the visual weight instead. */

import { BRAND } from "./brand.js";
import { SITE } from "./site.js";

export const ABOUT = {
  /* 01 — Hero. Copy: SOURCE — the positioning the annual report supports,
     in the same words as the rest of the site. */
  hero: {
    kicker: "About Rising Beyond Borders",
    crumb: "About Us",
    heading: "Who we are",
    body: BRAND.summary,
    cta: { label: "Explore Our Work", to: "/work" },
  },

  /* 02 — Who We Are. Heading: Document 03's. First paragraph: SOURCE, as
     the annual report puts it. The second is PENDING: Document 03 calls
     for an approved About introduction that has not been supplied. */
  whoWeAre: {
    id: "who-we-are",
    kicker: "Who we are",
    heading: "Empowering communities. Creating sustainable solutions.",
    body: [
      `${BRAND.fullName} is a non-profit dedicated to empowering communities and creating sustainable solutions to pressing challenges.`,
      "Demo text — We started with a small group of volunteers and a simple idea: that lasting change comes from working with communities, not for them. Replace this paragraph with Rising Beyond Borders' approved introduction.",
    ],
  },

  /* 03 — Mission & Vision. SOURCE: both statements are the annual report's.
     Document 03 asks RBB to confirm the final web wording. Two blocks,
     never merged. */
  missionVision: {
    id: "mission-vision",
    kicker: "What we stand for",
    heading: "Mission & Vision",
    mission: {
      label: "Our Mission",
      statement:
        "Empower vulnerable communities with resources, support and opportunities for sustainable growth and lasting change.",
    },
    vision: {
      label: "Our Vision",
      statement:
        "A world beyond borders where compassion unites people and every individual can thrive in a safe, inclusive and equitable society.",
    },
    source: "Mission and vision from the Rising Beyond Borders annual report.",
  },

  /* 04 — Our Values. PENDING. The supplied material has no approved list
     of values, and Document 03 forbids inventing one. Each value is
     { title, description? }; the list renders the moment it has entries. */
  values: {
    id: "values",
    kicker: "Our values",
    heading: "What guides our work",
    items: [
      { title: "Compassion", description: "Demo — We start from people's own experience and treat everyone with dignity." },
      { title: "Partnership", description: "Demo — We work with communities and local organisations, not around them." },
      { title: "Accountability", description: "Demo — We are open about what we do, what it costs and what it achieves." },
      { title: "Sustainability", description: "Demo — We build things that keep working after a project ends." },
    ],
    fallback: "Values to be provided by Rising Beyond Borders.",
  },

  /* 05 — How We Work. Foundation: the mission's own "sustainable growth and
     lasting change". The detailed approach is PENDING — and the homepage's
     proposed Listen → Partner → Act → Sustain is deliberately NOT shown
     here, where it would read as RBB's official method. */
  approach: {
    id: "how-we-work",
    kicker: "How we work",
    heading: "Creating change that lasts.",
    intro: "Demo text — Every project begins by listening to the community, is delivered with local partners, and is designed to be sustained locally.",
    steps: [
      { title: "Listen", body: "Demo — Understand what the community needs, in its own words." },
      { title: "Partner", body: "Demo — Work with local people and organisations who know the context." },
      { title: "Act", body: "Demo — Deliver practical support that responds to those needs." },
      { title: "Sustain", body: "Demo — Hand over skills and ownership so the change lasts." },
    ],
    cta: { label: "Explore Our Approach", to: "/impact/our-approach" },
  },

  /* 06 — Our Team. PENDING. The people themselves live in
     content/team.js (Document 10); the About page shows the approved ones
     marked `featured` there, and links to /about/team for the rest.
     Nobody is listed until RBB supplies names, roles and permission. */
  team: {
    id: "team",
    kicker: "Our team",
    heading: "The people behind our work",
    fallback: "Team information to be provided by Rising Beyond Borders.",
    cta: { label: "View Our Team", to: "/about/team" },
  },

  /* 07 — Transparency & Governance. PENDING. The document rows are shared
     with the homepage (SITE.transparencyLinks). */
  transparency: {
    id: "transparency",
    kicker: "Transparency & governance",
    heading: "Transparency matters.",
    body: "Demo text — We publish reports, financial information and governance details on our Transparency page.",
    links: SITE.transparencyLinks,
    linkMeta: SITE.transparencyLinkMeta,
    cta: { label: "View Transparency", to: "/about/transparency" },
  },

  /* 08 — Closing CTA. Two ways onward, and neither is a donation ask. */
  closingCta: {
    heading: "See our work in action.",
    ctas: {
      primary: { label: "Explore Our Work", to: "/work" },
      secondary: { label: "Explore Our Impact", to: "/impact" },
    },
  },
};

export default ABOUT;
