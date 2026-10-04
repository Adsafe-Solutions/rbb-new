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
     Headline and supporting line: PROPOSED — the direction given in the
     site owner's content brief (2026-10-04), written as general copy: no
     place, figure or programme is named. The brief's own wording,
     "Creating opportunities. Strengthening communities. Changing lives.",
     does not fit the poster scale: OPPORTUNITIES. and STRENGTHENING are
     each wider than a 320px screen, and a word cannot wrap — so the same
     three ideas, in words that fit. The annual report's own
     headline, "Building Hope. Creating Change. Transforming Lives.", is
     the SOURCE alternative; RBB chooses between them (decision D8).
     "Get Involved" goes to the Get
     Involved hub rather than straight to Donate: the hero should not open
     on a donation-only message. */
  hero: {
    /* The eyebrow over the headline. RBB's own name and nothing else —
       an editorial masthead line, not a claim. Deliberately not a
       strapline: the supplied materials carry none, and a hero is the
       last place to put words nobody has approved. */
    kicker: BRAND.fullName,
    headline: ["Opportunity for all.", "Stronger communities.", "Changing lives."],
    body: "Rising Beyond Borders works alongside communities to widen access to learning, wellbeing and fair livelihoods — so that every person has a real chance to build a safer, healthier future.",
    ctas: {
      primary: { label: "Explore Our Work", to: "/work" },
      secondary: { label: "Get Involved", to: "/get-involved" },
    },
    image: PHOTOS.kids,
  },

  /* 02 — Who We Are.
     First paragraph: SOURCE — the annual report's own description, as
     Document 02 quotes it. Second: PROPOSED — RBB's inclusive, non-
     religious position as the content brief states it; no place or
     figure. Mission, vision, values and team belong on /about. */
  whoWeAre: {
    kicker: "Who we are",
    heading: "Change begins with people.",
    body: [
      `${BRAND.fullName} is a non-profit dedicated to empowering communities and creating sustainable solutions to pressing challenges.`,
      "We serve people and communities regardless of religion, nationality, ethnicity, gender, background or belief — because where someone starts in life should never decide how far they can go.",
    ],
    cta: { label: "About Us", to: "/about" },
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
    items: PROGRAMS.map(({ title, description, to, icon }) => ({
      title,
      description,
      to,
      icon,
    })),
  },

  /* 04 — Our Approach.
     Intro: PROPOSED general copy. Listen → Partner → Act → Sustain is a structure Document 02
     suggested, not a framework RBB has published, and Document 19 forbids
     presenting it as RBB's methodology before approval. The steps live
     once, in content/impact.js (`proposedFramework`), and appear here only
     when that is approved. Until then: heading, intro and the link. */
  approach: {
    kicker: "Our approach",
    heading: "Creating change that lasts.",
    intro:
      "Lasting change is built with communities, not for them. We start by listening, respond to the priorities people set for themselves, and favour solutions that keep working long after a project ends.",
    steps: approachSteps(),
    cta: { label: "Learn How We Work", to: "/impact/our-approach" },
  },

  /* 05 — Our Impact. The headline figures live in content/impact.js
     (pending RBB's verification; the conflicting "120+" is excluded there). */
  impact: {
    kicker: "Our impact",
    heading: "Together, we create impact.",
    /* PROPOSED — qualitative, so the section says something true while
       every figure beside it is still pending verification. */
    body: "Impact begins with listening, continues through collaboration, and grows when people have the opportunity to shape their own futures.",
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
      slug: project.slug,
      releaseMarker: project.releaseMarker,
      title: project.title,
      description: project.description,
      location: project.location,
      status: project.status,
      program: project.program,
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

  /* 05 — Progress timeline (components/ProgressTimeline): the events so
     far, oldest first, as cards that travel along a timeline as the page
     scrolls. Each card is a YouTube Short (played in place) with its
     date, program and one line. Replaces the featured-work grid on the
     homepage. PROPOSED heading copy.

     ⚠ SAMPLE EVENTS. Every event, date and line below is a stand-in
     (decision D13), and every video is a NASA public Short chosen only
     because it is vertical and implies no organisation's endorsement —
     not RBB footage. `releaseMarker` is INTERNAL (never shown) and keeps
     release:check blocked until RBB supplies its real milestones and
     Shorts. Posters are local photographs, so nothing loads from YouTube
     until a visitor presses play. */
  timeline: {
    kicker: "Our progress",
    heading: "Work that reaches communities.",
    cta: { label: "Explore All Projects", to: "/work/projects" },
    playLabel: "Play video",
    viewportLabel: "Timeline of events — scroll sideways for more",
    events: [
      {
        id: "reading-clubs-open",
        date: "2026-03-14",
        program: "education",
        title: "Reading clubs open their doors",
        summary: "Weekly after-school sessions begin, with books for every reading level.",
        youtubeId: "QP5Fs3AYuWE",
        videoTitle: "2026 Total Solar Eclipse Over Spain (NASA)",
        poster: WORKING_PHOTOS.readingCircle,
        releaseMarker: "Sample event — stand-in milestone and video",
      },
      {
        id: "first-health-day",
        date: "2026-04-22",
        program: "health-wellbeing",
        title: "A first community health day",
        summary: "Basic checks, practical advice and referrals, brought closer to home.",
        youtubeId: "myZ9kn9MIWQ",
        videoTitle: "2026 Solar Eclipse at 50,000 Feet (NASA)",
        poster: WORKING_PHOTOS.checkup,
        releaseMarker: "Sample event — stand-in milestone and video",
      },
      {
        id: "tailoring-course",
        date: "2026-05-18",
        program: "livelihoods",
        title: "The tailoring course welcomes its first group",
        summary: "Hands-on skills that can be practised close to home.",
        youtubeId: "MT8tg5b3b8E",
        videoTitle: "Artemis II Watches Earth Set Behind the Moon (NASA)",
        poster: WORKING_PHOTOS.sewing,
        releaseMarker: "Sample event — stand-in milestone and video",
      },
      {
        id: "support-packs",
        date: "2026-06-09",
        program: "community-support",
        title: "Essential support packs reach households",
        summary: "Volunteers plan and deliver support for families facing a hard month.",
        youtubeId: "l6PAhdKxa2c",
        videoTitle: "Six Years of NASA's Mars Curiosity Rover (NASA)",
        poster: WORKING_PHOTOS.packing,
        releaseMarker: "Sample event — stand-in milestone and video",
      },
      {
        id: "water-points",
        date: "2026-07-15",
        program: "health-wellbeing",
        title: "Water points back in use",
        summary: "Repairs and community care keep clean water close to home.",
        youtubeId: "yuT7iQC-yro",
        videoTitle: "Our Shared Spaceship: Earth (NASA)",
        poster: WORKING_PHOTOS.waterPump,
        releaseMarker: "Sample event — stand-in milestone and video",
      },
      {
        id: "information-day",
        date: "2026-08-27",
        program: "community-support",
        title: "A community information day",
        summary: "Local services and families meet in one welcoming place.",
        youtubeId: "43mvpb1Ujpo",
        videoTitle: "Artemis II Crew's First Images from Space (NASA)",
        poster: WORKING_PHOTOS.gathering,
        releaseMarker: "Sample event — stand-in milestone and video",
      },
    ],
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

  /* Video — a film in a tilted card, played in place (components/
     VideoFeature). PROPOSED copy.

     ⚠ SAMPLE: the film is "Big Buck Bunny" (Blender Foundation, openly
     licensed), a stand-in chosen because it implies no organisation's
     endorsement — not an RBB film. Replace `youtubeId`, `title` and
     `poster` with RBB's own video; `releaseMarker` is INTERNAL (never
     shown) and keeps release:check blocked until then. The poster is a
     local photograph, so nothing loads from YouTube until a visitor
     presses play. */
  video: {
    kicker: "Watch",
    heading: "See the work up close.",
    body: "Short films about the people and communities at the heart of our work.",
    youtubeId: "aqz-KE-bpKQ",
    title: "Big Buck Bunny",
    playLabel: "Play video",
    poster: WORKING_PHOTOS.gathering,
    releaseMarker: "Sample video — stand-in film until RBB supplies its own",
  },

  /* 08 — Transparency & Trust.
     Body: PROPOSED. The three rows are the kinds of document Document 02 names;
     each says "to be provided" until the document exists. No registration,
     audit, percentage or policy claim goes here until RBB confirms it. */
  transparency: {
    kicker: "Transparency",
    heading: "Trust matters.",
    body: "Supporters should always be able to see how our work is run and how resources are used.",
    links: SITE.transparencyLinks,
    linkMeta: SITE.transparencyLinkMeta,
    cta: { label: "View Transparency", to: "/about#transparency" },
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
      ...{
        donate: WORKING_PHOTOS.aidBoxes,
        volunteer: WORKING_PHOTOS.packing,
        partner: WORKING_PHOTOS.gathering,
        fundraise: WORKING_PHOTOS.foodPrep,
      }[path.id],
    })),
  },

  /* 10 — Final CTA.
     Heading: Document 02's, adapted from the annual report's "Together, we
     rise beyond borders for a better tomorrow." Supporting copy: PROPOSED. */
  finalCta: {
    heading: "Together, we can rise beyond borders.",
    body: "Give, volunteer, partner or fundraise — there is a place for everyone in work that opens up opportunity and strengthens communities.",
    ctas: {
      primary: { label: "Get Involved", to: "/get-involved" },
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
