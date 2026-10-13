/* Every image is optimised IN THE BROWSER before it is uploaded
   (2026-10-13): converted to WebP and, when larger than the website could
   ever show, scaled down. The file still goes straight to storage — the API
   never sees the bytes — and the API still checks what arrives.

   · WebP at quality 0.85 for photographs, 0.9 for PNG (graphics, logos,
     transparency): no visible loss on the website, typically a fraction of
     the original's size.
   · Longest side at most 3200px: the widest image the website draws is a
     full-width band at about 1440px, so 3200px stays sharp on a 2× screen.
   · Orientation from the camera is applied; camera metadata (EXIF, GPS
     location) is not carried over.
   · The original is kept when converting would not make it smaller (for a
     WebP original, at least 10% smaller) and it was not scaled down, or
     when this browser cannot encode WebP (it then uploads as it is, in a
     type the API accepts).
   Anything a browser can open converts — so GIF or BMP become WebP too.
   SVG is never accepted (see apps/api media policy). */

export const MAX_EDGE = 3200;
/* Larger than this is not even tried: decoding it could exhaust the tab. */
export const MAX_INPUT_BYTES = 60 * 1024 * 1024;
const MAX_PIXELS = 100_000_000;

export interface Optimised {
  file: File;
  /* True when `file` is the WebP made here. */
  converted: boolean;
  originalSize: number;
  originalType: string;
  width: number | null;
  height: number | null;
}

/* The size to draw at: the same, or scaled so the longest side is maxEdge. */
export function targetSize(width: number, height: number, maxEdge = MAX_EDGE): { width: number; height: number; scaled: boolean } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height, scaled: false };
  const ratio = maxEdge / longest;
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)), scaled: true };
}

export const qualityFor = (type: string) => (type === "image/png" ? 0.9 : 0.85);

/* "Field Day.JPG" → "Field Day.webp". */
export const webpName = (name: string) => `${name.replace(/\.[A-Za-z0-9]{1,10}$/, "") || "image"}.webp`;

/* Use the WebP only when it helps: the original was too large, or the WebP
   is smaller. An original that is already WebP is re-encoded only for a
   real saving (10%+), since every lossy re-encode costs a little detail. */
export const useConverted = (originalSize: number, convertedSize: number, scaled: boolean, originalType = "") =>
  scaled || convertedSize < (originalType === "image/webp" ? originalSize * 0.9 : originalSize);

/* May this file be tried at all? */
export const convertible = (file: File) => file.type.startsWith("image/") && file.type !== "image/svg+xml" && file.size > 0 && file.size <= MAX_INPUT_BYTES;

async function encode(bitmap: ImageBitmap, width: number, height: number, quality: number): Promise<Blob | null> {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);
    return canvas.convertToBlob({ type: "image/webp", quality });
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
}

export async function optimiseImage(file: File): Promise<Optimised> {
  const unchanged: Optimised = { file, converted: false, originalSize: file.size, originalType: file.type, width: null, height: null };
  if (!convertible(file) || typeof createImageBitmap !== "function") return unchanged;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    if (bitmap.width * bitmap.height > MAX_PIXELS) return unchanged;
    const size = targetSize(bitmap.width, bitmap.height);
    const blob = await encode(bitmap, size.width, size.height, qualityFor(file.type));
    // A browser that cannot encode WebP hands back a PNG instead.
    if (!blob || blob.type !== "image/webp" || !useConverted(file.size, blob.size, size.scaled, file.type)) return unchanged;
    return {
      file: new File([blob], webpName(file.name), { type: "image/webp", lastModified: file.lastModified }),
      converted: true,
      originalSize: file.size,
      originalType: file.type,
      width: size.width,
      height: size.height,
    };
  } catch {
    // Not an image this browser can open: upload it as it is; the type check decides.
    return unchanged;
  } finally {
    bitmap?.close();
  }
}
