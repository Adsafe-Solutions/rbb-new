/* Donation & Giving — Document 11. ONE source for how giving works: the
   header's donation popup (components/DonateDialog), /appeals and every
   appeal page read from here, so nothing about giving is stated in two
   places. (The legacy /giving and /gifts pages were retired — D35.) The appeals
   themselves are content/appeals.js.

   ⚠ No payment or financial detail may be written here that RBB has not
   supplied AND approved. No payment provider is integrated: Razorpay
   (Document 22) was removed, and RBB's new provider is still to be
   chosen. No payment URL, merchant ID,
   account number, UPI ID, bank or wallet details; no amounts, suggested
   amounts or currency; no tax-deductibility, receipt, refund,
   recurring-payment, cancellation, registration or compliance claim; no
   "$X provides Y" impact line. The inherited widget's CA$ amounts belong
   to another charity and stay provisional sample data in content/ngo.js.

   ⚠ The 2026 78 / 12 / 10 split (content/transparency.js) is a
   transparency figure pending RBB verification. It is NOT a statement of
   what a donation does, and is never shown here as one.

   ⚠ Nothing sensitive goes in this file, ever: it ships to every browser.
   A live integration's keys and configuration belong on a server.

   Editorial status, for the people maintaining this file — never shown:
     "draft" | "pending-review" | "approved" | "archived"
   Only "approved" methods and FAQs render. */

import { HOMEPAGE } from "./homepage.js";
import { SITE } from "./site.js";
import { transparencyLinks } from "./transparency.js";
import { pathCards } from "./getInvolved.js";
import { policyLink } from "./policies.js";
import { APPEALS_PAGES, appealKind } from "./appeals.js";
import { PAYMENT_CONNECTED } from "../lib/payment.js";

/* The public state of giving on the site:
     "pending"                 details and payment options are being
                               finalised; nothing to act on
     "approved-informational"  approved giving information, no payment
                               processing on the site
     "approved-live"           a real payment action — only once the
                               provider and its production configuration
                               are verified
   Raising this alone changes nothing a visitor sees: each state also
   needs its approved content (see `donationState`).

   ⚠ Unlike the rest of the site's content, this is NOT raised to a
   working placeholder state (Document 27 §8 keeps donation wording and
   settings behind RBB's approval): giving is real money, so the page
   stays "pending" until RBB approves the wording and the payment
   provider's production configuration is verified. */
const STATUS = "pending";

