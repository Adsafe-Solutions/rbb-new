import { randomUUID } from "node:crypto";

/* The media rules — every limit and allow-list in ONE place. The admin
   mirrors MEDIA_POLICY's numbers for instant feedback (GET
   /api/v1/media/policy), but only the API enforces them.

   IMAGES ONLY, for now. The website's media today is photographs and
   illustrations; nothing on the site needs an uploaded document yet. The
   content contract already knows application/pdf, so documents are one
   entry here when a milestone needs them (annual reports, for example).

   NO SVG. An SVG is a document that can carry script. Served from the
   media domain it would run if opened directly, and safe handling
   (sanitising, or forcing a download/sandbox CSP on the bucket's domain)
   is not something this milestone can guarantee. Logos are the usual
   reason for SVG; upload a PNG or WebP until SVG support is designed.

   SIZE: 10 MiB. The largest image the website uses today is 2.1 MB; 10 MiB
   still takes an unoptimised photograph straight from a phone or camera
   (typically 3–8 MB), and refuses video or archives disguised as images. */

export const MEDIA_POLICY = {
  maxBytes: 10 * 1024 * 1024,
  /* Each allowed type, with the file extensions that may carry it and the
     one extension the stored object gets. */
  types: {
    "image/jpeg": { kind: "image", extensions: ["jpg", "jpeg"], extension: "jpg" },
    "image/png": { kind: "image", extensions: ["png"], extension: "png" },
    "image/webp": { kind: "image", extensions: ["webp"], extension: "webp" },
    "image/avif": { kind: "image", extensions: ["avif"], extension: "avif" },
  },
  /* How long a presigned upload URL works. Long enough to start an
     upload; the transfer itself may take longer once begun. */
  uploadUrlTtlSeconds: 5 * 60,
  /* A pending upload older than this is abandoned (cleanup marks it failed). */
  abandonAfterMs: 60 * 60 * 1000,
  /* Largest image edge accepted, in pixels. */
  maxDimension: 20_000,
  /* Upload intents per member per window (abuse guard on URL issuing). */
  intentLimit: { windowMs: 10 * 60 * 1000, perUser: 100 },
} as const;

export type MediaMimeType = keyof typeof MEDIA_POLICY.types;
export type MediaKind = (typeof MEDIA_POLICY.types)[MediaMimeType]["kind"];
export const MEDIA_MIME_TYPES = Object.keys(MEDIA_POLICY.types) as MediaMimeType[];

export const isMediaMimeType = (value: string): value is MediaMimeType => Object.hasOwn(MEDIA_POLICY.types, value);

export const extensionOf = (filename: string) => {
  const match = /\.([A-Za-z0-9]{1,10})$/.exec(filename);
  return match ? match[1]!.toLowerCase() : null;
};

/* A filename as people see it: Unicode-normalised, no path, no control
   characters, trimmed, bounded. Stored as `originalFilename` for display
   only — it never becomes part of a path unprocessed. */
export function cleanDisplayName(filename: string): string {
  const base = filename.normalize("NFC").split(/[\\/]/).pop() ?? "";
  return base.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").replace(/\s+/g, " ").trim().slice(0, 255);
}

/* The filename part of an object key: ASCII lowercase letters, digits and
   single hyphens only, so no traversal, encoding trick, or HTML can reach
   a key. The extension comes from the TYPE, not from the name. */
export function keySafeName(filename: string, mimeType: MediaMimeType): string {
  const stem = filename
    .replace(/\.[A-Za-z0-9]{1,10}$/, "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
  return `${stem || "image"}.${MEDIA_POLICY.types[mimeType].extension}`;
}

/* The object key for a NEW upload:

     [<env>/]<orgId>/media/<random uuid>/<key-safe name>

   · the uuid is fresh for every upload and is not the record's id, so
     keys never collide, never overwrite, and reveal no database identity
   · the key never changes after creation (a rename edits metadata only)
   · outside production the key starts with "_development/" or "_test/",
     so local and test uploads never land in the production namespace
     even when the bucket is shared */
export function newObjectKey({ orgId, filename, mimeType, env }: { orgId: string; filename: string; mimeType: MediaMimeType; env: "development" | "test" | "production" }): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(orgId)) throw new Error("Refusing to build an object key for an invalid organization id");
  const prefix = env === "production" ? "" : `_${env}/`;
  return `${prefix}${orgId}/media/${randomUUID()}/${keySafeName(filename, mimeType)}`;
}
