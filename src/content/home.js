/* Every string on the homepage, in the order the page uses them.

   HERO follows content/ngo.js: copy reproduced from muslimhands.ca with
   the organisation name swapped for BRAND.name — see the note there.
   Everything from MISSION down is ORIGINAL copy for the dating sections,
   which no longer render on the homepage but stay in the catalog.

   Photography is free-license stock from Pexels, credited beside each
   import, and comes in as a `src` + `alt` pair. App-screen placeholders
   (`photo: "app-…"`) are still labels for Photo/PhoneMock's placeholder
   tile — there is no real app to screenshot. */

import { BRAND } from "./brand.js";

import heroGaza from "../assets/hero-gaza.jpg"; /* Abd Alrhman Al Darra, 30230054 */
import heroSudan from "../assets/hero-sudan.jpg"; /* Halidenurk, 27962039 */
import heroWater from "../assets/hero-water.jpg"; /* Illustrate Digital UG, 28101461 */
import missionSkater from "../assets/mission-skater.jpg";
import missionRunner from "../assets/mission-runner.jpg";
import missionDogwalk from "../assets/mission-dogwalk.jpg";
import memberCircleDinner from "../assets/member-circle-dinner.jpg";
import productsDateA from "../assets/products-date-a.jpg";
import productsDateB from "../assets/products-date-b.jpg";
import productsFriendsA from "../assets/products-friends-a.jpg";
import productsFriendsB from "../assets/products-friends-b.jpg";
import storyCouple from "../assets/story-couple.jpg";
/* The bleed hero's own photography — RBB's branded field images, so the
   mark and the promise are in the picture as well as on the page. */
import bleedKids from "../assets/helping kids.png";
import bleedField from "../assets/helping-onfield.png";
import bleedElder from "../assets/helping old.png";

export const HERO = {
  /* The headline is split into three parts because the design sets them in
     three different weights and sizes — `lead` light, `emphasis` bold and
     oversized, `subheading` in small caps beneath both. Keeping them as
     separate strings means the break never depends on where a <br> or a
     space happens to fall at a given viewport width. */
  lead: `${BRAND.name} has delivered`,
  emphasis: "Aid Across 15+ Countries",
  subheading: "Emergency relief and long-term change since 1993",
  /* The single-line version, for anywhere that needs the headline whole —
     document titles, share cards, the component catalog. */
  heading: "Delivering aid where it is needed most, since 1993",
  body: `${BRAND.name} delivers humanitarian aid across 15+ countries, providing emergency relief and long-term solutions through clean water, healthcare, education, and life-changing orphan support.`,
  cta: { label: "Donate Now", to: "/donate" },

  /* The auto-swiping card deck — one card per live appeal, in the order
     the source site's hero carousel runs them. Order here is only the
     starting order: Hero cycles the front card to the back on a timer,
     so per-card `tilt`/`y` would drift out of sync after the first swipe.
     Depth is computed from stack position instead; see SLOTS in Hero.jsx. */
  cards: [
    {
      name: "Gaza Emergency",
      src: heroGaza,
      alt: "Rows of tents and shelters in a displacement camp at sunset",
    },
    {
      name: "Sudan Emergency",
      src: heroSudan,
      alt: "Children washing dishes in basins outside family tents in a camp",
    },
    {
      name: "Give the Gift of Water",
      src: heroWater,
      alt: "A child drinking straight from the spout of a hand pump",
    },
  ],
};

/* The alternate hero: the photograph runs full height on the right and
   the copy sits on the page's own white, rather than the mark-framed
   photograph HERO uses. Both are live — config/sections.js picks which one
   the homepage opens with — so this is a second treatment of the SAME
   promise, not a second message. Keep them saying the same thing.

   The parts that do not change per slide live at the top; `slides` carries
   a photograph and the words that belong to it. */
