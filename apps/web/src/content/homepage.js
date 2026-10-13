/* The homepage's interface wording — what the CMS homepage's blocks
   (pages/Home/CmsHome.jsx) draw around the content RBB publishes: the
   slideshow's controls, the program cards (from the published programs),
   the labels of the timeline, stories and film, and the closing band the
   donation page reuses.

   2026-10-13: the homepage's CONTENT is the CMS's only (PUBLISHED_HOMEPAGE
   below). The built-in homepage this file used to hold — its slides,
   sections, sample timeline, film and FAQ — was removed once the live
   snapshot was shown to replace every part of it. */

import { PROGRAMS } from "./work.js";
import { RBB_PHOTOS as PHOTOS } from "./photos.js";

export const HOMEPAGE = {
  /* The slideshow's controls (components/PosterHero; PROPOSED interface copy). */
  hero: {
    controls: {
      label: "Highlights",
      slide: (n, total) => `${n} of ${total}`,
      goTo: (n, title) => `Show slide ${n}: ${title}`,
      pause: "Pause slideshow",
      play: "Play slideshow",
    },
  },

  /* The program cards: the published programs, so the homepage and the
     program pages cannot disagree. */
  programs: {
    items: PROGRAMS.map(({ title, description, to, icon }) => ({ title, description, to, icon })),
  },

  timeline: {
    playLabel: "Play video",
    viewportLabel: "Timeline of events — scroll sideways for more",
  },

  stories: {
    fallback: "Story to be provided by Rising Beyond Borders.",
    readLabel: "Read Story",
  },

  video: { playLabel: "Play video" },

  /* The closing band the donation page reuses (content/donation.js). */
  finalCta: {
    heading: "Together, we can rise beyond borders.",
    ctas: {
      primary: { label: "Get Involved", to: "/get-involved" },
      secondary: { label: "Explore Our Work", to: "/work" },
    },
    image: PHOTOS.elder,
  },
};

/* The homepage as the CMS published it — set by the build from the
   published snapshot (scripts/snapshot-adapter.mjs): `page` holds its
   blocks in order — { sections: [{ id, type, data }], seo? } — and
   pages/Home draws them (pages/Home/CmsHome). The build refuses a
   snapshot without one (scripts/published-snapshot.mjs). */
export const PUBLISHED_HOMEPAGE = {};

export default HOMEPAGE;
