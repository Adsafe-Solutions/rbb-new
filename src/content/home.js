/* Sample content for components that are no longer on any page and are
   kept for the /components catalog. The homepage's own strings are in
   content/homepage.js.

   HERO feeds the logo-framed hero (components/Hero). Its copy and card
   labels came from another charity's appeals and are placeholders.
   Everything from MISSION down is ORIGINAL copy for the dating sections,
   which no longer render on the homepage but stay in the catalog.

   Photography is free-license stock from Pexels, credited beside each
   import, and comes in as a `src` + `alt` pair. App-screen placeholders
   (`photo: "app-…"`) are still labels for Photo/PhoneMock's placeholder
   tile — there is no real app to screenshot. */

import { BRAND } from "./brand.js";
import { SITE } from "./site.js";

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

export const HERO = {
  /* The headline is split into three parts because the design sets them in
     three different weights and sizes — `lead` light, `emphasis` bold and
     oversized, `subheading` in small caps beneath both. Keeping them as
     separate strings means the break never depends on where a <br> or a
     space happens to fall at a given viewport width. */
  lead: BRAND.fullName,
  emphasis: "Headline to be provided",
  subheading: BRAND.summary,
  /* The single-line version, for anywhere that needs the headline whole —
     document titles, share cards, the component catalog. */
  heading: BRAND.fullName,
  body: SITE.placeholder,
  cta: { label: "Donate Now", to: "/get-involved/donate" },

  /* The auto-swiping card deck — one card per live appeal, in the order
     the source site's hero carousel ran them. Order here is only the
     starting order: Hero cycles the front card to the back on a timer,
     so per-card `tilt`/`y` would drift out of sync after the first swipe.
     Depth is computed from stack position instead; see SLOTS in Hero.jsx. */
  cards: [
    {
      name: "Appeal 1 — to be confirmed",
      src: heroGaza,
      alt: "Rows of tents and shelters in a displacement camp at sunset",
    },
    {
      name: "Appeal 2 — to be confirmed",
      src: heroSudan,
      alt: "Children washing dishes in basins outside family tents in a camp",
    },
    {
      name: "Appeal 3 — to be confirmed",
      src: heroWater,
      alt: "A child drinking straight from the spout of a hand pump",
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
