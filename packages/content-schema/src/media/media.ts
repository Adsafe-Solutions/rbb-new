import { z } from "zod";
import { recordFields } from "../common/record.ts";
import { MediaId, text } from "../common/primitives.ts";

/* A Media record — what content points at with a `…Id` field. Content
   never holds a URL or a file path for its images; it holds the record's
   id, and the deployment resolves it: today to a local asset in
   apps/web/src/assets, later to an object in R2.

   Alt text is required for a meaningful image; a decorative one has
   empty alt text — the rule the web's content validator already
   enforces. */
export const MediaKind = z.enum(["image", "document"]);

export const MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "application/pdf"] as const;

export const Media = z
  .strictObject({
    ...recordFields,
    id: MediaId,
    kind: MediaKind,
    alt: z.string().max(300),
    decorative: z.boolean().optional(),
    /* The point to keep in frame when an image is cropped: "72% 45%". */
    focal: z.string().regex(/^\d{1,3}% \d{1,3}%$/, 'must be a focal point like "50% 40%"').optional(),
    /* Storage facts — set by the upload process once media lives in R2.
       Source-controlled local assets do not record them. */
    filename: text(255).optional(),
    mimeType: z.enum(MIME_TYPES).optional(),
    width: z.int().positive().optional(),
    height: z.int().positive().optional(),
    bytes: z.int().positive().optional(),
    /* Provenance — what docs/IMAGE_INVENTORY.md records by hand today. */
    credit: text(200).optional(),
    source: text(500).optional(),
    licence: text(200).optional(),
  })
  .superRefine((media, ctx) => {
    if (media.kind !== "image") return;
    if (media.decorative && media.alt !== "")
      ctx.addIssue({ code: "custom", path: ["alt"], message: "a decorative image must have empty alt text" });
    if (!media.decorative && media.alt.trim() === "")
      ctx.addIssue({ code: "custom", path: ["alt"], message: "an image needs alt text (or decorative: true)" });
  });
export type Media = z.infer<typeof Media>;
