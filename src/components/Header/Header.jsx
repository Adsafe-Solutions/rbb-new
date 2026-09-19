import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import Brand from "../Brand/Brand.jsx";
import Container from "../Container/Container.jsx";
import Mark from "../Mark/Mark.jsx";
import { BRAND, NAV } from "../../content/index.js";

/* The floating header.

   Borderless and transparent by design — it sits ON the honey band rather
   than above it, which is why there is no bottom rule and no background of
   its own. The nav group carries the only surface: a soft white-tinted
   pill holding the items, with the active item inverted to white. That
   white pill and the ink sign-in button are the same shape at opposite
   values, and the pair is what the design's toggle relationship rests on.

   ⚠ Fixed, out of flow, so the hero's Honey runs up behind it. That
   means the page has to make room for it: <main> pads its top by
   `--header-h`, and Hero pulls itself back up by the same amount so the
   band starts at the top of the viewport. All three read the one
   variable in styles/variables.css — change it there, nowhere else.

   Stays transparent while scrolling, by request — it floats over
   whatever section is underneath with no ground of its own. */

function GlobeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" />
    </svg>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      className={cx("h-4 w-4 transition-transform", open && "rotate-180")}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function MenuIcon({ open }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      className="h-6 w-6"
    >
      {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M3 7h18M3 12h18M3 17h18" />}
    </svg>
  );
}

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <Container className="flex h-[var(--header-h)] items-center justify-between gap-4">
        {/* Mark and wordmark, in their own white pill alongside the nav
            group and the donate control. The pill is not decoration: the
            header is transparent and fixed over whatever the page opens
            with, and the home hero opens on a Deep Trust Blue band — the
            same colour the wordmark is set in. Without the pill it would
            disappear into it. */}
        <Link
          to="/"
          aria-label={BRAND.name}
          className="flex items-center gap-2.5 rounded-2xl bg-paper-white px-4 py-2.5"
        >
          <Mark className="h-7 w-7 shrink-0 text-bumble-honey" />
          {/* `as="span"`: this whole pill is already the link home, and a
              second <a> nested inside one is invalid and unfocusable. */}
          <Brand size="nav" as="span" />
        </Link>

        {/* The nav group. Hidden below lg, where it becomes the sheet
            below — five items plus a brand and a control do not fit on a
            phone at this type size without shrinking the type past the
            15px floor the design sets. */}
        <nav
          aria-label="Primary"
          className={cx(
            "hidden items-center rounded-2xl bg-paper-white/45 p-1.5 lg:flex"
          )}
        >
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cx(
                  "rounded-2xl px-5 py-2.5 font-medium transition-colors",
                  "text-[length:var(--text-body)] leading-none tracking-body",
                  isActive
                    ? "bg-paper-white text-trust-blue"
                    : "text-trust-blue hover:bg-paper-white/60"
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {/* Language selector. A real locale menu belongs behind this;
              today it is the control's shape, so the header is complete
              and the menu is a drop-in rather than a re-layout. */}
          <button
            type="button"
            aria-label="Change language"
            className={cx(
              "hidden items-center gap-2 rounded-2xl bg-paper-white px-5 py-3",
              "text-bumble-ink transition-colors hover:bg-mist sm:inline-flex"
            )}
          >
            <GlobeIcon />
            <ChevronIcon open={false} />
          </button>

          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="rounded-2xl bg-paper-white p-3 text-bumble-ink lg:hidden"
          >
            <MenuIcon open={open} />
          </button>
        </div>
      </Container>

      {/* The small-screen sheet. Rendered under the bar rather than over
          the page: the header is transparent, so a full-screen overlay
          would have nothing to sit against and the honey band would read
          straight through it. */}
      {open && (
        <Container className="lg:hidden">
          <nav
            aria-label="Primary"
            className="mb-4 flex flex-col gap-1 rounded-3xl bg-paper-white p-3 shadow-sm"
          >
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cx(
                    "rounded-2xl px-4 py-3 font-medium",
                    "text-[length:var(--text-body)] tracking-body",
                    isActive ? "bg-mist text-trust-blue" : "text-trust-blue"
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </Container>
      )}
    </header>
  );
}
