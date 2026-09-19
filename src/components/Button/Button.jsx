import { Link } from "react-router-dom";
import { cx } from "../../lib/cx.js";

/* One button for the whole site. The element is chosen by what you pass:
     <Button onClick={…}>          → <button type="button">
     <Button href="#download">     → <a>
     <Button to="/stories">        → react-router <Link>

   ⚠ THERE IS ONLY ONE FILLED BUTTON IN THIS SYSTEM, and it is Growth
   Green — the palette reserves green for calls to action. Sky Blue is the
   brand's accent, not its clickability: a sky-blue button on a sky-blue
   band would vanish. The `link` variant below is the underlined text
   link; there is no third fill.

   No hover lift: feedback comes from the colour changing, green to Deep
   Trust Blue. */

const BASE = cx(
  "inline-flex cursor-pointer items-center justify-center gap-2",
  "whitespace-nowrap rounded-2xl px-7 py-4",
  "text-[length:var(--text-body)] font-medium leading-none tracking-body",
  "transition-colors duration-200"
);

const VARIANTS = {
  /* The primary. Green fill, paper text. Donate, submit, subscribe. */
  solid: "bg-growth-green text-paper-white hover:bg-trust-blue",

  /* The same button on a dark or saturated ground. */
  inverse: "bg-paper-white text-trust-blue hover:bg-mist",

  /* The quiet second action beside `solid` — "watch the film" next to
     "get involved". NOT a second fill: it is the page's own ground with a
     hairline around it, which is the only way to put two buttons side by
     side without the palette having to pick a second accent colour. The
     ring thickens on hover rather than the box filling in, so it never
     starts competing with the green. */
  outline: cx(
    "bg-transparent text-trust-blue ring-1 ring-inset ring-bumble-ink/20",
    "transition-[box-shadow,background-color] hover:bg-paper-white hover:ring-bumble-ink/40"
  ),

  /* The active nav pill: white on the honey band, the exact inverse of
     `solid`, which is what makes the two read as one toggle. */
  pill: "rounded-2xl bg-paper-white px-5 py-2.5 text-bumble-ink",

  /* Unfilled nav item and utility controls. */
  ghost: "bg-transparent text-bumble-ink hover:bg-paper-white/60",

  /* The underlined in-card link. Not a button shape at all — no padding,
     no radius — so it never reads as a second CTA next to the real one. */
  link: cx(
    "rounded-none px-0 py-0 underline underline-offset-4",
    "text-trust-blue hover:decoration-2"
  ),
};

export default function Button({
  variant = "solid",
  to,
  href,
  type = "button",
  className = "",
  children,
  ...rest
}) {
  const classes = cx(BASE, VARIANTS[variant] ?? VARIANTS.solid, className);

  if (to) {
    return (
      <Link to={to} className={classes} {...rest}>
        {children}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={classes} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
