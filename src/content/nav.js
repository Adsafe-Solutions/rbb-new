/* The site's information architecture — Document 01, V1 sitemap.

   ONE tree, read by everything that needs to know what pages exist: the
   header's dropdowns, the mobile menu, the footer, the section hub pages,
   breadcrumbs, the router and the document titles. Add a page here and it
   gets a route, a title and a place in the menus; nothing else to edit.

   `label` is what the menus say. `title` is the page's own heading and
   document title, when that needs to be longer than the menu has room for
   ("Transparency" in the dropdown, "Transparency & Financials" on the
   page). Omit it and the label is the title.

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
   it from outside the site — add a redirect in App.jsx when you do. */

import { GET_INVOLVED } from "./getInvolved.js";
import { CONTACT_COPY } from "./contact.js";
import { routedPolicies } from "./policies.js";

export const ABOUT_SECTION = {
  label: "About Us",
  to: "/about",
  children: [
    { label: "Who We Are", to: "/about/who-we-are", section: "/about#who-we-are" },
    { label: "Mission & Vision", to: "/about/mission-vision", section: "/about#mission-vision" },
    { label: "Our Values", to: "/about/values", section: "/about#values" },
    {
      label: "Our Team",
      to: "/about/team",
      description: "The people behind the work of Rising Beyond Borders.",
    },
    /* A section of /about since the About pages were consolidated (two
       pages: About and Our Team). The old address forwards to the
       section, and so do its own anchors' old links. */
    { label: "Transparency", title: "Transparency & Financials", to: "/about/transparency", section: "/about#transparency" },
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
    { label: "All Projects", to: "/work/projects" },
  ],
};

export const IMPACT_SECTION = {
  label: "Our Impact",
  to: "/impact",
  description:
    "How Rising Beyond Borders works towards sustainable growth and lasting change across its four program areas.",
  children: [
    { label: "Impact at a Glance", to: "/impact/at-a-glance", section: "/impact#at-a-glance" },
    {
      label: "Where We Work",
      to: "/impact/where-we-work",
      description: "Where the work of Rising Beyond Borders reaches, by country and region.",
    },
    {
      label: "Our Approach",
      to: "/impact/our-approach",
      description:
        "How Rising Beyond Borders works to empower communities for sustainable growth and lasting change.",
    },
    { label: "Impact Stories", to: "/impact/stories", section: "/impact#stories" },
  ],
};

/* The four ways to take part come from content/getInvolved.js — the one
   source for their names, addresses and descriptions (Document 06). Donate
   is one of them AND the header's own button; it lives at
   /get-involved/donate, and the old /donate forwards there (App.jsx), so
   there is one donation page and every "Donate" on the site reaches it. */
export const GET_INVOLVED_SECTION = {
  label: "Get Involved",
  to: "/get-involved",
  description: "The ways to take part in the work of Rising Beyond Borders: donate, volunteer, partner or fundraise.",
  children: GET_INVOLVED.paths.map((path) => ({
    label: path.title,
    to: path.to,
    description: path.metaDescription,
  })),
};

export const STORIES_PAGE = { label: "Stories", to: "/stories" };
export const CONTACT_PAGE = {
  label: "Contact",
  title: CONTACT_COPY.heading,
  to: "/contact",
  description: CONTACT_COPY.metaDescription,
};
export const DONATE_PAGE = GET_INVOLVED_SECTION.children.find((c) => c.to === "/get-involved/donate");

/* The primary navigation, in screen order. An entry with `children` is a
   dropdown; one without is a direct link. Home is the logo, and Contact
   lives in the footer — the document keeps the top level to five items. */
export const NAV = [
  ABOUT_SECTION,
  WORK_SECTION,
  IMPACT_SECTION,
  GET_INVOLVED_SECTION,
  STORIES_PAGE,
];

/* The one filled button in the header. */
export const NAV_CTA = DONATE_PAGE;

/* The policy pages (content/policies.js, Document 13) — here so each
   gets a route and a title. They are NOT all linked: the footer shows
   only the published ones (FOOTER_LEGAL). */
export const LEGAL_PAGES = routedPolicies().map((p) => ({
  label: p.title,
  to: p.route,
  description: p.metaDescription,
}));

/* Every page above as one flat list — what the router and the title hook
   read. Each child carries its section as `parent`, which is what the
   breadcrumb links back to. Donate appears twice in the tree (its own
   page and a Get Involved item); the first, parentless entry wins. */
const flatten = (entries) =>
  entries.flatMap((entry) => [
    entry,
    ...(entry.children ?? []).map((child) => ({
      ...child,
      parent: { label: entry.label, to: entry.to },
    })),
  ]);

export const PAGES = flatten([CONTACT_PAGE, ...NAV, ...LEGAL_PAGES]).filter(
  (page, i, all) => all.findIndex((p) => p.to === page.to) === i
);

export default NAV;
