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

   The eight stories below are WORKING placeholders (Document 27), kept
   here — not in a separate tree — so the hub, category filters, the
   detail template and related stories all have something to review. Every
   one opens by saying it is invented; nothing in it is presented as an
   RBB fact. Replace with RBB's approved stories before launch. */

import { BRAND } from "./brand.js";
import { WORKING_PHOTOS as IMG } from "./photos.js";

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
const NOTE =
  "This is a working placeholder story used to preview this page — the people, places and details below are invented. Replace with a story approved by Rising Beyond Borders.";
export const STORIES = [
  {
    /* WORKING placeholder (Document 27) — see NOTE, which opens the body. */
    status: "approved",
    author: "Demo Author",
    id: "learning-to-read",
    slug: "learning-to-read-together",
    title: "Learning to read, together",
    category: "field",
    excerpt: "How one after-school reading club grew from ten children to sixty in a single year.",
    date: "2026-08-18",
    featured: true,
    image: IMG.readingCircle,
    programId: "education",
    projectId: "community-reading-clubs",
    location: "South Asia · demo location",
    body: [
      NOTE,
      "The first reading club met in a borrowed room with ten children and a single shelf of books. By the end of the year, sixty children were coming every week.",
      "Volunteers read aloud, then children took turns reading to each other. Older children began helping the younger ones, and parents started dropping in to listen.",
      "The club now lends books to take home, so reading carries on between sessions.",
    ],
    quotes: [{ text: "My daughter reads to her little brother every night now.", attribution: "A parent (demo quotation)" }],
    impact: ["Demo figure: 60 children attending weekly", "Demo figure: 400 books lent in a term"],
    media: [IMG.girlReading, IMG.teacherClassroom],
    relatedStoryIds: ["a-classroom-with-enough-books", "packing-day"],
  },
  {
    /* WORKING placeholder (Document 27) — see NOTE, which opens the body. */
    status: "approved",
    author: "Demo Author",
    id: "classroom-books",
    slug: "a-classroom-with-enough-books",
    title: "A classroom with enough books",
    category: "impact",
    excerpt: "What changed when every child in one classroom had their own notebook and reader.",
    date: "2026-07-02",
    image: IMG.ruralClassroom,
    programId: "education",
    projectId: "classroom-supplies",
    body: [
      NOTE,
      "Before the supplies arrived, children shared one reader between four. Lessons slowed to the pace of the slowest page-turn.",
      "With a reader and notebook each, the teacher could set work for everyone at once and spend her time with the children who needed help.",
    ],
    impact: ["Demo figure: 85 classrooms equipped", "Demo figure: every pupil with a reader"],
    relatedStoryIds: ["learning-to-read-together"],
  },
  {
    /* WORKING placeholder (Document 27) — see NOTE, which opens the body. */
    status: "approved",
    author: "Demo Author",
    id: "water",
    slug: "water-close-to-home",
    title: "Water close to home",
    category: "community",
    excerpt: "A repaired hand pump means an hour saved every day for the families who use it.",
    date: "2026-06-11",
    image: IMG.waterPump,
    programId: "health-wellbeing",
    projectId: "clean-water-points",
    body: [
      NOTE,
      "When the pump broke, the nearest clean water was an hour's walk away. Repairing it, and training a small committee to look after it, brought water back to the centre of the village.",
      "The committee now collects a small fee for spare parts, so the next repair does not have to wait for outside help.",
    ],
    quotes: [{ text: "The children go to school on time now.", attribution: "A committee member (demo quotation)" }],
    media: [IMG.drinkingWater],
    relatedStoryIds: ["health-day-in-the-square"],
  },
  {
    /* WORKING placeholder (Document 27) — see NOTE, which opens the body. */
    status: "approved",
    author: "Demo Author",
    id: "health-day",
    slug: "health-day-in-the-square",
    title: "A health day in the square",
    category: "field",
    excerpt: "Screening, advice and referrals — a day with the community health team.",
    date: "2026-05-20",
    image: IMG.checkup,
    programId: "health-wellbeing",
    projectId: "community-health-days",
    body: [
      NOTE,
      "By nine in the morning a line had formed. Local health workers checked blood pressure, weighed babies and answered questions about nutrition.",
      "Anyone who needed more than a check-up left with a referral to the nearest clinic and a note of when to go.",
    ],
    media: [IMG.healthTeam],
    relatedStoryIds: ["water-close-to-home"],
  },
  {
    /* WORKING placeholder (Document 27) — see NOTE, which opens the body. */
    status: "approved",
    author: "Demo Author",
    id: "sewing",
    slug: "from-one-sewing-machine",
    title: "From one sewing machine to a workshop",
    category: "impact",
    excerpt: "A tailoring graduate now trains others from her own small workshop.",
    date: "2026-04-09",
    image: IMG.sewing,
    programId: "livelihoods",
    projectId: "tailoring-skills",
    body: [
      NOTE,
      "She joined the tailoring course with no experience and left with a starter kit and her first customers.",
      "Two years on, she runs a small workshop and has taken on two apprentices of her own.",
    ],
    impact: ["Demo figure: 2 apprentices trained", "Demo figure: 1 workshop opened"],
    relatedStoryIds: ["market-day"],
  },
  {
    /* WORKING placeholder (Document 27) — see NOTE, which opens the body. */
    status: "approved",
    author: "Demo Author",
    id: "market",
    slug: "market-day",
    title: "Market day",
    category: "community",
    excerpt: "Traders on how a little training in record-keeping changed how they plan.",
    date: "2026-03-15",
    image: IMG.market,
    programId: "livelihoods",
    projectId: "market-traders",
    body: [
      NOTE,"For most traders, keeping records meant remembering. A short course in simple bookkeeping showed them which goods made money and which did not."],
    media: [IMG.vegetableSeller, IMG.harvest],
    relatedStoryIds: ["from-one-sewing-machine"],
  },
  {
    /* WORKING placeholder (Document 27) — see NOTE, which opens the body. */
    status: "approved",
    author: "Demo Author",
    id: "packing-day",
    slug: "packing-day",
    title: "Packing day",
    category: "news",
    excerpt: "Volunteers packed essentials boxes for households across the district.",
    date: "2026-09-05",
    image: IMG.packing,
    programId: "community-support",
    projectId: "essentials-distribution",
    body: [
      NOTE,
      "More than forty volunteers spent the day packing boxes of food and essentials, ready for delivery the following week.",
      "Thank you to everyone who gave their time.",
    ],
    media: [IMG.foodPrep, IMG.aidBoxes, IMG.reliefPacking],
    relatedStoryIds: ["new-volunteer-programme"],
  },
  {
    /* WORKING placeholder (Document 27) — see NOTE, which opens the body. */
    status: "approved",
    author: "Demo Author",
    id: "volunteer-programme",
    slug: "new-volunteer-programme",
    title: "A new volunteer programme",
    category: "news",
    excerpt: "An update on how volunteers can get involved this season.",
    date: "2026-09-12",
    image: IMG.gathering,
    programId: "community-support",
    body: [
      NOTE,"This season brings new ways to volunteer, from packing days to reading clubs. Anyone interested can register through the Volunteer page."],
    relatedStoryIds: ["packing-day"],
  },
];

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
export const storyCard = (story) => ({
  title: story.title,
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
      empty: "Newsletter sign-up to be provided by Rising Beyond Borders.",
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
