/* Every string on the homepage, in page order — Document 02, Homepage
   Master Specification. The page and its components read this and nothing
   else, so updating the homepage is an edit here, not in JSX.

   Each block says where its words came from, because on this page that
   is the whole question:

     SOURCE     in the materials RBB supplied (annual report, presentation)
     PROPOSED   written for the website; RBB has to approve it
     WORKING    a placeholder line kept while RBB's own copy is not yet
                supplied (Document 27); self-labelled, replace before launch
     VERIFY     supplied by RBB, but Document 02 requires it to be verified
                before the site is published
     PENDING    nothing supplied yet; the page shows a placeholder

   ⚠ Nothing here may name a country, a project, a figure, a year, a
   registration or a campaign AS IF RBB HAD SUPPLIED IT. The homepage this
   replaced carried another charity's appeals and numbers; see Document 01's
   cleanup notes in content/ngo.js. */

import { BRAND } from "./brand.js";
import { SITE } from "./site.js";
import { PROGRAMS, PROJECTS, projectHighlights, projectPath } from "./work.js";
import { IMPACT, approachSteps, impactStats, metricsNote } from "./impact.js";
import { GET_INVOLVED, pathCards } from "./getInvolved.js";
import { latestStories, storyCard } from "./stories.js";
import { RBB_PHOTOS as PHOTOS, WORKING_PHOTOS } from "./photos.js";

