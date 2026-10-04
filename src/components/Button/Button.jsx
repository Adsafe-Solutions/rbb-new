import { Link } from "react-router-dom";
import { cx } from "../../lib/cx.js";

/* One button for the whole site. The element is chosen by what you pass:
     <Button onClick={…}>          → <button type="button">
     <Button href="#download">     → <a>
     <Button to="/stories">        → react-router <Link>

   ---------------- The system ----------------

   Three boxed variants and one text link, and that is all:

     solid    the primary. The accent fill.
     ink      the secondary. The solid opposite of the ground.
     outline  the quiet third: the ground itself with a 2px ring.
     link     an underlined text link, for inside a card.

   Each is written against the TONE it sits on (styles/index.css), not
   against a colour, so one variant is right on every surface and the
   hover state can never match the background:

                paper              ink (blue band)     accent (sky band)
     solid      Sky / Night   →    Sky / Night    →    Night / white
       hover    Blue / white       white / Blue        white / Night
     ink        Blue / white       white / Blue        white / Night
       hover    Sky / Night        Sky / Night         Night / white
     outline    ring, Blue text    ring, white text    ring, Night text
       hover    fills as `ink`

   The pairs swap on hover — solid becomes ink and ink becomes solid —
   which is the whole interaction: one flat colour for another, no
   gradient, no glow, no shadow.

   ⚠ The primary's label is Night, not Charcoal and not white. White on
   Sky Blue is 2.55:1 and Charcoal 4.45:1 — a hair under the 4.5:1 that
   AA asks of text this size, on the button every page leads with. Night
   is 5.95:1 (Document 16).

   ⚠ Rounded 12px, not a pill. The header is the site's one pill; a page
   of pill buttons under it reads as a different product.

   `inverse` and `outlineInverse` are the names the pages used before
   the tones existed — a button "for a dark ground". The tone does that
   now, so they are `ink` and `outline`, kept as aliases.

   ---------------- States ----------------

   hover          the colour swap, and one pixel of lift
   active         pressed back down and a hair smaller
   focus-visible  the site's ring (styles/index.css) — never replaced
                  here; a keyboard user needs the ring, not the animation
   disabled       `disabled` or `aria-disabled`: 45% and no pointer

   ⚠ No padding, radius or transition in BASE that a variant also sets.
   Two utilities setting one property on one element resolve by the
   order Tailwind EMITS them, not the order they are written, so each
   property lives in exactly one place. */
const BASE = cx(
  "inline-flex cursor-pointer items-center justify-center gap-2",
  "whitespace-nowrap font-bold leading-none tracking-normal",
  "transition duration-200",
  "disabled:cursor-not-allowed disabled:opacity-45",
  "aria-disabled:cursor-not-allowed aria-disabled:opacity-45"
);

/* `active:` puts the lift back down and takes a hair off the size, so
   the button reads as pushed. Boxed variants only: a text link that
   rises off its own line of prose looks broken. */
const PRESS = "hover:-translate-y-px active:translate-y-0 active:scale-[0.97] motion-reduce:hover:translate-y-0";

const SIZES = {
  sm: { pad: "px-4 py-2.5", text: "text-[15px]" },
  md: { pad: "px-6 py-4", text: "text-[17px]" },
  lg: { pad: "px-8 py-5", text: "text-[19px]" },
};

const SOLID = "rounded-xl bg-pop text-on-pop hover:bg-flip hover:text-on-flip";
const INK = "rounded-xl bg-flip text-on-flip hover:bg-pop hover:text-on-pop";
/* The ring is an inset shadow, not a border: a border would make the
   outline button 4px larger than the filled one beside it. */
const OUTLINE = cx(
  "rounded-xl bg-transparent text-fg shadow-[inset_0_0_0_2px_var(--tone-edge)]",
  "hover:bg-flip hover:text-on-flip"
);

const VARIANTS = {
  solid: SOLID,
  ink: INK,
  outline: OUTLINE,
  inverse: INK,
  outlineInverse: OUTLINE,

  /* An unfilled utility control. */
  ghost: "rounded-xl bg-transparent text-fg hover:bg-hair",

  /* The underlined in-card link. Not a button shape at all — no padding,
     no radius — so it never reads as a second CTA next to the real one.
     The underline is the text's own colour: it is what marks this as a
     link, and the accent would be a 2.4:1 line on a light surface. */
  link: "text-fg underline decoration-2 underline-offset-4 hover:decoration-[3px]",
};

const BOXED = new Set(["solid", "ink", "outline", "inverse", "outlineInverse", "ghost"]);

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
  const classes = cx(
    BASE,
    box.text,
    BOXED.has(kind) && box.pad,
    BOXED.has(kind) && PRESS,
    VARIANTS[kind],
    className
  );

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
