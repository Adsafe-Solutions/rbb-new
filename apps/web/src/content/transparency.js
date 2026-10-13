/* Transparency & Financials — Document 09. ONE source for everything
   the Transparency section of /about shows. Other pages link here (through the shared
   rows in content/site.js) rather than repeating any of it.

   Editorial status, for the people maintaining this file — never shown:
     "verified"        confirmed by RBB for publication
     "pending-review"  supplied in RBB's materials, awaiting RBB's check
     "placeholder"     nothing supplied yet

   ⚠ None of the following may be written here or anywhere on the site
   until RBB supplies it and approves the wording: currency amounts,
   revenue, expenses, assets, grants, donor counts, audit status or audit
   conclusions, CRA or any charity registration or number, tax
   deductibility, legal status beyond "non-profit" as the source says,
   board members, governance roles or policies, certifications,
   compliance claims — and no badges or seals implying any of them. The
   site this replaced said "registered charity with the Canada Revenue
   Agency" and "independently audited every year"; neither was supported.

   ⚠ No document appears without a real, approved file (`fileUrl`) — never
   a placeholder PDF link. */

import { BRAND } from "./brand.js";
import { SITE } from "./site.js";

/* A report or financial document:
     { id, title, year?, type?, description?, fileUrl, status }
   Only "verified" entries WITH a fileUrl render; type and year show only
   when given, and say nothing (e.g. "audited") that the document itself
   does not. */
export const publishedDocuments = (docs) =>
  docs.filter((doc) => ["verified", "approved"].includes(doc.status) && doc.fileUrl);

export const TRANSPARENCY = {
  /* The financial overview, governance and "How we report" are the CMS's
     only (Admin → Transparency, 2026-10-13); the published snapshot sets
     them. Empty without one. The document lists below are still the
     website's own: none is published from the CMS yet. */
  financialOverview: { year: null, status: "placeholder", items: [] },

  /* PLACEHOLDER — no report files supplied. Unlike the page text, a
     document is not something a placeholder can stand in for: a listed
     report is a file a visitor downloads, so nothing is listed until RBB
     supplies a real one (the ⚠ above). */
  annualReports: [],

  /* PLACEHOLDER — no financial statements or summaries supplied. */
  financialDocuments: [],

  /* PLACEHOLDER — no governance information supplied (decision D7). A
     board, its duties or its policies are facts about RBB, so nothing
     stands in for them: the section shows its pending line until RBB
     supplies an approved statement. `documents` stays empty for the same
     reason as the report lists above. Its documents are listed in
     `governanceDocuments`, like the other two lists. */
  governance: {
    intro: null,
    sections: [],
    status: "placeholder",
  },
  governanceDocuments: [],

  accountability: { intro: null, status: "placeholder" },
};

/* ---------------- Page copy ----------------
   Headings and labels are PROPOSED interface copy. */
export const TRANSPARENCY_COPY = {
  /* The chapter's kicker, heading and intro: the CMS's (the snapshot sets them). */
  kicker: null,
  heading: "",
  body: "",
  onThisPage: "On this page",
  overview: {
    id: "financial-overview",
    kicker: "Financial overview",
    /* Read when drawn, so a published overview's year is the one shown. */
    get heading() {
      return `${TRANSPARENCY.financialOverview.year} at a glance`;
    },
    /* The two things Document 09 requires the page to say about the
       figures: where they come from, and that they await verification. */
    get caption() {
      return `The ${TRANSPARENCY.financialOverview.year} financial overview as it appears in the ${BRAND.fullName} annual report materials, shown as a share of the total.`;
    },
    verification: SITE.figuresPending,
  },
  reports: {
    id: "annual-reports",
    kicker: "Reports",
    heading: "Annual reports",
    empty: "Annual reports will be published here once they are approved.",
  },
  financial: {
    id: "financial-information",
    kicker: "Financials",
    heading: "Financial information",
    empty: "Financial statements will be published here once they are approved.",
  },
  governance: {
    id: "governance",
    kicker: "Governance",
    heading: "Governance",
    empty: "Information on how Rising Beyond Borders is governed will be published here once it is approved.",
  },
  accountability: { id: "accountability", heading: "How we report" },
  related: {
    impact: { kicker: "Our impact", heading: "See what the work achieves", cta: { label: "Explore Our Impact", to: "/impact" } },
    involve: {
      kicker: "Get involved",
      heading: "There are many ways to make a difference.",
      body: "Donate, volunteer, join a fellowship, partner with us or travel with us.",
      cta: { label: "Get Involved", to: "/get-involved" },
    },
  },
  documentLabel: "Download",
  closing: {
    heading: "Learn more about Rising Beyond Borders.",
    ctas: {
      primary: { label: "About Us", to: "/about" },
      secondary: { label: "Contact", to: "/contact" },
    },
  },
};

/* The transparency rows every trust panel shows (the homepage, About,
   Impact, donation and contact pages): what the Transparency chapter of
   /about actually has — the financial overview, each document list once
   it has a published document, governance once there is any, and "How we
   report". Each row lands on its own anchor there. Read when drawn, so
   published transparency content is reflected everywhere at once. */
export const transparencyLinks = () => {
  const t = TRANSPARENCY_COPY;
  const { governance, accountability } = TRANSPARENCY;
  const listed = (docs) => publishedDocuments(docs).length > 0;
  return [
    { title: t.overview.kicker, to: `/about#${t.overview.id}` },
    listed(TRANSPARENCY.annualReports) && { title: t.reports.heading, to: `/about#${t.reports.id}` },
    listed(TRANSPARENCY.financialDocuments) && { title: t.financial.heading, to: `/about#${t.financial.id}` },
    (governance.intro || governance.sections.length > 0 || listed(TRANSPARENCY.governanceDocuments)) && { title: t.governance.heading, to: `/about#${t.governance.id}` },
    accountability.intro && { title: t.accountability.heading, to: `/about#${t.accountability.id}` },
  ].filter(Boolean);
};

export default TRANSPARENCY;