export const DONATION = {
  status: STATUS,

  /* The general donation page (/appeals — the Donate page's address
     forwards there) is the CMS's only (PUBLISHED_GENERAL_DONATION,
     2026-10-13): its hero, "why", "how support helps", FAQ and lists. What
     stays here is the donation form's and the page's own wording. */

  /* 07 — Closing CTA: back to the form, never a second form. */
  closing: {
    heading: "Every contribution helps build a world where everyone can thrive.",
    cta: "Donate",
  },

  /* 04 — Ways to Give. EMPTY until RBB supplies its methods. Card, bank
     transfer, cheque and the rest appear only once supplied. One record:
       {
         id, label,
         description:   one or two sentences
         status:        see above — only "approved" renders
         instructions:  [string] — approved steps, shown as written
         externalUrl:   the provider's page for this method, if any
         provider:      the provider's name, as RBB states it
         availability:  where / to whom it is open, if RBB limits it
       }
     A method's `externalUrl` shows only when the whole page is
     "approved-live" — an informational page takes no payment. */
  givingMethods: [],
  ways: {
    id: "ways-to-give",
    kicker: "Ways to give",
    heading: "How you can give",
    empty: "Ways to give to be provided by Rising Beyond Borders.",
    linkLabel: "Continue with",
  },

  /* 05 — Donation Action. One block per state; `donationState` picks. */
  donationAction: {
    id: "donate",
    kicker: "Donate",
    pending: {
      heading: "Donations are not open yet",
      body: [
        "Rising Beyond Borders is finalising its donation details and payment options. They will appear here once they are confirmed.",
        "Nothing on this page takes a payment.",
      ],
      cta: { label: "Contact Us", to: "/contact" },
      ctaIntro: "Questions about giving can go through the Contact page.",
    },
    /* APPROVED-INFORMATIONAL: { heading, body: [string] } from RBB. With
       approved methods but no text of its own, `methodsOnly` is shown. */
    informational: null,
    methodsOnly: {
      heading: "How to donate",
      body: ["The ways to give on this page are the ones Rising Beyond Borders currently offers."],
      cta: { label: "Contact Us", to: "/contact" },
      ctaIntro: "Questions about giving can go through the Contact page.",
    },
    /* APPROVED-LIVE: { heading, body: [string], label, url, provider }
       — the provider's own hosted page, verified by RBB. The site never
       collects card or bank details itself. */
    live: null,
  },

  /* The ONE donation form (components/DonationForm) — every donation
     page, the Donate popup and any future page draw this form with this
     configuration; only the page's context around it changes.

     `config` — what may be given. Amounts are in MAJOR units ("500"). The
     currency is null until RBB's payment provider and its currency are
     approved: amounts then show as plain numbers, with no symbol (D26,
     D27). `frequencyOptions.monthly` stays false until recurring giving
     is really supported — the form then offers it, never before.

     `copy` — PROPOSED interface copy. It names no currency, and makes no
     tax, receipt, refund, security-certification or purpose claim. */
  form: {
    config: {
      frequencyOptions: { oneTime: true, monthly: false },
      currency: null,
      presetAmounts: [500, 1000, 2500, 5000, 10000, 25000],
      allowCustomAmount: true,
      minimumAmount: 100,
      maximumAmount: 1000000,
    },
    copy: {
      heading: "Make a donation",
      intro: "Choose an amount and enter your details.",
      frequency: { legend: "How often", oneTime: "Give once", monthly: "Give monthly" },
      amountLegend: "Choose an amount",
      otherAmount: "Other amount",
      otherHint: (min, max) => `Between ${min} and ${max}.`,
      detailsLegend: "Your details",
      summaryEmpty: "Choose an amount",
      fields: {
        name: { label: "Full name", autoComplete: "name", maxLength: 200 },
        email: { label: "Email address", autoComplete: "email", maxLength: 254 },
        phone: { label: "Phone number", autoComplete: "tel", maxLength: 24 },
      },
      messages: {
        chooseAmount: "Choose an amount",
        amountFormat: (decimals) =>
          decimals ? `Enter an amount as a number, with up to ${decimals} decimal places` : "Enter a whole number",
        amountRange: (min, max) => `Enter an amount between ${min} and ${max}`,
        name: "Enter your full name",
        email: "Enter an email address in the correct format, like name@example.com",
        phone: "Enter a phone number using digits, spaces and an optional leading +",
      },
      submit: "Continue to Payment",
      submitting: "Preparing your payment…",
      change: "Change amount or details",
      /* The provider-error state: what a submit shows while no payment
         provider can take it — true (nothing taken, nothing sent), never a
         success, never a reference. */
      unavailable: {
        heading: "We couldn't start your donation",
        body: "Online giving is unavailable at the moment, so no payment has been taken. Please try again later, or get in touch through our Contact page.",
      },
      /* Only routes that exist and say something true. */
      help: {
        heading: "Questions about giving",
        links: [
          { label: "How we report on our finances", to: "/about#transparency" },
          { label: "Report a problem with a donation", to: "/contact" },
          /* Only while the policy is published (content/policies.js). */
          ...(policyLink("donation") ? [{ label: "Our donation policy", to: policyLink("donation").to }] : []),
        ],
      },
    },
  },

  /* The Donate popup's statement over the same form (components/
     DonateDialog). */
  dialog: {
    kicker: "Donate",
    heading: "Make a difference today.",
    body: ["Your support can help create opportunities, strengthen communities and build pathways toward a more inclusive future."],
  },

  /* 06 — Transparency & Trust. The shared transparency rows; no audit,
     registration, tax or compliance claim. */
  trust: {
    id: "transparency",
    kicker: "Transparency",
    heading: "Transparency matters.",
    body: "Supporters should always be able to see how our work is run and how resources are used.",
    cta: { label: "View Transparency", to: "/about#transparency" },
  },
  trustLinks: transparencyLinks(),
  trustLinkMeta: SITE.transparencyLinkMeta,

  /* 07 — FAQ. [{ q, a, status }] — questions and answers RBB supplies.
     No refund, receipt, tax, recurring-payment, cancellation or
     processing policy is written here on RBB's behalf. */
  /* The FAQ band's heading (components/DonationExperience); the
     questions are the published page's own. */
    faq: {
    id: "faq",
    kicker: "Questions",
    heading: "Frequently asked questions",
    empty: "Donation questions and answers to be provided by Rising Beyond Borders.",
  },

  /* 08 — Related Ways to Help. The ways to take part, from the shared
     Get Involved source. */
  relatedPaths: {
    kicker: "Other ways to help",
    heading: "Other ways to make a difference.",
    items: pathCards(),
  },

  /* The header's donation popup (components/DonateDialog): the line
     under the form that leads on to the appeals. */
  popup: {
    appealsIntro: "Want to support something specific?",
    appeals: { label: "See our appeals", to: "/appeals" },
  },

  /* The site-wide close (content/homepage.js), for pages that are not
     donation pages (AppealList). Its
     supporting line is still pending, so it is left out here rather than
     shown twice as a placeholder. */
  closingCta: {
    heading: HOMEPAGE.finalCta.heading,
    ctas: HOMEPAGE.finalCta.ctas,
    image: HOMEPAGE.finalCta.image,
  },
};

