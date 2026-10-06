import { cx } from "../../lib/cx.js";
import MediaPlaceholder from "../MediaPlaceholder/MediaPlaceholder.jsx";
import Picture from "../Picture/Picture.jsx";

/* A photograph as a PRINT: set in a white paper frame with the 2px
   border and a hard offset shadow, hung a degree or two off square.

   This is how every photograph on the site appears. The reference this
   language comes from barely uses photographs; a charity's site is made
   of them, so they are brought INTO the system instead of sitting on top
   of it — a framed print on the same wall as the flyers, never a
   full-bleed glossy image and never a rounded card with a soft shadow.

     image    { src, alt, focal? } — as content/photos.js supplies it.
              Without one, the frame holds the pale-mark placeholder: an
              empty frame is honest; a stock photograph would not be.
     ratio    the photograph's own box (a full class string — Tailwind
              only generates what it can read)
     tilt     l | r | l-lg | r-lg
     label    a sticker over the frame's lower-left corner: a place, a
              program — a short fact about the picture, from content
     caption  a line under the photograph, inside the frame
     priority the page's largest image: fetched early, never lazy

   ⚠ No hover zoom and no reveal ON the frame: both would scale or fade
   the paper and its shadow, which reads as the card zooming. A caller
   that wants an entrance reveals the element around this.

   The frame is a <figure>; `alt` describes the picture, and the caption
   and label are real text. */
const TILT = { l: "tilt-l", r: "tilt-r", "l-lg": "tilt-l-lg", "r-lg": "tilt-r-lg" };

export default function EditorialImage({
  image,
  ratio = "aspect-[4/3]",
  tilt,
  label,
  caption,
  sizes = "(min-width: 1024px) 45vw, 92vw",
  priority = false,
  cast = "cast",
  className = "",
  ...rest
}) {
  return (
    <figure
      data-tone="card"
      className={cx("relative rounded-2xl border-rim p-2.5 sm:p-3", cast, tilt && "flyer", TILT[tilt], className)}
    >
      <div className={cx("overflow-hidden rounded-[10px]", ratio)}>
        {image?.src ? (
          <Picture
            sizes={sizes}
            src={image.src}
            alt={image.alt}
            loading={priority ? undefined : "lazy"}
            fetchpriority={priority ? "high" : undefined}
            decoding="async"
            style={image.focal ? { objectPosition: image.focal } : undefined}
            className="h-full w-full object-cover"
            {...rest}
          />
        ) : (
          <MediaPlaceholder className="h-full w-full" />
        )}
      </div>

      {caption && <figcaption className="px-1 pb-1 pt-3 text-[15px] leading-snug text-quiet">{caption}</figcaption>}

      {label && (
        <p
          data-tone="ink"
          className="type-meta absolute -left-2 bottom-6 max-w-[80%] -rotate-3 rounded-lg px-3.5 py-2.5 text-fg shadow-[3px_3px_0_var(--color-bumble-honey)] sm:-left-4"
        >
          {label}
        </p>
      )}
    </figure>
  );
}
