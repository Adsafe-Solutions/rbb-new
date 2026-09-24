import { useEffect, useLayoutEffect, useRef } from "react";

/* useLayoutEffect in the browser (the wordmark is fitted before paint, so
   it never visibly jumps), useEffect during the build's pre-render, where
   there is no layout and React warns about the layout variant. */
const useFitEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
import { Link } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import Brand from "../Brand/Brand.jsx";
import Mark from "../Mark/Mark.jsx";
import SocialIcon from "./SocialIcon.jsx";
import {
  BRAND,
  FOOTER_COLUMNS,
  FOOTER_CONTACT,
  FOOTER_LEGAL,
  SOCIALS,
  methodHref,
} from "../../content/index.js";

/* The footer: a full-width Deep Trust Blue band in three tiers.

     top     the mark and summary on the left; Explore, Get Involved and
             Organization columns on the right
     middle  the wordmark, set so large it spans the whole column edge
             to edge — the footer's one gesture
     bottom  a hairline, then the copyright, the legal links (published
             policies only) and a back-to-top control

   Everything else is deliberately quiet — small type, one accent colour
   on the column headings — so the wordmark carries the band. */

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
  "text-[length:var(--text-caption)] tracking-caption text-paper-white",
  "transition-colors hover:text-bumble-honey"
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

/* Small spaced capitals in a light tint of Sky Blue — the one place in
   the system that uppercases, because at this size weight alone does not
   separate a heading from its list.

   A tint, not Sky Blue itself: Sky Blue on Deep Trust Blue is 3.9:1,
   under the 4.5:1 that text this small needs. Mixed 60/40 with white it
   is about 5.5:1 and still reads as the brand's blue. Mixed here from the
   two tokens rather than added to the palette, so the palette itself is
   unchanged. */
const HEADING = cx(
  "text-[length:12px] font-bold uppercase tracking-[0.14em]",
  "text-[color:color-mix(in_srgb,var(--color-bumble-honey)_60%,var(--color-paper-white))]"
);

/* The wordmark, as one row: "Rising" huge in the black weight with tight
   tracking, "Beyond Borders" at under half its size in semibold on the
   same baseline, all but touching it — the pair scaled together so the
   row spans its box exactly, the footer's full width inside its gutter.
   The contrast between the two weights is what makes it read as one
   lockup rather than a headline and a caption.

   Measured rather than set in vw: the words come from content and their
   width depends on the letters in them, so no fixed ratio fits every
   name. A ResizeObserver repeats it on resize, and it re-runs when the
   web font lands — measured in the fallback face it would come out a
   few percent off.

   ⚠ It measures the INK, not the text boxes. A glyph's box includes its
   side bearings — empty space either side of the letter, dozens of
   pixels at this size — so fitting the boxes leaves the row short of
   the column's left edge and opens an uneven hole between the two
   words. Canvas `measureText` reports where the ink actually starts and
   ends; the sizes are fitted to that, and the bearings cancelled with
   margins so the gap between the words is exactly GAP. */

/* The small words' size, as a fraction of the big word's. */
const REST_RATIO = 0.45;

/* Space between the g's ink and the B's, as a fraction of the big size. */
const GAP = 0.025;

/* Letter-spacing on each word, in em. Mirrored in the measurement below,
   so change them here rather than in a class. */
const LEAD_TRACKING = -0.045;
const REST_TRACKING = -0.02;

