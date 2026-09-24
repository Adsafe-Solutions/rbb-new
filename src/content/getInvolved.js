/* Get Involved — Document 06. ONE source for the four ways to take part:
   the header's Donate button, the nav's Get Involved menu, the footer, the
   homepage and program-page cards, /get-involved and each path's own page
   all read from here, so a path's name, address or description is stated
   once.

   Editorial status, for the people maintaining this file — never shown:
     "verified"/"approved"  confirmed by RBB, or cleared to publish as
                            working content (Document 27); see the note
                            below
     "pending-review"      in the approved architecture, wording awaiting
                            RBB
     "placeholder"          nothing supplied yet; the page shows a
                            placeholder

   Donate is one of the four here, but what its page says about giving
   lives in content/donation.js (Document 11).

   ⚠ No operational detail may be invented here that RBB has not
   confirmed: no amounts, currency, payment provider, bank details or tax
   claim; no volunteer eligibility, ages, locations, schedules, screening
   or training that claims to be RBB's real process; no partnership
   packages, tiers, named partners, benefits or pricing; no fundraising
   platforms, rules, targets or approvals. The section text below is a
   WORKING placeholder (Document 27), self-labelled "Demo —" throughout,
   kept so each path's page has something to review; it is not RBB's
   approved process. Donate itself stays "pending-review": giving is real
   money, and content/donation.js keeps it gated until RBB and the
   payment provider are verified (Document 22).

   ⚠ No forms either. A form here would appear to reach RBB and reach
   nobody. The process / application / inquiry sections are HIDDEN until a
   real route exists (`hideWhenEmpty`), rather than shown as placeholders
   a visitor might try to act on. */

import { ABOUT } from "./about.js";
import { ORG_CONTACT } from "./contact.js";

/* A page section: { id, heading, body?, items?, empty, hideWhenEmpty? }.
   `body` is approved text; `items` approved list entries; `faqs` (FAQ
   rows only) is [{ q, a }]. With none of them the row shows `empty`, or
   is left out entirely when `hideWhenEmpty` is set. */
const section = (id, heading, empty, extra = {}) => ({ id, heading, empty, ...extra });

const D = "Demo — ";

