import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Header from "./components/Header/Header.jsx";
import Footer from "./components/Footer/Footer.jsx";
import Home from "./pages/Home/Home.jsx";
import DesignSystem from "./pages/DesignSystem/DesignSystem.jsx";
import Components from "./pages/Components/Components.jsx";
import Giving from "./pages/Giving/Giving.jsx";
import Zakat from "./pages/Zakat/Zakat.jsx";
import Gifts from "./pages/Gifts/Gifts.jsx";
import Volunteer from "./pages/Volunteer/Volunteer.jsx";
import Blogs from "./pages/Blogs/Blogs.jsx";
import Contact from "./pages/Contact/Contact.jsx";
import Placeholder from "./pages/Placeholder/Placeholder.jsx";
import NotFound from "./pages/NotFound/NotFound.jsx";
import { NAV } from "./content/index.js";
import { SECTIONS } from "./config/sections.js";

/* Every internal path the site links to that has no page of its own.

   The header's own paths come from the content so a nav entry can never
   404. The rest are listed by hand: the footer used to supply them, but it
   now shows only routed links, and the cards and CTAs across the site
   still point at these slugs. The destination is the stub until someone
   builds the real page, which is the honest state — unbuilt, not broken.
   External links are excluded; they are not ours to route. */
const STUB_PATHS = [
  ...NAV.map((item) => item.to),
  "/about-us",
  "/about-us/careers",
  /* Zakat's own sub-tree now hangs off /giving/zakat rather than off an
     "/islamic-resources" section, which no longer exists: RBB serves and is
     funded by people of every faith and none, so one tradition does not get
     a top-level branch of the site. */
  "/giving/zakat/calculator",
  "/giving/monthly",
  "/giving/gifts-in-wills",
  "/reports",
  "/giving/emergencies/gaza-emergency",
  "/giving/emergencies/sudan-emergency-appeal",
  "/giving/emergencies/yemen-emergency-appeal",
  "/giving/sponsorships/sponsor-an-orphan",
  "/giving/zakat/sadaqah-jariyah",
  "/giving/zakat/give-sadaqah",
  "/giving/great-charity-gifts",
  "/giving/give-the-gift-of-water",
  "/giving/hope-shops",
  "/giving/build-a-well",
  "/giving/medical-camps",
  "/stories",
  "/date",
  "/friends",
  /* Reachable from a CTA rather than from the nav, so not in the list
     above — but just as much a link that must not 404. */
  "/download",
  "/member-circle",
  "/donate",
  "/volunteer",
  "/events",
  "/fundraise",
  "/resources",
].filter((path, i, all) => path !== "/" && all.indexOf(path) === i);

/* Sends the window to the top on navigation.

   The browser restores the previous scroll position on a client-side route
   change, which lands you halfway down a page you have never seen. `auto`
   rather than the document's `smooth`: a page change should be instant,
   and smooth-scrolling the full height of a long page takes seconds. */
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);

  return null;
}

function Shell() {
  return (
    <>
      <ScrollToTop />
      <Header />
      {/* The landmark the skip link and screen-reader rotor look for. */}
      <main id="main" className="pt-[var(--header-h)]">
        <Routes>
          <Route path="/" element={<Home />} />
          {/* Declared before the stubs: the nav lists this path too, and
              the real page has to win over the placeholder. */}
          {/* The hub, and Zakat one level down. /giving was the Zakat
              page itself until RBB's framing was widened; the old path
              still resolves, it just resolves to the hub that offers
              Zakat rather than to Zakat. */}
          <Route path="/giving" element={<Giving />} />
          <Route path="/giving/zakat" element={<Zakat />} />
          <Route path="/gifts" element={<Gifts />} />
          <Route path="/giving/major-giving" element={<Gifts />} />
          <Route path="/get-involved/volunteer" element={<Volunteer />} />
          <Route path="/volunteer" element={<Volunteer />} />
          <Route path="/blogs" element={<Blogs />} />
          <Route path="/contact-us" element={<Contact />} />

          {SECTIONS.designSystemRoute && (
            <Route path="/design-system" element={<DesignSystem />} />
          )}

          {SECTIONS.componentsRoute && (
            <Route path="/components" element={<Components />} />
          )}

          {STUB_PATHS.map((path) => (
            <Route key={path} path={path} element={<Placeholder />} />
          ))}

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
