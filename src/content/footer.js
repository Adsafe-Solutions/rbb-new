/* The footer's link columns, its signup block and the social row.

   `external: true` renders the small outbound arrow and the rel/target
   pair — the design marks off-site links rather than letting them look
   like the rest of the list. */
import { BRAND } from "./brand.js";

/* Only paths that have a real page behind them. The site's other slugs
   (the appeals, the Islamic-giving sub-pages, the resource pages) still
   route to the stub — see STUB_PATHS in App.jsx — but the footer does not
   advertise them until there is something to land on. Add the link back
   here the day its page ships. */
export const FOOTER_COLUMNS = [
  {
    heading: "Giving",
    links: [
      { label: "Zakat & Sadaqah", to: "/giving" },
      { label: "Charity Gifts", to: "/gifts" },
      { label: "Major Gifts", to: "/giving/major-giving" },
    ],
  },
  {
    heading: "Organisation",
    links: [
      { label: "Volunteer", to: "/get-involved/volunteer" },
      { label: "Blogs", to: "/blogs" },
      { label: "Contact Us", to: "/contact-us" },
    ],
  },
];

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

/* The footer's signup block and the heading over the social row. Copy
   lives here rather than in the component, like everything else in
   src/content/. */
export const FOOTER_SIGNUP = {
  heading: `Get the latest from ${BRAND.name}.`,
  placeholder: "Email Address",
  cta: "Subscribe",
  done: "Thanks — you're on the list.",
};

export const FOOTER_SOCIAL_HEADING = "Follow us";
