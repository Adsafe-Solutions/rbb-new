/* Contact & organization — Document 08. ONE source for how to reach
   Rising Beyond Borders: /contact, the footer, the Get Involved pages'
   "Get in touch" and the Careers page all read from here.

   Editorial status, for the people maintaining this file — never shown:
     "verified"        confirmed by RBB, or a working placeholder cleared
                       to show while RBB's own value is not yet supplied
                       (Document 27) — see the reserved-value note below
     "pending-review"  supplied, awaiting RBB's final check
     "placeholder"     nothing supplied yet

   ⚠ ONLY "verified" entries with a value are ever rendered as contact
   information (see `verifiedOnly`). Nothing else reaches the page — not a
   pending email, not a half-confirmed address.

   ⚠ PENDING (content brief, 2026-10-04): the reserved demo values that
   stood in here (example.org, 555-01xx, "Demo Street", platform home
   pages) are gone. A contact detail is not something a placeholder can
   stand in for — a visitor may try to use it — so every entry below is
   empty and every contact surface shows its pending line until RBB
   supplies the real value (decisions D17–D19). None of RBB's real
   contact details exists yet: real email
   addresses, phone numbers, office or mailing addresses, map locations,
   social accounts, office hours, response times, departments, form
   recipients or careers/hiring contacts must all come from RBB. The site
   this replaced showed another charity's mailbox, phone, address and
   hours; they never come back.

   ⚠ No form without a real, tested destination: a form that "sends" to
   nowhere tells people they have reached RBB when they have not. */

import { RBB_PHOTOS } from "./photos.js";

export const verifiedOnly = (entries) =>
  entries.filter((entry) => entry.status === "verified" && (entry.value || entry.url));

export const ORG_CONTACT = {
  status: "placeholder",

  /* Public contact methods. Add one per verified channel:
       { id, type: "email" | "phone" | "other", label, value, href?,
         description?, status }
     `href` defaults to mailto:/tel: from `value` for email and phone. */
  methods: [],

  /* Where general questions go — a page, a mailto: or a real, tested form
     service. */
  generalInquiry: {
    title: "General inquiries",
    description: "Whether your question is about our work, volunteering, partnership, fundraising or giving, we would be glad to hear from you.",
    href: null,
    label: null,
    status: "placeholder",
  },

  /* Office or mailing address. Rendered only when verified; a map link
     only if RBB supplies one — never inferred coordinates. */
  office: {
    address: null,
    city: null,
    region: null,
    country: null,
    mapUrl: null,
    status: "placeholder",
  },

  /* Official social accounts. `icon` keys map to the glyphs in
     components/Footer/SocialIcon.jsx. Each stays empty until RBB supplies
     its real account URL — never a platform's home page (decision D18). */
  /* ⚠ TEMPORARY (RBB's call, Oct 2026): the platforms' ROOT addresses,
     so the footer's icons show while RBB's real account URLs are found.
     Replace each `url` with the RBB account ("https://www.instagram.com/
     <handle>"). Until then the release markers flag every one ("platform
     home page as social link") and release:check stays BLOCKED, so they
     cannot reach production by accident. TikTok stays off until RBB
     says it has an account. */
  social: [
    { platform: "instagram", icon: "instagram", label: "Instagram", url: "https://www.instagram.com/", status: "verified" },
    { platform: "facebook", icon: "facebook", label: "Facebook", url: "https://www.facebook.com/", status: "verified" },
    { platform: "x", icon: "x", label: "X", url: "https://x.com/", status: "verified" },
    { platform: "linkedin", icon: "linkedin", label: "LinkedIn", url: "https://www.linkedin.com/", status: "verified" },
    { platform: "youtube", icon: "youtube", label: "YouTube", url: "https://www.youtube.com/", status: "verified" },
    { platform: "tiktok", icon: "tiktok", label: "TikTok", url: null, status: "placeholder" },
  ],

  /* Shown only if RBB supplies them and wants them displayed. */
  hours: { value: null, status: "placeholder" },
  responseTime: { value: null, status: "placeholder" },

  /* What every contact surface says while nothing above is verified. */
  /* No visitor-facing pending line: with no verified channel, the
     contact surfaces leave the slot out (Footer, ContactMethods,
     QuestionsPanel) rather than announce what is missing. */
  pending: null,
  inquiryPending: null,
};

