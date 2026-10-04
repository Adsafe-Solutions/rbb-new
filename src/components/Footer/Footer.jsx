import { Link } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import { glideTo } from "../../animations/lenis.js";
import Logo from "../Logo/Logo.jsx";
import Mark from "../Mark/Mark.jsx";
import FooterWordmark from "./FooterWordmark.jsx";
import SocialIcon from "./SocialIcon.jsx";
import {
  BRAND,
  FOOTER_COLUMNS,
  FOOTER_CONTACT,
  FOOTER_LEGAL,
  SOCIALS,
  methodHref,
} from "../../content/index.js";

/* The footer: the page's closing band, in Deep Trust Blue — the one place
   the brand's own blue is guaranteed on every page. Pages close on a Sky
   Blue call to action above it (CtaSection), so the two read as an ask
   and then a close, never as one dark block.

   Four tiers, divided by hairlines — an editorial close rather than a
   block of links:
     1  the brand: the reversed logo and the one-line summary, with the
        verified contact methods and social accounts beside them
     2  the full name as the site's largest type (FooterWordmark)
     3  four link columns: Explore · Get Involved · About · Information
     4  the copyright, the published policies and the way back to the top

   Behind it, the mark as an oversized faint watermark, cropped by the
   band's edge.

   ⚠ Only verified data renders here (content/contact.js, SOCIALS,
   policies). No registration number, address, handle, email or phone
   appears until RBB has supplied it — with none verified, those rows
   are simply absent. */

function ExternalArrow() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      className="h-3.5 w-3.5"
    >
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}

const LINK = cx(
  "inline-flex items-center gap-1",
  "text-[16px] text-copy underline-offset-4 decoration-bumble-honey decoration-2",
  "transition-colors hover:text-fg hover:underline"
);

function FooterLink({ link }) {
  /* An off-site link opens in a new tab and says so, both with the arrow
     and — for anyone not looking at it — in the accessible name. `noopener`
     is what stops the opened page reaching back through window.opener. */
  if (link.external) {
    return (
      <a href={link.to} target="_blank" rel="noopener noreferrer" className={LINK}>
        {link.label}
        <ExternalArrow />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    );
  }

  return (
    <Link to={link.to} className={LINK}>
      {link.label}
    </Link>
  );
}

/* The column headings: the system's small capitals, in white, over a
   short Sky Blue rule. Not Sky Blue type — on Deep Trust Blue that is
   3.89:1, under the 4.5:1 text this small needs; the rule carries the
   accent instead. */
const HEADING = "type-meta flex items-center gap-2.5 text-fg before:h-0.5 before:w-5 before:shrink-0 before:rounded-full before:bg-bumble-honey";

