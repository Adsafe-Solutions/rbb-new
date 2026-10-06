/* Media Center — ONE source for news, blogs and events: the Media Center
   hub, /media/news (a timeline), /media/blogs, /media/events and each
   item's own page all read from here. Add a record and it is listed,
   routed and pre-rendered; nothing else to edit.

   The items below are SAMPLE content, written to read naturally so the
   pages can be reviewed as they will look. Each carries an internal
   `releaseMarker` (never shown) so a production release stays blocked
   until RBB replaces them. With a list empty, its page shows `empty`. */

import { WORKING_PHOTOS } from "./photos.js";
import { PROGRAMS } from "./work.js";

/* INTERNAL, never shown: keeps release:check blocked until RBB's own
   items replace these sample ones (src/lib/releaseMarkers.js). */
const MARKER = "Sample event — sample media item";

/* ---------------- News ----------------
   { id, date, program, title, summary, body: [paragraphs], image }.
   Oldest first: the news page draws them on a timeline, like the
   homepage's progress timeline. */
export const NEWS = [
  {
    id: "reading-clubs-term-starts",
    date: "2026-04-08",
    program: "education",
    title: "Reading clubs start a new term",
    summary: "After-school reading sessions return, with new books for every reading level.",
    body: [
      "Our after-school reading clubs are back for a new term. Children meet twice a week to read together, borrow books to take home and build the confidence that comes with reading for pleasure.",
      "This term the clubs have new books for every level, from first picture books to short novels, and volunteers on hand to listen to every reader.",
    ],
    image: WORKING_PHOTOS.readingCircle,
  },
  {
    id: "health-day-announced",
    date: "2026-05-14",
    program: "health-wellbeing",
    title: "A community health day is announced",
    summary: "Basic checks and practical advice, brought closer to home.",
    body: [
      "We are bringing a community health day closer to the families we work with: basic health checks, practical advice on everyday wellbeing, and help finding the right service for anything that needs follow-up.",
      "The day is free and open to everyone. Full details are on our events page.",
    ],
    image: WORKING_PHOTOS.checkup,
  },
  {
    id: "tailoring-group-graduates",
    date: "2026-06-20",
    program: "livelihoods",
    title: "First tailoring group completes its course",
    summary: "Participants share what they made, and what they plan next.",
    body: [
      "Our first tailoring group has completed its course. Over twelve weeks, participants learned to measure, cut and finish garments, and to price and sell their work.",
      "At the closing showcase, each participant presented a piece they made and talked about what comes next — from taking orders from neighbours to planning a small stall.",
    ],
    image: WORKING_PHOTOS.sewing,
  },
  {
    id: "volunteer-day-recap",
    date: "2026-07-25",
    program: "community-support",
    title: "Volunteers pack support boxes for families",
    summary: "A morning of packing, sorting and planning deliveries.",
    body: [
      "Volunteers gave up a Saturday morning to pack support boxes for families facing a difficult month — sorting donations, packing essentials and planning the delivery routes.",
      "Thank you to everyone who came along. If you would like to join the next volunteer day, see our Volunteer page.",
    ],
    image: WORKING_PHOTOS.packing,
  },
  {
    id: "water-point-repairs",
    date: "2026-08-30",
    program: "health-wellbeing",
    title: "Water point repairs completed",
    summary: "Clean water back within reach, and a plan to keep it that way.",
    body: [
      "Repairs to a community water point are complete, bringing clean water back within reach of the families who rely on it.",
      "Alongside the repairs, local volunteers have been trained in simple maintenance, so small problems can be fixed before they become big ones.",
    ],
    image: WORKING_PHOTOS.waterPump,
  },
  {
    id: "information-day-recap",
    date: "2026-09-26",
    program: "community-support",
    title: "Community information day brings services together",
    summary: "Families met local services in one welcoming place.",
    body: [
      "Our community information day brought local services together under one roof, so families could get advice, ask questions and find support without travelling from office to office.",
      "We will hold more information days through the year — watch our events page for the next one.",
    ],
    image: WORKING_PHOTOS.gathering,
  },
].map((n) => ({ ...n, status: "placeholder", releaseMarker: MARKER }));

/* ---------------- Blogs ----------------
   { id, date, category, title, excerpt, author, body: [paragraphs],
   image }. Newest first. */
export const BLOG_CATEGORIES = [
  { id: "reflections", label: "Reflections" },
  { id: "field-notes", label: "Field notes" },
  { id: "how-to", label: "How to help" },
];

