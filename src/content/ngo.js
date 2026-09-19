/* Every string on the homepage below the hero, in the order the page uses
   them.

   ⚠ Copy and figures are reproduced from muslimhands.ca (fetched
   2026-09-15) at the user's request, with the organisation name swapped
   for BRAND.name so a rename stays one edit. Two things were deliberately
   left out and must be supplied by whoever owns this site:
     - the CRA charity registration number — a real charity's number
       under a different name is misrepresentation, so `about` says
       "registered charity" without one;
     - photography — theirs is copyrighted; these are free-license Pexels
       stock, credited beside each import.
   If this site is not for that charity, every figure below is someone
   else's audited impact and has to be replaced before it ships. */

import { BRAND } from "./brand.js";

import kitchen from "../assets/ngo-kitchen.jpg"; /* Eden FC, 20859655 */
import sudan from "../assets/ngo-sudan.jpg"; /* Ahmed Akacha, 10629442 */
import waterChild from "../assets/ngo-water-child.jpg"; /* Ahmed Akacha, 10214733 */
import waterPump from "../assets/ngo-water-pump.jpg"; /* Matazu Multimedia, 32154739 */
import tentGirl from "../assets/ngo-tent-girl.jpg"; /* Ahmed Akacha, 27198722 */
import volunteers from "../assets/ngo-volunteers.jpg"; /* RDNE Stock Project, 6646918 */
import volunteer from "../assets/ngo-volunteer.jpg"; /* RDNE Stock Project, 6646893 */
import events from "../assets/ngo-events.jpg"; /* Quyn Phạm, 13418669 */
import fundraise from "../assets/ngo-fundraise.jpg"; /* cottonbro, 6591154 */
import about from "../assets/ngo-about.jpg"; /* RDNE Stock Project, 6646886 */
import legacySewing from "../assets/zakat-sewing.jpg"; /* Illustrate Digital UG, 20853652 */
import legacyBoy from "../assets/zakat-orphan.jpg"; /* umar-muazu, 32662981 */
import legacyDig from "../assets/gifts-hero.jpg";

