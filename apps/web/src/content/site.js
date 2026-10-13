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
  /* No visitor-facing "to be provided" line (content brief, 2026-10-04):
     with no newsletter service the section is simply left out. */
  newsletterPending: null,

  /* A statistic with no verified number behind it yet. The dash holds the
     figure's place in the layout; the label says why it is empty. */
  figurePlaceholder: {
    value: "—",
    label: "Figure to be provided by Rising Beyond Borders",
  },

  notFoundTitle: "Page not found",
  /* The not-found page's own words (pages/NotFound). Interface copy,
     moved here unchanged from the page so it can be edited with the rest
     of the site's wording. */
  notFound: {
    heading: "We cannot find that page",
    body: "The link may be out of date, or the page may have moved.",
    cta: { label: "Back to home", to: "/" },
  },
  /* The same page when the site could not check for the latest published
     content and has no copy of it (pages/NotFound, runtime snapshot):
     it will not say "not found" about a page that may exist. Interface
     copy; says nothing about the cause. */
  unavailable: {
    heading: "This page cannot be shown right now",
    body: "We could not check for the latest published content. Please try again in a moment.",
    cta: { label: "Try again" },
  },

  /* The hint in the corner of the homepage hero. Interface copy, like
     the error and placeholder lines above — it describes the page, not
     Rising Beyond Borders, so there is nothing here for RBB to approve. */
  scrollCue: "Scroll",

  /* The one line that goes with any published figure RBB has not yet
     verified — the impact figures and the financial overview alike
     (Documents 09, 19), so the two can never describe the same state in
     different words. */
  /* The figures' verification status is INTERNAL (content/impact.js,
     content/transparency.js `status`, and release/approvals.mjs, which
     keeps the release blocked until RBB verifies them). Visitors see the
     figures with their source line — the annual report — and no status
     stamp (content brief, 2026-10-04). */
  figuresPending: null,
  /* The same status, short enough to stamp on the figure's own card
     (components/StatCard). PROPOSED interface copy. */
  figurePending: null,

  /* The search/social description of a page that shows WORKING content
     (content/seo.js). Such a page is `noindex`; this line is what any
     preview crawler or link unfurl sees instead of a placeholder excerpt
     that would read as a real RBB fact. Not shown on the page. */
  previewDescription: `${BRAND.fullName} works with communities across education, health and wellbeing, livelihoods and community support.`,

  /* The colour-theme switcher (components/ThemeSwitcher) — shown only
     when config/sections.js `themeSwitcher` is on. `swatches` are the
     theme's ground, ink and accent, for the little preview dots; the
     palettes themselves live in styles/index.css. `default` is the
     theme every page starts in (RBB's request, Oct 2026): it is set on
     <html data-theme> in index.html — change both together. */
  themes: {
    default: "poster",
    toggle: "Colour theme",
    legend: "Choose a colour theme",
    options: [
      { id: "rbb", label: "RBB Blue", swatches: ["#f5efe6", "#10437c", "#00adef"] },
      { id: "poster", label: "Ivory & Cyan", swatches: ["#f4e8d2", "#28282b", "#0ff0fc"] },
      { id: "midnight", label: "Midnight", swatches: ["#070a09", "#faf4e8", "#0ff0fc"] },
    ],
  },

  /* What a page says if it fails while running (components/ErrorBoundary).
     PROPOSED interface copy; says nothing about the cause. */
  pageError: {
    heading: "Something went wrong",
    body: "This page could not be shown. Please try again, or return to the homepage.",
    cta: "Back to home",
  },

  /* The documents a visitor checks before trusting a charity, as Documents
     02, 03 and 09 name them, are the rows every trust panel shows —
     derived from the transparency content itself
     (content/transparency.js transparencyLinks), so a panel never lists
     something the Transparency chapter of /about does not have. No
     registration, audit, ratio or policy claim goes there until RBB
     confirms it. */
  transparencyLinkMeta: null,



  /* Titles for routes outside the sitemap (the dev catalogues). The
     legacy giving pages that used to be listed here were retired (D35). */
  titles: {
    "/design-system": "Design System",
    "/components": "Components",
  },
};

export default SITE;
