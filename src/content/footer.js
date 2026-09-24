/* The footer's link columns, legal line and social row.

   Paths come from nav.js, so the footer can never point at a page the
   router does not know about. `external: true` renders the small outbound
   arrow and the rel/target pair — the design marks off-site links rather
   than letting them look like the rest of the list. */
import { BRAND } from "./brand.js";
import { ORG_CONTACT, verifiedOnly } from "./contact.js";
import {
  ABOUT_SECTION,
  CONTACT_PAGE,
  DONATE_PAGE,
  GET_INVOLVED_SECTION,
  IMPACT_SECTION,
  STORIES_PAGE,
  WORK_SECTION,
} from "./nav.js";
import { publishedPolicyLinks } from "./policies.js";

const child = (section, to) => section.children.find((c) => c.to === to);
const link = ({ label, to }) => ({ label, to });

export const FOOTER_COLUMNS = [
  {
    heading: "Explore",
    links: [ABOUT_SECTION, WORK_SECTION, IMPACT_SECTION, STORIES_PAGE].map(link),
  },
  {
    heading: "Get Involved",
    links: [
      DONATE_PAGE,
      child(GET_INVOLVED_SECTION, "/get-involved/volunteer"),
      child(GET_INVOLVED_SECTION, "/get-involved/partner"),
      child(GET_INVOLVED_SECTION, "/get-involved/fundraise"),
    ].map(link),
  },
  {
    heading: "Organization",
    links: [
      child(ABOUT_SECTION, "/about/team"),
      child(ABOUT_SECTION, "/about/transparency"),
      CONTACT_PAGE,
    ].map(link),
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
  links: publishedPolicyLinks(),
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

export const FOOTER_CONTACT = {
  methods: verifiedOnly(ORG_CONTACT.methods),
  pending: ORG_CONTACT.pending,
};
