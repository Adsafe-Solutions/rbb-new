import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useParams,
} from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
import MotionProvider from "./animations/MotionProvider.jsx";
import { jumpTo } from "./animations/lenis.js";
import Header from "./components/Header/Header.jsx";
import Footer from "./components/Footer/Footer.jsx";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary.jsx";
import MarkSprite from "./components/Mark/MarkSprite.jsx";
import Home from "./pages/Home/Home.jsx";
import Giving from "./pages/Giving/Giving.jsx";
import Zakat from "./pages/Zakat/Zakat.jsx";
import Gifts from "./pages/Gifts/Gifts.jsx";
import Contact from "./pages/Contact/Contact.jsx";
import About from "./pages/About/About.jsx";
import Placeholder from "./pages/Placeholder/Placeholder.jsx";
import NotFound from "./pages/NotFound/NotFound.jsx";
import Work from "./pages/Work/Work.jsx";
import Program from "./pages/Program/Program.jsx";
import Projects from "./pages/Projects/Projects.jsx";
import ProjectDetail from "./pages/ProjectDetail/ProjectDetail.jsx";
import Impact from "./pages/Impact/Impact.jsx";
import WhereWeWork from "./pages/WhereWeWork/WhereWeWork.jsx";
import Approach from "./pages/Approach/Approach.jsx";
import GetInvolvedPage from "./pages/GetInvolvedPage/GetInvolvedPage.jsx";
import InvolvePath from "./pages/InvolvePath/InvolvePath.jsx";
import Donate from "./pages/Donate/Donate.jsx";
import Policy from "./pages/Policy/Policy.jsx";
import StoriesHub from "./pages/StoriesHub/StoriesHub.jsx";
import StoryDetail from "./pages/StoryDetail/StoryDetail.jsx";
import Careers from "./pages/Careers/Careers.jsx";
import Team from "./pages/Team/Team.jsx";
import TeamProfile from "./pages/TeamProfile/TeamProfile.jsx";
import useSeo from "./hooks/useSeo.js";
import { canonicalPath, routeMeta } from "./content/seo.js";
import { pageView } from "./lib/analytics.js";
import { GET_INVOLVED, PAGES, POLICIES, PROGRAMS, SITE } from "./content/index.js";
import { SECTIONS } from "./config/sections.js";
import ThemeSwitcher from "./components/ThemeSwitcher/ThemeSwitcher.jsx";
import { DEV_TOOLS_IN_BUILD } from "./config/env.js";
import { LEGACY_PATHS, REDIRECTS, STUB_PATHS } from "./config/routes.js";

/* The pages of the V1 sitemap (content/nav.js) that already have a built
   page behind them. Every other sitemap path renders Placeholder until
   its content arrives — add the page here the day it does, and the nav,
   footer, breadcrumbs and title all follow on their own. */
const BUILT = {
  "/about": About,
  /* /about/transparency is a section of /about now (content/nav.js),
     forwarded like the other About sections. */
  "/about/team": Team,
  "/contact": Contact,
  "/stories": StoriesHub,
  "/work": Work,
  "/impact": Impact,
  "/impact/where-we-work": WhereWeWork,
  "/impact/our-approach": Approach,
  "/work/projects": Projects,
  /* All four program areas share one template; it finds its program by
     the URL (content/work.js). */
  ...Object.fromEntries(PROGRAMS.map((program) => [program.to, Program])),
  "/get-involved": GetInvolvedPage,
  /* The ways to take part share one template; it finds its path by the
     URL (content/getInvolved.js)… */
  ...Object.fromEntries(GET_INVOLVED.paths.map((path) => [path.to, InvolvePath])),
  /* …except Donate, which has a state the others do not and its own page
     (Document 11, content/donation.js). Listed after the spread so it
     wins. */
  "/get-involved/donate": Donate,
  /* The policy pages share one template; each shows RBB's approved text,
     or its pending line until there is some (content/policies.js). A
     policy with no route — Cookies, for now — gets no page at all. */
  ...Object.fromEntries(POLICIES.filter((p) => p.route).map((p) => [p.route, Policy])),
};

