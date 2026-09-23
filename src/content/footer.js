/* The footer's link columns, contact block, legal line and social row.

   `external: true` renders the small outbound arrow and the rel/target
   pair — the design marks off-site links rather than letting them look
   like the rest of the list. */
import { BRAND } from "./brand.js";
import { CONTACT_INFO } from "./pages.js";

/* Only paths that have a real page behind them. The site's other slugs
   (the appeals, the Zakat sub-pages, the resource pages) still
   route to the stub — see STUB_PATHS in App.jsx — but the footer does not
   advertise them until there is something to land on. Add the link back
   here the day its page ships. */
export const FOOTER_COLUMNS = [
  {
    heading: "Navigation",
    links: [
      { label: "Home", to: "/" },
      { label: "About", to: "/about-us" },
      { label: "Volunteer", to: "/get-involved/volunteer" },
      { label: "Blogs", to: "/blogs" },
      { label: "Contact", to: "/contact-us" },
    ],
  },
  {
    /* Order matters here. "Zakat & Sadaqah" used to be the first link in
       the only giving column, which framed RBB as a Muslim charity in the
       footer of every page on the site. The hub leads now and Zakat sits
       among the routes it offers — still one click away, no longer the
       heading act. */
    heading: "Giving",
    links: [
      { label: "Ways to Give", to: "/giving" },
      { label: "Charity Gifts", to: "/gifts" },
      { label: "Major Gifts", to: "/giving/major-giving" },
      { label: "Zakat & Sadaqah", to: "/giving/zakat" },
    ],
    /* The small credential under the list — the one line a sceptical
       donor scans a charity's footer for. */
    note: "Registered charity",
  },
];

export const FOOTER_CONTACT = {
  heading: "Contact",
  ...CONTACT_INFO,
};

export const FOOTER_LEGAL = {
  copyright: `${BRAND.name}. All rights reserved.`,
  backToTop: "Back to top",
};

/* Icon keys map to the inline SVGs in components/Footer/SocialIcon.jsx —
   the set is small and fixed, so it is cheaper to draw them than to pull
   in an icon package for six marks. */
export const SOCIALS = [
  { icon: "instagram", label: "Instagram", href: "#" },
  { icon: "facebook", label: "Facebook", href: "#" },
  { icon: "x", label: "X", href: "#" },
  { icon: "linkedin", label: "LinkedIn", href: "#" },
  { icon: "youtube", label: "YouTube", href: "#" },
  { icon: "tiktok", label: "TikTok", href: "#" },
];
