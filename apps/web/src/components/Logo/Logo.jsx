import { cx } from "../../lib/cx.js";
import lockup from "../../assets/logos/rbb-lockup.png";
import lockupReversed from "../../assets/logos/rbb-lockup-reversed.png";

/* RBB's own logo: the mark and "Rising Beyond Borders" set in the logo's
   lettering, as one piece of supplied artwork.

   This replaces the pairing the header and footer used before — the
   traced vector mark beside the name typeset in the brand face — which was the
   name SET to look like the logo rather than the logo itself. Both of
   those components stay, and are still the right tool elsewhere: Mark
   takes `currentColor`, so it draws the fifteen decorative watermarks in
   any of the palette's colours and at any size, and LogoFrame masks a
   photograph through its ring. Neither is possible with flat artwork.

   Which is why `tone` picks a FILE rather than applying a filter. A PNG
   cannot be recoloured in CSS without wrecking it, and RBB supply a
   reversed cut for dark ground, so the reversed cut is what goes there:

     "brand"  — Deep Trust Blue lettering, Sky Blue mark, for light ground
     "invert" — white lettering, Sky Blue mark, for the footer's dark band

   The files are 480px-wide copies of `Rising Beyond Borders Logo-01.png`
   and `-02.png` from the supplied set — three times the widest the site
   draws them. Copies rather than the 2710px originals because the header
   loads on every page; 32-bit rather than a palette because quantising
   moved Deep Trust Blue to #0f427b, and the brand colour is the brand
   colour. Re-cut from the originals in src/assets/logos/ if the size the
   site draws them at changes. */

/* The artwork's own pixel size, passed to the <img> so the browser holds
   the right box before the file arrives. Height in CSS comes from the
   class; `w-auto` keeps this ratio. */
const WIDTH = 480;
const HEIGHT = 101;

const TONES = {
  brand: lockup,
  invert: lockupReversed,
};

export default function Logo({ tone = "brand", className = "", ...rest }) {
  const img = (src, extra, more = {}) => (
    <img
      src={src}
      /* Decoration. Every place this appears sits inside a link already
         named for the organisation, so alt text here would have a screen
         reader say the name twice in a row. */
      alt=""
      width={WIDTH}
      height={HEIGHT}
      className={cx("w-auto", extra, className)}
      {...more}
      {...rest}
    />
  );
  if (tone !== "brand") return img(TONES[tone] ?? TONES.brand);
  /* The light-ground cut, plus the reversed cut for the Midnight colour
     theme's dark surfaces (styles/index.css shows one or the other). The
     reversed one is `lazy`: while hidden it is never fetched. */
  return (
    <>
      {img(TONES.brand, "logo-for-light")}
      {img(TONES.invert, "logo-for-dark", { loading: "lazy" })}
    </>
  );
}

