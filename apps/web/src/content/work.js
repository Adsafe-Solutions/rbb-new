/* Our Work — Document 04. The program areas and the projects under them,
   as ONE data model. /work, the four program pages, /work/projects, the
   project detail pages AND the homepage's program cards and project
   timeline all read from here, so a program's description or a project's
   facts can only ever be stated once.

   2026-10-13: the programs and projects are the CMS's only (Admin →
   Programs, Projects): the published snapshot sets PROGRAMS,
   PROJECT_RECORDS and PROJECTS. The built-in programs and sample projects
   this file used to hold were removed once the live snapshot was shown
   to replace them. What stays here: the lookups and the pages' wording.

   ⚠ Nothing here may name a project, campaign, country, school, clinic,
   partner, figure, date or outcome that RBB has not supplied AS IF IT WERE
   REAL. The site this replaced carried another charity's country appeals;
   none of them were RBB's, and none come back as "projects". */

import { BRAND } from "./brand.js";
import { pathCards } from "./getInvolved.js";
import { withoutTrailingSlash } from "../lib/paths.js";

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
   `missing` is shown only for a field genuinely not supplied. */
export const PROGRAMS = [];

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
     } */
export const PROJECT_RECORDS = [];

/* The projects the site may show: approved ones only. Every page reads
   this, never PROJECT_RECORDS, so a record being prepared (draft /
   pending-review / archived) cannot reach a card, a detail page, the
   sitemap or structured data (scripts/content-publishing.mjs strips
   anything else at build time). */
export const PROJECTS = PROJECT_RECORDS.filter((p) => p.editorialStatus === "approved");

/* Where the projects come from (M31.1), as STORY_SOURCE does for the
   stories: false while PROJECT_RECORDS are the website's own; the build
   sets it (scripts/snapshot-adapter.mjs) once the CMS publishes projects,
   which are then the ONLY projects. The website's own stories name the
   website's own projects, so content/validate.js never holds those
   references against the CMS's projects. */
export const PROJECT_SOURCE = { cms: false };

/* ---------------- Lookups ---------------- */
export const programBySlug = (slug) => PROGRAMS.find((p) => p.slug === slug);
export const programByPath = (path) => PROGRAMS.find((p) => p.to === withoutTrailingSlash(path));
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
      donate: { label: "Donate", to: "/appeals" },
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
