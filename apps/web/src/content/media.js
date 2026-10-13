/* Media Center — ONE source for news, blogs and events: the Media Center
   hub, /media/news (a timeline), /media/blogs, /media/events and each
   item's own page all read from here.

   2026-10-13: the items are the CMS's only (Admin → Posts, Events): the
   published snapshot sets NEWS, BLOGS and EVENTS. The sample items this
   file used to hold were removed once the live snapshot was shown to
   replace them. With a list empty, its page shows `empty`. What stays
   here: the blog categories and event groups, the addresses and the
   pages' wording. */

import { PROGRAMS } from "./work.js";

/* ---------------- News ----------------
   { id, date, program, title, summary, body, image }. Oldest first: the
   news page draws them on a timeline. */
export const NEWS = [];

/* ---------------- Blogs ----------------
   { id, date, category, title, excerpt, author, body, image }. Newest
   first. */
export const BLOG_CATEGORIES = [
  { id: "reflections", label: "Reflections" },
  { id: "field-notes", label: "Field notes" },
  { id: "how-to", label: "How to help" },
];

export const BLOGS = [];

/* ---------------- Events ----------------
   { id, date, start, end?, program, title, subtitle, summary, about,
     schedule: [{ time, item }], venue, address, mapUrl?, image }.
   `program` is a program slug, or "open" for everyone. Newest first,
   like the events directory. Whether an event is upcoming or ended is
   worked out in the browser (pages/Events), never written here. */
export const EVENT_GROUPS = [
  ...PROGRAMS.map((p) => ({ id: p.slug, label: p.title })),
  { id: "open", label: "Open to all" },
];

export const EVENTS = [];

/* ---------------- Lookups ---------------- */
export const NEWS_ROOT = "/media/news";
export const BLOGS_ROOT = "/media/blogs";
export const EVENTS_ROOT = "/media/events";

export const newsPath = (n) => `${NEWS_ROOT}/${n.id}`;
export const blogPath = (b) => `${BLOGS_ROOT}/${b.id}`;
export const eventPath = (e) => `${EVENTS_ROOT}/${e.id}`;

export const newsById = (id) => NEWS.find((n) => n.id === id);
export const blogById = (id) => BLOGS.find((b) => b.id === id);
export const eventById = (id) => EVENTS.find((e) => e.id === id);

/* "upcoming" or "ended" on the day `on` ("2026-10-06"), or null when
   the day is not known yet — the pre-rendered page, before hydration. */
export const eventStatus = (event, on) => (on ? (event.date >= on ? "upcoming" : "ended") : null);
export const todayIso = () => new Date().toISOString().slice(0, 10);

export const blogCategory = (id) => BLOG_CATEGORIES.find((c) => c.id === id);
export const eventGroup = (id) => EVENT_GROUPS.find((g) => g.id === id);

/* A blog post as a StoryCard draws it (components/StoryList). */
export const blogCard = (b) => ({
  title: b.title,
  category: blogCategory(b.category)?.label,
  excerpt: b.excerpt,
  date: b.date,
  image: b.image,
  to: blogPath(b),
});

/* Every Media Center page with an address of its own, for the
   pre-renderer. */
export const mediaDetailPaths = () => [...NEWS.map(newsPath), ...BLOGS.map(blogPath), ...EVENTS.map(eventPath)];

/* ---------------- Page copy ----------------
   PROPOSED interface copy — what each page is, never a claim. */
export const MEDIA_PAGES = {
  hub: {
    kicker: "Media center",
    heading: "Media Center",
    body: "News, stories, writing and events from the work of Rising Beyond Borders, in one place.",
    news: { kicker: "Latest news", heading: "What's new", cta: { label: "All news", to: NEWS_ROOT } },
    events: { kicker: "What's on", heading: "Coming up", cta: { label: "All events", to: EVENTS_ROOT } },
    blogs: { kicker: "Blogs", heading: "From the blog", cta: { label: "All posts", to: BLOGS_ROOT } },
    timeline: { kicker: "Latest news", heading: "News as it happened", body: "Every update from across the four program areas, on one timeline.", cta: { label: "See the timeline", to: NEWS_ROOT } },
    stories: { kicker: "Impact stories", heading: "Stories of change", body: "The people and communities behind the work, in their own words.", cta: { label: "Read the stories", to: "/stories" } },
  },
  news: {
    kicker: "Media center",
    heading: "Latest News",
    body: "Updates from across the four program areas, as they happen.",
    timeline: {
      kicker: "Timeline",
      heading: "News as it happened.",
      viewportLabel: "Timeline of news — scroll sideways for more",
      readLabel: "Read more",
    },
    empty: {
      text: "News from our work in education, health and wellbeing, livelihoods and community support will be published here as it happens. In the meantime, you can read about the four program areas and the people they serve.",
      cta: { label: "Explore Our Work", to: "/work" },
    },
    closing: {
      heading: "Follow the work as it happens.",
      ctas: {
        primary: { label: "See Upcoming Events", to: EVENTS_ROOT },
        secondary: { label: "Media Center", to: "/media" },
      },
    },
  },
  blogs: {
    kicker: "Media center",
    heading: "Blogs",
    body: "Reflections, field notes and practical ideas from the people involved in the work.",
    all: "All posts",
    count: (n) => `${n} ${n === 1 ? "post" : "posts"}`,
    empty: {
      text: "This is where the people involved in our work will share reflections, notes from the field and practical ways to help. The first posts are being written.",
      cta: { label: "Ways to Get Involved", to: "/get-involved" },
    },
  },
  events: {
    kicker: "What's on",
    heading: "Every event, in one place",
    body: "Gatherings, workshops and volunteer days. Pick a program to narrow the list, or browse everything.",
    all: "All programs",
    count: (n) => `${n} ${n === 1 ? "event" : "events"}`,
    empty: "No events in this program yet.",
    /* With no events at all. */
    none: {
      text: "There are no events scheduled right now. Community gatherings, workshops and volunteer days will be listed here as soon as they are confirmed, each with its date, time and place.",
      cta: { label: "Become a Volunteer", to: "/get-involved/volunteer" },
    },
    upcoming: "Upcoming",
    ended: "Ended",
    detailsLabel: "Event details",
    pagination: { label: "Event pages", previous: "Previous page", next: "Next page", page: (n) => `Page ${n}` },
    closing: {
      heading: "Want to help at the next one?",
      ctas: {
        primary: { label: "Volunteer", to: "/get-involved/volunteer" },
        secondary: { label: "Contact Us", to: "/contact" },
      },
    },
  },
  event: {
    back: "All events",
    about: "About this event",
    schedule: "How the day runs",
    where: "Where",
    directions: "Get directions",
    date: "Date",
    time: "Time",
    takePart: "Taking part",
    takePartBody: "To ask about taking part, get in touch through our Contact page.",
    /* Shown instead, when an event published from the CMS has a
       registration link. */
    register: "Register",
    more: "More about",
    others: "More events",
  },
  article: {
    byline: "By",
    backNews: { label: "All news", to: NEWS_ROOT },
    backBlogs: { label: "All posts", to: BLOGS_ROOT },
    moreNews: "More news",
    moreBlogs: "More from the blog",
  },
};

export default MEDIA_PAGES;
