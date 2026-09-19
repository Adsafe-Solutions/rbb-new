/* Top navigation. The nav is a floating pill group in the middle of the
   header — see components/Header. Order here is order on screen, and
   mirrors muslimhands.ca's primary navigation.

   `to` is a router path. An entry with no page of its own still gets a
   route: App.jsx falls through to the stub rather than 404-ing a link the
   header is showing. */
export const NAV = [
  { label: "Home", to: "/" },
  { label: "Giving", to: "/giving" },
  { label: "Gifts", to: "/gifts" },
  { label: "Get Involved", to: "/get-involved" },
  { label: "About", to: "/about-us" },
];

export default NAV;
