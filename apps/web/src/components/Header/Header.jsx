import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import { pauseScroll, resumeScroll } from "../../animations/lenis.js";
import Button from "../Button/Button.jsx";
import Logo from "../Logo/Logo.jsx";
import DesktopNav from "./DesktopNav.jsx";
import MobileNav from "./MobileNav.jsx";
import { useDonate } from "../DonateDialog/DonateDialog.jsx";
import { MenuIcon } from "./icons.jsx";
import AnnouncementBar from "../AnnouncementBar/AnnouncementBar.jsx";
import StoryStrip from "../StoryStrip/StoryStrip.jsx";
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

export default function Header({ announcement = null, onCloseAnnouncement, stories = null }) {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleRef = useRef(null);
  const { openDonate } = useDonate();
  /* Scrolled at all: with the story strip on, the header slides up by
     the strip's height (styles/index.css `.has-stories`). Smooth
     scrolling moves the window itself, so the native event is the one
     to listen to. */
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (!stories) return undefined;
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [stories]);

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
      data-site-header=""
      data-scrolled={stories && (scrolled || menuOpen) ? "" : undefined}
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

      {/* The announcement bar, full-bleed over the pill — after the skip
          link, so that stays the first Tab stop. Its height is already in
          `--header-h` while it shows (App.jsx, styles/index.css). */}
      {/* Full-bleed strips over the pill, in this order: the story
          circles (which slide away on scroll), then the announcement bar.
          Their heights are already in `--header-h` while they show
          (App.jsx, styles/index.css). */}
      {(stories || announcement) && (
        <div className="-mx-3 -mt-3 mb-3 sm:-mx-4">
          {stories && <StoryStrip items={stories.items} label={stories.label} />}
          {announcement && <AnnouncementBar bar={announcement} onClose={onCloseAnnouncement} />}
        </div>
      )}

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
            {/* The full logo at every width — the name is the point of
              the header on a phone too (RBB, Oct 2026). At 32px tall it
              is 152px wide, which fits beside the Donate button and the
              menu toggle from a 360px phone up. Narrower than that the
              bar has about 125px, so the logo steps down to 26px tall
              (124px wide), where each line of lettering is still ~10px. */}
            <Logo className="h-6.5 shrink-0 min-[360px]:h-8" />
          </Link>

          <DesktopNav />

          <div className="flex items-center gap-2 sm:gap-3">
            {/* `sm` box so it fits beside the logo and the menu button on
              a 320px phone. h-11 at every width: it is the tallest thing
              in the bar, so it is what sets how tall the bar has to be,
              and 44px is the comfortable touch target. It used to step up
              to h-12.5 and body size at `lg`, which a 72px bar has no
              room for. */}
            {/* Opens the donation popup (components/DonateDialog). A link
              to the appeals underneath, so before hydration — or with
              a modifier key, for a new tab — it still goes somewhere
              you can give. Closes the mobile menu first: both pause
              smooth scrolling, and the menu would otherwise resume it
              under the open dialog. */}
            <Button
              to={NAV_CTA.to}
              size="sm"
              aria-haspopup="dialog"
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                setMenuOpen(false);
                openDonate();
              }}
              /* RBB's call (Oct 2026), for this one button only: a 25px
                 radius and Paper (#f5efe6) type — `--nav-cta-fg`, per colour
                 theme (styles/index.css). `!` so they win over the
                 solid variant's radius and Night text whatever order
                 Tailwind emits them in. ⚠ Paper on Sky Blue measures
                 below the 4.5:1 WCAG AA asks of text this size.
                 Hover hands the text back to the variant's on-flip colour:
                 the fill swaps to ink there, and a pinned `--nav-cta-fg`
                 vanished on it (Poster: #28282b on #28282b). */
              className="h-11 rounded-[25px]! text-[var(--nav-cta-fg)]! hover:text-on-flip! lg:px-5"
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