export const NGO = {
  /* The Gaza appeal, as ONE section. It used to be two — a FeatureBanner
     headed "Our Work in Gaza" and an ImpactStats band headed "Your Impact
     in Gaza" — which repeated each other's heading across a gap and a
     change of surface. Neither worked alone: the first had no numbers,
     the second had no context, and neither had a way to act.

     ⚠ `note` on the first stat used to read "Lives Saved". The figure is
     BENEFICIARIES — people who received aid — and "lives saved" is a
     different, much stronger claim a donor or a regulator can hold us to.
     Keep the label to what the number actually counts.

     ⚠ The partner names are a factual claim carried over from the source
     copy. Confirm them against RBB's actual agreements before launch. */
  gaza: {
    /* The pill says whether it is live; the kicker says what KIND of
       work this is. A kicker of "Gaza" over a heading ending "in Gaza"
       said the same word twice in two lines. */
    status: "Active now",
    kicker: "Emergency appeal",
    heading: "Our Work in Gaza",
    body: `${BRAND.name} works through partners on the ground to reach families in Gaza with hot meals, emergency food parcels, bread and shelter — delivered as close to the need as access allows.`,
    partners: {
      label: "Delivering with",
      names: ["UN World Food Programme", "International Organization for Migration"],
    },
    /* Values are the NUMBER only; the unit lives in the label. "158 Metric
       Tonnes of Bread" as a value wrapped to three lines beside two-line
       neighbours and made the row look broken. */
    stats: [
      { value: "225,610", label: "People reached", highlight: true },
      { value: "417,380", label: "Hot meals served" },
      { value: "500", label: "Emergency food packs" },
      { value: "158 t", label: "Bread delivered" },
    ],
    ctas: {
      primary: { label: "Donate to Gaza", href: "#donate-gaza" },
      secondary: { label: "Read the Gaza report", to: "/reports" },
    },
    src: tentGirl,
    alt: "A young girl standing among the tents of a displacement camp",
  },

  donate: {
    appeal: { name: "Gaza Emergency Appeal", changeTo: "/donate" },
    amounts: [150, 175, 300],
    currency: { symbol: "CA$", code: "CAD" },
    addon: "Zakat",
    cta: { label: "Donate", to: "/donate" },
    src: kitchen,
    alt: "Volunteers ladling food from a large steaming pot at a community kitchen",
  },

  campaign: {
    heading: "Provide Urgent Relief to Sudan",
    accent: "Urgent Relief",
    body: "Sudan is facing one of the world's most devastating humanitarian crises. More than 30 million people urgently need assistance. 21 million people are facing acute hunger, 75% of health facilities have collapsed, and 11 million people have been forced to flee.",
    cta: { label: "Sudan Emergency Fund", to: "/donate" },
    src: sudan,
    alt: "A woman carrying a baby walks with a child past tents at a camp for displaced families",
  },

  action: {
    tag: "Yemen Emergency",
    heading: "Help Save Lives in Yemen",
    body: "Provide essential aid and support families in need. 19.5 million people across Yemen require humanitarian assistance. $50 can feed 100 people per day for a month through the Yemen Bread Factory, which makes 10,000 loaves of bread daily.",
    cta: { label: "Feed 200 people in Yemen", to: "/donate" },
    src: waterChild,
    alt: "A young girl drinking water from an outdoor tap",
  },

  getInvolved: {
    heading: "Get Involved",
    tabs: [
      {
        key: "volunteer",
        label: "Volunteer",
        heading: "Volunteer",
        body: "Get involved by volunteering your time with food banks, community initiatives, events, outreach, and fundraising - there is a role for everyone!",
        cta: { label: "Volunteer", to: "/volunteer" },
        src: volunteer,
        alt: "A smiling volunteer carrying a box of food supplies beside a delivery van",
      },
      {
        key: "events",
        label: "Events",
        heading: "Events",
        body: "From local events to international volunteer trips, our opportunities inspire positive change through hands-on humanitarian action. Explore our upcoming events to get involved.",
        cta: { label: "Events", to: "/events" },
        src: events,
        alt: "A group of young volunteers in matching shirts at an outdoor event",
      },
      {
        key: "fundraise",
        label: "Fundraise",
        heading: "Fundraise",
        body: `Use our crowdfunding feature to set up a fundraiser on behalf of ${BRAND.name} – Choose your cause and share your fundraiser with friends and family to make a big impact!`,
        cta: { label: "Do Your Own Fundraising", to: "/fundraise" },
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
      { label: "Our Work", to: "/about-us" },
      { label: "Our Impact", to: "/reports" },
      { label: "Donate to Help People", to: "/donate" },
    ],
    src: waterChild,
    alt: "A child drinking from cupped hands at a village standpipe",
  },

  /* The long view: three decades in one sentence, beside a three-photo
     collage. It sits directly before the mosaic of figures, so the claim
     ("for over 30 years") arrives just before the evidence for it.

     `headline` is split so the last phrase can take the accent colour —
     the promise itself, not the organisation's name, is what gets the
     emphasis.

     The photographs are chosen for the SHAPES they sit in: a portrait
     subject for the arch, a single face for the round drop (a tight
     close-up is exactly what that small circular frame wants), and a wide
     scene with people across it for the long frame underneath. */
  legacy: {
    headline: `For over 30 years, ${BRAND.name} has worked towards a world where`,
    headlineAccent: "no one is left behind.",
    body: "From emergency convoys to village boreholes, classrooms to sewing co-operatives — we show up where the need is greatest, and stay until communities can stand on their own.",
    cta: { label: "See our recent successes", to: "/blogs" },
    secondary: { label: "About us", to: "/about-us" },
    badge: { value: "30+", label: "years in the field" },
    photos: {
      arch: { src: legacySewing, alt: "A young woman smiling at her sewing machine in a livelihoods workshop", focal: "50% 30%" },
      drop: { src: legacyBoy, alt: "A boy smiling straight at the camera", focal: "50% 35%" },
      wide: { src: legacyDig, alt: "Volunteers digging the trench for a new water line", focal: "50% 55%" },
    },
  },

  mosaic: {
    leadStat: { value: "15+", label: "Countries receiving humanitarian aid" },
    leadPhoto: { src: waterPump, alt: "A child working a hand pump to fill a bucket with water" },
    feature: {
      value: "3 Million+",
      label: "Loaves distributed in Yemen in 2025",
      src: tentGirl,
      alt: "A girl in pink standing beside a tent in a camp",
    },
    sidePhoto: { src: volunteers, alt: "Volunteers in matching shirts handing out aid boxes" },
    sideStat: { value: "Since 1993", label: "Delivering aid where it is needed most" },
  },

  /* This slot used to hold an "Islamic Resources" band under a photograph
     of a mosque. RBB is not a faith-specific organisation, so a single
     tradition cannot stand at the centre of the homepage — and standing
     for "faith" in general is not a job one mosque photograph can do.

     The BAND stays rather than the section being deleted: the homepage's
     rhythm is an alternation of full-bleed and contained surfaces (see
     pages/Home) and pulling one out leaves a hole, not a saving. What it
     holds now is the thing a donor of any faith actually wants next —
     where the money went. */
  resources: {
    surface: "honey",
    src: fundraise,
    alt: "Two fundraisers going through paperwork together beside a crate of supplies",
    heading: "Reports & Accountability",
    body: "Every appeal is accounted for. Read our annual reports and field updates to see exactly what your giving bought, and where.",
    cta: { label: "Read our reports", to: "/reports" },
  },

  about: {
    surface: "pollen",
    src: about,
    alt: "A volunteer handing a box marked FOOD AID to another person",
    heading: BRAND.name,
    body: [
      `${BRAND.name} is a registered charity with the Canada Revenue Agency.`,
      "We are an international aid agency and NGO working globally to help those affected by natural disasters, conflict and poverty.",
      "We ensure your donations reach the people that really need them and provide an efficient, impartial and transparent service.",
    ],
  },

  overallStats: {
    stats: [
      { label: "Beneficiaries Supported", value: "3 Million+", note: "Received life-saving support" },
      { label: "Emergency Beneficiaries", value: "1.2 Million+", note: "Provided with emergency relief" },
      { label: "Water", value: "1 Million+", note: "Gained access to clean water" },
    ],
  },
};

export default NGO;
