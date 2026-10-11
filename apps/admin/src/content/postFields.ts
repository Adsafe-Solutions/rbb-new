/* Milestone 4: the post fields each type keeps to itself, as the website
   draws them — a news item's program area, a blog post's category (the
   contract's BLOG_CATEGORY_IDS; apps/web content/media.js BLOG_CATEGORIES
   names them). The API refuses the other type's field, so changing the
   type clears it in the same save. */

export type PostKind = "news" | "blog";

export const BLOG_CATEGORIES: { value: string; label: string }[] = [
  { value: "reflections", label: "Reflections" },
  { value: "field-notes", label: "Field notes" },
  { value: "how-to", label: "How to help" },
];

/* The changes a type switch makes: the new type, and the field only the
   old type has, cleared (undefined is sent as null). */
export function typeChange(type: PostKind): { type: PostKind; programId?: undefined; category?: undefined } {
  return type === "blog" ? { type, programId: undefined } : { type, category: undefined };
}
