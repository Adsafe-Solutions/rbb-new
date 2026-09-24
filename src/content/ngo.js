/* Sample content for the sections that made up the PREVIOUS homepage —
   appeal spotlight, donate form, campaigns, collage, mosaic, accountability
   band, stats, regular giving. The homepage no longer uses any of it
   (Document 02 rebuilt it; its strings are in content/homepage.js). It
   feeds the /components catalog, and `about` is still the "who we are"
   block on /about.

   ⚠ This content was first another charity's copy and figures: its
   appeals, its impact numbers, its founding year, its registration. All
   of it was replaced with placeholders. Do not put a figure, a country, a
   year or a credential back in here until RBB has supplied and confirmed
   it.

   Photography is free-license Pexels stock, credited beside each import. */

import { BRAND } from "./brand.js";
import { SITE } from "./site.js";

import kitchen from "../assets/ngo-kitchen.jpg"; /* Eden FC, 20859655 */
import sudan from "../assets/ngo-sudan.jpg"; /* Ahmed Akacha, 10629442 */
import maternal from "../assets/gifts-maternal.jpg"; /* Mahyub Hamida, 30313887 */
import waterChild from "../assets/ngo-water-child.jpg"; /* Ahmed Akacha, 10214733 */
import waterPump from "../assets/ngo-water-pump.jpg"; /* Matazu Multimedia, 32154739 */
import yemenChild from "../assets/hero-water.jpg"; /* Illustrate Digital UG, 28101461 */
import tentGirl from "../assets/ngo-tent-girl.jpg"; /* Ahmed Akacha, 27198722 */
import volunteers from "../assets/ngo-volunteers.jpg"; /* RDNE Stock Project, 6646918 */
import volunteer from "../assets/ngo-volunteer.jpg"; /* RDNE Stock Project, 6646893 */
import events from "../assets/ngo-events.jpg"; /* Quyn Phạm, 13418669 */
import fundraise from "../assets/ngo-fundraise.jpg"; /* cottonbro, 6591154 */
import medical from "../assets/zakat-medical.jpg"; /* Pavel Danilyuk, 5998449 */
import legacySewing from "../assets/zakat-sewing.jpg"; /* Illustrate Digital UG, 20853652 */
import legacyBoy from "../assets/zakat-orphan.jpg"; /* umar-muazu, 32662981 */
import legacyDig from "../assets/gifts-hero.jpg";

/* The two placeholders this page leans on: a statistic with no verified
   number yet, and an appeal RBB has not named yet. */
const FIGURE = SITE.figurePlaceholder;
const APPEAL = {
  heading: "Appeal to be confirmed",
  body: "Appeal details to be provided by Rising Beyond Borders.",
};

