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
    status: "Active now",
    kicker: "Emergency appeal",
    heading: "Our Work in Gaza",
    /* One sentence. This sits directly under the hero now, and a second
       wall of copy there pushes everything else down the page before
       anyone has scrolled. The detail belongs to /reports. */
    body: "Hot meals, food parcels, bread and shelter for families in Gaza — delivered through partners on the ground.",
    /* Three, not four: the food-pack count was the smallest and least
       telling of the set. `partners` is dropped from display too — it
       named two UN agencies, a claim still waiting to be confirmed, and
       the compact version has no room to hedge it. AppealSpotlight still
       renders `partners` if an entry supplies it. */
    stats: [
      { value: "225,610", label: "People reached", highlight: true },
      { value: "417,380", label: "Hot meals served" },
      { value: "158 t", label: "Bread delivered" },
    ],
    ctas: {
      primary: { label: "Donate to Gaza", href: "#donate-gaza" },
      secondary: { label: "Read the report", to: "/reports" },
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

  /* Yemen, as the Sudan campaign's mirror: same component, flipped by the
     homepage, so the two appeals read as a pair zigzagging across the page. It used to
     be a charcoal ActionCard, a different idiom sitting straight after
     Sudan, which made two appeals of equal weight look unrelated.

     `tag` is not shown by CampaignHero — Sudan has no tag and the pair
     should match. It is kept because the component catalog still renders
     ActionCard from this entry, and that card needs one.

     The photograph changed too: it was the girl at the tap, which "What
     We Fight For" already shows higher up the same page. */
  yemen: {
    tag: "Yemen Emergency",
    heading: "Help Save Lives in Yemen",
    accent: "Save Lives",
    body: "Provide essential aid and support families in need. 19.5 million people across Yemen require humanitarian assistance. $50 can feed 100 people per day for a month through the Yemen Bread Factory, which makes 10,000 loaves of bread daily.",
    cta: { label: "Feed 200 people in Yemen", to: "/donate" },
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

  /* Reports & Accountability. This slot used to hold an "Islamic
     Resources" band; then a plain FeatureBanner asking for trust with a
     stock photograph and one sentence. A section about accountability has
     to SHOW something, so it now carries the commitments and the actual
     documents a donor would go and check.

     ⚠ No figures here on purpose. A "where your money goes" chart is the
     obvious move and the wrong one until RBB supplies audited numbers — an
     invented 92% on the accountability section is the worst possible
     place for an invented number.

     ⚠ The commitments are claims. "Independently audited" and the CRA
     registration repeat what the site already says elsewhere; confirm
     both before launch. The document links go to the /reports stub until
     the real PDFs exist. */
  accountability: {
    kicker: "Reports & Accountability",
    heading: "Every gift, accounted for.",
    body: "We publish where the money goes — not a summary on request. Annual reports, audited accounts and field updates, so you can see exactly what your giving bought, and where.",
    commitments: [
      "Independently audited every year",
      "Restricted gifts tracked and reported separately",
      "Registered charity with the Canada Revenue Agency",
    ],
    documents: [
      { title: "Annual Report", meta: "The year in review · PDF", to: "/reports" },
      { title: "Audited Financial Statements", meta: "Independent audit · PDF", to: "/reports" },
      { title: "Field Updates", meta: "From each appeal, as it happens", to: "/reports" },
    ],
    cta: { label: "Read our reports", to: "/reports" },
  },

  /* Who we are. This was a FeatureBanner headed just "RBB" — a heading that
     told the reader nothing — with three centred sentences and no way to
     go further. The facts are the same; they now have a headline, the
     three principles they imply, and the registration as a credential
     rather than a sentence.

     "Impartial" says what it means — aid by need alone, not by faith —
     which is the promise the faith-neutral rework of the site rests on. */
  about: {
    kicker: `About ${BRAND.name}`,
    heading: "Impartial, efficient, and open about both.",
    body: [
      "We are an international aid agency working to help people affected by natural disasters, conflict and poverty — whoever and wherever they are.",
      "We make sure your donations reach the people who really need them, with an efficient, impartial and transparent service.",
    ],
    pillars: [
      { title: "Impartial", body: "Aid goes by need alone — never by faith, ethnicity or politics." },
      { title: "Efficient", body: "Field teams and local partners, so more of every gift arrives." },
      { title: "Transparent", body: "Reports and audited accounts, published every year." },
    ],
    credential: { label: "Registered charity", value: "Canada Revenue Agency" },
    cta: { label: "More about us", to: "/about-us" },
    src: medical,
    alt: "A doctor examining a young girl at a medical camp",
  },

  /* The lifetime figures, last thing before the footer. They used to sit
     there with no heading and nothing on the cards saying whose numbers
     they were. `icon` picks one of the inline glyphs in ImpactStats
     (people | relief | water); a stat without one simply has no tile. */
  overallStats: {
    heading: "Our Impact Since 1993",
    branded: true,
    stats: [
      { icon: "people", label: "Beneficiaries Supported", value: "3 Million+", note: "Received life-saving support" },
      { icon: "relief", label: "Emergency Beneficiaries", value: "1.2 Million+", note: "Provided with emergency relief" },
      { icon: "water", label: "Water", value: "1 Million+", note: "Gained access to clean water" },
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