/* ---------------- Lookups ---------------- */
const approved = (record) => ["approved", "verified"].includes(record.status);
export const approvedGivingMethods = () => DONATION.givingMethods.filter(approved);

/* The state the page actually shows. A state is honoured only when its
   approved content exists — "approved-live" without a verified URL and
   provider falls back, and so does "approved-informational" with nothing
   to say. Everything falls back to "pending", never forward. */
export const donationState = () => {
  const { live, informational } = DONATION.donationAction;
  if (DONATION.status === "approved-live" && live?.url && live?.provider)
    return "approved-live";
  if (DONATION.status.startsWith("approved") && (informational || approvedGivingMethods().length)) {
    return "approved-informational";
  }
  return "pending";
};

/* Whether the donation form is drawn WITHOUT a connected payment
   provider (lib/payment.js) — while giving is "pending", every donation
   page shows the form, and a submit ends in its provider-error state.
   The release gate reads this (via the build's readiness facts) and
   blocks a production release while it is true. */
export const donationPreview = (state = donationState()) => state === "pending" && !PAYMENT_CONNECTED;

/* The statement block for a state (it was the retired legacy giving pages' band). */
export const donationActionBlock = (state = donationState()) => {
  const action = DONATION.donationAction;
  if (state === "approved-live") return action.live;
  if (state === "approved-informational") return action.informational ?? action.methodsOnly;
  return action.pending;
};

/* ---------------- Donation experiences ----------------
   What components/DonationExperience draws, built from content. ONE shape
   for every kind of donation page — only the content changes; the form
   is always DONATION.form:

     {
       type:        "general" | "appeal" | "campaign" | "project"
       id:          the page's anchor for the form ("donate")
       eyebrow, title, description, image
       parent:      the breadcrumb's section { label, to }
       context:     { label?, body: [string] }  — beside the form
       donation:    { type, appeal?, campaign?, project?, designation }
                    — handed to lib/payment.js with the gift; never shown
       why:         { kicker, heading, body: [string], cta? }  or null
       impact:      { kicker, heading, intro?, items: [{ title, description }] } or null
       trust:       the TrustPanel props, or null
       faq:         [{ q, a }] — empty: no section
       closing:     { heading, cta }
     }
   Any optional block that is null or empty is simply not drawn. A
   project page builds the same shape from a project record. */
const TRUST = {
  ...DONATION.trust,
  links: DONATION.trustLinks,
  linkMeta: DONATION.trustLinkMeta,
};

/* The general donation page as the CMS published it — set by the build
   from the published snapshot (scripts/snapshot-adapter.mjs), and empty
   otherwise. While empty, the page is the source content above. Once the
   organization PUBLISHES its page in the CMS, `page` holds it:
     { eyebrow?, title, description, image, context?, why?, impact?,
       designation, checkout?, seo? }
   The closing band stays this file's. Milestone 7: the trust panel, the
   FAQ and the appeal bands are the site's unless the published page has
   its own (scripts/snapshot-adapter.mjs: absent = the site's; null or []
   = none on this page; otherwise the page's own — see `ownTrust`). */
export const PUBLISHED_GENERAL_DONATION = {};

