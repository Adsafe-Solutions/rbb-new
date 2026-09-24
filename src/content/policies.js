/* Privacy, legal & site policies — Document 13. ONE source for every
   policy the site may publish: the /privacy, /terms and /accessibility
   pages, the footer's legal links and the forms' privacy link all read
   from here.

   ⚠ Nothing here is legal text, and none may be written on RBB's behalf:
   no privacy wording, rights, retention periods, service providers,
   cookie behaviour, security promises, governing law, jurisdiction,
   charity or tax status, registration numbers, audit or certification,
   or accessibility-conformance claim. Policy text comes from RBB, reviewed
   by counsel, and is pasted in as supplied.

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

import { ORG_CONTACT, methodHref, verifiedOnly } from "./contact.js";

/* WORKING placeholder policy text (Document 27). Each page is structured
   like a real policy so it can be reviewed, and every one opens by saying
   on its face that it is NOT RBB's policy — the final text comes from RBB
   and its counsel. No date, provider, retention period, right or
   conformance claim below is RBB's. */
const POLICY_NOTE =
  "Demo text — this is NOT Rising Beyond Borders' policy. It shows how the page will look; the final text will be supplied by Rising Beyond Borders and reviewed by counsel.";
const working = (sections) => ({
  status: "approved",
  effectiveDate: "2026-09-24",
  lastUpdated: "2026-09-24",
  intro: [POLICY_NOTE],
  sections,
});

const WORKING_POLICIES = {
  privacy: working([
    { id: "introduction", heading: "Introduction and scope", body: ["Demo — This policy explains how personal information is handled when you use this website."] },
    { id: "information-collected", heading: "Information we collect", body: ["Demo — Details you give us through our forms and donation checkout, such as your name and email address."], items: ["Demo — contact form messages", "Demo — newsletter sign-ups", "Demo — donation details (payments are processed by Razorpay)"] },
    { id: "use", heading: "How we use information", body: ["Demo — To answer your message, process your donation and, if you ask, send you news."] },
    { id: "sharing", heading: "Sharing and service providers", body: ["Demo — We use service providers to send email (Resend) and process payments (Razorpay)."] },
    { id: "retention", heading: "Data retention", body: ["Demo — Retention periods to be set by Rising Beyond Borders."] },
    { id: "rights", heading: "Your rights and choices", body: ["Demo — You can ask to see, correct or delete your information."] },
    { id: "contact", heading: "Privacy questions", body: ["Demo — Contact us at hello@example.org."] },
  ]),
  terms: working([
    { id: "acceptable-use", heading: "Acceptable use", body: ["Demo — Use this website lawfully and do not try to disrupt it."] },
    { id: "intellectual-property", heading: "Intellectual property", body: ["Demo — Text and images on this site belong to their owners."] },
    { id: "external-links", heading: "External links", body: ["Demo — We are not responsible for other websites we link to."] },
    { id: "changes", heading: "Changes to these terms", body: ["Demo — We may update these terms; the date above shows the latest version."] },
  ]),
  accessibility: working([
    { id: "commitment", heading: "Our commitment", body: ["Demo — We want this website to be usable by everyone."] },
    { id: "limitations", heading: "Known limitations", body: ["Demo — Some older documents may not be fully accessible."] },
    { id: "feedback", heading: "Feedback and contact", body: ["Demo — Tell us about any problem at hello@example.org."] },
  ]),
  /* No `cookies` entry on purpose — see the cookies record below. */
};

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
    relatedPolicies: ["terms", "accessibility"],
    metaDescription: "The Rising Beyond Borders privacy policy.",
    /* Document 13's own wording for this state. */
    pending: "Privacy policy information will be provided and reviewed by Rising Beyond Borders.",
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
    relatedPolicies: ["privacy", "accessibility"],
    metaDescription: "The terms of use for the Rising Beyond Borders website.",
    pending: "Website terms will be provided and reviewed by Rising Beyond Borders.",
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
  {
    id: "accessibility",
    route: "/accessibility",
    title: "Accessibility",
    status: "placeholder",
    effectiveDate: null,
    lastUpdated: null,
    intro: [],
    sections: [],
    contactReference: null,
    relatedPolicies: ["privacy", "terms"],
    metaDescription: "Accessibility and the Rising Beyond Borders website.",
    pending: "Accessibility information will be provided and reviewed by Rising Beyond Borders.",
    /* Document 13 §7. No standard, conformance level or certification is
       claimed unless RBB verifies and approves it. */
    outline: [
      { id: "commitment", heading: "Our commitment" },
      { id: "limitations", heading: "Known limitations" },
      { id: "feedback", heading: "Feedback and contact" },
      { id: "updates", heading: "Updates to this statement" },
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

/* Each policy that has working text takes it; the rest keep the pending
   state above. */
export const POLICIES = POLICY_RECORDS.map((p) => (WORKING_POLICIES[p.id] ? { ...p, ...WORKING_POLICIES[p.id] } : p));

/* What the codebase itself was found to use (Document 13 §6), for RBB and
   counsel — NOT a public statement, and NOT a claim that the site sets no
   cookies: the host, and the font services below, are outside this code
   and have not been verified.
     - site code: no cookies, no localStorage / sessionStorage /
       IndexedDB, no analytics, no tracking pixels, no embedded maps or
       video. Forms (content/forms.js) send with `credentials: "omit"`
       and are all disabled.
     - third-party requests on every page: Fontshare (api.fontshare.com
       stylesheet, cdn.fontshare.com font files, for Satoshi) and Google
       Fonts (fonts.googleapis.com stylesheet, for the DM Sans fallback —
       its font files on fonts.gstatic.com load only if Satoshi fails).
       Each receives the visitor's IP address and browser details.
       Dancing Script is no longer requested (Document 15).
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
  thirdPartyRequests: ["Fontshare", "Google Fonts"],
  hosting: "not assessed",
};

/* ---------------- Lookups ---------------- */
export const policyById = (id) => POLICIES.find((p) => p.id === id);
export const policyByRoute = (route) => POLICIES.find((p) => p.route === route);

export const isPublished = (policy) =>
  Boolean(policy?.route) && ["approved", "verified"].includes(policy?.status) && policy.sections.length > 0;

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
