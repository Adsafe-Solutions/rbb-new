import { cx } from "../../lib/cx.js";

/* The four-point star — the site's one decorative mark. Tucks into a card
   corner, usually half off the edge.

   Colour comes from `currentColor`, so `text-*` picks it: Honey by
   default, `text-paper-white` on a photograph or the Ink card. Size and
   placement come from `className` — it is positioned by whoever uses it. */
export default function Sparkle({ className = "" }) {
  return (
    <svg
      viewBox="0 0 236 237"
      aria-hidden="true"
      fill="currentColor"
      className={cx("pointer-events-none text-bumble-honey", className)}
    >
      <path d="M117.424 236.243C113.61 174.06 62.743 124.607.003 123.087L0 123.015c65.246-1.58 117.653-54.998 117.653-120.665 0 65.667 52.407 119.085 117.653 120.665l-.003.072c-62.739 1.52-113.607 50.973-117.42 113.156l-.23.001z" />
    </svg>
  );
}