/* Milestone 7: a CMS donation page's own trust panel, FAQ and appeal
   lists, in the three states the adapter gives them (absent → the site's
   `fallback`; null → none; else the page's own). The trust panel's
   document rows are always the transparency records'. */
const ownTrust = (trust, fallback) => (trust === undefined ? fallback : trust && { id: TRUST.id, ...trust, links: TRUST.links, linkMeta: TRUST.linkMeta });
const ownFaq = (faq, fallback) => (faq === undefined ? { faq: fallback } : { faq: faq?.items ?? [], ...(faq && { faqHeading: { kicker: faq.kicker, heading: faq.heading, highlight: faq.highlight } }) });

export const generalDonation = () => {
  const cms = PUBLISHED_GENERAL_DONATION.page;
  if (cms)
    return {
      type: "general",
      source: "cms",
      id: DONATION.donationAction.id,
      eyebrow: cms.eyebrow ?? APPEALS_PAGES.hub.heading,
      title: cms.title,
      description: cms.description,
      image: cms.image,
      parent: null,
      context: cms.context ?? null,
      donation: { type: "general", designation: cms.designation },
      why: cms.why ?? null,
      impact: cms.impact ?? null,
      trust: ownTrust(cms.trust, TRUST),
      ...ownFaq(cms.faq, []),
      lists: cms.lists,
      closing: DONATION.closing,
      checkout: cms.checkout ?? null,
    };
  /* No built-in page (2026-10-13): the build refuses a snapshot without
     one (scripts/published-snapshot.mjs). */
  return null;
};

/* An emergency appeal or a campaign (content/appeals.js). Its own story
   is the "why"; its own list of what support funds is the "how". */
export const appealDonation = (appeal) => {
  const kind = appealKind(appeal.kind);
  const emergency = appeal.kind === "emergency";
  /* The appeal's one "why" passage (a statement, or rich text from the
     CMS) and its one list of how support helps. */
  const situation = appeal.sections.find((s) => s.type === "statement" || s.type === "richText");
  const response = appeal.sections.find((s) => s.type === "numberedCards");
  const body = situation?.type === "statement" ? [].concat(situation.body ?? []) : [];
  const content = situation?.type === "richText" ? situation.content : null;
  /* Milestone 7: an appeal published from the CMS uses its own statement
     heading, kicker, highlight and link, and its cards' kicker and
     highlight; the wording below is the fallback. The website's own
     appeals keep the page's wording, as before (their statement headings
     were written for the record, never shown). */
  const cms = appeal.source === "cms";
  return {
    type: emergency ? "appeal" : "campaign",
    id: DONATION.donationAction.id,
    eyebrow: kind.label,
    title: `Support ${appeal.title}`,
    description: appeal.summary,
    image: appeal.image,
    parent: { label: kind.label, to: kind.to },
    /* The summary above is the context; the story itself is the "why"
       below — never the same paragraph twice. */
    context: null,
    donation: { type: emergency ? "appeal" : "campaign", [emergency ? "appeal" : "campaign"]: appeal.id },
    why: body.length
      ? {
          id: "why",
          kicker: (cms && situation.kicker) || kind.kicker,
          heading: cms ? situation.heading : emergency ? "Why this response matters" : "Why this campaign matters",
          body,
          ...(cms && situation.highlight && { highlight: situation.highlight }),
          ...(cms && situation.cta && { cta: situation.cta }),
        }
      : content?.length
        ? { id: "why", kicker: kind.kicker, heading: situation.heading, content }
        : null,
    impact: response?.items?.length
      ? {
          id: "how-support-helps",
          kicker: (cms && response.kicker) || "How support helps",
          heading: response.heading,
          ...(cms && response.highlight && { highlight: response.highlight }),
          intro: response.intro ?? "Your support can help with:",
          items: response.cards ?? response.items.map((title) => ({ title })),
        }
      : null,
    trust: cms ? ownTrust(appeal.trust, TRUST) : TRUST,
    ...(cms ? ownFaq(appeal.faq, []) : { faq: [] }),
    lists: cms ? appeal.lists : undefined,
    closing: DONATION.closing,
    releaseMarker: appeal.releaseMarker,
    /* The appeal's Givebutter checkout, when the CMS configured one. */
    checkout: appeal.checkout ?? null,
  };
};

export default DONATION;