export const NGO = {
  /* The live appeal, straight after the hero. It held another charity's
     Gaza appeal and its figures; the slots stay so Document 02 can fill
     them with an appeal RBB is actually running. The key is still `gaza`
     (and the jump target `#donate-gaza`) only because the page wires to
     those names — nothing on screen says Gaza.

     ⚠ When real figures arrive, keep each label to what its number
     actually counts: "people reached" is not "lives saved". */
  gaza: {
    kicker: "Appeal",
    heading: APPEAL.heading,
    /* One sentence when it is real. This sits directly under the hero,
       and a wall of copy there pushes everything else down the page. */
    body: APPEAL.body,
    /* Three figures. AppealSpotlight also renders `partners` and
       `status` ("Active now") if an entry supplies them — both are
       claims, so both wait for RBB. */
    stats: [{ ...FIGURE, highlight: true }, { ...FIGURE }, { ...FIGURE }],
    ctas: {
      primary: { label: "Donate", href: "#donate-gaza" },
      secondary: { label: "Transparency & Financials", to: "/about/transparency" },
    },
    src: tentGirl,
    alt: "A young girl standing among the tents of a displacement camp",
  },

  /* ⚠ PROVISIONAL — the amounts and the currency below are not RBB's.
     They came in with another charity's donation form and are left in
     place only so the widget keeps working until Document 02. Canadian
     dollars assumes a Canadian base, which the supplied materials have
     not settled (Document 01 flags a Beverly Hills, CA address against
     the stated Canada-based positioning). Rising Beyond Borders must
     confirm the currency, the suggested amounts and the payment setup
     before this widget takes a real donation. Nothing here is wired to
     a payment processor. */
  donate: {
    appeal: { name: APPEAL.heading, changeTo: "/get-involved/donate" },
    amounts: [150, 175, 300], // provisional — see note above
    currency: { symbol: "CA$", code: "CAD" }, // provisional — see note above
    addon: "Zakat",
    cta: { label: "Donate", to: "/get-involved/donate" },
    src: kitchen,
    alt: "Volunteers ladling food from a large steaming pot at a community kitchen",
  },

  campaign: {
    heading: APPEAL.heading,
    body: APPEAL.body,
    cta: { label: "Donate", to: "/get-involved/donate" },
    src: sudan,
    alt: "A woman carrying a baby walks with a child past tents at a camp for displaced families",
  },

  /* The second appeal slot, as the first one's mirror: same component,
     flipped by the homepage, so the two read as a pair zigzagging across
     the page. Both held another charity's country appeals and are
     placeholders until RBB names its own. The keys are unchanged only
     because the page wires to them.

     `tag` is not shown by CampaignHero — the first slot has no tag and
     the pair should match. It is kept because the component catalog
     still renders ActionCard from this entry, and that card needs one. */
  yemen: {
    tag: "Appeal",
    heading: APPEAL.heading,
    body: APPEAL.body,
    cta: { label: "Donate", to: "/get-involved/donate" },
    src: yemenChild,
    alt: "A child drinking straight from the spout of a hand pump",
  },

  getInvolved: {
    heading: "Get Involved",
    tabs: [
      {
        key: "volunteer",
        label: "Volunteer",
        heading: "Volunteer",
        body: SITE.placeholder,
        cta: { label: "Volunteer", to: "/get-involved/volunteer" },
        src: volunteer,
        alt: "A smiling volunteer carrying a box of food supplies beside a delivery van",
      },
      {
        key: "events",
        label: "Events",
        heading: "Events",
        body: SITE.placeholder,
        cta: { label: "Events", to: "/events" },
        src: events,
        alt: "A group of young volunteers in matching shirts at an outdoor event",
      },
      {
        key: "fundraise",
        label: "Fundraise",
        heading: "Fundraise",
        body: SITE.placeholder,
        cta: { label: "Do Your Own Fundraising", to: "/get-involved/fundraise" },
        src: fundraise,
        alt: "Four volunteers packing food donations into boxes",
      },
    ],
  },

  /* The statement of purpose, straight after the hero. It says what the
     problem is before any section asks for money — the hero makes the
     promise, this names what the promise is against.

     Faith-neutral like the rest of the site. The block this replaced was
     "Our Promise" — "rooted in faith", donations as an "Amanah" — which
     addressed one tradition in the one place every visitor reads. */
  fightFor: {
    heading: "What We Fight For",
    paragraphs: [
      "Every day, millions of people are pushed to the edge by conflict, disaster and poverty they did nothing to cause. They go without clean water, safe shelter, enough food, a doctor, a classroom — the things that make a life possible, and that most of us never have to think about.",
      "We work to close that gap: reaching people first when an emergency hits, and staying long enough to leave behind water, health, education and livelihoods that last.",
    ],
    links: [
      { label: "Our Work", to: "/work" },
      { label: "Our Impact", to: "/impact" },
      { label: "Donate to Help People", to: "/get-involved/donate" },
    ],
    src: waterChild,
    alt: "A child drinking from cupped hands at a village standpipe",
  },

  /* The long view, beside a three-photo collage. It used to open "For
     over 30 years" with a "30+ years" badge on the collage — a founding
     date nothing supplied supports, so both are gone. LegacyCollage
     renders no badge when there is none.

     `headline` is split so the last phrase can take the accent colour —
     the promise itself, not the organisation's name, is what gets the
     emphasis.

     The photographs are chosen for the SHAPES they sit in: a portrait
     subject for the arch, a single face for the round drop (a tight
     close-up is exactly what that small circular frame wants), and a wide
     scene with people across it for the long frame underneath. */
  legacy: {
    headline: `${BRAND.name} is working towards a world where`,
    headlineAccent: "no one is left behind.",
    body: SITE.placeholder,
    cta: { label: "See our recent successes", to: "/stories" },
    secondary: { label: "About us", to: "/about" },
    photos: {
      arch: { src: legacySewing, alt: "A young woman smiling at her sewing machine in a livelihoods workshop", focal: "50% 30%" },
      drop: { src: legacyBoy, alt: "A boy smiling straight at the camera", focal: "50% 35%" },
      wide: { src: legacyDig, alt: "Volunteers digging the trench for a new water line", focal: "50% 55%" },
    },
  },

  mosaic: {
    leadStat: FIGURE,
    leadPhoto: { src: waterPump, alt: "A child working a hand pump to fill a bucket with water" },
    feature: {
      ...FIGURE,
      src: tentGirl,
      alt: "A girl in pink standing beside a tent in a camp",
    },
    sidePhoto: { src: volunteers, alt: "Volunteers in matching shirts handing out aid boxes" },
    sideStat: FIGURE,
  },

  /* Reports & Accountability. This slot used to hold an "Islamic
     Resources" band; then a plain FeatureBanner asking for trust with a
     stock photograph and one sentence. A section about accountability has
     to SHOW something, so it now carries the commitments and the actual
     documents a donor would go and check.

     ⚠ No figures here on purpose. A "where your money goes" chart is the
     obvious move and the wrong one until RBB supplies audited numbers — an
     invented 92% on the accountability section is the worst possible
     place for an invented number.

     ⚠ No commitments either, for the same reason. The list used to say
     "independently audited every year" and "registered charity with the
     Canada Revenue Agency" — neither is in anything RBB has supplied.
     `commitments` returns when RBB confirms what it can stand behind, and
     the document rows stop saying "to be provided" when the PDFs exist. */
  accountability: {
    kicker: "Reports & Accountability",
    heading: "Transparency & Financials",
    body: SITE.placeholder,
    commitments: [],
    documents: [
      { title: "Annual Report", meta: "To be provided by Rising Beyond Borders", to: "/about/transparency" },
      { title: "Financial Statements", meta: "To be provided by Rising Beyond Borders", to: "/about/transparency" },
    ],
    cta: { label: "Learn more", to: "/about/transparency" },
  },

  /* Who we are — shown on /about. The first sentence is the
     description the supplied annual report confirms. The block used to
     carry another charity's "who we are", three principles built on it,
     and a "Registered charity · Canada Revenue Agency" credential. The
     principles come back from RBB's own values (/about/values), and the
     credential only with a registration RBB has confirmed; AboutIntro
     renders neither while they are absent. */
  about: {
    kicker: `About ${BRAND.name}`,
    heading: "Who we are",
    body: [`${BRAND.fullName} is ${BRAND.summary.replace(/^A /, "a ")}`, SITE.placeholder],
    pillars: [],
    cta: { label: "More about us", to: "/about" },
    src: medical,
    alt: "A doctor examining a young girl at a medical camp",
  },

  /* The lifetime figures, last thing before the footer. Three empty
     slots until RBB confirms its headline metrics — Document 01 lists
     them as "verify before publication", and one carries a label that
     still has to be clarified. `icon` picks one of the inline glyphs in
     ImpactStats (people | relief | water); a stat without one simply has
     no tile. */
  overallStats: {
    heading: "Our Impact",
    branded: true,
    stats: [
      { label: "Impact figure", value: FIGURE.value, note: FIGURE.label },
      { label: "Impact figure", value: FIGURE.value, note: FIGURE.label },
      { label: "Impact figure", value: FIGURE.value, note: FIGURE.label },
    ],
  },

  /* The regular-giving ask, closing the page. Monthly donors are what let
     a field team plan past the next emergency, so the copy sells the
     predictability rather than the amount. */
  regular: {
    /* One entry per line: the break before "regular donor" is a
       deliberate typographic choice, not something any column width
       would produce on its own. Lines still wrap on a narrow phone. */
    heading: ["Make a difference.", "Become a", "regular donor"],
    body: `Join a community of monthly givers whose steady support gives ${BRAND.name} the predictability and flexibility to reach people who need it most — before, during and after an emergency.`,
    cta: { label: "Start giving", to: "/giving/monthly" },
    src: maternal,
    alt: "A health worker checks a baby held in their mother's arms at a clinic",
  },
};

export default NGO;