export const BLOGS = [
  {
    id: "why-we-start-by-listening",
    date: "2026-09-18",
    category: "reflections",
    title: "Why we start by listening",
    excerpt: "On letting communities set the priorities — and why it makes the work last.",
    image: WORKING_PHOTOS.gathering,
    body: [
      "Every piece of work we do begins with a conversation. Before any plan or budget, we ask the people closest to a challenge what they need, what is already working and what a good result would look like to them.",
      "It is slower at the start. But work shaped by the people it serves is work they own — and work people own is work that lasts after any single project ends.",
      "Listening does not stop once a project begins. We keep asking, keep adjusting, and report back on what we heard.",
    ],
  },
  {
    id: "a-morning-at-reading-club",
    date: "2026-08-21",
    category: "field-notes",
    title: "A morning at reading club",
    excerpt: "Notes from a session, written by one of our volunteers.",
    image: WORKING_PHOTOS.girlReading,
    body: [
      "The room is loud before it is quiet. Children arrive, swap books, argue happily about which story is best — and then, one by one, settle into reading.",
      "The best moment of the morning was a child who had refused to read aloud for weeks asking to read the last page to the group. Nobody said much. Everybody clapped.",
      "That is what the reading clubs are for: not just reading, but the confidence that comes with it.",
    ],
  },
  {
    id: "five-ways-to-volunteer-skills",
    date: "2026-07-30",
    category: "how-to",
    title: "Five ways to volunteer your skills",
    excerpt: "From design to bookkeeping, how professional skills can help.",
    image: WORKING_PHOTOS.teacherClassroom,
    body: [
      "Volunteering is not only about time on the ground. Professional skills — design, writing, bookkeeping, planning, photography — can make a real difference to a small organisation.",
      "Skills-based volunteering can be done in short, focused blocks, often remotely, and fitted around your working week.",
      "If you have a skill you would like to share, get in touch through our Volunteer page and tell us what you can offer.",
    ],
  },
  {
    id: "what-dignity-looks-like",
    date: "2026-06-12",
    category: "reflections",
    title: "What dignity looks like in practice",
    excerpt: "On offering support that leaves people in charge of their own choices.",
    image: WORKING_PHOTOS.aidBoxes,
    body: [
      "Dignity is easy to write about and harder to practise. In everyday terms it means asking before assuming, offering choices instead of packages, and never making someone prove they deserve help.",
      "It also means care with stories and photographs: shared only with permission, and in a way people would be proud to see.",
      "We do not always get it right. But it is the standard we hold ourselves to.",
    ],
  },
  {
    id: "notes-from-a-market-stall",
    date: "2026-05-09",
    category: "field-notes",
    title: "Notes from a market stall",
    excerpt: "A livelihoods story told from behind the counter.",
    image: WORKING_PHOTOS.market,
    body: [
      "Running a stall is a lesson in patience: early mornings, careful pricing, and learning which customers come back.",
      "The stallholders in our livelihoods program say the most useful thing has not been any single skill, but having others to compare notes with — what sold, what did not, and what to try next week.",
    ],
  },
  {
    id: "hosting-a-community-dinner",
    date: "2026-04-02",
    category: "how-to",
    title: "Hosting a community dinner for a cause",
    excerpt: "A simple plan for bringing people together.",
    image: WORKING_PHOTOS.foodPrep,
    body: [
      "A shared meal is one of the simplest ways to bring people together around a cause. Keep the menu simple, ask guests to bring a dish, and leave room for conversation.",
      "A short welcome explaining why you are gathering goes a long way. If you are thinking of hosting one in support of our work, get in touch first so we can help.",
    ],
  },
].map((b) => ({ ...b, author: "Rising Beyond Borders", status: "placeholder", releaseMarker: MARKER }));

/* ---------------- Events ----------------
   { id, date, start, end?, program, title, subtitle, summary,
     about: [paragraphs], schedule: [{ time, item }], venue, address,
     mapUrl?, image }.
   `program` is a program slug, or "open" for everyone. Newest first,
   like the events directory. Whether an event is upcoming or ended is
   worked out in the browser (pages/Events), never written here. */
export const EVENT_GROUPS = [
  ...PROGRAMS.map((p) => ({ id: p.slug, label: p.title })),
  { id: "open", label: "Open to all" },
];

const VENUE = "Community Centre";

const sampleEvent = (event) => ({
  venue: VENUE,
  address: "Full address shared when you register",
  /* A real event sets `mapUrl` to its map link; the "Get directions"
     button appears then. */
  mapUrl: null,
  schedule: [
    { time: event.start, item: "Welcome and introductions" },
    { time: "", item: "Main session" },
    ...(event.end ? [{ time: event.end, item: "Close" }] : []),
  ],
  status: "placeholder",
  releaseMarker: MARKER,
  ...event,
});