export const HERO_BLEED = {
  ctas: {
    primary: { label: "Get Involved", to: "/volunteer" },
    secondary: { label: "Watch Our Story", to: "/about" },
  },

  /* The card that floats over the photograph's lower corner. */
  note: { text: "A global community creating lasting impact.", to: "/about" },

  scrollLabel: "Scroll to explore",

  /* One photograph and the words that belong to it. The copy changes with
     the picture — a headline about clean water over a photograph of a
     litter pick is the thing this rotation exists to avoid.

     ⚠ EVERY slide must have exactly three `kicker` parts and exactly two
     `headline` lines. HeroBleed animates the copy by transitioning the
     SAME elements rather than replacing them, so the slots have to line
     up; a slide with one headline line leaves the second slot holding the
     previous slide's words.

     ⚠ And keep each headline line UNDER ABOUT SEVENTEEN CHARACTERS. The
     line is set at up to 64px in a 38rem column, so a longer one wraps —
     which turns a three-line headline into four, pushes the band taller,
     and shoves the note card off the bottom of the screen.

     `focal` is the photograph's object-position. It is per slide because
     the subject is not in the same place in every frame, and the left
     third of the panel is under the scrim: a centred subject lands in the
     haze. LOWER the first number to move the subject RIGHT on screen —
     object-position aligns that point of the SOURCE with the same point
     of the box, so raising it walks the crop window right through the
     image and the subject leftward across the panel. */
  slides: [
    {
      kicker: ["People", "Purpose", "A brighter tomorrow"],
      headline: ["Different people", "Brighter"],
      headlineAccent: "tomorrows.",
      body: `${BRAND.name} is a global community working together to create positive change through compassion, collaboration, and meaningful action.`,
      src: bleedKids,
      /* High, so the crop window walks right and keeps RBB's banner whole
         at the frame's edge. The girl still lands around 59% of the panel,
         clear of the scrim, which runs out at 54%. */
      focal: "75% 45%",
      alt: "An RBB field worker handing a bundle of school supplies to a smiling girl, other children crowding in beside her",
    },
    {
      kicker: ["Neighbours", "Not strangers", "Side by side"],
      headline: ["Ordinary hands", "Extraordinary"],
      headlineAccent: "change.",
      body: "Volunteers give their weekends to the work that holds a community together — packing, loading, carrying, handing over. None of it makes the news. All of it makes the difference.",
      src: bleedField,
      focal: "60% 45%",
      alt: "An RBB distribution in progress: volunteers unloading a truck and sorting boxes of supplies in a camp",
    },
    {
      kicker: ["Dignity", "Care", "Nobody overlooked"],
      headline: ["The last in line", "is the first"],
      headlineAccent: "we look for.",
      body: "Elders are the quietest casualties of a crisis — least able to queue, least likely to ask. Our distributions start with the people a queue leaves behind.",
      src: bleedElder,
      /* All the way right: it is the only value that fits RBB's banner in
         whole, and the seated woman still sits at about 65% of the panel. */
      focal: "100% 45%",
      alt: "An RBB field worker passing a sack of rice into the hands of an elderly woman seated at a distribution point",
    },
  ],
};

export const MISSION = {
  heading: "We exist to bring people closer.",
  body: "We want our members to find the kind of relationships that build confidence, not doubt — and to enjoy the getting there.",
  cta: { label: "Download RBB", to: "/download" },

  /* The three overlapping cards to the right, each with a vertical pill
     label running up its edge. First card leads, the other two step back
     and down behind it. */
  cards: [
    {
      label: "Outdoors",
      src: missionSkater,
      alt: "Skateboarder sitting at a skate park with their board",
      tilt: 0,
      y: 0,
    },
    {
      label: "Running",
      src: missionRunner,
      alt: "Woman jogging down a sunlit city street",
      tilt: 0,
      y: 40,
    },
    {
      label: "Dog parent",
      src: missionDogwalk,
      alt: "Person walking a dog across an open field",
      tilt: 0,
      y: 72,
    },
  ],
  /* Pexels — budgeron-bach (32435746 series), olly (3764533), theshuttervision (34587707). */
};

export const MEMBER_CIRCLE = {
  heading: "Share your ideas",
  paragraphs: [
    "Help shape what we build next by joining the Member Circle. It is a small group of members who talk to our team directly, through chats, discussions and product tests.",
    "Members see new features first, get a look at what is coming, and have a real say in where the app goes.",
  ],
  cta: { label: "Sign up", to: "/member-circle" },
  src: memberCircleDinner,
  alt: "A group of friends laughing together at a dinner table",
  sealLabel: "Member Circle",
  /* Pexels — Elle Takes Photos, pexels.com/photo/2696065 */
};

/* The two product cards. `surface` picks the frame colour — the pair is
   always one Honey and one Pollen so they read as siblings rather than as
   a primary and a secondary.

   `phonePhoto` is the placeholder label for the (fictional) app screen in
   the middle PhoneMock. `accents` are the two real photos flanking it —
   they stand in for the "people you'd meet," not the product itself, so
   they get real photography while the phone stays a placeholder. */
export const PRODUCTS = [
  {
    name: "RBB Date",
    surface: "honey",
    body: "Whether you are new to dating or ready to try again, Date is built to bring you closer to someone real, safely and at your own pace.",
    cta: { label: "Find your person", to: "/date" },
    phonePhoto: "app-date",
    accents: [
      { src: productsDateA, alt: "Smiling woman with a buzz cut, sitting outdoors" },
      { src: productsDateB, alt: "Smiling young man outdoors with bare trees behind him" },
    ],
    /* Pexels — enginakyurt (3290499), anasaber (10297087) */
  },
  {
    name: "RBB Friends",
    surface: "pollen",
    body: "New city, or just a bigger circle? Friends makes it easy to meet people who are into the things you are into.",
    cta: { label: "Find your people", to: "/friends" },
    phonePhoto: "app-friends",
    accents: [
      { src: productsFriendsA, alt: "Four friends laughing together by a fountain" },
      { src: productsFriendsB, alt: "Three friends smiling close together for a selfie" },
    ],
    /* Pexels — Olly (3768884), Anthony Shkraba Production (8910376) */
  },
];

export const STORY = {
  quote:
    "Neither of us expected much from a first message. Two years on we are still finishing each other's sentences and still arguing about the coffee order.",
  attribution: "Priya & Sam, married in 2025",
  cta: { label: "Read more stories", to: "/stories" },
  src: storyCouple,
  /* Pexels — Yankrukov, pexels.com/photo/7312017 */
};

export const GET_APP = {
  heading: "Get the app",
  body: "Just scan the QR code to get started.",
  photo: "app-phones",
};
