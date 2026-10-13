/* Privacy, legal & site policies — Document 13. ONE source for every
   policy the site may publish: the /privacy and /terms pages, the
   footer's legal links and the forms' privacy link all read from here.

   There is no accessibility statement. RBB asked for the page and its
   footer link to be taken out; Document 13 §7 still describes one, so if
   that decision is revisited the record goes back here and the route,
   the title, the footer link and the page come back with it.

   ⚠ Nothing here is legal text, and none may be written on RBB's behalf:
   no privacy wording, rights, retention periods, service providers,
   cookie behaviour, security promises, governing law, jurisdiction,
   charity or tax status, registration numbers, or audit or
   certification claim. Policy text comes from RBB, reviewed by counsel,
   and is pasted in as supplied.

   ⚠ Dates are RBB's. `effectiveDate` and `lastUpdated` are ISO dates
   ("YYYY-MM-DD") that RBB states — never the day the site was deployed.

   Editorial status, for the people maintaining this file — never shown:
     "draft" | "pending-review" | "approved" | "archived"
   A policy is PUBLISHED only when it is "approved" AND has sections (see
   `isPublished`). Anything else shows its neutral pending line — never
   draft text dressed as an active policy — and gets no footer link.

   One record:
     {
       id, route, title,
       status,
       effectiveDate, lastUpdated:  RBB's ISO dates, or null
       intro:            [string] — optional lead paragraphs
       sections:         [{ id, heading, body: [string], items?: [string] }]
       contactReference: the `id` of a VERIFIED method in content/contact.js
                         (e.g. a privacy mailbox) — shown only while that
                         method is verified; never a typed-in address
       relatedPolicies:  [policy id] — linked only when THEY are published
       pending:          what the page says until it is published
       outline:          for editors only — the sections Document 13
                         expects once text is supplied; never rendered
     } */

import { isWorkingContent } from "../lib/releaseMarkers.js";
import { withoutTrailingSlash } from "../lib/paths.js";
import { ORG_CONTACT, methodHref, verifiedOnly } from "./contact.js";

const POLICY_RECORDS = [
  {
    id: "privacy",
    route: "/privacy",
    title: "Privacy Policy",
    status: "placeholder",
    effectiveDate: null,
    lastUpdated: null,
    intro: [],
    sections: [],
    contactReference: null,
    relatedPolicies: ["terms", "donation"],
    metaDescription: "The Rising Beyond Borders privacy policy.",
    /* Document 13's own wording for this state. */
    pending: "Our privacy policy is being updated. If you have a question about how your information is handled, please visit our Contact page.",
    /* Document 13 §4. "transfers" only if RBB / counsel confirm it applies.
       "forms" must match what the site actually collects — content/forms.js. */
    outline: [
      { id: "introduction", heading: "Introduction and scope" },
      { id: "information-collected", heading: "Information we collect" },
      { id: "use", heading: "How we use information" },
      { id: "sharing", heading: "Sharing and service providers" },
      { id: "forms", heading: "Forms and communications" },
      { id: "cookies", heading: "Cookies and similar technologies" },
      { id: "retention", heading: "Data retention" },
      { id: "security", heading: "Security" },
      { id: "rights", heading: "Your rights and choices" },
      { id: "transfers", heading: "International transfers" },
      { id: "contact", heading: "Privacy questions" },
      { id: "updates", heading: "Updates to this policy" },
    ],
  },
  {
    id: "terms",
    route: "/terms",
    title: "Terms of Use",
    status: "placeholder",
    effectiveDate: null,
    lastUpdated: null,
    intro: [],
    sections: [],
    contactReference: null,
    relatedPolicies: ["privacy", "donation"],
    metaDescription: "The terms of use for the Rising Beyond Borders website.",
    pending: "Our website terms are being updated. If you have a question about using this website, please visit our Contact page.",
    /* Document 13 §5 — structural headings only. NOT authority to publish
       any of these provisions. "governing-law" in particular states a
       jurisdiction, which nothing supplied establishes. */
    outline: [
      { id: "acceptable-use", heading: "Acceptable use" },
      { id: "intellectual-property", heading: "Intellectual property" },
      { id: "external-links", heading: "External links" },
      { id: "availability", heading: "Website availability" },
      { id: "disclaimers", heading: "Disclaimers" },
      { id: "liability", heading: "Limitation of liability" },
      { id: "governing-law", heading: "Governing law" },
      { id: "changes", heading: "Changes to these terms" },
    ],
  },
  /* Donation Policy — how gifts are received, used, acknowledged and
     refunded. Real money: like Privacy and Terms, its text is RBB's to
     supply and counsel's to review; until then the page shows `pending`,
     never text that reads as RBB's terms. Linked from the footer and from
     the donation form's "Questions about giving". */
  {
    id: "donation",
    route: "/donation-policy",
    title: "Donation Policy",
    status: "placeholder",
    effectiveDate: null,
    lastUpdated: null,
    intro: [],
    sections: [],
    contactReference: null,
    relatedPolicies: ["privacy", "terms"],
    metaDescription: "How donations to Rising Beyond Borders are received, used, acknowledged and refunded.",
    pending:
      "Our donation policy is being finalised. It will explain how donations are received and used, how gifts to appeals are applied, how you are sent confirmation of your gift, and how to ask about a refund. If you have a question about giving in the meantime, please visit our Contact page.",
    /* The sections RBB's text is expected to cover — never rendered. */
    outline: [
      { id: "introduction", heading: "About this policy" },
      { id: "use-of-donations", heading: "How donations are used" },
      { id: "appeals", heading: "Appeals and campaigns" },
      { id: "payments", heading: "Payments" },
      { id: "receipts", heading: "Receipts and acknowledgements" },
      { id: "refunds", heading: "Refunds" },
      { id: "personal-information", heading: "Your personal information" },
      { id: "contact", heading: "Questions about giving" },
    ],
  },
  /* Cookies — NO ROUTE (`route: null`). Document 13 §6: a cookie page is
     published only once the technologies the PRODUCTION site uses are
     identified and RBB decides a disclosure is needed. Give it a route
     and approved sections then; until that decision, /cookies is a 404
     rather than a pending page implying a policy exists. */
  {
    id: "cookies",
    route: null,
    title: "Cookies",
    status: "placeholder",
    /* Why there is no page: the production technology has not been
       assessed (docs/TECHNOLOGY_AUDIT.md). */
    assessment: "not-assessed",
    effectiveDate: null,
    lastUpdated: null,
    intro: [],
    sections: [],
    contactReference: null,
    relatedPolicies: ["privacy"],
    pending: null,
    outline: [],
  },
];

