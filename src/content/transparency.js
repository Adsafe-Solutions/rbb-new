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
  /* The 2026 Financial Overview, exactly as the supplied annual-report
     materials give it — three shares and nothing else. PENDING-REVIEW: RBB
     must verify before final publication, and the page says so. These are
     NOT presented as audited results, are never converted into amounts,
     and no conclusion about financial health is drawn from them. */
  financialOverview: {
    year: 2026,
    status: "pending-review",
    items: [
      { id: "programs", label: "Programs & Services", percentage: 78, status: "pending-review" },
      { id: "fundraising", label: "Fundraising", percentage: 12, status: "pending-review" },
      { id: "administration", label: "Administration", percentage: 10, status: "pending-review" },
    ],
  },

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
     reason as the report lists above. */
  governance: {
    intro: null,
    sections: [],
    documents: [],
    status: "placeholder",
  },

  /* Why transparency matters, and how the page works. PROPOSED wording
     describing the site's own practice — not a claim about audits,
     standards or compliance. */
  accountability: {
    intro: [
      "Transparency is how trust is earned. Supporters, partners and the communities we work with should be able to see how the work is run and how resources are used.",
      "Our aim is to report openly on our finances and our work — including what did not go as planned, as well as what did.",
    ],
    status: "pending-review",
  },
};

/* ---------------- Page copy ----------------
   Headings and labels are PROPOSED interface copy. */
export const TRANSPARENCY_COPY = {
  kicker: "Transparency",
  heading: "Transparency & Financials",
  body: `Financial information, reports and governance for ${BRAND.fullName}.`,
  onThisPage: "On this page",
  overview: {
    id: "financial-overview",
    kicker: "Financial overview",
    heading: `${TRANSPARENCY.financialOverview.year} at a glance`,
    /* The two things Document 09 requires the page to say about the
       figures: where they come from, and that they await verification. */
    caption: `The ${TRANSPARENCY.financialOverview.year} financial overview as it appears in the ${BRAND.fullName} annual report materials, shown as a share of the total.`,
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
      body: "Donate, volunteer, partner with us or fundraise.",
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

export default TRANSPARENCY;
