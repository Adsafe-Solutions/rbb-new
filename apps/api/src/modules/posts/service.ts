import { z } from "zod";
import { Post } from "@rbb/content-schema";
import type { CollectionConfig } from "../content/service.ts";

/* Posts — news and blog articles (the content contract's Post).

   Editable in the CMS: type (news | blog), title, slug, excerpt, date,
   author, featured image, body (structured rich text — never HTML), SEO.
   Stories are posts too, but their own module since M12 (stories/): this
   collection's store is scoped to news and blog posts (POST_TYPES), so
   /api/v1/posts never sees, edits or counts a story. */

export const POST_TYPES = ["news", "blog"] as const;

const editable = { type: z.enum(["news", "blog"]), title: z.unknown(), slug: z.unknown(), excerpt: z.unknown(), date: z.unknown(), author: z.unknown(), imageId: z.unknown(), body: z.unknown(), seo: z.unknown() };

export const POST_COLLECTION: CollectionConfig<Post & { title: string }> = {
  kind: "post",
  contract: Post as z.ZodType<Post & { title: string }>,
  fields: editable,
  required: ["type", "title", "body"],
  defaults: () => ({}),
  rules: () => [],
  media: (post) => [
    ["body.imageId", post.imageId],
    ["body.seo.ogImageId", post.seo?.ogImageId],
  ],
  opaque: ["body"],
  listTypes: ["news", "blog"],
};