function Wordmark() {
  const boxRef = useRef(null);
  const leadRef = useRef(null);
  const restRef = useRef(null);

  useFitEffect(() => {
    const box = boxRef.current;
    const lead = leadRef.current;
    const rest = restRef.current;
    if (!box || !lead || !rest) return undefined;

    const ctx = document.createElement("canvas").getContext("2d");

    /* Extents at 100px. `actualBoundingBoxLeft` is positive when ink
       starts LEFT of the text's origin, so the leading bearing is its
       negation; the trailing bearing is what the advance adds past the
       ink's right edge.

       Letter-spacing is added by hand, not via `ctx.letterSpacing`,
       which older Safari and Firefox lack. CSS puts it after EVERY
       character, the last included: so the ink between the first and
       last glyph grows by (n − 1) steps, and the trailing space by one. */
    const measure = (el, tracking) => {
      const cs = getComputedStyle(el);
      ctx.font = `${cs.fontWeight} 100px ${cs.fontFamily}`;
      const text = el.textContent;
      const m = ctx.measureText(text);
      const step = tracking * 100;
      return {
        lead: -m.actualBoundingBoxLeft,
        trail: m.width - m.actualBoundingBoxRight + step,
        ink: m.actualBoundingBoxLeft + m.actualBoundingBoxRight + step * ([...text].length - 1),
      };
    };

    const fit = () => {
      const big = measure(lead, LEAD_TRACKING);
      const small = measure(rest, REST_TRACKING);
      if (!big.ink) return;

      /* Solve for the big size so that big ink + gap + small ink equals
         the column. One pixel short: sub-pixel rounding at the far edge
         otherwise shaves the last glyph's outer curve. */
      const per100 = big.ink + 100 * GAP + small.ink * REST_RATIO;
      const size = (100 * (box.clientWidth - 1)) / per100;
      const restSize = size * REST_RATIO;

      lead.style.fontSize = `${size}px`;
      lead.style.marginLeft = `${(-big.lead * size) / 100}px`;
      rest.style.fontSize = `${restSize}px`;
      rest.style.marginLeft = `${
        GAP * size - (big.trail * size) / 100 - (small.lead * restSize) / 100
      }px`;
      /* The g's and y's descenders hang below the tight line box; room
         for them, so they clear the rule under the wordmark. */
      box.style.paddingBottom = `${size * 0.3}px`;
      lead.style.letterSpacing = `${LEAD_TRACKING}em`;
      rest.style.letterSpacing = `${REST_TRACKING}em`;
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  }, []);

  /* Decoration: the brand is already the footer's first link and the
     header's home link, so screen readers skip this third copy.

     `overflow-x-clip`, not `overflow-hidden`: the box only needs to cut
     the trailing side bearing that runs past the column. Hidden would
     clip vertically too, and take the g's and y's descenders with it.

     `tracking-normal` clears the body's +0.2px, which the measurement
     would never see; each word's own tracking is set from the constants
     above, in the same pass that measures it. */
  return (
    <div
      ref={boxRef}
      aria-hidden="true"
      className="mt-14 flex items-baseline overflow-x-clip whitespace-nowrap tracking-normal md:mt-20"
    >
      <span ref={leadRef} className="font-black leading-[0.8] text-paper-white">
        {BRAND.wordmark.lead}
      </span>
      <span ref={restRef} className="font-semibold leading-none text-bumble-honey">
        {BRAND.wordmark.rest}
      </span>
    </div>
  );
}

const socials = SOCIALS.filter((social) => social.href);

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    /* The site's focus ring is Charcoal, which all but disappears on
       Deep Trust Blue — white here, so a keyboard user can still see
       where they are in the footer's links. */
    <footer className="bg-trust-blue text-paper-white [&_:focus-visible]:outline-paper-white">
      {/* No Container: the footer runs the full window width, and every
          tier — columns, wordmark, bottom bar — shares this one gutter so
          their edges line up. The wordmark scales to fill it, so on a wide
          screen it grows with the window rather than stopping at the
          1320px page column. */}
      <div className="px-5 pt-14 md:px-10 md:pt-20">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-5">
            <Link
              to="/"
              aria-label={`${BRAND.fullName} home`}
              className="inline-flex items-center gap-2"
            >
              <Mark className="h-8 w-8 shrink-0 text-bumble-honey" />
              <Brand size="nav" as="span" tone="invert" />
            </Link>
            <p className="mt-4 max-w-xs text-[length:var(--text-caption)] leading-caption tracking-caption text-paper-white/70">
              {BRAND.summary}
            </p>

            {/* Contact, from the shared source (content/contact.js): the
                verified methods as real links, or the one pending line —
                never a guessed address or number. */}
            {FOOTER_CONTACT.methods.length > 0 ? (
              <ul className="mt-5 flex flex-col gap-2 text-[length:var(--text-caption)] leading-caption tracking-caption">
                {FOOTER_CONTACT.methods.map((method) => (
                  <li key={method.id}>
                    <a href={methodHref(method)} className="text-paper-white transition-colors hover:text-bumble-honey">
                      <span className="sr-only">{method.label}: </span>
                      {method.value}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 max-w-xs text-[length:var(--text-caption)] leading-caption tracking-caption text-paper-white/70">
                {FOOTER_CONTACT.pending}
              </p>
            )}

            {/* Only the profiles RBB has supplied a URL for — see SOCIALS.
                With none yet, the row does not render at all rather than
                leaving an empty list in the accessibility tree. */}
            {socials.length > 0 && (
              <ul className="mt-6 flex flex-wrap items-center gap-2">
                {socials.map((social) => (
                  <li key={social.icon}>
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${social.label} (opens in a new tab)`}
                      className={cx(
                        "grid h-9 w-9 place-items-center rounded-full",
                        "border border-paper-white/20 text-paper-white",
                        "transition-colors hover:border-bumble-honey hover:text-bumble-honey"
                      )}
                    >
                      <SocialIcon name={social.icon} />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-10 sm:grid-cols-3 lg:col-span-7">
            {FOOTER_COLUMNS.map((column) => (
              <nav key={column.heading} aria-label={`Footer: ${column.heading}`}>
                <h2 className={HEADING}>{column.heading}</h2>
                <ul className="mt-4 flex flex-col gap-3">
                  {column.links.map((link) => (
                    <li key={link.to}>
                      <FooterLink link={link} />
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <Wordmark />

        <div className="flex flex-col-reverse gap-4 border-t border-paper-white/20 py-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8">
            {/* The year is the BUILD's in the pre-rendered page and the
                visitor's once hydrated; across New Year they differ, and
                that one text node is allowed to. */}
            <p className="text-[length:14px] text-paper-white/70" suppressHydrationWarning>
              &copy; {year} {FOOTER_LEGAL.copyright}
            </p>
            {/* Only published policies (content/policies.js) — and no
                empty "Legal" landmark while there are none. */}
            {FOOTER_LEGAL.links.length > 0 && (
              <nav aria-label="Legal">
                <ul className="flex flex-wrap gap-x-6 gap-y-2">
                  {FOOTER_LEGAL.links.map((link) => (
                    <li key={link.to}>
                      <Link
                        to={link.to}
                        className="text-[length:14px] text-paper-white/70 underline-offset-4 transition-colors hover:text-bumble-honey hover:underline"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </div>
          {/* Smooth comes from the document's own `scroll-behavior`, which
              the reduced-motion rule already turns off — no JS option to
              keep in step with it. */}
          <button
            type="button"
            /* Scroll AND move focus (Document 16): scrolling alone left a
               keyboard user's focus in the footer, so the next Tab jumped
               straight back to the bottom of the page. #main is already
               focusable (tabIndex -1) — the skip link's target. */
            onClick={() => {
              window.scrollTo({ top: 0 });
              document.getElementById("main")?.focus({ preventScroll: true });
            }}
            /* `-my-1.5 py-1.5`: a hit area over the 24px minimum (WCAG 2.2
               target size) without moving the row it sits in. */
            className="-my-1.5 inline-flex items-center gap-2 self-start py-1.5 text-[length:14px] font-bold uppercase tracking-[0.14em] transition-colors hover:text-bumble-honey md:self-auto"
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
    </footer>
  );
}