/* The two dev tools — the token reference and the component catalogue —
   load on demand, in chunks of their own. Imported statically they were
   in every visitor's bundle (the catalogue carries every legacy component
   and its sample data) although production never routes to them
   (Document 15). A production build without the dev switches does not
   contain them at all (DEV_TOOLS_IN_BUILD, Document 20). */
const DesignSystem = DEV_TOOLS_IN_BUILD
  ? lazy(() => import("./pages/DesignSystem/DesignSystem.jsx"))
  : null;
const Components = DEV_TOOLS_IN_BUILD
  ? lazy(() => import("./pages/Components/Components.jsx"))
  : null;

/* The pages built before the sitemap, by address (config/routes.js
   lists the addresses). */
const LEGACY_PAGES = {
  "/giving": Giving,
  "/giving/zakat": Zakat,
  "/gifts": Gifts,
  "/giving/major-giving": Gifts,
};

/* REDIRECTS and STUB_PATHS live in config/routes.js, where the build's
   pre-renderer and host redirect manifest read them too (Document 15). */

/* Writes a route's metadata — title, description, canonical, robots,
   social tags, structured data — from content/seo.js, for every page that
   does not know more about itself than its route. `title` fills in only
   where the sitemap has none (the dev pages). */
function Titled({ path, title, children }) {
  useSeo(routeMeta(path, { title }));
  return children;
}

/* /blogs/:slug → /stories/:slug. A plain <Navigate to="/stories/:slug">
   would send the literal ":slug"; the param has to be read and put back. */
function PostRedirect() {
  const { slug } = useParams();
  return <Navigate to={`/stories/${slug}`} replace />;
}

/* Sends the window to the top on navigation — or, when the URL carries a
   #section, to that section.

   The browser restores the previous scroll position on a client-side route
   change, which lands you halfway down a page you have never seen.

   ⚠ INSTANT, never animated. The document's own `scroll-behavior:
   smooth` used to animate every page change, and a jump to a section
   was still gliding when the page settled.

   ⚠ Through `jumpTo` (animations/lenis.js), not `window.scrollTo`.
   With smooth scrolling on, a native jump lands the page somewhere
   Lenis is still animating TOWARDS, and it carries on and undoes it.
   `jumpTo` hands Lenis the destination instead — and is the plain
   native call when Lenis is not running, which is what a reader with
   reduced motion gets. It honours the section's `scroll-mt` either
   way, which is what keeps a heading clear of the fixed header.

   Keyed on `key`, not `pathname`: choosing "Values" while already on
   /about#values is a new navigation to the same URL, and should still
   bring the section back into view. */
function ScrollToTop() {
  const { key, hash } = useLocation();

  useEffect(() => {
    const target = hash && document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!target) {
      jumpTo(0);
      return undefined;
    }

    const align = () => jumpTo(target);
    align();

    /* On a cold load the web font lands AFTER this jump and reflows
       everything above the section, leaving it short of the header. Align
       once more when the fonts are in — unless the reader has scrolled in
       the meantime, in which case their position wins. */
    let cancelled = false;
    const landed = window.scrollY;
    document.fonts?.ready.then(() => {
      if (!cancelled && window.scrollY === landed) align();
    });
    return () => {
      cancelled = true;
    };
  }, [key, hash]);

  return null;
}

/* The whole site under a router. The browser wraps it in BrowserRouter
   (App, below); the build's pre-renderer wraps it in StaticRouter
   (entry-server.jsx) — the same tree, so hydration finds the same DOM. */
