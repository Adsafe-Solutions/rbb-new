import { cx } from "../../lib/cx.js";
import Photo from "../Photo/Photo.jsx";

/* A phone with a screenshot in it.

   The bezel is drawn rather than imported: it is four rounded rectangles
   and a notch, and an image of a phone would have to be re-exported every
   time the radius or the screenshot changes.

   ⚠ The screen's radius is deliberately smaller than the body's. Equal
   radii make the glass look like it is floating off the frame — the inner
   curve has to be tighter by roughly the bezel width to read as one
   object. */
export default function PhoneMock({ src, alt = "", label, className = "" }) {
  return (
    <div
      className={cx(
        "relative shrink-0 rounded-[2.25rem] bg-bumble-ink p-2 shadow-sm",
        className
      )}
    >
      {/* The notch. Sits above the screen and is purely cosmetic. */}
      <div
        aria-hidden="true"
        className={cx(
          "absolute left-1/2 top-3 z-10 h-4 w-20 -translate-x-1/2",
          "rounded-full bg-bumble-ink"
        )}
      />
      <Photo
        src={src}
        alt={alt}
        label={label}
        ratio="9/19"
        className="rounded-[1.75rem]"
      />
    </div>
  );
}
