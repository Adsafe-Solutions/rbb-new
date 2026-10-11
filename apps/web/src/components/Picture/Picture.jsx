import manifest from "../../assets/responsive/manifest.json";
import { focalPosition } from "../../lib/focal.js";

/* A photograph at the size the layout needs — Document 15.

   `src` is the original JPEG as content/ imports it. If
   scripts/responsive-images.mjs has made WebP copies of it
   (src/assets/responsive/), the browser picks the smallest copy that
   fills the slot (`sizes`), and the original stays as the fallback <img>
   for anything without WebP. With no copies — a newly approved photo not
   yet processed — it is a plain <img>, so nothing breaks.

   `width`/`height` come from the original, so the browser reserves the
   right aspect ratio before a byte arrives. Everything else (alt,
   loading, className, style) passes straight to the <img>, and <picture>
   is `display: contents`, so layouts written for a bare <img> are
   unchanged. */
const COPIES = import.meta.glob("../../assets/responsive/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

/* "/assets/rbb-field-kids-B7wJjOva.jpg" (build) or
   "/src/assets/rbb-field-kids.jpg" (dev) → the manifest entry for
   "rbb-field-kids", trying the name as-is first so a file whose own name
   ends in eight word characters is never mistaken for a hashed one. */
const entryFor = (src) => {
  const file = String(src)
    .split("/")
    .pop()
    .replace(/\.\w+$/, "");
  if (manifest[file]) return [file, manifest[file]];
  const unhashed = file.replace(/-[\w-]{8}$/, "");
  return manifest[unhashed] ? [unhashed, manifest[unhashed]] : [null, null];
};

/* `focal` (Milestone 2): the point to keep in frame when the image is
   cropped (lib/focal.js) — set as object-position, and only when it is a
   valid one; without it the style is exactly what was passed. */
export default function Picture({ src, sizes = "100vw", ...props }) {
  const position = focalPosition(props.focal);
  /* The <img>'s attributes in the order they were given, `style` where
     `focal` was — so a page renders exactly as it did when components
     wrote object-position themselves. */
  const img = {};
  for (const [key, value] of Object.entries(props)) {
    if (key === "focal") {
      if (position) img.style = { ...props.style, objectPosition: position };
    } else if (!(key === "style" && position)) img[key] = value;
  }
  const [name, entry] = entryFor(src);
  if (!entry) return <img src={src} {...img} />;

  const srcSet = entry.widths
    .map((w) => {
      const url = COPIES[`../../assets/responsive/${name}-${w}.webp`];
      return url && `${url} ${w}w`;
    })
    .filter(Boolean)
    .join(", ");

  return (
    <picture className="contents">
      <source type="image/webp" srcSet={srcSet} sizes={sizes} />
      <img src={src} width={entry.width} height={entry.height} {...img} />
    </picture>
  );
}
