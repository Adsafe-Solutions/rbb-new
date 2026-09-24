/* Site-wide strings that belong to no one page: the document title
   pattern, the placeholder copy, and the titles of the pages that sit
   outside the V1 sitemap in nav.js. */
import { BRAND } from "./brand.js";

export const SITE = {
  /* Every document title ends with this; the homepage is this alone. */
  name: BRAND.fullName,

  /* The meta description for any page that does not set its own. Mirrors
     the one in index.html, which is what crawlers that do not run
     JavaScript see. */
  description: `${BRAND.fullName} is ${BRAND.summary.replace(/^A /, "a ")}`,

  /* What an unbuilt page says. Neutral on purpose: the content for these
     pages comes from Rising Beyond Borders in later phases, and until it
     does the page states that plainly rather than filling the space with
     copy nobody has approved. */
  placeholder: "Content to be provided by Rising Beyond Borders.",
  sectionHeading: "In this section",

  /* Where contact details will go. The site used to show another
     charity's mailbox, phone, address and hours here; nothing replaces
     them until RBB supplies its own. */
  contactPlaceholder: "Contact information to be provided by Rising Beyond Borders.",

  /* Shown wherever a newsletter sign-up would go. There is no provider,
     so there is no form — see components/Newsletter. */
  newsletterPending: "Newsletter sign-up to be provided by Rising Beyond Borders.",

  /* A statistic with no verified number behind it yet. The dash holds the
     figure's place in the layout; the label says why it is empty. */
  figurePlaceholder: {
    value: "—",
    label: "Figure to be provided by Rising Beyond Borders",
  },

  notFoundTitle: "Page not found",

  /* The one line that goes with any published figure RBB has not yet
     verified — the impact figures and the financial overview alike
     (Documents 09, 19), so the two can never describe the same state in
     different words. */
  figuresPending: `These figures are pending final verification by ${BRAND.fullName}.`,

  /* What a page says if it fails while running (components/ErrorBoundary).
     PROPOSED interface copy; says nothing about the cause. */
  pageError: {
    heading: "Something went wrong",
    body: "This page could not be shown. Please try again, or return to the homepage.",
    cta: "Back to home",
  },

  /* The documents a visitor checks before trusting a charity, as Documents
     02, 03 and 09 name them. Shared by every trust panel on the site; each
     row lands on its own section of /about/transparency, which is where the
     documents themselves live (content/transparency.js). No registration,
     audit, ratio or policy claim goes here until RBB confirms it. */
  transparencyLinks: [
    { title: "Annual Reports", to: "/about/transparency#annual-reports" },
    { title: "Financial Information", to: "/about/transparency#financial-information" },
    { title: "Governance", to: "/about/transparency#governance" },
  ],
  transparencyLinkMeta: "To be provided by Rising Beyond Borders",



  /* Pages built before the V1 sitemap. They still have routes and
     inbound links, so they still need titles — they are just no longer
     in the navigation. */
  titles: {
    "/giving": "Ways to Give",
    "/giving/zakat": "Zakat & Sadaqah",
    "/gifts": "Charity Gifts",
    "/giving/major-giving": "Major Gifts",
    "/design-system": "Design System",
    "/components": "Components",
  },
};

export default SITE;
