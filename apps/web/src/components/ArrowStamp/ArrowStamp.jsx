import { cx } from "../../lib/cx.js";

/* The arrow in a disc that marks a card as a link — stamped a few
   degrees off square in the card's corner.

   It answers the CARD's hover, not its own (`group-hover:`): the disc
   turns the accent, straightens and nudges along its arrow. The card it
   sits in must therefore be a `group`. Decoration — the link's name is
   its text — so `aria-hidden`.

   `direction` turns the arrow for a pager's "previous". */
export default function ArrowStamp({ className = "", direction = "right" }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-flex h-10 w-10 shrink-0 -rotate-3 items-center justify-center rounded-full bg-flip text-on-flip",
        "transition duration-200 group-hover:translate-x-1 group-hover:rotate-0 group-hover:bg-pop group-hover:text-on-pop",
        "group-focus-within:rotate-0 group-focus-within:bg-pop group-focus-within:text-on-pop",
        "motion-reduce:group-hover:translate-x-0",
        className
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cx("h-[1.125rem] w-[1.125rem]", direction === "left" && "rotate-180")}
      >
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </span>
  );
}
