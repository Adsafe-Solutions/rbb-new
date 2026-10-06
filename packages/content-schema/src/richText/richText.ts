import { z } from "zod";
import { Href } from "../common/link.ts";

/* Long-form text as structured JSON — never HTML. The renderer maps each
   node to an element it controls, so there is nothing to sanitize: a
   document can only ever contain what is listed here.

     blocks   paragraph · heading (h2, h3) · list (bullet, ordered)
     inline   text (optionally bold / italic) · link (safe href only)

   No raw HTML, embeds, images, scripts, styles or classes. */

export const Mark = z.enum(["bold", "italic"]);

export const TextNode = z.strictObject({
  type: z.literal("text"),
  text: z.string().min(1).max(5000),
  marks: z
    .array(Mark)
    .max(2)
    .refine((marks) => new Set(marks).size === marks.length, "marks must not repeat")
    .optional(),
});

export const LinkNode = z.strictObject({
  type: z.literal("link"),
  href: Href,
  children: z.array(TextNode).min(1),
});

export const Inline = z.discriminatedUnion("type", [TextNode, LinkNode]);

export const ParagraphNode = z.strictObject({
  type: z.literal("paragraph"),
  children: z.array(Inline).min(1),
});

export const HeadingNode = z.strictObject({
  type: z.literal("heading"),
  level: z.union([z.literal(2), z.literal(3)]),
  children: z.array(Inline).min(1),
});

export const ListNode = z.strictObject({
  type: z.literal("list"),
  style: z.enum(["bullet", "ordered"]),
  items: z.array(z.array(Inline).min(1)).min(1),
});

export const RichText = z.array(z.discriminatedUnion("type", [ParagraphNode, HeadingNode, ListNode])).min(1);
export type RichText = z.infer<typeof RichText>;
