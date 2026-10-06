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

import { ABOUT } from "./about.js";
import { ORG_CONTACT } from "./contact.js";

/* A page section: { id, heading, body?, items?, empty, hideWhenEmpty? }.
   `body` is approved text; `items` approved list entries; `faqs` (FAQ
   rows only) is [{ q, a }]. With none of them the row shows `empty`, or
   is left out entirely when `hideWhenEmpty` is set. */
const section = (id, heading, empty, extra = {}) => ({ id, heading, empty, ...extra });

export const GET_INVOLVED = {
  /* The four paths. Titles and addresses are the approved architecture;
     `shortDescription` is Document 06's own line for each (PENDING-REVIEW:
     RBB to confirm the final wording). `featured` is the one path the
     cards set apart. Delete an entry and every menu, card and page
     follows. */
  paths: [
    {
      id: "volunteer",
      slug: "volunteer",
      to: "/get-involved/volunteer",
      title: "Volunteer",
      shortDescription: "Share your time, skills and experience to support meaningful community-focused work.",
      icon: "volunteer",
      ctaLabel: "Volunteer",
      status: "pending-review",
      metaDescription: "How to volunteer your time and skills with Rising Beyond Borders.",
      sections: [
        section("why", "Why volunteer", "Information on volunteering to be provided by Rising Beyond Borders.", {
          body: "Volunteering is one of the most direct ways to support community-focused work. Volunteers bring time, energy and experience — and often find that they learn as much as they give. Whatever your background, your skills can help open up opportunity for others.",
        }),
        /* Future-facing on purpose: no volunteer program has been
           confirmed, so nothing here is an open role, a requirement, a
           deadline or a response time. */
        section("ways", "Opportunities may include", "Volunteer roles to be provided by Rising Beyond Borders.", {
          body: "Depending on Rising Beyond Borders' programs and needs, volunteering could take several forms:",
          items: [
            "Practical help at community events and activities",
            "Support for learning and reading activities",
            "Skills-based help, such as communications, design, finance or planning",
            "Helping to organise awareness and fundraising events",
          ],
        }),
        section("who", "Who could take part", "Volunteer eligibility to be provided by Rising Beyond Borders.", {
          body: "Rising Beyond Borders welcomes interest from people of every background. Anything a particular role needs — skills, time or location — will be set out with that role when it is published.",
        }),
        section("expect", "What happens next", "Information on what volunteering involves to be provided by Rising Beyond Borders.", {
          body: "Each volunteer opportunity sets out what it involves and how to express interest. If you have a question in the meantime, get in touch through our Contact page.",
        }),
        section("apply", "How to apply", null, { hideWhenEmpty: true }),
        section("faq", "Frequently asked questions", null, { hideWhenEmpty: true }),
      ],
    },
    /* Fellowship and Travel With Us are PROPOSED copy like the paths
       above: what each is, never how it operates — no cohort, cost,
       destination, date or eligibility rule until RBB confirms one. */
    {
      id: "fellowship",
      slug: "fellowship",
      to: "/get-involved/fellowship",
      title: "Fellowship",
      shortDescription: "Spend focused time learning alongside community-focused work, and bring your own skills to it.",
      icon: "fellowship",
      ctaLabel: "Fellowship",
      status: "pending-review",
      metaDescription: "Fellowships with Rising Beyond Borders.",
      sections: [
        section("why", "Why a fellowship", "Information on fellowships to be provided by Rising Beyond Borders.", {
          body: "A fellowship is a chance to go deeper than a single volunteering day: time spent learning from the communities and teams behind the work, and contributing your own skills to it across education, health and wellbeing, livelihoods and community support.",
        }),
        section("what", "What a fellowship could involve", "Fellowship details to be provided by Rising Beyond Borders.", {
          items: [
            "Working alongside a program team",
            "A focused piece of work of your own, agreed at the start",
            "Regular reflection on what you are learning",
          ],
        }),
        section("next", "Interested?", "Information on fellowships to be provided by Rising Beyond Borders.", {
          body: "Fellowship places are not open yet. If you would like to hear when they are, or to talk about what a fellowship could look like for you, get in touch through our Contact page.",
        }),
        section("apply", "How to apply", null, { hideWhenEmpty: true }),
        section("faq", "Frequently asked questions", null, { hideWhenEmpty: true }),
      ],
    },
    {
      id: "partner",
      slug: "partner",
      to: "/get-involved/partner",
      title: "Partner With Us",
      shortDescription: "Work with Rising Beyond Borders to explore practical ways of contributing skills, resources and expertise.",
      icon: "partner",
      ctaLabel: "Partner With Us",
      status: "pending-review",
      metaDescription: "How organizations and communities can explore partnership with Rising Beyond Borders.",
      sections: [
        section("why", "Why partner with us", "Information on partnership to be provided by Rising Beyond Borders.", {
          body: "Lasting change is rarely achieved alone. Partnership lets organisations, institutions and community groups combine their skills, resources and expertise around shared aims. We welcome conversations about practical ways of working together.",
        }),
        section("areas", "Potential partnership areas", "Partnership areas to be provided by Rising Beyond Borders.", {
          items: [
            "Sharing professional skills and expertise",
            "Contributing resources in kind",
            "Collaborating on community-focused work",
            "Raising awareness of shared causes",
          ],
        }),
        /* Kinds of partner, not partners: nothing here says Rising Beyond
           Borders works with any of them today. */
        section("who", "Who could partner with us", "Information on who can partner to be provided by Rising Beyond Borders.", {
          body: "Partnerships could bring together many kinds of organisation, including:",
          items: [
            "Community organisations and local groups",
            "Nonprofit organisations",
            "Schools, colleges and other educational institutions",
            "Health organisations",
            "Businesses",
            "Philanthropic supporters",
            "Technical and professional contributors",
          ],
        }),
        section("how", "How a partnership could start", "Information on how partnership works to be provided by Rising Beyond Borders.", {
          body: "Every partnership begins with a conversation about shared aims, what each side can bring, and how the people the work serves will have a say.",
        }),
        section("inquiry", "Partnership inquiries", null, { hideWhenEmpty: true }),
        section("faq", "Questions and next steps", null, { hideWhenEmpty: true }),
      ],
    },
    {
      id: "travel",
      slug: "travel",
      to: "/get-involved/travel",
      title: "Travel With Us",
      shortDescription: "See community-focused work first-hand, on a visit planned with the people it serves.",
      icon: "travel",
      ctaLabel: "Travel With Us",
      status: "pending-review",
      metaDescription: "Travelling with Rising Beyond Borders.",
      sections: [
        section("why", "Why travel with us", "Information on travelling with us to be provided by Rising Beyond Borders.", {
          body: "There is no better way to understand the work than to see it. Travelling with us means meeting the communities and teams behind it — on their terms, with respect for their time and privacy — and coming home able to share what you saw.",
        }),
        section("what", "What a trip could involve", "Trip details to be provided by Rising Beyond Borders.", {
          items: [
            "Time with program teams and the communities they work with",
            "Learning about the local context the work happens in",
            "Time together each day to reflect on what you have seen",
          ],
        }),
        section("practical", "Dates and practical details", "Trip details to be provided by Rising Beyond Borders.", {
          body: "Dates, costs and practical details are shared once a trip is confirmed. Register your interest below and we will let you know when trips are planned.",
        }),
        section("faq", "Frequently asked questions", null, { hideWhenEmpty: true }),
      ],
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

export const pathByPath = (to) => GET_INVOLVED.paths.find((p) => p.to === to);

/* ---------------- Page copy ----------------
   Headings and labels are PROPOSED interface copy. */
export const GET_INVOLVED_PAGES = {
  hub: {
    kicker: "Get involved",
    heading: "Get Involved",
    /* Document 02's approved section heading, reused as the invitation. */
    body: "There are many ways to make a difference. Whether you volunteer, join a fellowship, partner with us or travel with us, you become part of work that opens up opportunity and strengthens communities.",
    ways: { kicker: "Four ways to get involved", heading: "Choose how you take part." },
    choose: {
      kicker: "Choose your path",
      heading: "What each path involves",
      pending: "Details to be provided by Rising Beyond Borders.",
      /* PROPOSED line per path — what it is, never how it operates. */
      /* Shown INSTEAD of the card line above it on the page, so the two
         sections never say the same sentence twice. */
      notes: {
        volunteer: "Give time, a professional skill or practical help — the volunteer page explains what volunteering can involve.",
        fellowship: "Focused time learning alongside the work and contributing your own skills — the fellowship page explains what it could involve.",
        travel: "See the work first-hand on a visit planned with the communities it serves, and register your interest in a future trip.",
        partner: "For organisations, institutions and community groups that want to combine skills, resources or expertise around shared aims.",
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
    questions: { kicker: "Questions", heading: "Get in touch", cta: { label: "Contact Us", to: "/contact" } },
    closing: {
      heading: "Ready to take the next step?",
      ctas: {
        primary: { label: "See Our Appeals", to: "/appeals" },
        secondary: { label: "Explore Our Work", to: "/work" },
      },
    },
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