export const GET_INVOLVED = {
  /* The four paths. Titles and addresses are the approved architecture;
     `shortDescription` is Document 06's own line for each (PENDING-REVIEW:
     RBB to confirm the final wording). `featured` is the one path the
     cards set apart. Fundraise is a proposed path — if RBB does not offer
     it, delete that entry and every menu, card and page follows. */
  paths: [
    {
      id: "donate",
      slug: "donate",
      to: "/get-involved/donate",
      title: "Donate",
      shortDescription: "Give financial support.",
      icon: "donate",
      ctaLabel: "Donate",
      featured: true,
      status: "pending-review",
      metaDescription: "How to give financial support to the work of Rising Beyond Borders.",
      /* The page itself — its sections, state and every word about
         giving — reads content/donation.js (Document 11). */
    },
    {
      id: "volunteer",
      slug: "volunteer",
      to: "/get-involved/volunteer",
      title: "Volunteer",
      shortDescription: "Give time and skills.",
      icon: "volunteer",
      ctaLabel: "Volunteer",
      status: "pending-review",
      metaDescription: "How to volunteer your time and skills with Rising Beyond Borders.",
      sections: [
        section("why", "Why volunteer", "Information on volunteering to be provided by Rising Beyond Borders.", {
          body: `${D}Volunteers are at the heart of every project, from packing days to reading clubs.`,
        }),
        section("ways", "Ways to volunteer", "Volunteer roles to be provided by Rising Beyond Borders.", {
          items: [`${D}Packing and distribution days`, `${D}Reading club helpers`, `${D}Event support`, `${D}Skills-based volunteering (design, finance, IT)`],
        }),
        section("who", "Who can volunteer", "Volunteer eligibility to be provided by Rising Beyond Borders.", {
          body: `${D}Anyone aged 18 or over; some roles welcome younger volunteers with a parent or guardian.`,
        }),
        section("expect", "What to expect", "Information on what volunteering involves to be provided by Rising Beyond Borders.", {
          body: `${D}A short welcome session, a named contact, and roles that fit around your time.`,
        }),
        section("apply", "How to apply", null, { hideWhenEmpty: true }),
        section("faq", "Frequently asked questions", "Volunteer questions and answers to be provided by Rising Beyond Borders.", {
          faqs: [
            { q: "How much time do I need to give? (demo)", a: "Demo answer — as little as one afternoon; many volunteers help once a month." },
            { q: "Do I need experience? (demo)", a: "Demo answer — no; we explain everything on the day." },
          ],
        }),
      ],
    },
    {
      id: "partner",
      slug: "partner",
      to: "/get-involved/partner",
      title: "Partner With Us",
      shortDescription: "Explore organizational and community partnership.",
      icon: "partner",
      ctaLabel: "Partner With Us",
      status: "pending-review",
      metaDescription: "How organizations and communities can explore partnership with Rising Beyond Borders.",
      sections: [
        section("why", "Why partner with us", "Information on partnership to be provided by Rising Beyond Borders.", {
          body: `${D}Partners bring skills, reach and resources that help projects go further.`,
        }),
        section("areas", "Potential partnership areas", "Partnership areas to be provided by Rising Beyond Borders.", {
          items: [`${D}Programme partnerships`, `${D}Employee volunteering`, `${D}In-kind support`, `${D}Community partnerships`],
        }),
        section("who", "Who can partner", "Information on who can partner to be provided by Rising Beyond Borders.", {
          body: `${D}Businesses, foundations, schools, community groups and other non-profits.`,
        }),
        section("how", "How partnership works", "Information on how partnership works to be provided by Rising Beyond Borders.", {
          body: `${D}We agree shared goals, a simple plan and how we will report back to each other.`,
        }),
        section("inquiry", "Partnership inquiries", null, { hideWhenEmpty: true }),
        section("faq", "Questions and next steps", "Partnership questions and answers to be provided by Rising Beyond Borders.", {
          faqs: [{ q: "Is there a minimum commitment? (demo)", a: "Demo answer — no; partnerships are shaped around what works for both sides." }],
        }),
      ],
    },
    {
      id: "fundraise",
      slug: "fundraise",
      to: "/get-involved/fundraise",
      title: "Fundraise",
      shortDescription: "Raise support for Rising Beyond Borders.",
      icon: "fundraise",
      ctaLabel: "Fundraise",
      status: "placeholder",
      metaDescription: "How to raise support for the work of Rising Beyond Borders.",
      sections: [
        section("why", "Why fundraise", "Information on fundraising to be provided by Rising Beyond Borders.", {
          body: `${D}Fundraising events and challenges raise money and spread the word.`,
        }),
        section("how", "How it works", "Information on how fundraising works to be provided by Rising Beyond Borders.", {
          items: [`${D}Choose your activity`, `${D}Tell us about it using the form below`, `${D}Share your page and collect support`, `${D}Send in what you raise`],
        }),
        section("ideas", "Fundraising ideas", "Fundraising ideas to be provided by Rising Beyond Borders.", {
          items: [`${D}Sponsored run or walk`, `${D}Bake sale`, `${D}Birthday fundraiser`, `${D}Quiz night`],
        }),
        section("rules", "Rules and guidelines", "Fundraising guidelines to be provided by Rising Beyond Borders.", {
          body: `${D}Keep collections safe and legal, and use our name and logo as we agree with you.`,
        }),
        section("start", "Start a fundraiser", null, { hideWhenEmpty: true }),
        section("faq", "Frequently asked questions", "Fundraising questions and answers to be provided by Rising Beyond Borders.", {
          faqs: [{ q: "Can you send me materials? (demo)", a: "Demo answer — yes; tell us about your event and we will send what we have." }],
        }),
      ],
    },
  ],

  /* The contact route, from content/contact.js — the one source for how to
     reach RBB. Until its general-inquiry destination is supplied, every
     page shows the pending line instead of a link. */
  contact: {
    label: ORG_CONTACT.generalInquiry.label,
    url: ORG_CONTACT.generalInquiry.status === "verified" ? ORG_CONTACT.generalInquiry.href : null,
    pending: ORG_CONTACT.pending,
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

export const pathByPath = (to) => GET_INVOLVED.paths.find((p) => p.to === to);

/* ---------------- Page copy ----------------
   Headings and labels are PROPOSED interface copy. */
export const GET_INVOLVED_PAGES = {
  hub: {
    kicker: "Get involved",
    heading: "Get Involved",
    /* Document 02's approved section heading, reused as the invitation. */
    body: "There are many ways to make a difference.",
    ways: { kicker: "Four ways to get involved", heading: "Choose how you take part." },
    choose: {
      kicker: "Choose your path",
      heading: "What each path involves",
      pending: "Details to be provided by Rising Beyond Borders.",
      /* WORKING placeholder line per path (Document 27), self-labelled. */
      notes: {
        donate: `${D}Give online through Razorpay, choosing an amount that suits you.`,
        volunteer: `${D}Give an afternoon, a month or a skill: packing days, reading clubs, events.`,
        partner: `${D}Organisations and communities working with us on shared goals.`,
        fundraise: `${D}Run a challenge, event or birthday fundraiser for the work.`,
      },
      linkPrefix: "Go to",
    },
    /* SOURCE: the mission, as the annual report states it — the one
       approved statement of why the work matters. */
    why: {
      heading: "Why get involved",
      body: `Our mission is to ${ABOUT.missionVision.mission.statement.replace(/^E/, "e")}`,
    },
    related: {
      work: { kicker: "Our work", heading: "See the work you support", cta: { label: "Explore Our Work", to: "/work" } },
      impact: { kicker: "Our impact", heading: "See the difference it makes", cta: { label: "Explore Our Impact", to: "/impact" } },
    },
    questions: { kicker: "Questions", heading: "Get in touch", cta: { label: "Contact Page", to: "/contact" } },
    closing: {
      heading: "Ready to take the next step?",
      ctas: {
        primary: { label: "Donate", to: "/get-involved/donate" },
        secondary: { label: "Explore Our Work", to: "/work" },
      },
    },
  },
  path: {
    kicker: "Get involved",
    questions: { kicker: "Questions", heading: "Get in touch", cta: { label: "Contact Page", to: "/contact" } },
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
