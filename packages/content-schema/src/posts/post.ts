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

/* A blog post's `category` (Milestone 4): the three blog categories
   (apps/web content/media.js BLOG_CATEGORIES draws their names). Optional —
   a blog post without one is listed under "All" only. News has no
   categories: its taxonomy is its program area (`programId`). */
/* Milestone 5: a story's quotes and impact — the two story fields the
   website's template already draws (apps/web pages/StoryDetail; the source
   shape in content/stories.js), stories only:

     quotes  pull-quotes after the body: the words, as said, and who said
             them — both required, as the website's own content rules
             require (apps/web content/validate.js, docs/CONTENT_GUIDE.md
             `quotes [{ text, attribution }]`). Public: a quote and its
             attribution are shown on the page. A real person's words need RBB's approval and
             their permission (content/stories.js) — the editorial approval
             is that gate; the CMS records no consent here.
     impact  the "Impact" row: the change the story documents, one plain
             line each, as written — like a program's impact lines.

   Each is a list of at least one, or absent (a story without them shows
   neither, as before). Every quote's words and every impact line are
   distinct: the page tells them apart by their text. */
export const StoryQuote = z.strictObject({
  text: text(600),
  attribution: text(160),
});
export type StoryQuote = z.infer<typeof StoryQuote>;
export const STORY_QUOTES_MAX = 6;
export const STORY_IMPACT_MAX = 12;
const distinct = <T>(key: (item: T) => string, noun: string) => (items: T[], ctx: z.RefinementCtx) => {
  const seen = new Set<string>();
  items.forEach((item, i) => {
    const k = key(item).trim();
    if (seen.has(k)) ctx.addIssue({ code: "custom", path: [i], message: `repeats an earlier ${noun}` });
    seen.add(k);
  });
};
export const StoryQuotes = z.array(StoryQuote).min(1).max(STORY_QUOTES_MAX).superRefine(distinct((q: StoryQuote) => q.text, "quote"));
export const StoryImpact = z.array(text(200)).min(1).max(STORY_IMPACT_MAX).superRefine(distinct((line: string) => line, "line"));

export const BLOG_CATEGORY_IDS = ["reflections", "field-notes", "how-to"] as const;

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
  /* Stories only (Milestone 5). */
  quotes: StoryQuotes.optional(),
  impact: StoryImpact.optional(),
  seo: SeoOverrides.optional(),
});
export type Post = z.infer<typeof Post>;
