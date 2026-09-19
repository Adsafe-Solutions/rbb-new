import { useState } from "react";
import { Link } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import Brand from "../Brand/Brand.jsx";
import SocialIcon from "./SocialIcon.jsx";
import {
  BRAND,
  FOOTER_COLUMNS,
  FOOTER_SIGNUP,
  FOOTER_SOCIAL_HEADING,
  SOCIALS,
} from "../../content/index.js";

/* The footer is one Deep Trust Blue capsule — a panel whose left end is a
   half-circle — running off the right edge of the window, with the
   wordmark set oversized across its floor.

   The capsule is a radius, not a shape or an SVG. `rounded-l-[600px]` is
   deliberately larger than the panel can ever be tall: when the two radii
   on an edge exceed its length, CSS scales EVERY radius on the box by the
   same factor until they fit, which lands both left corners on exactly
   half the panel's height — a true half-circle at whatever height the
   content takes, with no measuring. A radius of `calc(infinity * 1px)`
   (what `rounded-l-full` emits) does not work here: that scale factor goes
   to zero and the corners come back square.

   The curve eats half the panel's height off the left edge, which is what
   the left padding is clearing; below `md` the panel is an ordinary
   rounded box, because at phone width that curve would leave nowhere to
   put the text.

   `overflow-hidden` is what crops the mark against the panel's floor, and
   it is also what keeps the curve clipping its own background. */

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

function FooterLink({ link }) {
  const className = cx(
    "inline-flex items-center gap-1 py-1",
    "text-[length:var(--text-caption)] tracking-caption text-paper-white/80",
    "transition-colors hover:text-paper-white hover:underline underline-offset-4"
  );

  /* An off-site link opens in a new tab and says so, both with the arrow
     and — for anyone not looking at it — in the accessible name. `noopener`
     is what stops the opened page reaching back through window.opener. */
  if (link.external) {
    return (
      <a href={link.to} target="_blank" rel="noopener noreferrer" className={className}>
        {link.label}
        <ExternalArrow />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    );
  }

  return (
    <Link to={link.to} className={className}>
      {link.label}
    </Link>
  );
}

/* Headings in the panel are small, spaced capitals — the one place in the
   system that uppercases, because on a filled panel weight alone does not
   separate a heading from its list. */
const HEADING = cx(
  "text-[length:var(--text-caption)] uppercase tracking-[0.08em]",
  "font-bold text-paper-white"
);

function Signup() {
  const [done, setDone] = useState(false);

  /* Nothing is sent anywhere yet — the form validates and confirms in
     place, so a mail provider drops in behind `onSubmit`. Same contract as
     the Newsletter section. */
  return (
    <div>
      <h2 className={HEADING}>{FOOTER_SIGNUP.heading}</h2>

      {done ? (
        <p className="mt-4 rounded-full bg-paper-white/15 px-6 py-3 text-paper-white">
          {FOOTER_SIGNUP.done}
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setDone(true);
          }}
          className={cx(
            "mt-4 flex items-center gap-2 rounded-full p-1.5 pl-6",
            "border border-paper-white/40 focus-within:border-paper-white"
          )}
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">Email address</span>
            <input
              type="email"
              required
              placeholder={FOOTER_SIGNUP.placeholder}
              className={cx(
                "w-full bg-transparent py-2 text-paper-white outline-none",
                "placeholder:text-paper-white/70"
              )}
            />
          </label>
          <button
            type="submit"
            className={cx(
              "shrink-0 rounded-full bg-paper-white px-6 py-2.5",
              "font-bold text-[length:var(--text-caption)] text-trust-blue",
              "transition-colors hover:bg-growth-green hover:text-paper-white"
            )}
          >
            {FOOTER_SIGNUP.cta}
          </button>
        </form>
      )}
    </div>
  );
}

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-paper-white pb-6 pl-4 md:pb-10 md:pl-8">
      <div
        className={cx(
          "relative overflow-hidden bg-trust-blue text-paper-white",
          "rounded-3xl md:rounded-l-[600px] md:rounded-r-none",
          "px-8 pt-14 md:pl-72 md:pr-12 md:pt-24 lg:pl-80"
        )}
      >
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4">
            <p className="max-w-xs font-bold text-[length:var(--text-subheading)] leading-subheading">
              {BRAND.tagline}
            </p>
            <p className="mt-4 text-[length:var(--text-caption)] tracking-caption text-paper-white/70">
              &copy; {year} {BRAND.name} &nbsp;/&nbsp; Registered charity
            </p>
          </div>

          <div className="grid gap-10 sm:grid-cols-2 lg:col-span-4 lg:px-4">
            {FOOTER_COLUMNS.map((column) => (
              <nav key={column.heading} aria-label={column.heading}>
                <h2 className={HEADING}>{column.heading}</h2>
                <ul className="mt-3 flex flex-col gap-0.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <FooterLink link={link} />
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          <div className="lg:col-span-4">
            <Signup />

            <h2 className={cx(HEADING, "mt-8")}>{FOOTER_SOCIAL_HEADING}</h2>
            <ul className="mt-3 flex flex-wrap items-center gap-2">
              {SOCIALS.map((social) => (
                <li key={social.icon}>
                  <a
                    href={social.href}
                    aria-label={social.label}
                    className={cx(
                      "grid h-10 w-10 place-items-center rounded-full",
                      "bg-paper-white/10 text-paper-white",
                      "transition-colors hover:bg-paper-white hover:text-trust-blue"
                    )}
                  >
                    <SocialIcon name={social.icon} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Pulled back out through the panel's own padding: the mark runs to
            the panel's right edge and is cropped by its floor. Decoration
            beside the header's own home link, so it opts out of being a
            second one. */}
        <div
          aria-hidden="true"
          className="-mr-8 mt-10 flex justify-end md:-mr-12 md:mt-6"
        >
          <Brand as="span" size="banner" tone="invert" />
        </div>
      </div>
    </footer>
  );
}
