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
   platforms, rules, targets or approvals. The "why" text and the general
   lists below are PROPOSED copy (content brief, 2026-10-04) — what each
   path is, never how it operates. Every operational section (roles,
   eligibility, what to expect, how it works, rules, FAQs) shows its
   pending line until RBB supplies it (decision D20). Donate itself stays "pending-review": giving is real
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
      shortDescription: "Support work that helps create opportunity, strengthen communities and build more sustainable futures.",
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
      id: "fundraise",
      slug: "fundraise",
      to: "/get-involved/fundraise",
      title: "Fundraise",
      shortDescription: "Bring your community together to raise awareness and support for causes that matter.",
      icon: "fundraise",
      ctaLabel: "Fundraise",
      status: "placeholder",
      metaDescription: "How to raise support for the work of Rising Beyond Borders.",
      sections: [
        section("why", "Why fundraise", "Information on fundraising to be provided by Rising Beyond Borders.", {
          body: "Fundraising brings people together around a cause. Whether you organise something with friends, colleagues or your wider community, you raise awareness as well as support — and help more people discover the work.",
        }),
        section("ideas", "Ways you could fundraise", "Fundraising ideas to be provided by Rising Beyond Borders.", {
          items: [
            "Community events — a gathering, a shared meal or a sports day",
            "Peer-to-peer fundraising — a personal challenge supported by friends, family and colleagues",
            "Workplace, school and community-group initiatives",
            "Celebrations and birthday fundraisers",
          ],
        }),
        /* What has to exist before anyone is invited to fundraise — said
           plainly, so the page never implies a platform or rules that do
           not exist. */
        section("how", "Planning a fundraiser", "Information on how fundraising works to be provided by Rising Beyond Borders.", {
          body: "Before you start, get in touch through our Contact page so we can talk through your idea — including how funds raised are received and how our name and logo may be used.",
        }),
        section("rules", "Rules and guidelines", null, { hideWhenEmpty: true }),
        section("start", "Start a fundraiser", null, { hideWhenEmpty: true }),
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
    body: "There are many ways to make a difference. Whether you give, volunteer, partner or fundraise, you become part of work that opens up opportunity and strengthens communities.",
    ways: { kicker: "Four ways to get involved", heading: "Choose how you take part." },
    choose: {
      kicker: "Choose your path",
      heading: "What each path involves",
      pending: "Details to be provided by Rising Beyond Borders.",
      /* PROPOSED line per path — what it is, never how it operates. */
      /* Shown INSTEAD of the card line above it on the page, so the two
         sections never say the same sentence twice. */
      notes: {
        donate: "Financial support sustains work across education, health and wellbeing, livelihoods and community support.",
        volunteer: "Give time, a professional skill or practical help — the volunteer page explains what volunteering can involve.",
        partner: "For organisations, institutions and community groups that want to combine skills, resources or expertise around shared aims.",
        fundraise: "Organise an event, a personal challenge or a celebration that raises awareness and support among the people you know.",
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
        primary: { label: "Donate", to: "/get-involved/donate" },
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
