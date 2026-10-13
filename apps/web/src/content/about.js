/* /about's interface wording, the mission and vision as the CMS
   published them, and /about/how-we-work (HOW_WE_WORK below).

   2026-10-13: the About page's CONTENT is the CMS's only
   (PUBLISHED_ABOUT, drawn by pages/About/CmsAbout.jsx). The built-in
   About page this file used to hold was removed once the live snapshot
   was shown to replace every part of it. The mission and vision other
   pages quote (Team, Get Involved, Donate, Our Approach) are the
   published About page's own (missionStatement / visionStatement), so an
   edit in the CMS reaches every page that quotes them.

   ⚠ No founding year, registration, country, office, beneficiary figure,
   team member, value or governance claim goes in here: RBB publishes
   those through the CMS. */

export const ABOUT = {
  /* The values list's empty state (pages/About/CmsAbout.jsx). */
  values: { fallback: "Values to be provided by Rising Beyond Borders." },
};

/* The published About page's Mission & Vision block, or null. */
const missionVision = () => PUBLISHED_ABOUT.page?.sections.find((s) => s.type === "missionVision")?.data ?? null;
/* "Empower vulnerable communities …" — "" before an About page is published. */
export const missionStatement = () => missionVision()?.mission?.statement ?? "";
export const visionStatement = () => missionVision()?.vision?.statement ?? "";
/* "Our mission is to empower …", as the other pages quote it. */
export const missionLine = () => (missionStatement() ? `Our mission is to ${missionStatement().replace(/^E/, "e")}` : "");

/* /about/how-we-work — how the work is run day to day. Built from what
   the site already states as approved: the approach intro and
   principles, and the measurement aims (content/impact.js). No practice,
   policy, process or structure is claimed beyond them — safeguarding,
   governance and feedback procedures appear here once RBB supplies them.
   The proposed Listen → Partner → Act → Sustain framework is NOT here: it
   is not RBB's adopted method (Document 05). */
export const HOW_WE_WORK = {
  kicker: "About us",
  heading: "How We Work",
  body: "How we work with communities, partners and supporters — from the first conversation to learning from what changed.",
  practices: {
    kicker: "In practice",
    heading: "What working with us looks like.",
    items: [
      { title: "Listening first", description: "Work starts from the priorities communities name for themselves.", icon: "community" },
      { title: "Working together", description: "We collaborate with communities, supporters and organisations who share our aims.", icon: "partner" },
      { title: "Dignity and choice", description: "Support is offered with respect, and people keep control over decisions that affect them.", icon: "shield" },
      { title: "Building for the long term", description: "We favour solutions that communities can carry forward after any single project ends.", icon: "livelihoods" },
    ],
  },
  rows: [
    {
      id: "starting-point",
      heading: "Where the work starts",
      body: "The people closest to a challenge usually understand it best. Our work is shaped with the communities it is meant to serve, and designed to keep going after any single project ends.",
    },
    {
      id: "connecting",
      heading: "Connecting people with opportunity",
      body: "Much of what we do is connection: helping people reach the resources, skills and services that open up new options, across education, health and wellbeing, livelihoods and community support.",
    },
    {
      id: "learning",
      heading: "Learning from what changes",
      body: "Counting activities is not the same as knowing what changed, so we aim to look at four things:",
      items: [
        "Clear aims, agreed with the people involved before work begins",
        "What changed for people, in their own words as well as in numbers",
        "What did not work, reported as plainly as what did",
        "What we learned, and how it shapes the next piece of work",
      ],
    },
    {
      id: "openness",
      heading: "Being open about it",
      body: "Supporters should always be able to see how our work is run and how resources are used. Our transparency and financial information is gathered in one place on the About page.",
    },
  ],
  related: {
    approach: { kicker: "Our approach", heading: "The principles behind the work", body: "Listening first, working together and building for the long term.", cta: { label: "Explore Our Approach", to: "/impact/our-approach" } },
    transparency: { kicker: "Transparency", heading: "How resources are used", body: "Supporters should always be able to see how our work is run.", cta: { label: "View Transparency", to: "/about#transparency" } },
  },
  closing: {
    heading: "See the work in action.",
    ctas: {
      primary: { label: "Explore Our Work", to: "/work" },
      secondary: { label: "Get Involved", to: "/get-involved" },
    },
  },
};

/* The About page as the CMS published it — set by the build from the
   published snapshot (scripts/snapshot-adapter.mjs): `page` holds its
   blocks in order — { sections: [{ id, type, data }], seo? } — and
   pages/About draws them (pages/About/CmsAbout). The build refuses a
   snapshot without one (scripts/published-snapshot.mjs). */
export const PUBLISHED_ABOUT = {};

export default ABOUT;
