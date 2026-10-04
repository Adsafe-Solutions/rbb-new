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
     the annual report puts it. The rest: PROPOSED general copy from the
     content brief (2026-10-04) — the four SOURCE program areas and RBB's
     inclusive position, with no history, place, figure or person. RBB
     confirms or rewrites it (decision D8). */
  whoWeAre: {
    id: "who-we-are",
    kicker: "Who we are",
    heading: "Empowering communities. Creating sustainable solutions.",
    body: [
      `${BRAND.fullName} is a non-profit dedicated to empowering communities and creating sustainable solutions to pressing challenges.`,
      "In practice, that means opening up access — to learning, to essential support, to fair ways of earning a living and to the connections that help a community through hard times. Our work spans four areas, education, health and wellbeing, livelihoods and community support, because the barriers people face rarely arrive one at a time.",
      "Rising Beyond Borders is inclusive by design. We serve people regardless of religion, nationality, ethnicity, gender, background or belief, and we start from the priorities communities set for themselves.",
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

  /* 04 — Our Values. PROPOSED. The supplied material has no list of
     values; these are the themes the content brief (2026-10-04) asked
     for, offered for RBB's approval (decision D10). Until approved they
     are not presented as a formally adopted statement — the section is
     headed "What guides our work", not "Our official values". Each value
     is { title, description? }. */
  values: {
    id: "values",
    kicker: "Our values",
    heading: "What guides our work",
    items: [
      { title: "Dignity", description: "Everyone we work with is treated with respect, and has a say in the decisions that affect their life." },
      { title: "Inclusion", description: "Our work is open to all, regardless of religion, nationality, ethnicity, gender, background or belief." },
      { title: "Compassion", description: "We lead with empathy, and we listen before we act." },
      { title: "Collaboration", description: "Change goes further when communities, supporters and organisations work towards it together." },
      { title: "Accountability", description: "We act with integrity, are honest about what we do, and are open about how resources are used." },
      { title: "Sustainability", description: "We favour solutions that people and communities can carry forward long after a project ends." },
    ],
    fallback: "Values to be provided by Rising Beyond Borders.",
  },

  /* 05 — How We Work. Foundation: the mission's own "sustainable growth and
     lasting change". Intro: PROPOSED general prose (decision D11). The
     proposed Listen → Partner → Act → Sustain framework is deliberately
     NOT here: it is not RBB's adopted method, and the one pending copy of
     it lives in content/impact.js (`proposedFramework`), hidden. */
  approach: {
    id: "how-we-work",
    kicker: "How we work",
    heading: "Creating change that lasts.",
    intro:
      "We begin by listening, because communities understand their own priorities best. From there we work collaboratively — connecting people with resources, skills and opportunities, favouring solutions that can be sustained locally, and learning from what works and what does not.",
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
    cta: { label: "Meet the Team", to: "/about/team" },
  },

  /* 07 — Transparency & Governance. Body: PROPOSED; the documents are
     PENDING. The document rows are shared with the homepage
     (SITE.transparencyLinks). */
  transparency: {
    id: "transparency",
    kicker: "Transparency & governance",
    heading: "Transparency matters.",
    body: "Supporters, communities and partners should always be able to see how our work is run and how resources are used.",
    links: SITE.transparencyLinks,
    linkMeta: SITE.transparencyLinkMeta,
    cta: { label: "View Transparency", to: "/about#transparency" },
  },

  /* 08 — Closing CTA. Two ways onward, and neither is a donation ask. */
  /* The page's way on: the people (the one About page that is not on
     this page) and the invitation. "Explore Our Work" already sits in
     the hero. */
  closingCta: {
    heading: "Meet the people behind the work.",
    ctas: {
      primary: { label: "Get Involved", to: "/get-involved" },
      secondary: { label: "Meet the Team", to: "/about/team" },
    },
  },
};

export default ABOUT;
