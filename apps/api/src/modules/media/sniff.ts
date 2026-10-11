import type { MediaMimeType } from "./policy.ts";

/* What a file REALLY is, from its first bytes — never from its name or
   the type the browser claimed. Used when an upload is completed: the
   object's leading bytes must carry the signature of the declared type.
   An HTML page, an SVG or an executable renamed to .jpg fails here.

   Also reads the pixel dimensions where the header holds them (PNG, WebP,
   AVIF, and JPEG when its frame header is within the bytes read), so the
   stored width/height come from the file, not from the client. */

export const SNIFF_BYTES = 64 * 1024;

export interface Sniffed {
  mimeType: MediaMimeType;
  width: number | null;
  height: number | null;
}

const ascii = (bytes: Uint8Array, start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
const u16be = (b: Uint8Array, i: number) => (b[i]! << 8) | b[i + 1]!;
const u32be = (b: Uint8Array, i: number) => ((b[i]! << 24) >>> 0) + (b[i + 1]! << 16) + (b[i + 2]! << 8) + b[i + 3]!;
const u24le = (b: Uint8Array, i: number) => b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16);
const dims = (width: number, height: number) => (width > 0 && height > 0 ? { width, height } : { width: null, height: null });

function jpegSize(b: Uint8Array): { width: number | null; height: number | null } {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return dims(0, 0);
    const marker = b[i + 1]!;
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const length = u16be(b, i + 2);
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame) return dims(u16be(b, i + 7), u16be(b, i + 5));
    if (length < 2) return dims(0, 0);
    i += 2 + length;
  }
  return dims(0, 0);
}

function webpSize(b: Uint8Array): { width: number | null; height: number | null } {
  const chunk = ascii(b, 12, 4);
  if (chunk === "VP8 " && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) return dims(((b[27]! << 8) | b[26]!) & 0x3fff, ((b[29]! << 8) | b[28]!) & 0x3fff);
  if (chunk === "VP8L" && b[20] === 0x2f)
    return dims(1 + (((b[22]! & 0x3f) << 8) | b[21]!), 1 + (((b[24]! & 0x0f) << 10) | (b[23]! << 2) | ((b[22]! & 0xc0) >> 6)));
  if (chunk === "VP8X") return dims(1 + u24le(b, 24), 1 + u24le(b, 27));
  return dims(0, 0);
}

function avifSize(b: Uint8Array): { width: number | null; height: number | null } {
  for (let i = 0; i + 16 <= b.length; i++)
    if (b[i] === 0x69 && ascii(b, i, 4) === "ispe") return dims(u32be(b, i + 8), u32be(b, i + 12));
  return dims(0, 0);
}

export function sniffImage(bytes: Uint8Array): Sniffed | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mimeType: "image/jpeg", ...jpegSize(b) };
  if (b.length >= 24 && ascii(b, 0, 8) === "\x89PNG\r\n\x1a\n" && ascii(b, 12, 4) === "IHDR") return { mimeType: "image/png", ...dims(u32be(b, 16), u32be(b, 20)) };
  if (b.length >= 30 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return { mimeType: "image/webp", ...webpSize(b) };
  if (b.length >= 16 && ascii(b, 4, 4) === "ftyp") {
    const boxSize = Math.min(u32be(b, 0), b.length);
    const brands = [ascii(b, 8, 4)];
    for (let i = 16; i + 4 <= boxSize; i += 4) brands.push(ascii(b, i, 4));
    if (brands.includes("avif") || brands.includes("avis")) return { mimeType: "image/avif", ...avifSize(b) };
  }
  return null;
}
