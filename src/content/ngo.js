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

import foodParcels from "../assets/ngo-food-parcels.jpg"; /* RDNE Stock Project, 6646846 */
import kitchen from "../assets/ngo-kitchen.jpg"; /* Eden FC, 20859655 */
import sudan from "../assets/ngo-sudan.jpg"; /* Ahmed Akacha, 10629442 */
import waterChild from "../assets/ngo-water-child.jpg"; /* Ahmed Akacha, 10214733 */
import classroom from "../assets/ngo-classroom.jpg"; /* Bengi River, 14992078 */
import waterPump from "../assets/ngo-water-pump.jpg"; /* Matazu Multimedia, 32154739 */
import tentGirl from "../assets/ngo-tent-girl.jpg"; /* Ahmed Akacha, 27198722 */
import volunteers from "../assets/ngo-volunteers.jpg"; /* RDNE Stock Project, 6646918 */
import volunteer from "../assets/ngo-volunteer.jpg"; /* RDNE Stock Project, 6646893 */
import events from "../assets/ngo-events.jpg"; /* Quyn Phạm, 13418669 */
import fundraise from "../assets/ngo-fundraise.jpg"; /* cottonbro, 6591154 */
import mosque from "../assets/ngo-mosque.jpg"; /* Akshay S, 38351606 */
import about from "../assets/ngo-about.jpg"; /* RDNE Stock Project, 6646886 */

export const NGO = {
  work: {
    surface: "honey",
    src: foodParcels,
    alt: "Cardboard boxes marked AID stacked inside a delivery van",
    heading: "Our Work in Gaza",
    body: `${BRAND.name} is working through our partners on the ground, including the UN World Food Programme and the International Organization of Migration, to deliver hot meals, emergency food parcels, tents and bread to provide for Gazans.`,
  },

  appealStats: {
    heading: "Your Impact in Gaza",
    stats: [
      { label: "Total Beneficiaries", value: "225,610", note: "Lives Saved", highlight: true },
      { label: "Hot Cooked Meals", value: "417,380 Meals", note: "Delivered" },
      { label: "Emergency Food Parcels", value: "500 Food Packs", note: "Delivered" },
      { label: "Bread Parcels", value: "158 Metric Tonnes of Bread", note: "Delivered" },
    ],
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

  fightFor: {
    heading: "Our Promise",
    paragraphs: [
      `Sincerity — At ${BRAND.name}, we act with pure intentions and honesty. Our work is rooted in faith and integrity.`,
      `Global Impact — ${BRAND.name} has been delivering your donations to those in need across the globe for over 30 years.`,
      "Sustainable Progress — Your donations support thousands worldwide through both emergency relief and long-term solutions.",
      "Accountable — Your donations are an Amanah. We deliver them where most needed with compassion, oversight and transparency.",
    ],
    links: [
      { label: "Volunteer", to: "/volunteer" },
      { label: "Events", to: "/events" },
      { label: "Fundraise", to: "/fundraise" },
    ],
    src: classroom,
    alt: "Children at wooden desks in a tented classroom, one looking back at the camera",
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
    sideStat: { value: "Since 1993", label: "Delivering your Sadaqah and Zakat" },
  },

  resources: {
    surface: "honey",
    src: mosque,
    alt: "A white mosque dome and minaret against a clear blue sky",
    heading: "Islamic Resources",
    body: "Learn, reflect, and grow in faith. Explore our Islamic resources for guidance rooted in Islamic values.",
    cta: { label: "Learn More", to: "/resources" },
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
