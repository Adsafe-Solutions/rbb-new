import type { Post } from "@rbb/content-schema";

/* The four story types, by the names the website gives them (apps/web
   content/stories.js STORY_CATEGORIES; the contract's STORY_CATEGORY_IDS). */
export const STORY_CATEGORIES: { value: NonNullable<Post["category"]>; label: string }[] = [
  { value: "news", label: "News & Updates" },
  { value: "field", label: "Field Stories" },
  { value: "impact", label: "Impact Stories" },
  { value: "community", label: "Community Stories" },
];
export const categoryLabel = (id: string | undefined) => STORY_CATEGORIES.find((c) => c.value === id)?.label ?? "—";
