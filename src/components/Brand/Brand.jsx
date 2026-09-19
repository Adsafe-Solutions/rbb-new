import { Link } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import { BRAND } from "../../content/index.js";

/* The wordmark, as live type rather than a logo file.

   The hero renders this same component at display size with photo cards
   cutting across it, and the footer renders it large and flush left. A
   bitmap could not do either: the hero mark is ~18vw and would have to be
   an SVG export re-made on every brand tweak, and the name comes from
   content so it can be changed in one place.

   `size` picks the treatment, not just a font size:
     "nav"     — header, 24px
     "footer"  — footer, large and flush left
     "display" — the hero mark, fluid to the viewport */
const SIZES = {
  nav: "text-heading-sm leading-heading-sm tracking-heading-sm",
  footer: "text-[clamp(2.5rem,7vw,4.5rem)] leading-none tracking-tight",
  /* The footer panel's oversized mark. Leading is below 1 so the glyphs
     sit flush to the panel's bottom edge, which is what the design wants
     — the box around them, not the type, is doing the spacing. */
  banner: "text-[clamp(5rem,25vw,20rem)] leading-[0.78] tracking-tight",
  /* Fluid so the mark keeps its edge-to-edge presence at every width. The
     upper bound is what stops it outgrowing the 1200px column on a very
     wide monitor. */
  display: "text-[clamp(4rem,18vw,15rem)] leading-none tracking-tight",
};

/* The mark's colour, as a prop rather than a className override: an
   incoming `text-paper-white` and the base `text-trust-blue` have equal
   specificity, so which one wins is decided by the order Tailwind emits
   them, not by the order they appear in the attribute. */
const TONES = {
  brand: "text-trust-blue",
  invert: "text-paper-white",
};

export default function Brand({
  size = "nav",
  tone = "brand",
  as,
  className = "",
  ...rest
}) {
  const content = (
    <span
      className={cx(
        "font-bold",
        TONES[tone] ?? TONES.brand,
        SIZES[size] ?? SIZES.nav,
        className
      )}
    >
      {BRAND.name}
    </span>
  );

  /* The hero mark is decoration around a heading that already exists, and
     a second link to "/" next to the header's is noise for anyone
     tabbing through. `as="span"` opts out of the link. */
  if (as === "span") return content;

  return (
    <Link to="/" aria-label={`${BRAND.name} home`} className="inline-block" {...rest}>
      {content}
    </Link>
  );
}
