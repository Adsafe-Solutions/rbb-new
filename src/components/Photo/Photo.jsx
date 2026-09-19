import { cx } from "../../lib/cx.js";

/* A photograph, or a stand-in for one that has not arrived yet.

   Photography is the emotional engine of this design — it occupies 50-60%
   of most sections — so the layout cannot be judged with the images
   missing. When a content entry names a `photo` label instead of a `src`,
   this draws a tonal placeholder at the right aspect ratio with the label
   on it, so every section holds its true shape from the first render.

   Dropping real art in is one edit at the content file: replace
   `photo: "portrait-seafront"` with `src: portraitSeafront` (an import
   from src/assets/). Nothing here or in the sections changes.

   ⚠ `alt` is required and is NOT the placeholder label. The label is a
   production note; the alt text describes the photograph to someone who
   cannot see it. A decorative image passes alt="". */
export default function Photo({
  src,
  alt = "",
  label,
  ratio = "4/5",
  className = "",
  imgClassName = "",
  children,
}) {
  return (
    <div
      className={cx("relative overflow-hidden rounded-2xl bg-mist", className)}
      style={{ aspectRatio: ratio }}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={cx("h-full w-full object-cover", imgClassName)}
        />
      ) : (
        /* The stand-in. Warm rather than grey — a neutral block next to the
           honey bands reads as a broken image, a warm one reads as art
           that is on its way. `aria-hidden` because the label is a note to
           the team, not content: a screen reader announcing
           "portrait-seafront" is noise. */
        <div
          aria-hidden="true"
          className={cx(
            "flex h-full w-full items-center justify-center",
            "bg-gradient-to-br from-pollen/70 via-mist to-bumble-honey/40"
          )}
        >
          <span
            className={cx(
              "px-4 text-center text-[length:var(--text-caption)]",
              "font-medium tracking-caption text-graphite"
            )}
          >
            {label ?? "photo"}
          </span>
        </div>
      )}
      {children}
    </div>
  );
}