const socials = SOCIALS.filter((social) => social.href);

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    /* The site's focus ring is Charcoal, which all but disappears on
       Deep Trust Blue — white here, so a keyboard user can still see
       where they are in the footer's links. */
    <footer data-tone="ink" className="relative overflow-clip">
      <Mark className="pointer-events-none absolute -right-[10%] -top-[6%] h-[min(80vw,40rem)] w-[min(80vw,40rem)] rotate-[-12deg] text-paper-white opacity-[0.045]" />
      {/* No Container: the footer runs the full window width, and every
          tier — columns, wordmark, bottom bar — shares this one gutter so
          their edges line up. The wordmark scales to fill it, so on a wide
          screen it grows with the window rather than stopping at the
          1320px page column. */}
      <div className="relative mx-auto max-w-[var(--page-max-width)] px-5 pt-10 md:px-8 md:pt-20">
        {/* 1 — the brand, and where to find RBB elsewhere. */}
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <Link to="/" aria-label={`${BRAND.fullName} home`} className="inline-flex">
              {/* The reversed cut — RBB's supplied lockup for a dark ground. */}
              <Logo tone="invert" className="h-11" />
            </Link>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-copy">{BRAND.summary}</p>
          </div>

          {/* Verified contact methods and social accounts only
              (content/contact.js). Add an account's real URL there and its
              icon appears here; with none supplied yet, nothing renders —
              no empty list in the accessibility tree, no placeholder link. */}
          {(FOOTER_CONTACT.methods.length > 0 || socials.length > 0) && (
            <div className="flex flex-col gap-4 md:items-end">
              {FOOTER_CONTACT.methods.length > 0 && (
                <ul className="flex flex-wrap gap-x-6 gap-y-2">
                  {FOOTER_CONTACT.methods.map((method) => (
                    <li key={method.id}>
                      <a
                        href={methodHref(method)}
                        className="font-semibold text-fg underline decoration-bumble-honey decoration-2 underline-offset-4"
                      >
                        <span className="sr-only">{method.label}: </span>
                        {method.value}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {socials.length > 0 && (
                <ul aria-label="Rising Beyond Borders elsewhere" className="flex flex-wrap items-center gap-2">
                  {socials.map((social) => (
                    <li key={social.icon}>
                      <a
                        href={social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${social.label} (opens in a new tab)`}
                        className={cx(
                          "grid h-11 w-11 place-items-center rounded-full",
                          "border-2 border-hair text-fg",
                          "transition-colors hover:border-bumble-honey hover:bg-bumble-honey hover:text-night"
                        )}
                      >
                        <SocialIcon name={social.icon} />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* 2 — the name, as the band's one big gesture. */}
        <FooterWordmark className="mt-8 border-t border-hair pt-8 md:mt-12 md:pt-14" />

        {/* 3 — where to go next. */}
        <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-9 border-t border-hair pt-8 md:mt-20 md:gap-x-8 md:pt-10 lg:grid-cols-4">
          {FOOTER_COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={`Footer: ${column.heading}`}>
              <h2 className={HEADING}>{column.heading}</h2>
              <ul className="mt-5 flex flex-col gap-3">
                {column.links.map((link) => (
                  <li key={link.to}>
                    <FooterLink link={link} />
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* 4 — the close. */}
        <div className="mt-10 flex flex-col gap-4 border-t border-hair py-7 md:mt-20 md:flex-row md:items-center md:justify-between">
          {/* The year is the BUILD's in the pre-rendered page and the
                visitor's once hydrated; across New Year they differ, and
                that one text node is allowed to. */}
            <p
              className="text-[15px] text-quiet"
              suppressHydrationWarning
            >
              &copy; {year} {FOOTER_LEGAL.copyright}
            </p>
          {/* Right: the legal pages, then the way back up. */}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8">
            {/* Only published policies (content/policies.js) — and no
                empty "Legal" landmark while there are none. */}
            {FOOTER_LEGAL.links.length > 0 && (
              <nav aria-label="Legal">
                <ul className="flex flex-wrap gap-x-6 gap-y-2">
                  {FOOTER_LEGAL.links.map((link) => (
                    <li key={link.to}>
                      <Link
                        to={link.to}
                        className="text-[15px] text-quiet underline-offset-4 transition-colors hover:text-fg hover:underline"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          {/* The one deliberately ANIMATED scroll on the site: you asked
              to go back to the top, and watching the page travel there
              is what tells you it went. Through `glideTo`
              (animations/lenis.js) so it is Lenis's glide when smooth
              scrolling is on, and the document's own `scroll-behavior`
              when it is not — which the reduced-motion rule already
              turns off, so there is no third case to keep in step. */}
          <button
            type="button"
            /* Scroll AND move focus (Document 16): scrolling alone left a
               keyboard user's focus in the footer, so the next Tab jumped
               straight back to the bottom of the page. #main is already
               focusable (tabIndex -1) — the skip link's target. */
            onClick={() => {
              glideTo(0);
              document.getElementById("main")?.focus({ preventScroll: true });
            }}
            /* `-my-1.5 py-1.5`: a hit area over the 24px minimum (WCAG 2.2
               target size) without moving the row it sits in. */
            className="type-meta -my-1.5 inline-flex items-center gap-2 self-start rounded-lg py-1.5 text-fg transition-colors hover:text-bumble-honey sm:self-auto"
          >
            {FOOTER_LEGAL.backToTop}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-4 w-4"
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
