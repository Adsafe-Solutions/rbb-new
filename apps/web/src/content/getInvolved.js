/* Get Involved — Document 06. ONE source for the four ways to take part:
   the nav's Get Involved menu, the footer, the homepage and program-page
   cards, /get-involved and each path's own page all read from here, so a
   path's name, address or description is stated once.

   Editorial status, for the people maintaining this file — never shown:
     "verified"/"approved"  confirmed by RBB, or cleared to publish as
                            working content (Document 27); see the note
                            below
     "pending-review"      in the approved architecture, wording awaiting
                            RBB
     "placeholder"          nothing supplied yet; the page shows a
                            placeholder

   Giving is not one of the four any more: it is the header's Donate
   button (a popup) and the Appeals section — content/donation.js and
   content/appeals.js. Fundraise was a proposed path RBB does not offer
   in the current sitemap, so it is gone, with its menu entry and page.

   ⚠ No operational detail may be invented here that RBB has not
   confirmed: no amounts, currency, payment provider, bank details or tax
   claim; no volunteer eligibility, ages, locations, schedules, screening
   or training that claims to be RBB's real process; no partnership
   packages, tiers, named partners, benefits or pricing; no fundraising
   platforms, rules, targets or approvals. The "why" text and the general
   lists below are PROPOSED copy (content brief, 2026-10-04) — what each
   path is, never how it operates. Every operational section (roles,
   eligibility, what to expect, how it works, rules, FAQs) shows its
   pending line until RBB supplies it (decision D20).

   ⚠ No forms either. A form here would appear to reach RBB and reach
   nobody. The process / application / inquiry sections are HIDDEN until a
   real route exists (`hideWhenEmpty`), rather than shown as placeholders
   a visitor might try to act on. */

import { missionLine } from "./about.js";
import { ORG_CONTACT } from "./contact.js";
import { withoutTrailingSlash } from "../lib/paths.js";

export const GET_INVOLVED = {
  /* The four paths. Titles and addresses are the approved architecture;
     `shortDescription`, `sections` and the meta description are the
     CMS's (2026-10-13): the published snapshot merges them in by id.
     `featured` is the one path the cards set apart. Delete an entry and
     every menu, card and page follows. */
  paths: [
    {
      id: "volunteer",
      slug: "volunteer",
      to: "/get-involved/volunteer",
      title: "Volunteer",
      shortDescription: "",
      icon: "volunteer",
      ctaLabel: "Volunteer",
      status: "pending-review",
      sections: [],
    },
    /* Fellowship and Travel With Us are PROPOSED copy like the paths
       above: what each is, never how it operates — no cohort, cost,
       destination, date or eligibility rule until RBB confirms one. */
    {
      id: "fellowship",
      slug: "fellowship",
      to: "/get-involved/fellowship",
      title: "Fellowship",
      shortDescription: "",
      icon: "fellowship",
      ctaLabel: "Fellowship",
      status: "pending-review",
      sections: [],
    },
    {
      id: "partner",
      slug: "partner",
      to: "/get-involved/partner",
      title: "Partner With Us",
      shortDescription: "",
      icon: "partner",
      ctaLabel: "Partner With Us",
      status: "pending-review",
      sections: [],
    },
    {
      id: "travel",
      slug: "travel",
      to: "/get-involved/travel",
      title: "Travel With Us",
      shortDescription: "",
      icon: "travel",
      ctaLabel: "Travel With Us",
      status: "pending-review",
      sections: [],
    },
  ],

  /* The contact route, from content/contact.js — the one source for how to
     reach RBB. Until its general-inquiry destination is supplied, every
     page shows the pending line instead of a link. */
  contact: {
    label: ORG_CONTACT.generalInquiry.label,
    url: ORG_CONTACT.generalInquiry.status === "verified" ? ORG_CONTACT.generalInquiry.href : null,
    pending: ORG_CONTACT.pending, /* null: the panel shows the Contact Us button alone */
    status: ORG_CONTACT.generalInquiry.status,
  },
};

/* The paths as the cards everywhere else draw them (InvolvementPaths). */
export const pathCards = () =>
  GET_INVOLVED.paths.map((path) => ({
    title: path.title,
    description: path.shortDescription,
    cta: path.ctaLabel,
    to: path.to,
    icon: path.icon,
    featured: path.featured,
  }));

export const pathByPath = (to) => GET_INVOLVED.paths.find((p) => p.to === withoutTrailingSlash(to));

/* ---------------- Page copy ----------------
   Headings and labels are PROPOSED interface copy. */
export const GET_INVOLVED_PAGES = {
  /* The hub's heading and introduction, the two path sections' headings,
     each path's line and the closing are the CMS's (Admin → Get Involved,
     2026-10-13): the published snapshot sets them. Empty without one. The
     rest is the site's interface wording. */
  hub: {
    kicker: "Get involved",
    heading: "",
    body: "",
    ways: { kicker: "", heading: "" },
    choose: {
      kicker: "",
      heading: "",
      pending: "Details to be provided by Rising Beyond Borders.",
      /* Each path's line in this list (the CMS's), shown INSTEAD of its
         card line, so the two sections never say the same sentence twice. */
      notes: {},
      linkPrefix: "Go to",
    },
    /* SOURCE: the mission, as the annual report states it — the one
       approved statement of why the work matters. */
    why: {
      heading: "Why get involved",
      body: missionLine(),
    },
    related: {
      work: { kicker: "Our work", heading: "See the work you support", cta: { label: "Explore Our Work", to: "/work" } },
      impact: { kicker: "Our impact", heading: "See the difference it makes", cta: { label: "Explore Our Impact", to: "/impact" } },
    },
    questions: { kicker: "Questions", heading: "Get in touch", cta: { label: "Contact Us", to: "/contact" } },
    closing: { heading: "", ctas: {} },
  },
  path: {
    kicker: "Get involved",
    questions: { kicker: "Questions", heading: "Get in touch", cta: { label: "Contact Us", to: "/contact" } },
    closing: {
      heading: "Other ways to get involved.",
      ctas: {
        primary: { label: "All Ways to Get Involved", to: "/get-involved" },
        secondary: { label: "Explore Our Work", to: "/work" },
      },
    },
  },
};

export default GET_INVOLVED;
