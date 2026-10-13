/* The footer's link columns, legal line and social row.

   Paths come from nav.js, so the footer can never point at a page the
   router does not know about. `external: true` renders the small outbound
   arrow and the rel/target pair — the design marks off-site links rather
   than letting them look like the rest of the list. */
import { BRAND } from "./brand.js";
import { CAREERS, ORG_CONTACT, verifiedOnly } from "./contact.js";
import {
  ABOUT_SECTION,
  APPEALS_SECTION,
  CONTACT_PAGE,
  GET_INVOLVED_SECTION,
  IMPACT_SECTION,
  MEDIA_SECTION,
  WORK_SECTION,
} from "./nav.js";
import { publishedPolicyLinks } from "./policies.js";

const child = (section, to) => section.children.find((c) => c.to === to);
/* A page that lives as a section of its parent links straight to the
   section, not through the old address's redirect. */
const link = ({ label, to, section }) => ({ label, to: section ?? to });

/* Legal pages that exist, under their short footer names. */
const LEGAL_SHORT = { "/privacy": "Privacy", "/terms": "Terms", "/donation-policy": "Donation Policy" };
const legalLinks = () =>
  publishedPolicyLinks().map((l) => ({ label: LEGAL_SHORT[l.to] ?? l.label, to: l.to }));

export const FOOTER_COLUMNS = [
  {
    heading: "Explore",
    links: [ABOUT_SECTION, WORK_SECTION, IMPACT_SECTION, APPEALS_SECTION, MEDIA_SECTION].map(link),
  },
  {
    heading: "Get Involved",
    links: [{ label: "Donate", to: APPEALS_SECTION.to }, ...GET_INVOLVED_SECTION.children].map(link),
  },
  /* Chapters of the one About page — links to its sections, not new
     pages. Transparency stays here too: it was in the footer before, and
     for a charity it is a link people look for. */
  {
    heading: "About",
    links: [
      { label: "Who We Are", to: "/about#who-we-are" },
      { label: "Mission & Vision", to: "/about#mission-vision" },
      { label: "Our Values", to: "/about#values" },
      link(child(ABOUT_SECTION, "/about/how-we-work")),
      link(child(ABOUT_SECTION, "/about/transparency")),
      { label: "Meet the Team", to: "/about/team" },
    ],
  },
  /* Careers (2026-10-13): the page at its long-standing address
     (contact.js CAREERS.to), where open roles take applications. */
  {
    heading: "Information",
    links: [{ label: "Contact Us", to: CONTACT_PAGE.to }, { label: "Careers", to: CAREERS.to }, ...legalLinks()],
  },
];

/* The footer's contact block reads FOOTER_CONTACT below. It used to carry
   another charity's mailbox, phone and address, which on every page read
   as RBB's own; now it shows only what content/contact.js marks verified,
   and a restrained pending line until then. */

/* Legal links: ONLY policies RBB has approved and published (Document
   13). None yet, so the row is empty — no placeholder legal links. */
export const FOOTER_LEGAL = {
  copyright: `${BRAND.fullName}. All rights reserved.`,
  links: legalLinks(),
  backToTop: "Back to top",
};

/* Social accounts and contact methods come from content/contact.js —
   the one source for how to reach RBB. Only verified entries with a URL
   or value arrive here, so nothing unconfirmed ever renders; with none,
   the footer shows the restrained pending line instead. */
export const SOCIALS = verifiedOnly(ORG_CONTACT.social).map(({ icon, label, url }) => ({
  icon,
  label,
  href: url,
}));

/* The footer's newsletter sign-up (components/Footer) — the same
   newsletter form as everywhere else (content/forms.js `newsletter`),
   shown only when that form is ready. PROPOSED copy: no frequency or
   content promise beyond "updates". */
export const FOOTER_SUBSCRIBE = {
  heading: "Subscribe to receive updates",
  body: "News, stories and events from our work, straight to your inbox.",
};

export const FOOTER_CONTACT = {
  methods: verifiedOnly(ORG_CONTACT.methods),
  pending: ORG_CONTACT.pending,
};
