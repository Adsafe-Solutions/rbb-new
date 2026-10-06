/* The site's information architecture — Document 01, V1 sitemap.

   ONE tree, read by everything that needs to know what pages exist: the
   header's dropdowns, the mobile menu, the footer, the section hub pages,
   breadcrumbs, the router and the document titles. Add a page here and it
   gets a route, a title and a place in the menus; nothing else to edit.

   `label` is what the menus say. `title` is the page's own heading and
   document title, when that needs to be longer than the menu has room
   for. Omit it and the label is the title.

   `section` marks a page whose content lives as a section of its parent
   page rather than a page of its own (Document 03 puts Who We Are,
   Mission & Vision and Values on /about). Its URL still works — the router
   forwards it to the section — so the menus, bookmarks and shared links
   stay as they are, and splitting a section back out into its own page
   later is deleting one field.

   `description` is the page's meta description, where it has one; pages
   without fall back to the site description (content/site.js). No figure
   or place goes in one that the page itself cannot stand behind.

   ⚠ `to` values are the public URLs. Changing one breaks every link to
   it from outside the site — add a redirect in config/routes.js when you
   do. */

import { GET_INVOLVED } from "./getInvolved.js";
import { CONTACT_COPY } from "./contact.js";
import { routedPolicies } from "./policies.js";
import { APPEAL_KINDS, appealPath, appealsOf } from "./appeals.js";

/* An entry with `children` whose own parent is a section is a GROUP: the
   dropdown draws it as a column — its label as a heading linking to its
   own page, its children under it — and the mobile menu indents it. One
   level of grouping only; the menus draw no deeper. */

export const IMPACT_SECTION = {
  label: "Our Impact",
  to: "/impact",
  description:
    "How Rising Beyond Borders works towards sustainable growth and lasting change across its four program areas.",
  children: [
    { label: "Impact at a Glance", to: "/impact/at-a-glance", section: "/impact#at-a-glance" },
    {
      label: "Our Approach",
      to: "/impact/our-approach",
      description:
        "How Rising Beyond Borders works to empower communities for sustainable growth and lasting change.",
    },
    { label: "Impact Stories", to: "/impact/stories", section: "/impact#stories" },
    {
      label: "Where We Work",
      to: "/impact/where-we-work",
      description: "Where the work of Rising Beyond Borders reaches, by country and region.",
    },
  ],
};

/* Our Impact is a group inside About Us. Its pages keep their /impact
   addresses — they are public URLs — so only the menu moved. */
export const ABOUT_SECTION = {
  label: "About Us",
  to: "/about",
  children: [
    IMPACT_SECTION,
    { label: "Who We Are", to: "/about/who-we-are", section: "/about#who-we-are" },
    { label: "Mission & Vision", to: "/about/mission-vision", section: "/about#mission-vision" },
    { label: "Our Values", to: "/about/values", section: "/about#values" },
    { label: "How We Work", to: "/about/how-we-work" },
    /* A section of /about since the About pages were consolidated. The
       old address forwards to the section. */
    { label: "Transparency & Financials", to: "/about/transparency", section: "/about#transparency" },
    {
      label: "Our Team",
      to: "/about/team",
      description: "The people behind the work of Rising Beyond Borders.",
    },
  ],
};

export const WORK_SECTION = {
  label: "Our Work",
  to: "/work",
  children: [
    { label: "Education", to: "/work/education" },
    { label: "Health & Wellbeing", to: "/work/health-wellbeing" },
    { label: "Livelihoods", to: "/work/livelihoods" },
    { label: "Community Support", to: "/work/community-support" },
  ],
};

/* Appeals — what the Donate page became. Its two groups and every appeal
   in them come from content/appeals.js: add an appeal there and it is in
   this menu, routed, and built from the shared appeal template. */
export const APPEALS_SECTION = {
  label: "Appeals",
  to: "/appeals",
  description: "Emergency appeals and campaigns from Rising Beyond Borders, and how to give.",
  children: APPEAL_KINDS.map((kind) => ({
    label: kind.label,
    to: kind.to,
    description: kind.description,
    children: appealsOf(kind.id).map((appeal) => ({ label: appeal.title, to: appealPath(appeal) })),
  })),
};

/* Impact Stories here is the stories directory, which keeps its /stories
   address; Our Impact's entry of the same name is that page's section. */
export const MEDIA_SECTION = {
  label: "Media Center",
  to: "/media",
  children: [
    { label: "Latest News", to: "/media/news" },
    { label: "Impact Stories", to: "/stories" },
    { label: "Blogs", to: "/media/blogs" },
    { label: "Events", to: "/media/events" },
  ],
};

/* The ways to take part come from content/getInvolved.js — the one
   source for their names, addresses and descriptions (Document 06). */
export const GET_INVOLVED_SECTION = {
  label: "Get Involved",
  to: "/get-involved",
  description: "The ways to take part in the work of Rising Beyond Borders: volunteer, join a fellowship, partner with us or travel with us.",
  children: GET_INVOLVED.paths.map((path) => ({
    label: path.title,
    to: path.to,
    description: path.metaDescription,
  })),
};

/* Contact Us is its own page and its own top-level link — separate from
   Get Involved, which is the ways to take part. */
export const CONTACT_PAGE = {
  label: "Contact Us",
  title: CONTACT_COPY.heading,
  to: "/contact",
  description: CONTACT_COPY.metaDescription,
};

/* Pages that exist but are in no menu — routed and titled all the same. */
const UNLISTED_PAGES = [
  {
    label: "All Projects",
    to: "/work/projects",
    parent: { label: WORK_SECTION.label, to: WORK_SECTION.to },
  },
];

/* The primary navigation, in screen order. An entry with `children` is
   a dropdown; one without is a direct link. Home is the logo. */
export const NAV = [
  ABOUT_SECTION,
  WORK_SECTION,
  APPEALS_SECTION,
  MEDIA_SECTION,
  GET_INVOLVED_SECTION,
  CONTACT_PAGE,
];

/* The one filled button in the header. Not a page: it opens the donation
   popup (components/DonateDialog). `to` is where it goes without
   JavaScript, and where the popup sends anyone who wants to choose an
   appeal. */
export const NAV_CTA = { label: "Donate", to: APPEALS_SECTION.to };

/* The policy pages (content/policies.js, Document 13) — here so each
   gets a route and a title. They are NOT all linked: the footer shows
   only the published ones (FOOTER_LEGAL). */
export const LEGAL_PAGES = routedPolicies().map((p) => ({
  label: p.title,
  to: p.route,
  description: p.metaDescription,
}));

/* Every page above as one flat list — what the router and the title hook
   read. Each entry carries the section or group it sits in as `parent`,
   which is what the breadcrumb links back to. A page listed twice keeps
   its first entry. */
const flatten = (entries, parent) =>
  entries.flatMap((entry) => [
    parent && !entry.parent ? { ...entry, parent } : entry,
    ...flatten(entry.children ?? [], { label: entry.label, to: entry.to }),
  ]);

export const PAGES = flatten([...NAV, ...UNLISTED_PAGES, ...LEGAL_PAGES]).filter(
  (page, i, all) => all.findIndex((p) => p.to === page.to) === i
);

export default NAV;
