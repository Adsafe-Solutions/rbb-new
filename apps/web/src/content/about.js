/* /about's interface wording, the mission and vision as the CMS
   published them, and /about/how-we-work's own parts (HOW_WE_WORK below).

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

/* /about/how-we-work. Its kicker, heading, introduction, rows and "In
   practice" block are the CMS's (Admin → How We Work page, 2026-10-13):
   the published snapshot sets them. Empty without one. The two related
   cards and the closing ask stay the site's. The proposed Listen →
   Partner → Act → Sustain framework is NOT here: it was rejected (D11). */
export const HOW_WE_WORK = {
  kicker: null,
  heading: "",
  body: "",
  practices: { kicker: null, heading: "", items: [] },
  rows: [],
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