/* A method's link: its own `href`, else mailto:/tel: from its value. */
export const methodHref = (method) =>
  method.href ??
  (method.type === "email"
    ? `mailto:${method.value}`
    : method.type === "phone"
      ? `tel:${method.value.replace(/[^\d+]/g, "")}`
      : undefined);

/* The route a form offers when a submission fails (Document 12) — the
   first VERIFIED contact method with a link, or null. Never a guess. */
export const alternativeContact = () => {
  const method = verifiedOnly(ORG_CONTACT.methods).find((m) => methodHref(m));
  return method ? { label: method.value ?? method.label, href: methodHref(method) } : null;
};

/* The office as display lines, or null when there is nothing verified. */
export const officeLines = () => {
  const o = ORG_CONTACT.office;
  if (o.status !== "verified" || !o.address) return null;
  return [o.address, [o.city, o.region].filter(Boolean).join(", "), o.country].filter(Boolean);
};

/* Careers — reconciled at the existing /about-us/careers (Document 08
   keeps that address rather than opening a second careers page). Not in
   the main navigation. No roles and no application route until RBB
   supplies them (decision D19): an invented vacancy or careers inbox is
   something a real applicant would act on. */
export const CAREERS = {
  to: "/about-us/careers",
  title: "Careers",
  kicker: "Careers",
  body: "Opportunities to work with Rising Beyond Borders.",
  metaDescription: "Careers and opportunities with Rising Beyond Borders.",
  sections: [
    { id: "why", heading: "Why work with us", body: ["Working with Rising Beyond Borders means contributing to work in education, health and wellbeing, livelihoods and community support — work that is inclusive by design and shaped by the communities it serves."] },
    { id: "opportunities", heading: "Open opportunities", empty: "There are no open opportunities at the moment." },
    { id: "apply", heading: "How to apply", body: ["Each opportunity sets out what the role involves and how to apply."] },
  ],
  roles: [],
  closing: {
    heading: "Explore Rising Beyond Borders.",
    ctas: {
      primary: { label: "About Us", to: "/about" },
      secondary: { label: "Contact", to: "/contact" },
    },
  },
};

/* ---------------- /contact page copy ----------------
   Headings and labels are PROPOSED interface copy. */
export const CONTACT_COPY = {
  kicker: "Contact",
  heading: "Contact Us",
  body: "How to reach Rising Beyond Borders.",
  metaDescription: "How to get in touch with Rising Beyond Borders.",
  methods: { kicker: "Contact details", heading: "Ways to reach us", email: "Email", phone: "Phone", office: "Address", map: "View map", hours: "Hours", response: "Response time", social: "Follow us" },
  inquiry: { kicker: "General inquiries", heading: "Questions about our work" },
  getInvolved: { kicker: "Get involved", heading: "Looking to take part?" },
  careers: {
    kicker: "Careers",
    heading: "Work with us",
    empty: "Opportunities to work with Rising Beyond Borders will be listed on the Careers page.",
    cta: { label: "Careers", to: CAREERS.to },
  },
  /* The newsletter card (components/Newsletter): a working placeholder
     photograph until RBB supplies one. */
  newsletter: { kicker: "Stay updated", heading: "News by email", image: RBB_PHOTOS.distribution },
  transparency: {
    kicker: "Transparency",
    heading: "Reports and accountability",
    body: "How our work is run, and how resources are used.",
    cta: { label: "View Transparency", to: "/about#transparency" },
  },
  closing: {
    heading: "Learn more about our work.",
    ctas: {
      primary: { label: "Explore Our Work", to: "/work" },
      secondary: { label: "Get Involved", to: "/get-involved" },
    },
  },
};

export default ORG_CONTACT;
