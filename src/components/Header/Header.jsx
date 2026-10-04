import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import { pauseScroll, resumeScroll } from "../../animations/lenis.js";
import Button from "../Button/Button.jsx";
import Logo from "../Logo/Logo.jsx";
import Mark from "../Mark/Mark.jsx";
import DesktopNav from "./DesktopNav.jsx";
import MobileNav from "./MobileNav.jsx";
import { MenuIcon } from "./icons.jsx";
import { BRAND, NAV_CTA } from "../../content/index.js";

/* The floating header: a white pill with a 2px Deep Trust Blue border,
   hung over the page 12px from the top of the window — the logo, the
   navigation and the one Donate button inside it.

   ONE state. It used to turn transparent over a dark hero and take a
   white ground past it; a pill with its own surface reads on every band
   the page scrolls under it — paper, Deep Trust Blue, Sky Blue — so the
   header no longer needs to know what is beneath it, and the
   IntersectionObserver that tracked the hero is gone.

   No shadow and no blur behind it: depth in this system is a hard
   offset, and the border alone separates the pill from whatever passes
   under it.

   ⚠ Fixed, out of flow. <main> pads its top by `--header-h` and the
   heroes pull themselves back up by the same amount so their band starts
   at the top of the window, behind the pill. All of them read the one
   variable in styles/variables.css — change it there, nowhere else.

   The pill is `data-tone="card"`, so the focus ring inside it is Night
   whatever band it is floating over. */

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
         ⚠ AND Lenis is paused. `overflow: hidden` stops the scrollbar,
         but smooth scrolling listens to the WHEEL, not to the
         scrollbar, and would go on moving a page that cannot show it —
         so the menu closes onto a page somewhere else entirely. The two
         have to be set and released together.
       · Escape closes it and returns focus to the toggle.
       · widening past `lg` closes it — the desktop nav has appeared, and
         a menu left open behind it would keep the scroll lock. */
  useEffect(() => {
    if (!menuOpen) return undefined;

    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    pauseScroll();

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
      resumeScroll();
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
      className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4"
    >
      {/* The first thing Tab reaches on every page: straight past the
          header to <main>. Invisible until focused. */}
      <a
        href="#main"
        className={cx(
          "sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-20",
          "focus:rounded-xl focus:bg-bumble-honey focus:px-5 focus:py-3 focus:font-bold focus:text-night"
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

      {/* The pill. The width of the page column, 60px tall; the 12px of
          page above and below it make up `--header-h`. */}
      <div
        data-tone="card"
        className="relative mx-auto max-w-[calc(var(--page-max-width)-2rem)] rounded-full border-rim bg-paper-white"
      >
        <div className="relative flex h-[3.75rem] items-center justify-between gap-3 pl-5 pr-2 sm:pl-6">
          {/* Mark and wordmark, in their own white pill. The pill is not
            decoration: the header is transparent and fixed over whatever
            the page opens with, and the home hero opens on a Deep Trust
            Blue band — the same colour the wordmark is set in. Without
            the pill it would disappear into it. */}
          <Link
            to="/"
            aria-label={`${BRAND.fullName} home`}
            className="flex shrink-0 items-center rounded-lg py-2"
          >
            {/* The supplied logo needs about 150px to keep its two lines
              of lettering legible, and a 320px phone has about 100px here
              once the Donate button and the menu toggle have taken
              theirs. So the phone shows the mark alone — the same
              artwork, as vector — and the full logo appears as soon as
              there is room for it. */}
            <Mark className="h-8 w-8 shrink-0 text-bumble-honey sm:hidden" />
            <Logo className="hidden h-8 shrink-0 sm:block" />
          </Link>

          <DesktopNav />

          <div className="flex items-center gap-2 sm:gap-3">
            {/* `sm` box so it fits beside the logo and the menu button on
              a 320px phone. h-11 at every width: it is the tallest thing
              in the bar, so it is what sets how tall the bar has to be,
              and 44px is the comfortable touch target. It used to step up
              to h-12.5 and body size at `lg`, which a 72px bar has no
              room for. */}
            <Button
              to={NAV_CTA.to}
              size="sm"
              aria-current={pathname === NAV_CTA.to ? "page" : undefined}
              /* RBB's call (Oct 2026), for this one button only: a 25px
                 radius and Paper (#f5efe6) type — `--nav-cta-fg`, per colour
                 theme (styles/index.css). `!` so they win over the
                 solid variant's radius and Night text whatever order
                 Tailwind emits them in. ⚠ Paper on Sky Blue measures
                 below the 4.5:1 WCAG AA asks of text this size. */
              className="h-11 rounded-[25px]! text-[var(--nav-cta-fg)]! lg:px-5"
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
              className="rounded-full p-2.5 text-trust-blue transition-colors hover:bg-mist lg:hidden"
            >
              <MenuIcon open={menuOpen} />
            </button>
          </div>
        </div>
      </div>

      <div className="relative mx-auto mt-2 max-w-[calc(var(--page-max-width)-2rem)] lg:hidden">
        <MobileNav
          id="mobile-menu"
          open={menuOpen}
          onNavigate={() => setMenuOpen(false)}
        />
      </div>
    </header>
  );
}
