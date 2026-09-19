import { cx } from "../../lib/cx.js";

/* The pill. Verified counts, category tags, the vertical labels running up
   the mission cards — all the same shape at 1000px radius.

   `tone` picks the ground: white on a photo, a light-gray tint with blue
   text on a white card, ink for the rare reversed one. Nothing else in the system is pill-shaped, so
   a Badge always reads as metadata rather than as something to press. */

const TONES = {
  paper: "bg-paper-white text-bumble-ink",
  honey: "bg-mist text-trust-blue",
  ink: "bg-bumble-ink text-paper-white",
};

export default function Badge({
  tone = "paper",
  vertical = false,
  className = "",
  children,
  ...rest
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-4 py-2.5",
        "text-[length:var(--text-caption)] font-medium leading-none tracking-caption",
        TONES[tone] ?? TONES.paper,
        /* Sideways label, reading bottom-to-top up the edge of a card.
           `writing-mode` has no utility, hence the arbitrary property. */
        vertical && "[writing-mode:vertical-rl] rotate-180 px-2.5 py-4",
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
