import { z } from "zod";
import { recordFields } from "../common/record.ts";
import { EntityId, IsoDate, MediaId, Slug, text } from "../common/primitives.ts";
import { RichText } from "../richText/richText.ts";
import { SeoOverrides } from "../seo/seo.ts";

/* One article model for the three kinds the site publishes today, which
   share their shape (title, date, image, paragraphs, a category):

     story   /stories/<slug>        content/stories.js
     news    /media/news/<slug>     content/media.js NEWS
     blog    /media/blogs/<slug>    content/media.js BLOGS

   `type` decides the route and the listing a post appears in; each keeps
   its own address. `category` is a slug from that type's own taxonomy
   (story categories, blog categories; news has none). */
export const PostType = z.enum(["story", "news", "blog"]);
export type PostType = z.infer<typeof PostType>;

/* A story's `category`: the four story types (apps/web content/stories.js
   STORY_CATEGORIES draws their names). M12: stories are managed in the
   CMS as posts of type "story", with their program, project, gallery and
   related stories. */
export const STORY_CATEGORY_IDS = ["news", "field", "impact", "community"] as const;

export const Post = z.strictObject({
  ...recordFields,
  type: PostType,
  slug: Slug,
  title: text(160),
  excerpt: text(400).optional(),
  date: IsoDate.optional(),
  category: Slug.optional(),
  author: text(120).optional(),
  imageId: MediaId.optional(),
  body: RichText,
  programId: Slug.optional(),
  projectId: Slug.optional(),
  location: text(120).optional(),
  featured: z.boolean().optional(),
  /* Further photographs shown with the article (a story's `media`). */
  galleryIds: z.array(MediaId).max(12).optional(),
  relatedPostIds: z.array(EntityId).max(6).optional(),
  seo: SeoOverrides.optional(),
});
export type Post = z.infer<typeof Post>;