/* Every policy's text is the CMS's (2026-10-13: Admin → Policies); the
   published snapshot merges it into these records by id. The id, route
   and title above stay the site's. Without a snapshot no policy is
   published, and each page shows its pending line. */
export const POLICIES = POLICY_RECORDS;

/* What the codebase itself was found to use (Document 13 §6), for RBB and
   counsel — NOT a public statement, and NOT a claim that the site sets no
   cookies: the host, and the font services below, are outside this code
   and have not been verified.
     - site code: no cookies, no localStorage / sessionStorage /
       IndexedDB, no analytics, no tracking pixels, no embedded maps or
       video. Forms (content/forms.js) send with `credentials: "omit"`
       and are all disabled.
     - third-party requests on every page: Google Fonts only
       (fonts.googleapis.com stylesheet, fonts.gstatic.com font files,
       for DM Sans, the brand face). It receives the visitor's IP address
       and browser details. Fontshare is no longer contacted — Satoshi
       was replaced by DM Sans, and with it the second font provider.
       Dancing Script is not requested either (Document 15).
     - hosting / CDN: not yet chosen, so not assessed.
   Document 17 re-checked this by crawling all 48 pre-rendered routes of a
   local production build in a clean browser (scripts/audit-technology.mjs):
   no cookies, no web storage, no service worker, scripts first-party only.
   The full inventory and the audit to repeat on the real host are in
   docs/TECHNOLOGY_AUDIT.md.
   Re-check before a cookie or privacy policy is published, and after any
   analytics, embed, provider or consent tool is added. */
export const TECHNOLOGY_AUDIT = {
  checked: "Document 17 (local production build; host not yet assessed)",
  firstParty: { cookies: false, webStorage: false, serviceWorker: false, analytics: false, embeds: false },
  thirdPartyRequests: ["Google Fonts"],
  hosting: "not assessed",
};

/* ---------------- Lookups ---------------- */
export const policyById = (id) => POLICIES.find((p) => p.id === id);
export const policyByRoute = (route) => POLICIES.find((p) => p.route === withoutTrailingSlash(route));

export const isPublished = (policy) =>
  Boolean(policy?.route) && ["approved", "verified"].includes(policy?.status) && policy.sections.length > 0;

/* Published AND final: approved text that is not a working placeholder.
   Only a final policy shows its text and may be indexed (content/seo.js,
   pages/Policy). A published-but-working policy — the demo Privacy and
   Terms text — keeps its route and its links, so the forms that require a
   privacy link stay as they are (`policyLink`), but the page shows its
   neutral pending line instead of text that reads as a real policy. */
export const isFinalPolicy = (policy) =>
  isPublished(policy) && !isWorkingContent([policy.intro, policy.sections]);

/* Policies that have a page at all — published or pending. The router
   reads this; the footer does not. */
export const routedPolicies = () => POLICIES.filter((p) => p.route);

/* Published policies as links — the footer's legal row. Empty until RBB
   approves one: no placeholder legal links. */
export const publishedPolicyLinks = () =>
  POLICIES.filter(isPublished).map((p) => ({ label: p.title, to: p.route }));

/* One policy as a link, only if published — how the forms reach
   /privacy (content/forms.js). null keeps a form that requires it
   disabled. */
export const policyLink = (id) => {
  const policy = policyById(id);
  return isPublished(policy) ? { label: policy.title, to: policy.route } : null;
};

/* The verified contact method a policy names, or null. */
export const policyContact = (policy) => {
  if (!policy.contactReference) return null;
  const method = verifiedOnly(ORG_CONTACT.methods).find((m) => m.id === policy.contactReference);
  return method ? { label: method.label, value: method.value, href: methodHref(method) } : null;
};

/* ---------------- Page copy ----------------
   PROPOSED interface labels. */
export const POLICY_COPY = {
  kicker: "Site policies",
  effective: "Effective",
  updated: "Last updated",
  contents: "On this page",
  contact: "Questions about this policy",
  related: "Related policies",
};

export default POLICIES;
