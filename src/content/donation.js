/* Donation & Giving — Document 11. ONE source for how giving works:
   /get-involved/donate and the legacy /giving and /gifts pages all read
   from here, so nothing about giving is stated in two places. The path
   itself — its name, address, card line and icon — stays with the other
   three ways to take part in content/getInvolved.js.

   ⚠ No payment or financial detail may be written here that RBB has not
   supplied AND approved. The provider is Razorpay (selected in Document
   22) and is named only in the checkout copy below. No payment URL, merchant ID,
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

import { ABOUT } from "./about.js";
import { HOMEPAGE } from "./homepage.js";
import { SITE } from "./site.js";
import { PROGRAMS } from "./work.js";
import { pathCards } from "./getInvolved.js";
import { policyLink } from "./policies.js";
import { ENV } from "../config/env.js";
import { validApi } from "../lib/donations.js";

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

/* The one line that says giving is not open yet — the hero's notice, and
   the legacy pages' whole message. */
const PENDING_NOTICE =
  "Online donations are not open yet. Details will be published here once Rising Beyond Borders confirms them.";

const MISSION = `Our mission is to ${ABOUT.missionVision.mission.statement.replace(/^E/, "e")}`;

export const DONATION = {
  status: STATUS,

  /* 01 — Hero. PROPOSED interface copy. It invites; it does not promise
     what a gift achieves. `notice` is the state line under it. */
  hero: {
    kicker: "Get involved",
    heading: "Donate",
    /* PROPOSED (content brief, 2026-10-04). Says what giving supports, in
       the four SOURCE program areas' terms; promises no outcome. */
    body: "Support work that helps create opportunity, strengthen communities and build more sustainable futures.",
    notice: PENDING_NOTICE,
    /* The in-page route to the donation action, so a phone reader finds it
       without scrolling past everything else first. Labelled by state:
       while nothing can be given, it does not say "Donate". */
    cta: {
      to: "#donate",
      labels: {
        pending: "Make a donation",
        "approved-informational": "How to donate",
        "approved-live": "Donate",
      },
    },
  },

  /* 02 — Why Give. SOURCE: the mission and vision, as the annual report
     states them. No beneficiary figure: none is verified yet. */
  whyGive: {
    id: "why-give",
    kicker: "Why give",
    heading: "Why your support matters",
    body: [MISSION, `Our vision is ${ABOUT.missionVision.vision.statement.replace(/^A/, "a")}`],
    cta: { label: "About Us", to: "/about#mission-vision" },
  },

  /* 03 — How Support Helps. The four program areas, each linked to its
     page. What a gift does in each is NOT stated: there is no approved
     costed model, so no cost-per-outcome line. */
  supportAreas: {
    id: "how-support-helps",
    kicker: "How support helps",
    heading: "The work your support is part of",
    intro:
      "Rising Beyond Borders works across four connected program areas — education, health and wellbeing, livelihoods and community support.",
    items: PROGRAMS.map((p) => ({ title: p.title, description: p.description, to: p.to, icon: p.icon })),
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

    /* APPROVED-LIVE, ON THIS PAGE — Razorpay Checkout (Document 22). The
       donor picks an approved amount, gives a name and email, and pays in
       Razorpay's own window; card, bank and UPI details go to Razorpay,
       never to this site. Shown only when ALL of these hold (see
       `checkoutReady`):
         - DONATION.status is "approved-live"
         - this block's status is "approved" (RBB has approved the copy)
         - VITE_DONATIONS_API points at RBB's donation endpoints
         - the Privacy Policy is published
       …and at run time the server must also answer with a configuration
       (keys, currency, amounts — server/donations/config.mjs). Anything
       missing: the page falls back, never forward.

       PROPOSED interface copy. It names no amount and no currency (both
       come from the server), and makes no tax, receipt, refund or
       purpose claim. */
    checkout: {
      status: "draft",
      heading: "Make a donation",
      body: [
        "Choose an amount and enter your details, then pay in Razorpay's payment window. The payment details you enter there go to Razorpay, not to this website.",
      ],
      loading: "Loading donation options…",
      needsJavaScript: "Donating on this page needs JavaScript. Please switch it on, or use the Contact page to ask about other ways to give.",
      unavailable:
        "Online donations are unavailable right now. Please try again later, or ask about giving through the Contact page.",
      testMode: "Test mode — no real payment will be taken.",
      amountLegend: "Amount",
      /* The form's own head, frequency control, sections and help links
         (components/DonationCheckout). PROPOSED interface copy, like the
         rest of this block. "Secure" describes the arrangement stated in
         `secureLine` — payment details go to Razorpay, not this site —
         and nothing more: no certification, encryption or tax claim. */
      secureHeading: "Secure online giving",
      /* The payment-flow explanation is not shown at this stage (content
         brief, 2026-10-04). */
      secureLine: null,
      frequency: {
        legend: "How often",
        once: "Give once",
        /* Recurring donations are not offered (Document 22), so there is
           no Monthly option at all — not a disabled one with a note. */
        monthly: null,
        monthlyNote: null,
      },
      detailsLegend: "Your details",
      summaryLabel: "Your donation",
      summaryEmpty: "Choose an amount",
      /* Only routes that exist and say something true. No question is
         listed here until RBB has approved its answer (tax, receipts,
         recurring, refunds). */
      help: {
        heading: "Questions about giving",
        links: [
          { label: "How we report on our finances", to: "/about#transparency" },
          { label: "Report a problem with a donation", to: "/contact" },
        ],
      },
      otherAmount: "Other amount",
      otherLabel: "Your amount",
      otherHint: (min, max) => `Between ${min} and ${max}.`,
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
      submit: "Continue to payment",
      submitting: "Preparing your payment…",
      rateLimited: "Too many attempts. Please wait a few minutes and try again.",
      error: "Something went wrong and your payment was not started. Please try again.",
      reference: "Donation reference",
      states: {
        checkout_opened: "Complete your payment in the Razorpay window.",
        verifying: "Confirming your payment…",
        captured: {
          heading: "Thank you — your donation is confirmed",
          body: (amount) => `Your donation of ${amount} has been received and confirmed.`,
        },
        authorized: {
          heading: "Your payment is being confirmed",
          body: "Your payment has been received and is waiting for confirmation from the payment provider. This page updates when it is confirmed.",
        },
        cancelled: {
          heading: "Your payment was not finished",
          body: "The payment window was closed before the payment was finished.",
        },
        failed: {
          heading: "The payment did not go through",
          body: "Your payment was not completed. You can try again.",
        },
        unknown: {
          heading: "We could not confirm this payment yet",
          body: "Please keep your donation reference and do not pay again straight away. Questions about a payment can go through the Contact page.",
        },
      },
      retry: "Try again",
      change: "Change amount or details",
      contact: { label: "Contact Us", to: "/contact" },
      /* What Razorpay's window shows at the top. */
      checkoutName: "Rising Beyond Borders",
      checkoutDescription: "Donation",

      /* PREVIEW — the form above, drawn while giving is "pending", so the
         donation page shows the whole donation experience before it opens
         (components/DonationCheckout, `preview`). It takes no payment and
         makes no request. Every value here is a PLACEHOLDER, never a
         proposal: the currency is ISO 4217 "XXX" ("no currency", shown
         as ¤) and the amounts are round numbers in it, so nothing can be
         read as RBB's currency or suggested gift (decisions D26, D27). The
         badge is self-labelled ("Demo preview —"), so the release markers
         count it, and the release gate blocks production while the
         preview is on the page. The real amounts and currency come from
         the server's configuration once donations are approved-live —
         the preview is then never drawn. */
      preview: {
        /* The statement beside the preview form: the live checkout's
           heading, with the state said first, in words. */
        heading: "Make a difference today.",
        body: ["Your support can help create opportunities, strengthen communities and build pathways toward a more inclusive future."],
        /* No visible preview badge (content brief, 2026-10-04). The form
           still carries `data-donation-preview`, which release:check
           reads to keep production blocked. The amounts carry no currency
           sign: none has been approved (D26, D27). */
        badge: null,
        amountLegend: "Choose an amount",
        otherHint: () => "Enter the amount you would like to give.",
        config: {
          mode: "preview",
          currency: "XXX",
          /* Drawn by the component itself, not Intl: ICU builds disagree
             on how to show "XXX", which would break hydration. */
          symbol: "",
          currencyLabel: "",
          exponent: 2,
          presets: [50000, 100000, 250000, 500000, 1000000, 2500000],
          custom: true,
          min: 10000,
          max: 100000000,
        },
        /* What a submit shows: true — no payment is taken and nothing is
           sent — without staging language, and never a success. */
        result: {
          heading: "We couldn't start your donation",
          body: "Online giving is unavailable at the moment, so no payment has been taken. Please try again later, or get in touch through our Contact page.",
        },
      },
    },
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
  trustLinks: SITE.transparencyLinks,
  trustLinkMeta: SITE.transparencyLinkMeta,

  /* 07 — FAQ. [{ q, a, status }] — questions and answers RBB supplies.
     No refund, receipt, tax, recurring-payment, cancellation or
     processing policy is written here on RBB's behalf. */
  faqs: [],
  faq: {
    id: "faq",
    kicker: "Questions",
    heading: "Frequently asked questions",
    empty: "Donation questions and answers to be provided by Rising Beyond Borders.",
  },

  /* 08 — Related Ways to Help. The other three paths, from the shared
     Get Involved source. */
  relatedPaths: {
    kicker: "Other ways to help",
    heading: "Other ways to make a difference.",
    items: pathCards().filter((p) => p.to !== "/get-involved/donate"),
  },

  /* The legacy giving pages (/giving, /gifts, /giving/major-giving). They
     keep their addresses, but none of them describes a giving program of
     its own until RBB supplies one — each points to the one donation page
     instead, with the same state line. */
  legacy: {
    kicker: "Donate",
    heading: "How to give",
    pendingBody: [PENDING_NOTICE],
    body: ["How to give to Rising Beyond Borders is set out on our donation page."],
    onward: { label: "Go to Donate", to: "/get-involved/donate" },
  },
  /* The legacy pages show `legacy.body` in every state — no "not open
     yet" line (content brief, 2026-10-04). */

  /* 09 — Closing CTA. The site-wide close (content/homepage.js). Its
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
export const approvedDonationFaqs = () => DONATION.faqs.filter(approved);

/* The state the page actually shows. A state is honoured only when its
   approved content exists — "approved-live" without a verified URL and
   provider falls back, and so does "approved-informational" with nothing
   to say. Everything falls back to "pending", never forward. */
/* Razorpay Checkout on the page (Document 22) — every build-time
   condition; the server's run-time configuration is the last one. */
export const checkoutReady = () =>
  DONATION.donationAction.checkout?.status === "approved" &&
  validApi(ENV.donationsApi) &&
  Boolean(policyLink("privacy"));

export const donationState = () => {
  const { live, informational } = DONATION.donationAction;
  if (DONATION.status === "approved-live" && (checkoutReady() || (live?.url && live?.provider)))
    return "approved-live";
  if (DONATION.status.startsWith("approved") && (informational || approvedGivingMethods().length)) {
    return "approved-informational";
  }
  return "pending";
};

/* Whether the donation page draws the checkout's PREVIEW: only while
   giving is "pending" — never beside approved giving information, never
   once the real checkout can show. The release gate reads this (via the
   build's readiness facts) and blocks a production release while it is
   true. */
export const donationPreview = (state = donationState()) =>
  state === "pending" && Boolean(DONATION.donationAction.checkout?.preview);

/* The block the legacy giving pages show, in the current state. */
export const legacyGivingBlock = () => {
  const { heading, body } = DONATION.legacy;
  return { heading, body };
};

/* The copy for the state `donationState` reports. */
export const donationActionBlock = (state = donationState()) => {
  const action = DONATION.donationAction;
  if (state === "approved-live")
    return checkoutReady()
      ? {
          ...action.checkout,
          checkout: true,
          cta: action.pending.cta,
          ctaIntro: action.pending.ctaIntro,
        }
      : action.live;
  if (state === "approved-informational") return action.informational ?? action.methodsOnly;
  return donationPreview(state)
    ? {
        ...action.pending,
        heading: action.checkout.preview.heading,
        body: action.checkout.preview.body,
        preview: { copy: action.checkout, ...action.checkout.preview },
      }
    : action.pending;
};

export default DONATION;
