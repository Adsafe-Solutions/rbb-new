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

   ⚠ WORKING PLACEHOLDER VALUES (Document 27): the email/phone/address
   below use RESERVED, unreachable values — example.org is reserved for
   documentation (RFC 2606) and 555-01xx numbers are fictional — so
   nothing invented here can reach a real person or be mistaken for RBB's
   actual details. Each is labelled "Demo contact detail — replace before
   launch". None of RBB's real contact details exists yet: real email
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
  status: "verified",

  /* Public contact methods. Add one per verified channel:
       { id, type: "email" | "phone" | "other", label, value, href?,
         description?, status }
     `href` defaults to mailto:/tel: from `value` for email and phone. */
  methods: [
    { id: "demo-email", type: "email", label: "Email", value: "hello@example.org", description: "Demo contact detail — replace before launch.", status: "verified" },
    { id: "demo-phone", type: "phone", label: "Phone", value: "+1 555 0100", description: "Demo contact detail — replace before launch.", status: "verified" },
  ],

  /* Where general questions go — a page, a mailto: or a real, tested form
     service. */
  generalInquiry: {
    title: "General inquiries",
    description: "For general questions about Rising Beyond Borders and its work.",
    href: "mailto:hello@example.org",
    label: "hello@example.org",
    status: "verified",
  },

  /* Office or mailing address. Rendered only when verified; a map link
     only if RBB supplies one — never inferred coordinates. */
  office: {
    address: "100 Demo Street",
    city: "Demo City",
    region: null,
    country: "Demo Country",
    mapUrl: null,
    status: "verified",
  },

  /* Official social accounts. `icon` keys map to the glyphs in
     components/Footer/SocialIcon.jsx. Working placeholders below link to
     each platform's own home page, not an account — no demo link can land
     on a real person's or organisation's profile. */
  social: [
    { platform: "instagram", icon: "instagram", label: "Instagram", url: "https://www.instagram.com/", status: "verified" },
    { platform: "facebook", icon: "facebook", label: "Facebook", url: "https://www.facebook.com/", status: "verified" },
    { platform: "x", icon: "x", label: "X", url: null, status: "placeholder" },
    { platform: "linkedin", icon: "linkedin", label: "LinkedIn", url: "https://www.linkedin.com/", status: "verified" },
    { platform: "youtube", icon: "youtube", label: "YouTube", url: "https://www.youtube.com/", status: "verified" },
    { platform: "tiktok", icon: "tiktok", label: "TikTok", url: null, status: "placeholder" },
  ],

  /* Shown only if RBB supplies them and wants them displayed. */
  hours: { value: "Demo — Monday to Friday, 9:00–17:00", status: "verified" },
  responseTime: { value: "Demo — within three working days", status: "verified" },

  /* What every contact surface says while nothing above is verified. */
  pending: "Contact information to be provided by Rising Beyond Borders.",
  inquiryPending: "A general inquiry route will be provided by Rising Beyond Borders.",
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
   the main navigation. Working placeholder roles/sections below (Document
   27), self-labelled "(demo role)"; replace with RBB's approved process
   before launch. */
export const CAREERS = {
  to: "/about-us/careers",
  title: "Careers",
  kicker: "Careers",
  body: "Opportunities to work with Rising Beyond Borders.",
  metaDescription: "Careers and opportunities with Rising Beyond Borders.",
  sections: [
    { id: "why", heading: "Why work with us", body: ["Demo text — Work with a small, committed team alongside communities and partners. Replace with Rising Beyond Borders' approved careers information."] },
    { id: "opportunities", heading: "Open opportunities", empty: "There are no opportunities listed at this time. Careers information to be provided by Rising Beyond Borders." },
    { id: "apply", heading: "How to apply", body: ["Demo — Send a short cover letter and CV to the careers contact below, quoting the role title."] },
    { id: "careers-contact", heading: "Careers contact", body: ["Demo — careers@example.org"] },
  ],
  roles: [
    { id: "demo-role-1", title: "Programme Officer — Education (demo role)", status: "approved" },
    { id: "demo-role-2", title: "Volunteer Coordinator (demo role)", status: "approved" },
    { id: "demo-role-3", title: "Finance Assistant, part-time (demo role)", status: "approved" },
  ],
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
    empty: "Demo text — See open roles and how to apply on our Careers page.",
    cta: { label: "Careers", to: CAREERS.to },
  },
  /* The newsletter card (components/Newsletter): a working placeholder
     photograph until RBB supplies one. */
  newsletter: { kicker: "Stay updated", heading: "News by email", image: RBB_PHOTOS.distribution },
  transparency: {
    kicker: "Transparency",
    heading: "Reports and accountability",
    body: "Demo text — Reports and accountability information on the Transparency page.",
    cta: { label: "View Transparency", to: "/about/transparency" },
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
