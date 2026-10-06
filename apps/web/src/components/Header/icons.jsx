import { cx } from "../../lib/cx.js";

/* The header's two glyphs. Decorative: every control that shows one also
   carries its own text or label, so both are `aria-hidden`. */

export function ChevronIcon({ open, className = "h-4 w-4" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cx(
        "shrink-0 transition-transform duration-200",
        open && "rotate-180",
        className
      )}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function MenuIcon({ open }) {
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
