import { cx } from "../../lib/cx.js";

/* The homepage's line glyphs, drawn inline — a fixed set of a dozen marks
   does not justify an icon package. Keys are what content names in its
   `icon` fields. Always decorative: whatever carries an icon also carries
   its own text, so every one is `aria-hidden`.

   Full path data per key rather than composed strings, for the same reason
   Tailwind classes are never interpolated: what is here is what renders. */
const PATHS = {
  /* An open book. */
  education: (
    <>
      <path d="M12 6.5C10 5 7.5 4.5 4 4.5v13c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2v-13c-3.5 0-6 .5-8 2Z" />
      <path d="M12 6.5v13" />
    </>
  ),
  /* A heart with a pulse line through it. */
  health: (
    <>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
      <path d="M7.5 12h2.5l1.2-2.2 1.6 4 1.2-1.8H16.5" />
    </>
  ),
  /* A seedling. */
  livelihoods: (
    <>
      <path d="M12 20v-8" />
      <path d="M12 12c0-3.5 2.5-6 6.5-6 0 3.5-2.5 6-6.5 6Z" />
      <path d="M12 14.5c0-3-2-5-5.5-5 0 3 2 5 5.5 5Z" />
      <path d="M7 20h10" />
    </>
  ),
  /* Three people. */
  community: (
    <>
      <circle cx="12" cy="8" r="2.75" />
      <path d="M7 19.5c0-3 2.2-5 5-5s5 2 5 5" />
      <circle cx="5.5" cy="10" r="2" />
      <path d="M2.5 18.5c0-2.2 1.3-3.7 3.2-4" />
      <circle cx="18.5" cy="10" r="2" />
      <path d="M21.5 18.5c0-2.2-1.3-3.7-3.2-4" />
    </>
  ),
  /* A hand holding a heart. */
  donate: (
    <>
      <path d="M12 11.5s-3.5-2.1-3.5-4.6A2 2 0 0 1 12 5.7a2 2 0 0 1 3.5 1.2c0 2.5-3.5 4.6-3.5 4.6Z" />
      <path d="M3 14.5h3l3.5 2h3.5a1.5 1.5 0 0 0 0-3H10" />
      <path d="M13 15.5l5-2.3a1.5 1.5 0 0 1 1.3 2.7L13 19.5H6.5L3 17.5" />
    </>
  ),
  /* A raised hand. */
  volunteer: (
    <>
      <path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12" />
      <path d="M11 11V5a1.5 1.5 0 0 1 3 0v6" />
      <path d="M14 11V6.5a1.5 1.5 0 0 1 3 0V14c0 3.6-2.4 6-6 6h-.5a5.5 5.5 0 0 1-4.3-2.1L4 15a1.5 1.5 0 0 1 2.3-1.9L8 15" />
    </>
  ),
  /* Two linked rings. */
  partner: (
    <>
      <circle cx="9" cy="12" r="5" />
      <circle cx="15" cy="12" r="5" />
    </>
  ),
  /* A flag on a pole. */
  fundraise: (
    <>
      <path d="M6 21V4" />
      <path d="M6 4.5h11l-2.5 4 2.5 4H6" />
    </>
  ),
  /* A page with lines. */
  document: (
    <>
      <path d="M7 3.5h7l4 4v13H7Z" />
      <path d="M14 3.5v4h4M9.5 12h6M9.5 15.5h6" />
    </>
  ),
  /* A shield with a tick. */
  shield: (
    <>
      <path d="M12 3.5 19 6v5.5c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6Z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </>
  ),
  /* A pie chart. */
  chart: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12Z" />
      <path d="M15 3.8A8.5 8.5 0 0 1 20.2 9H15Z" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
};

export default function LineIcon({ name, className = "h-6 w-6" }) {
  const path = PATHS[name];
  if (!path) return null;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cx("shrink-0", className)}
    >
      {path}
    </svg>
  );
}