export const EVENTS = [
  sampleEvent({
    id: "community-dinner-november",
    date: "2026-11-14",
    start: "6:30 PM",
    end: "9:00 PM",
    program: "open",
    title: "Community dinner",
    subtitle: "Food, conversation and a short update on the work.",
    summary: "An evening for supporters, volunteers and neighbours. Everyone welcome.",
    about: [
      "Join us for an evening of good food and good company. Supporters, volunteers and neighbours are all welcome.",
      "During the evening we will share a short update on the work across our four program areas, with time for questions.",
    ],
    image: WORKING_PHOTOS.foodPrep,
  }),
  sampleEvent({
    id: "volunteer-induction-october",
    date: "2026-10-24",
    start: "10:00 AM",
    end: "12:00 PM",
    program: "community-support",
    title: "Volunteer induction morning",
    subtitle: "Meet the team and find a role that suits you.",
    summary: "An introduction for new volunteers: how the work runs and where help is needed.",
    about: [
      "New to volunteering with us? This morning is for you. Meet the team, hear how the work runs, and find out where help is most needed.",
      "There is no commitment — come along, ask questions and see what suits you.",
    ],
    image: WORKING_PHOTOS.packing,
  }),
  sampleEvent({
    id: "reading-afternoon-october",
    date: "2026-10-17",
    start: "3:00 PM",
    end: "5:00 PM",
    program: "education",
    title: "Family reading afternoon",
    subtitle: "Stories, games and books to take home.",
    summary: "An afternoon of reading for children and the adults who read with them.",
    about: [
      "An afternoon of stories and reading games for children and the adults who read with them.",
      "Every child goes home with a book of their own.",
    ],
    image: WORKING_PHOTOS.readingCircle,
  }),
  sampleEvent({
    id: "health-awareness-session",
    date: "2026-10-10",
    start: "11:00 AM",
    end: "12:30 PM",
    program: "health-wellbeing",
    title: "Everyday health awareness session",
    subtitle: "Practical advice in plain language.",
    summary: "A relaxed session on everyday health, with time for questions.",
    about: [
      "A relaxed session on everyday health and wellbeing: simple habits, when to seek help, and where to find it.",
      "Bring your questions — there is plenty of time to ask them.",
    ],
    image: WORKING_PHOTOS.healthTeam,
  }),
  sampleEvent({
    id: "skills-fair-september",
    date: "2026-09-27",
    start: "10:00 AM",
    end: "3:00 PM",
    program: "livelihoods",
    title: "Skills and livelihoods fair",
    subtitle: "Local makers, short workshops and practical advice.",
    summary: "A day of short workshops on practical skills and small enterprise.",
    about: [
      "A day of short, hands-on workshops on practical skills and running a small enterprise, with local makers sharing what they have learned.",
      "Drop in for one workshop or stay all day.",
    ],
    image: WORKING_PHOTOS.market,
  }),
  sampleEvent({
    id: "information-day-september",
    date: "2026-09-12",
    start: "9:30 AM",
    end: "1:00 PM",
    program: "community-support",
    title: "Community information day",
    subtitle: "Local services, all in one place.",
    summary: "Meet the services that can help, and ask questions in one welcoming place.",
    about: [
      "Local services come together in one place so families can get advice and support without travelling from office to office.",
      "Interpreters and volunteers are on hand to help.",
    ],
    image: WORKING_PHOTOS.gathering,
  }),
  sampleEvent({
    id: "tailoring-showcase-august",
    date: "2026-08-22",
    start: "4:00 PM",
    end: "6:00 PM",
    program: "livelihoods",
    title: "Tailoring course showcase",
    subtitle: "See what the group made.",
    summary: "The tailoring group shows its work and talks about what comes next.",
    about: [
      "Our tailoring group celebrates the end of its course with a showcase of the garments they have made.",
      "Come and see the work, meet the makers and hear their plans.",
    ],
    image: WORKING_PHOTOS.sewing,
  }),
  sampleEvent({
    id: "teachers-workshop-august",
    date: "2026-08-08",
    start: "9:00 AM",
    end: "12:00 PM",
    program: "education",
    title: "Teachers' sharing workshop",
    subtitle: "Ideas that work in a busy classroom.",
    summary: "Teachers swap practical ideas for lessons with few resources.",
    about: [
      "A morning for teachers to swap practical ideas that work in busy classrooms with few resources.",
      "Bring one idea that works for you — and leave with several more.",
    ],
    image: WORKING_PHOTOS.teacherClassroom,
  }),
  sampleEvent({
    id: "open-day-july",
    date: "2026-07-18",
    start: "11:00 AM",
    end: "4:00 PM",
    program: "open",
    title: "Open day",
    subtitle: "Come and see how the work runs.",
    summary: "Drop in, meet the team and hear about the four program areas.",
    about: [
      "Drop in any time during the day to meet the team and hear about our work in education, health and wellbeing, livelihoods and community support.",
      "Families are welcome — there will be activities for children.",
    ],
    image: WORKING_PHOTOS.reliefPacking,
  }),
  sampleEvent({
    id: "water-care-session-july",
    date: "2026-07-04",
    start: "10:00 AM",
    end: "11:30 AM",
    program: "health-wellbeing",
    title: "Looking after a water point",
    subtitle: "Simple care that keeps water flowing.",
    summary: "A hands-on session on everyday care for a shared water point.",
    about: [
      "A hands-on session on the everyday care that keeps a shared water point working: simple checks, cleaning and small repairs.",
      "No experience needed.",
    ],
    image: WORKING_PHOTOS.drinkingWater,
  }),
];

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
