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

/* The point of an image to keep in frame when a layout crops it
   (Milestone 2): "X% Y%" — horizontal, then vertical, whole percentages
   from 0 to 100, one space between. It is CSS's `object-position`, as the
   website's own photographs already write it ("72% 45%"). Absent means
   centred ("50% 50%"), which is also what the browser does by default. */
export const FOCAL_POINT_PATTERN = /^(\d{1,3})% (\d{1,3})%$/;
export const isFocalPoint = (value: unknown): value is string => {
  const m = typeof value === "string" ? FOCAL_POINT_PATTERN.exec(value) : null;
  return Boolean(m && Number(m[1]) <= 100 && Number(m[2]) <= 100);
};
export const FocalPoint = z.string().refine(isFocalPoint, 'must be a focal point like "50% 40%": two whole percentages from 0 to 100');

export const MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "application/pdf"] as const;

export const Media = z
  .strictObject({
    ...recordFields,
    id: MediaId,
    kind: MediaKind,
    alt: z.string().max(300),
    decorative: z.boolean().optional(),
    /* The point to keep in frame when an image is cropped: "72% 45%". */
    focal: FocalPoint.optional(),
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