export const HOMEPAGE = {
  /* 01 — Hero.
     Headline: SOURCE (presentation and annual report).
     Supporting copy: WORKING. "Support Our Mission" goes to the Get
     Involved hub rather than straight to Donate: the hero should not open
     on a donation-only message. */
  hero: {
    headline: ["Building Hope.", "Creating Change.", "Transforming Lives."],
    body: "Demo text — We work alongside communities to open up education, health, livelihoods and support, so that every person has the chance to thrive.",
    ctas: {
      primary: { label: "Explore Our Work", to: "/work" },
      secondary: { label: "Support Our Mission", to: "/get-involved" },
    },
    image: PHOTOS.kids,
  },

  /* 02 — Who We Are.
     Body: SOURCE — the annual report's own description, as Document 02
     quotes it. Mission, vision, values and team belong on /about. */
  whoWeAre: {
    kicker: "Who we are",
    heading: "Change begins with people.",
    body: [
      `${BRAND.fullName} is a non-profit dedicated to empowering communities and creating sustainable solutions to pressing challenges.`,
    ],
    cta: { label: "Learn About Us", to: "/about" },
    image: PHOTOS.distribution,
    /* The collage presentation (components/LegacyCollage). The headline is
       the heading above, split only for its two-colour setting. No badge:
       the design's "30+ years" figure belongs to another charity, and RBB
       has supplied no founding date or tenure — a figure there is a claim.
       Photographs: RBB's three field photographs, RBB's only approved
       imagery (docs/IMAGE_INVENTORY.md). */
    collage: {
      headline: "Change begins",
      headlineAccent: "with people.",
      secondary: { label: "Explore Our Work", to: "/work" },
      photos: { arch: PHOTOS.distribution, drop: PHOTOS.kids, wide: PHOTOS.elder },
    },
  },

  /* 03 — Our Areas of Work.
     The four areas: SOURCE (annual report). Exactly these four, with their
     descriptions, live in content/work.js. */
  programs: {
    kicker: "Our areas of work",
    heading: "Where we focus our work",
    /* Straight from the Our Work data, so a description is written once
       and the homepage and the program pages cannot disagree. */
    items: PROGRAMS.map(({ title, description, to, icon }) => ({ title, description, to, icon })),
  },

  /* 04 — Our Approach.
     PENDING. Listen → Partner → Act → Sustain is a structure Document 02
     suggested, not a framework RBB has published, and Document 19 forbids
     presenting it as RBB's methodology before approval. The steps live
     once, in content/impact.js (`proposedFramework`), and appear here only
     when that is approved. Until then: heading, intro and the link. */
  approach: {
    kicker: "Our approach",
    heading: "Creating change that lasts.",
    intro: "Demo text — We listen first, work with local partners, act on what communities ask for, and build things that last after we step back.",
    steps: approachSteps(),
    cta: { label: "Learn How We Work", to: "/impact/our-approach" },
  },

  /* 05 — Our Impact. The headline figures live in content/impact.js
     (pending RBB's verification; the conflicting "120+" is excluded there). */
  impact: {
    kicker: "Our impact",
    heading: "Together, we create impact.",
    /* The same figures /impact shows, from content/impact.js — one copy,
       with their verification status recorded there. */
    metrics: IMPACT.metrics,
    /* The same three figures as cards (components/ImpactStats): each
       figure's own label, its value, a glyph. Nothing added — no year, no
       "since", no fourth figure; the excluded "120+" stays excluded. */
    stats: impactStats(),
    source: IMPACT.metricsSource,
    note: metricsNote(),
    cta: { label: "Explore Our Impact", to: "/impact" },
  },

  /* 06 — Featured Work.
     Mark two or three projects `featured` in content/work.js and they
     appear here. Until RBB's own catalogue is supplied these are the
     working placeholder projects (content/work.js). */
  featuredWork: {
    kicker: "Featured work",
    heading: "Work that reaches communities.",
    /* The projects content/work.js marks `featured` — the same records the
       project pages show, never a second copy of their facts. */
    items: PROJECTS.filter((project) => project.featured).map((project) => ({
      title: project.title,
      description: project.description,
      location: project.location,
      image: project.image,
      to: projectPath(project),
    })),
    /* Every approved project for the timeline (components/ProjectTimeline):
       featured first, each with its own place, date-or-status, Donate and
       Learn More. With none, the heading and `fallback` line. */
    highlights: projectHighlights(),
    slots: 3,
    fallback: "Featured work to be provided by Rising Beyond Borders.",
    placeholderLabel: "Featured work",
    cta: { label: "Explore All Projects", to: "/work/projects" },
  },

  /* 07 — Stories of Change.
     The newest three approved stories (content/stories.js — currently
     working placeholders) appear here. */
  stories: {
    kicker: "Stories",
    heading: "Stories of change",
    /* The latest approved stories from content/stories.js — the same
       records /stories and each story's page show. */
    items: latestStories(3).map(storyCard),
    slots: 3,
    fallback: "Story to be provided by Rising Beyond Borders.",
    placeholderLabel: "Story",
    readLabel: "Read Story",
    cta: { label: "Explore All Stories", to: "/stories" },
  },

  /* 08 — Transparency & Trust.
     PENDING. The three rows are the kinds of document Document 02 names;
     each says "to be provided" until the document exists. No registration,
     audit, percentage or policy claim goes here until RBB confirms it. */
  transparency: {
    kicker: "Transparency",
    heading: "Trust matters.",
    body: "Demo text — Reports, financial information and governance, published so supporters can see how the work is run.",
    links: SITE.transparencyLinks,
    linkMeta: SITE.transparencyLinkMeta,
    cta: { label: "View Transparency", to: "/about/transparency" },
  },

  /* 09 — Get Involved. The paths themselves, and their approval status
     (Fundraise is PROPOSED), are in content/getInvolved.js — shared with
     the nav, the program pages and the Get Involved pages. */
  getInvolved: {
    kicker: "Get involved",
    heading: "There are many ways to make a difference.",
    items: pathCards(),
    /* The tabbed presentation (components/GetInvolved): one tab per path,
       in the approved order, each with the path's own name, its approved
       one-line description and its own link — nothing else is claimed
       about any path. Photographs: working placeholders until RBB
       supplies one per path. */
    tabs: GET_INVOLVED.paths.map((path) => ({
      key: path.id,
      label: path.title,
      heading: path.title,
      body: path.shortDescription,
      cta: { label: path.ctaLabel, to: path.to },
      ...{ donate: WORKING_PHOTOS.aidBoxes, volunteer: WORKING_PHOTOS.packing, partner: WORKING_PHOTOS.gathering, fundraise: WORKING_PHOTOS.foodPrep }[path.id],
    })),
  },

  /* 10 — Final CTA.
     Heading: Document 02's, adapted from the annual report's "Together, we
     rise beyond borders for a better tomorrow." Supporting copy: WORKING. */
  finalCta: {
    heading: "Together, we can rise beyond borders.",
    body: "Demo text — Give, volunteer, partner or fundraise — every contribution moves the work forward.",
    ctas: {
      primary: { label: "Support Our Mission", to: "/get-involved" },
      secondary: { label: "Explore Our Work", to: "/work" },
    },
    image: PHOTOS.elder,
    /* The closing card (components/RegularGiving) keeps the heading and
       both ways on; its photograph is a working placeholder until RBB
       supplies one. It is NOT a regular-giving ask: recurring donations
       are not approved (Document 22). */
    cardImage: WORKING_PHOTOS.checkup,
  },
};

export default HOMEPAGE;
