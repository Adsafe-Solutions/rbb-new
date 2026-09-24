import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import Brand from "../Brand/Brand.jsx";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";
import Mark from "../Mark/Mark.jsx";
import DesktopNav from "./DesktopNav.jsx";
import MobileNav from "./MobileNav.jsx";
import { MenuIcon } from "./icons.jsx";
import { BRAND, NAV_CTA } from "../../content/index.js";

/* The floating header.

   Borderless and transparent by design — it sits ON the page's opening
   band rather than above it, so there is no bottom rule and no background
   of its own. Each control carries its own white surface instead: the
   logo pill, the nav pill, the menu button. Donate is the one filled
   Growth Green button, and it stays in the bar at every width.

   ⚠ Fixed, out of flow, so the hero's band runs up behind it. That
   means the page has to make room for it: <main> pads its top by
   `--header-h`, and the heroes pull themselves back up by the same amount
   so the band starts at the top of the viewport. All of them read the one
   variable in styles/variables.css — change it there, nowhere else.

   Stays transparent while scrolling, by request — it floats over
   whatever section is underneath with no ground of its own.

   Focus rings are drawn INSIDE the controls here (negative offset). The
   site's ring is Charcoal and sits outside the element; behind the
   header that is often the Deep Trust Blue hero, where Charcoal all but
   vanishes. Inside, it is always on white or green. */

const LG = "(min-width: 64rem)";

export default function Header() {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleRef = useRef(null);

  /* Navigating closes the menu — back/forward included, which never
     passes through a link's onClick. */
  useEffect(() => setMenuOpen(false), [pathname]);

  /* While the menu is open:
       · the page behind it does not scroll. On <html>, not <body>: body
         carries `overflow-x: clip` for the overhanging artwork, and
         setting overflow there would replace it (see styles/index.css).
       · Escape closes it and returns focus to the toggle.
       · widening past `lg` closes it — the desktop nav has appeared, and
         a menu left open behind it would keep the scroll lock. */
  useEffect(() => {
    if (!menuOpen) return undefined;

    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";

    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      toggleRef.current?.focus();
    };
    const wide = window.matchMedia(LG);
    const onWide = (e) => e.matches && setMenuOpen(false);

    document.addEventListener("keydown", onKeyDown);
    wide.addEventListener("change", onWide);
    return () => {
      root.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
      wide.removeEventListener("change", onWide);
    };
  }, [menuOpen]);

  /* Tabbing past the last link in the menu closes it, rather than
     carrying focus on into a page the open menu is covering. No focus
     trap: the menu is a disclosure, not a dialog, and Tab always leaves. */
  const onBlur = (e) => {
    if (menuOpen && e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) {
      setMenuOpen(false);
    }
  };

  return (
    <header
      onBlur={onBlur}
      className="fixed inset-x-0 top-0 z-50 [&_:focus-visible]:[outline-offset:-4px]"
    >
      {/* The first thing Tab reaches on every page: straight past the
          header to <main>. Invisible until focused. */}
      <a
        href="#main"
        className={cx(
          "sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-20",
          "focus:rounded-2xl focus:bg-paper-white focus:px-5 focus:py-3 focus:font-medium focus:text-trust-blue focus:shadow-sm"
        )}
      >
        Skip to content
      </a>

      {/* Dims the page behind the open menu; a tap on it closes the menu.
          Before the bar in the DOM, so the bar and the sheet paint over
          it. Hidden from assistive tech — Escape and the toggle are the
          accessible ways out. */}
      {menuOpen && (
        <div
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
          className="enter fixed inset-0 bg-bumble-ink/40 lg:hidden"
        />
      )}

      <Container className="relative flex h-[var(--header-h)] items-center justify-between gap-3">
        {/* Mark and wordmark, in their own white pill. The pill is not
            decoration: the header is transparent and fixed over whatever
            the page opens with, and the home hero opens on a Deep Trust
            Blue band — the same colour the wordmark is set in. Without
            the pill it would disappear into it. */}
        <Link
          to="/"
          aria-label={`${BRAND.fullName} home`}
          className="flex shrink-0 items-center gap-2.5 rounded-2xl bg-paper-white px-3 py-2.5 sm:px-4"
        >
          <Mark className="h-7 w-7 shrink-0 text-bumble-honey" />
          {/* `as="span"`: this whole pill is already the link home, and a
              second <a> nested inside one is invalid and unfocusable. */}
          <Brand size="nav" as="span" />
        </Link>

        <DesktopNav />

        <div className="flex items-center gap-2 sm:gap-3">
          {/* `sm` box so it fits beside the logo and the menu button on a
              320px phone; `h-12` matches their height. At `lg` it matches
              the nav pill instead, and with the room it steps up to the
              body size the nav is set in. */}
          <Button
            to={NAV_CTA.to}
            size="sm"
            aria-current={pathname === NAV_CTA.to ? "page" : undefined}
            className="h-12 lg:h-12.5 lg:px-7 lg:text-[length:var(--text-body)]"
          >
            {NAV_CTA.label}
          </Button>

          <button
            ref={toggleRef}
            type="button"
            aria-label="Menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-2xl bg-paper-white p-3 text-trust-blue transition-colors hover:bg-mist lg:hidden"
          >
            <MenuIcon open={menuOpen} />
          </button>
        </div>
      </Container>

      <Container className="relative lg:hidden">
        <MobileNav
          id="mobile-menu"
          open={menuOpen}
          onNavigate={() => setMenuOpen(false)}
        />
      </Container>
    </header>
  );
}
