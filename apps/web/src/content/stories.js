/* Stories — Document 07. The single source for stories: the /stories
   hub, every /stories/<slug> page, the homepage's "Stories of change" and
   /impact's impact stories all read from here. Other content REFERENCES a
   story by its slug; nothing copies a story's text.

   ⚠ No story, person, name, quotation, location, date, partner, outcome,
   statistic, testimonial, photograph or personal detail may be written
   here AS IF IT WERE RBB'S OWN unless RBB has supplied and approved it.
   Quotes, names and images of real people need RBB's explicit approval
   and the subject's permission. The site this replaced carried another
   charity's blog posts; none return.

   2026-10-13: the stories are the CMS's only (Admin → Stories): the
   published snapshot sets STORIES. The sample stories this file used to
   hold were removed once the live snapshot was shown to replace them.
   What stays here: the categories, the lookups and the pages' wording. */

import { BRAND } from "./brand.js";
import { WORKING_PHOTOS as IMG } from "./photos.js";
import { isWorkingContent } from "../lib/releaseMarkers.js";

/* ---------------- Categories ----------------
   The four story types. `description` is the one line the hub shows for
   each (PROPOSED interface copy, from Document 07's own definitions). */
export const STORY_CATEGORIES = [
  { id: "news", label: "News & Updates", description: "Official updates and announcements." },
  { id: "field", label: "Field Stories", description: "Stories from our work and the communities we work with." },
  { id: "impact", label: "Impact Stories", description: "Stories of documented change." },
  { id: "community", label: "Community Stories", description: "Community experiences and voices." },
];

/* ---------------- Stories ----------------
   Only `slug`, `title` and `status: "approved"` are needed for a story to
   appear; everything else renders only when present.

     {
       id, slug, title,
       status:          "draft" | "pending-review" | "approved" | "archived"
                        — internal; ONLY "approved" is ever shown
       category:        one of STORY_CATEGORIES ids
       excerpt, date, author, featured, image, body, location,
       programId, projectId, impact, quotes, media, relatedStoryIds
     }
*/
export const STORIES = [];

/* Whether the stories are the CMS's (M15) — set by the published
   snapshot (scripts/snapshot-adapter.mjs), with STORIES. */
export const STORY_SOURCE = { cms: false };

/* ---------------- Lookups ----------------
   Everything goes through `published`, so a story that is not approved is
   never shown anywhere — not on a card, not at its own URL. */
export const published = () => STORIES.filter((story) => story.status === "approved");
export const storyBySlug = (slug) => published().find((story) => story.slug === slug);
export const featuredStory = () => published().find((story) => story.featured);
export const storiesIn = (categoryId) => published().filter((story) => story.category === categoryId);
export const categoryById = (id) => STORY_CATEGORIES.find((c) => c.id === id);
export const storyPath = (story) => `/stories/${story.slug}`;

/* Newest first where dates exist; undated stories keep their list order
   after the dated ones. */
export const latestStories = (limit) =>
  [...published()]
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .slice(0, limit);

/* A story as the shared card components draw it (StoriesOfChange,
   StoryList): only the fields the story has. */
/* `sample` — the release markers' own test on the record — travels with
   the card as an invisible `data-release-marker` attribute, so a page
   that lists sample stories is still found by every HTML scan (the
   prerender indexing gate, the readiness scan). It is not shown. */
const SAMPLE_LABEL = "Sample story";
export const storyCard = (story) => ({
  title: story.title,
  sample: isWorkingContent(story) ? SAMPLE_LABEL : undefined,
  category: categoryById(story.category)?.label,
  excerpt: story.excerpt,
  date: story.date,
  image: story.image,
  to: storyPath(story),
});

/* ---------------- Page copy ----------------
   Headings and labels are PROPOSED interface copy. */
export const STORIES_PAGES = {
  hub: {
    kicker: "Stories",
    heading: "Stories",
    body: `News, updates and stories from the work of ${BRAND.fullName}.`,
    featured: {
      kicker: "Featured story",
      heading: "In focus",
      empty: "A featured story will appear here once Rising Beyond Borders has approved one.",
    },
    browse: {
      kicker: "All stories",
      heading: "Latest stories",
      empty: "Stories and updates to be provided and reviewed by Rising Beyond Borders.",
      filtered: "Showing",
      showAll: "Show all stories",
    },
    types: {
      kicker: "Browse by type",
      heading: "Types of story",
      none: "Stories to come.",
      count: (n) => `${n} ${n === 1 ? "story" : "stories"}`,
      current: "Showing now",
    },
    related: {
      kicker: "Related work",
      heading: "Explore the work behind the stories",
      cta: { label: "All Program Areas", to: "/work" },
    },
    newsletter: {
      kicker: "Stay updated",
      heading: "News by email",
      /* No sign-up yet: the section is left out, not announced. */
      empty: null,
      image: IMG.gathering,
    },
    closing: {
      heading: "Be part of the story.",
      ctas: {
        primary: { label: "Get Involved", to: "/get-involved" },
        secondary: { label: "Explore Our Impact", to: "/impact" },
      },
    },
  },
  detail: {
    readLabel: "Read Story",
    byline: "By",
    location: "Location",
    related: "Related work",
    impact: "Impact",
    media: "Gallery",
    relatedStories: "Related stories",
    closing: {
      heading: "More from Rising Beyond Borders.",
      ctas: {
        primary: { label: "All Stories", to: "/stories" },
        secondary: { label: "Get Involved", to: "/get-involved" },
      },
    },
  },
};

export default STORIES;
