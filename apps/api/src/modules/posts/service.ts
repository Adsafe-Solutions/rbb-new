import { z } from "zod";
import { BLOG_CATEGORY_IDS, Post } from "@rbb/content-schema";
import type { CollectionConfig } from "../content/service.ts";
import { referenceProblems, type ReferenceTarget } from "../content/shared.ts";
import { isApproval } from "../content/workflow.ts";

/* Posts — news and blog articles (the content contract's Post).

   Editable in the CMS: type (news | blog), title, slug, excerpt, date,
   author, featured image, body (structured rich text — never HTML), SEO;
   and (Milestone 4) a news item's program area and a blog post's category.
   Stories are posts too, but their own module since M12 (stories/): this
   collection's store is scoped to news and blog posts (POST_TYPES), so
   /api/v1/posts never sees, edits or counts a story.

   Each type keeps to its own taxonomy, as the website draws it:
     news  `programId` — a program's slug, checked at save like a story's
           (this organization's, not archived, approved or live by the
           time the item is approved). Absent: no program is shown, as
           before. A news item has no `category`.
     blog  `category` — one of BLOG_CATEGORY_IDS. Absent: the post is
           listed under "All" only, as before. A blog post has no
           `programId`.
   A field the other type uses is refused by name, never kept unseen:
   changing a post's type means clearing it (null) in the same save. */

export const POST_TYPES = ["news", "blog"] as const;

const editable = { type: z.enum(["news", "blog"]), title: z.unknown(), slug: z.unknown(), excerpt: z.unknown(), date: z.unknown(), author: z.unknown(), category: z.unknown(), imageId: z.unknown(), body: z.unknown(), programId: z.unknown(), seo: z.unknown() };

export const POST_COLLECTION: CollectionConfig<Post & { title: string }> = {
  kind: "post",
  contract: Post as z.ZodType<Post & { title: string }>,
  fields: editable,
  required: ["type", "title", "body"],
  defaults: () => ({}),
  rules: (post) => [
    ...(post.type === "news" && post.category !== undefined ? [{ path: "body.category", message: "news has no category; its program area is its taxonomy" }] : []),
    ...(post.type === "blog" && post.category !== undefined && !(BLOG_CATEGORY_IDS as readonly string[]).includes(post.category) ? [{ path: "body.category", message: `must be one of ${BLOG_CATEGORY_IDS.join(", ")}` }] : []),
    ...(post.type === "blog" && post.programId !== undefined ? [{ path: "body.programId", message: "a blog post has no program area; only news items do" }] : []),
  ],
  media: (post) => [
    ["body.imageId", post.imageId],
    ["body.seo.ogImageId", post.seo?.ogImageId],
  ],
  opaque: ["body"],
  listTypes: ["news", "blog"],
};

/* The collection with its program reference checked against this
   organization's programs (by slug). Archiving is never blocked by what a
   post names. */
export const postCollection = (refs: { programs: ReferenceTarget }): CollectionConfig<Post & { title: string }> => ({
  ...POST_COLLECTION,
  async check(post) {
    if (post.status === "archived" || !post.programId) return [];
    return referenceProblems(refs.programs, [post.programId], { path: "body.programId", noun: "program", by: "slug", publishing: isApproval(post.status) });
  },
});
