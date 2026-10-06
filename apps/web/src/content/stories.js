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

   The eight stories below are SAMPLE stories (decision D15), kept here —
   not in a separate tree — so the hub, category filters, the detail
   template and related stories all have something to review. Every one
   opens by saying it is a sample; nothing in it is presented as an RBB
   fact. Replace with RBB's approved stories before launch. */

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
/* Every sample story carries this line as its `note` (shown above the
   article, so the opening paragraph stays the story's own), and its card
   carries the
   "Sample story" stamp (see `storyCard`) — both found by the release
   markers. The stories are written as editorial prototypes: no named
   person, quotation, place, date or figure, because none has been
   supplied. */
const NOTE =
  "Sample story — written to show how stories will appear on this site. It describes no real person, place or event.";
export const STORIES = [
  {
    status: "approved",
    id: "learning-to-read",
    slug: "learning-to-read-together",
    title: "Learning to read, together",
    category: "field",
    excerpt: "Why a quiet hour with books, a little patience and no marks can matter as much as any lesson.",
    featured: true,
    image: IMG.readingCircle,
    programId: "education",
    projectId: "community-reading-clubs",
    releaseMarker: NOTE,
    body: [
      "Most afternoons the room is noisier than a library should be. Children arrive straight from school, drop their bags and go looking for the book they were halfway through the day before.",
      "Reading clubs start from a simple observation: the children who struggle to read in class are often the ones who never get to read for pleasure. Here there are no marks, and no one is in a hurry.",
      "A volunteer reads aloud first, then steps back. Older children begin to help younger ones. A parent waiting at the door sometimes stays to listen, and leaves with a book to share at home.",
      "The lesson for anyone planning this kind of work is that confidence comes before fluency. A child who believes reading is for them will practise; a child who does not will find reasons not to.",
    ],
    media: [IMG.girlReading, IMG.teacherClassroom],
    relatedStoryIds: ["a-classroom-with-enough-books", "packing-day"],
  },
  {
    status: "approved",
    id: "classroom-books",
    slug: "a-classroom-with-enough-books",
    title: "When every learner has a book",
    category: "impact",
    excerpt: "Shared textbooks slow a whole class down. What changes when materials stop being the bottleneck?",
    image: IMG.ruralClassroom,
    programId: "education",
    projectId: "classroom-supplies",
    releaseMarker: NOTE,
    body: [
      "Picture a lesson where one book is shared between several learners. The teacher reads the exercise aloud, copies it onto the board, and waits while it is copied again into notebooks. Half the lesson is gone before the learning starts.",
      "Materials seem like the least interesting part of education, until they are missing. Then they decide how fast a class can move, which children keep up and how much of a teacher's skill ever reaches the room.",
      "Asked what they need, teachers rarely ask for much: enough readers to go round, notebooks, a few things to make an idea visible. The difference is less about the objects than about the time and attention they free up.",
      "Change of this kind is easy to count and easy to overstate. The better question is the one teachers ask themselves: did more children understand today than yesterday?",
    ],
    relatedStoryIds: ["learning-to-read-together"],
  },
  {
    status: "approved",
    id: "water",
    slug: "water-close-to-home",
    title: "Water close to home",
    category: "community",
    excerpt: "A working water point changes the shape of a day — most of all for the people who used to fetch water from far away.",
    image: IMG.waterPump,
    programId: "health-wellbeing",
    projectId: "clean-water-points",
    releaseMarker: NOTE,
    body: [
      "When a water point stops working, the change is not only in what people drink. The walk to the next source eats into the morning; children arrive late to school; water that is not safe starts to look good enough.",
      "Repairing a pump is the easy part. Keeping it working is harder, and it depends less on engineering than on organisation: who notices the first sign of trouble, who holds the money for spare parts, who knows how to fix it.",
      "Where a community takes on that care for itself, a water point stops being a gift that can break and becomes something people own. That is the difference between a repair and a lasting change.",
      "It is a pattern that runs through community health work: the most valuable support is often the kind that makes outside help less necessary next time.",
    ],
    media: [IMG.drinkingWater],
    relatedStoryIds: ["health-day-in-the-square"],
  },
  {
    status: "approved",
    id: "health-day",
    slug: "health-day-in-the-square",
    title: "A health day, start to finish",
    category: "field",
    excerpt: "From the first check-up to the last referral: how an open health day can bring care closer without replacing the services already there.",
    image: IMG.checkup,
    programId: "health-wellbeing",
    projectId: "community-health-days",
    releaseMarker: NOTE,
    body: [
      "A health day begins well before the first visitor arrives: tables set apart for privacy, information in the languages people speak, and a plan for what happens to anyone who needs more than a check-up.",
      "Most people come with small questions — about a child's growth, a persistent cough, what to eat during pregnancy. Answered early, small questions stay small.",
      "The measure of a good day is not how many people are seen but where they go next. A referral is only useful if the person knows where the clinic is, when to go and what to expect when they get there.",
      "Done well, a day like this strengthens the health services a community already has. Done badly, it competes with them. That distinction shapes every decision about how such a day is planned.",
    ],
    media: [IMG.healthTeam],
    relatedStoryIds: ["water-close-to-home"],
  },
  {
    status: "approved",
    id: "sewing",
    slug: "from-one-sewing-machine",
    title: "A skill you can practise at home",
    category: "impact",
    excerpt: "Why practical skills that fit around caring responsibilities can open a door to earning.",
    image: IMG.sewing,
    programId: "livelihoods",
    projectId: "tailoring-skills",
    releaseMarker: NOTE,
    body: [
      "For many people, the barrier to earning is not ability but time and distance. Caring for children or relatives rules out work that is far away or fixed to someone else's hours.",
      "A practical skill such as tailoring can be used at home or close by, picked up and put down around the rest of the day. The first garment sold to a neighbour is a small thing; it is also proof that the skill has value.",
      "The course itself is only the beginning. What matters afterwards is pricing work fairly, keeping track of costs and finding customers — and having others to ask when something goes wrong.",
      "Livelihoods work is often judged by how many people complete a course. A better test is how many are still using what they learned a year later, and whether they are passing it on.",
    ],
    relatedStoryIds: ["market-day"],
  },
  {
    status: "approved",
    id: "market",
    slug: "market-day",
    title: "Keeping count on market day",
    category: "community",
    excerpt: "Simple record-keeping can show a small trader what is working — and what is quietly losing money.",
    image: IMG.market,
    programId: "livelihoods",
    projectId: "market-traders",
    releaseMarker: NOTE,
    body: [
      "For most small traders, keeping records means remembering. A busy stall leaves little time for anything else, and memory is generous about good days and forgetful about losses.",
      "A notebook and a simple habit — what came in, what went out — can change that. Within a few weeks the pattern shows: which goods earn their place on the stall, which tie up money, which season needs saving for.",
      "Traders learn fastest from each other. A group that meets to compare notes turns individual bookkeeping into shared knowledge about a market they all understand.",
      "None of this is dramatic. It is the kind of quiet change that makes a household less vulnerable to the next bad week.",
    ],
    media: [IMG.vegetableSeller, IMG.harvest],
    relatedStoryIds: ["from-one-sewing-machine"],
  },
  {
    status: "approved",
    id: "packing-day",
    slug: "packing-day",
    title: "What goes into a packing day",
    category: "news",
    excerpt: "Behind every essentials pack is a day of planning, sorting and care — and a lot of volunteers.",
    image: IMG.packing,
    programId: "community-support",
    projectId: "essentials-distribution",
    releaseMarker: NOTE,
    body: [
      "A packing day looks simple from the outside: tables, boxes, people passing things along a line. The work that makes it possible starts days before.",
      "Someone has to know which households need support and what they need — not what is easiest to give. Packs are planned around everyday needs, and around the dignity of the people receiving them.",
      "On the day, volunteers sort, pack, check and label. Many come once; some come back every time. What they share is the knowledge that the boxes they fill will be opened in a home that needed them.",
      "The day ends with stacks of packs ready to go. The real work — delivery, follow-up, and connecting families with longer-term help — is only beginning.",
    ],
    media: [IMG.foodPrep, IMG.aidBoxes, IMG.reliefPacking],
    relatedStoryIds: ["new-volunteer-programme"],
  },
  {
    status: "approved",
    id: "volunteer-programme",
    slug: "new-volunteer-programme",
    title: "How volunteering could work",
    category: "news",
    excerpt: "A look at the kinds of contribution volunteers may be able to make as Rising Beyond Borders' programs take shape.",
    image: IMG.gathering,
    programId: "community-support",
    releaseMarker: NOTE,
    body: [
      "Volunteering means different things to different people: an afternoon at a community event, a professional skill offered once, or a regular commitment over many months.",
      "As programs take shape, volunteer opportunities may include practical help at events, support for learning activities, and skills-based contributions in areas such as communications, finance or planning.",
      "The details — what roles exist, where they are and what each involves — will be published on the Volunteer page as they are confirmed.",
      "In the meantime, the best way to stay informed is through the Get Involved pages.",
    ],
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