export function Shell() {
  const { pathname } = useLocation();

  /* The one page-view hook (Document 17) — a no-op until analytics is
     approved (lib/analytics.js). The canonical path only: never the query
     string, which can carry personal data. */
  useEffect(() => pageView(canonicalPath(pathname)), [pathname]);

  return (
    <>
      <ScrollToTop />
      {/* The mark's geometry, defined once for the whole document. Every
          <Mark> and the hero's LogoFrame are <use> references to it, and
          a <use> with no target in the document draws nothing at all —
          so this stays ABOVE the router, not inside a page. */}
      <MarkSprite />
      <Header />
      {/* The landmark the skip link and screen-reader rotor look for. */}
      <main id="main" tabIndex={-1} className="pt-[var(--header-h)] focus:outline-none">
        <ErrorBoundary resetKey={pathname} copy={SITE.pageError}>
          <Routes>
            <Route
              path="/"
              element={
                <Titled path="/">
                  <Home />
                </Titled>
              }
            />

            {/* The V1 sitemap. Built pages where they exist, the
              placeholder — which is also the section landing page —
              everywhere else. */}
            {PAGES.map((page) => {
              /* A page that lives as a section of its parent forwards
               there (see `section` in content/nav.js). */
              if (page.section) {
                return (
                  <Route
                    key={page.to}
                    path={page.to}
                    element={<Navigate to={page.section} replace />}
                  />
                );
              }
              const Page = BUILT[page.to];
              return (
                <Route
                  key={page.to}
                  path={page.to}
                  element={
                    Page ? (
                      <Titled path={page.to}>
                        <Page />
                      </Titled>
                    ) : (
                      <Placeholder page={page} />
                    )
                  }
                />
              );
            })}

            {/* One project. Its page sets its own title, and is a 404 for any
              slug not in content/work.js — so, until RBB supplies
              projects, for every slug. */}
            <Route path="/work/projects/:slug" element={<ProjectDetail />} />

            {/* One story. Its page sets its own title, and is a 404 for any
              slug that is not an approved story in content/stories.js —
              so, until RBB supplies stories, for every slug. */}
            <Route path="/stories/:slug" element={<StoryDetail />} />

            {/* Careers, at the address the site has always used for it
              (Document 08). Not in the navigation; sets its own title. */}
            <Route path="/about-us/careers" element={<Careers />} />

            {/* One person's profile — a 404 unless they are approved AND
              have an approved biography (content/team.js). */}
            <Route path="/about/team/:slug" element={<TeamProfile />} />

            {Object.entries(REDIRECTS).map(([from, to]) => (
              <Route key={from} path={from} element={<Navigate to={to} replace />} />
            ))}
            <Route path="/blogs/:slug" element={<PostRedirect />} />

            {/* Pages built before the sitemap. Outside the navigation now,
              but still linked from across the site, so they stay — at
              their own addresses, not redirected, until RBB decides what
              each is for (Document 11). /giving, /gifts and
              /giving/major-giving point to the one donation page; Zakat
              keeps its placeholder. */}
            {LEGACY_PATHS.map((path) => [path, LEGACY_PAGES[path]]).map(
              ([path, Page]) => (
                <Route
                  key={path}
                  path={path}
                  element={
                    <Titled path={path}>
                      <Page />
                    </Titled>
                  }
                />
              )
            )}

            {DesignSystem && SECTIONS.designSystemRoute && (
              <Route
                path="/design-system"
                element={
                  <Titled path="/design-system" title={SITE.titles["/design-system"]}>
                    <Suspense fallback={null}>
                      <DesignSystem />
                    </Suspense>
                  </Titled>
                }
              />
            )}

            {Components && SECTIONS.componentsRoute && (
              <Route
                path="/components"
                element={
                  <Titled path="/components" title={SITE.titles["/components"]}>
                    <Suspense fallback={null}>
                      <Components />
                    </Suspense>
                  </Titled>
                }
              />
            )}

            {STUB_PATHS.map((path) => (
              <Route key={path} path={path} element={<Placeholder />} />
            ))}

            {/* Sets its own `noindex` metadata (content/seo.js). */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </main>
      <Footer />
      {/* Hidden unless switched on (config/sections.js themeSwitcher). */}
      {SECTIONS.themeSwitcher && <ThemeSwitcher />}
      {/* The motion system (src/animations). Renders nothing; it starts
          smooth scrolling and binds each page's reveals.

          ⚠ LAST in the Shell on purpose. React runs effects in tree
          order, so by the time this one scans the page, ScrollToTop has
          already put the window where the new route starts — scan
          first and every trigger on the new page would be created
          already scrolled past, fire at once, and the page would
          arrive with its animations spent. */}
      <MotionProvider />
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
