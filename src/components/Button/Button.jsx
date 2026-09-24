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

/* ⚠ No padding and no radius in BASE. They used to live here, and every
   variant that needed different ones — `link` with none, `pill` with less
   — lost: two utilities setting the same property on one element resolve
   by the order Tailwind EMITS them, not the order they appear in the class
   string, so `px-7` beat `link`'s `px-0` and every text link on the site
   carried 28px of invisible padding on each side. Each variant now states
   its own box, so there is nothing to fight with. */
const BASE = cx(
  "inline-flex cursor-pointer items-center justify-center gap-2",
  "whitespace-nowrap",
  "font-medium leading-none tracking-body",
  "transition-colors duration-200"
);

/* Padding and type size, by `size`. Same rule as above: they live in ONE
   place per element, never as a default that a smaller size would have to
   fight. `sm` is for buttons that share a card with other content — the
   project cards, where two full-size buttons outweighed the story.
   Padding applies only to the boxed variants; `pill` keeps its own box
   and `link` has none. */
const SIZES = {
  md: { pad: "px-7 py-4", text: "text-[length:var(--text-body)]" },
  sm: { pad: "px-4 py-2.5", text: "text-[length:var(--text-caption)]" },
};
const BOXED = new Set(["solid", "inverse", "outline", "outlineInverse", "ghost"]);

const VARIANTS = {
  /* The primary. Green fill, Charcoal text. Donate, submit, subscribe.

     ⚠ Charcoal, NOT white (Document 16). White on Growth Green is 2.48:1
     — below WCAG AA even for large text — on the one button every page
     leads with. Charcoal on the same green is 4.59:1, and both colours are
     already in the palette, so the brand does not change; only the pairing
     does. PENDING RBB approval as a contrast treatment. On hover it turns
     Deep Trust Blue with white text (9.92:1). */
  solid: "rounded-2xl bg-growth-green text-bumble-ink hover:bg-trust-blue hover:text-paper-white",

  /* The same button on a dark or saturated ground. */
  inverse: "rounded-2xl bg-paper-white text-trust-blue hover:bg-mist",

  /* The quiet second action beside `solid` — "watch the film" next to
     "get involved". NOT a second fill: it is the page's own ground with a
     hairline around it, which is the only way to put two buttons side by
     side without the palette having to pick a second accent colour. The
     ring thickens on hover rather than the box filling in, so it never
     starts competing with the green. */
  outline: cx(
    "rounded-2xl bg-transparent text-trust-blue ring-1 ring-inset ring-bumble-ink/20",
    "transition-[box-shadow,background-color] hover:bg-paper-white hover:ring-bumble-ink/40"
  ),

  /* `outline` on a dark ground — the bleed hero's Deep Trust Blue band.
     Same hairline logic, inverted: the trust-blue text of `outline` is
     invisible on that band, and filling it white would make it a second
     `inverse` and break the rule of one filled button per decision. */
  outlineInverse: cx(
    "rounded-2xl bg-transparent text-paper-white ring-1 ring-inset ring-paper-white/35",
    "transition-[box-shadow,background-color] hover:bg-paper-white/10 hover:ring-paper-white/70"
  ),

  /* The active nav pill: white on the honey band, the exact inverse of
     `solid`, which is what makes the two read as one toggle. */
  pill: "rounded-2xl bg-paper-white px-5 py-2.5 text-bumble-ink",

  /* Unfilled nav item and utility controls. */
  ghost: "rounded-2xl bg-transparent text-bumble-ink hover:bg-paper-white/60",

  /* The underlined in-card link. Not a button shape at all — no padding,
     no radius — so it never reads as a second CTA next to the real one. */
  link: cx(
    "underline underline-offset-4",
    "text-trust-blue hover:decoration-2"
  ),
};

export default function Button({
  variant = "solid",
  size = "md",
  to,
  href,
  type = "button",
  className = "",
  children,
  ...rest
}) {
  const kind = VARIANTS[variant] ? variant : "solid";
  const box = SIZES[size] ?? SIZES.md;
  const classes = cx(BASE, box.text, BOXED.has(kind) && box.pad, VARIANTS[kind], className);

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
