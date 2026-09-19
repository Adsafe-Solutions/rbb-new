/* Every string on /gifts, in page order.

   Reproduced verbatim from muslimhands.ca/giving/major-giving (fetched
   2026-09-15), organisation name via BRAND.name. Photography is
   free-license Pexels stock, credited beside each import. */

import { BRAND } from "./brand.js";

import hero from "../assets/gifts-hero.jpg"; /* Dauphotographer, 35106287 */
import solar from "../assets/gifts-solar.jpg"; /* nisar-ahmed-jamali, 31512224 */
import borehole from "../assets/gifts-borehole.jpg"; /* Kelly, 3794760 */
import goats from "../assets/gifts-goats.jpg"; /* Tahir Osman, 26560881 */
import seeds from "../assets/gifts-seeds.jpg"; /* Joice Rivas, 14251410 */
import tree from "../assets/gifts-tree.jpg"; /* Thirdman, 7656746 */
import wheelchair from "../assets/gifts-wheelchair.jpg"; /* Kampus, 8777810 */
import eye from "../assets/gifts-eye.jpg"; /* Pavel Danilyuk, 5996653 */
import maternal from "../assets/gifts-maternal.jpg"; /* Mahyub Hamida, 30313887 */
import volunteers from "../assets/ngo-volunteers.jpg";
import waterChild from "../assets/ngo-water-child.jpg";
import waterPump from "../assets/ngo-water-pump.jpg";
import sewing from "../assets/zakat-sewing.jpg";
import events from "../assets/ngo-events.jpg";

export const GIFTS = {
  hero: {
    heading: "Major Giving",
    body: "Deliver impactful personalized projects tailored to your goals, timeline, and budget.",
    src: hero,
    alt: "Workers digging foundation trenches with shovels in a rural area",
  },

  legacy: {
    heading: "Create a Lasting Legacy",
    paragraphs: [
      "Your generosity helps transform the lives of thousands of people in need. Through your support, communities gain access to essential resources, vital services, and life-changing opportunities.",
      "When you give through Major Giving, you help bring high-impact projects to life. From health centres and hope shops to solar-powered boreholes and other large-scale solutions that improve lives for generations to come.",
      "With every projects you support, you will receive a personalized feedback report, including photos and, where available, video content, so you can truly see the impact of your generosity.",
    ],
    src: volunteers,
    alt: "Volunteers in matching shirts handing out aid boxes",
  },

  feedback: {
    heading: "100% Feedback Promise",
    paragraphs: [
      `${BRAND.name} provides personalized feedback reports for each major giving project donated. These include location details and pictures of your project, allowing you to see the impact of your gift. A plaque with your name and/or the name of a loved one can be placed on the within the area of your project.`,
    ],
    cta: { label: "Donate a Well", to: "/giving/give-the-gift-of-water" },
    src: waterChild,
    alt: "A girl drinking from an outdoor tap",
    flip: true,
  },

  water: {
    heading: "Sustainable Water Solutions",
    intro:
      "Unsafe water remains one of the biggest threats to health worldwide, claiming over 800,000 lives each year (WHO). Access to clean water transforms entire communities – improving health, education, and livelihoods. Your gift — including Zakat or Sadaqah, if that is how you give — can fund large-scale water solutions such as solar-powered boreholes and water filtration plants, delivering safe, reliable water for years to come. Each donated water project includes a personalized report, photos, location details, and the option to place a name plaque in honor of yourself or a loved one.",
    surface: "mist",
    items: [
      {
        title: "Water Filtration Plant",
        body: "A water filtration plant can serve hundreds of people daily and is installed in areas with limited access to water, ensuring clean drinking water is available for decades. Ultrafiltration technology removes particles from water to make it safe to drink.",
        detail: "Locations: Pakistan",
        src: waterPump,
        alt: "A child working a hand pump",
      },
      {
        title: "Solar Powered Borehole",
        body: "By donating a solar-powered borehole, you can provide clean water for to up to 3,000 people every day. The borehole will be equipped with solar panels, ensuring it remains operational even during power outages.",
        detail: "Locations: Pakistan, Mali, or Niger",
        src: solar,
        alt: "Solar panels set up outdoors in a rural area",
      },
      {
        title: "Deep Borehole",
        body: "A deep borehole can serve thousands of people daily and is installed in areas with limited access to water, ensuring clean drinking water is available for decades.",
        detail: "Locations: Mali, Niger, or Senegal",
        src: borehole,
        alt: "Workers with a shovel and pickaxe on rocky ground",
      },
    ],
  },

  empowerment: {
    heading: "Economic Empowerment Initiatives",
    intro:
      "Many families have the skills and determination to earn a living but lack the resources to get started. Our livelihoods projects provide tools, training, and opportunities that empower communities to break the cycle of poverty. Your Zakat or Sadaqah can support initiatives such as vocational training, livestock distribution, and income-generating businesses across Africa and Asia. You'll receive a personalized impact report showing how your contribution helped families become self-reliant.",
    items: [
      {
        title: "Sewing Machines",
        body: "Sewing machines can help families stitch and repair clothes while earning a reliable income.",
        src: sewing,
        alt: "A student at a sewing machine during a training class",
      },
      {
        title: "Farming Tools & Seeds",
        body: "Farming tools and seeds allow families to cultivate their land, grow food, and build sustainable livelihoods.",
        src: seeds,
        alt: "Hands holding beans over soil, ready for planting",
      },
      {
        title: "Goats",
        body: "Goats provide families with nutritious milk for years while supporting food security and livelihoods.",
        src: goats,
        alt: "A smiling boy standing among goats on a farm",
      },
      {
        title: "Fruit Tree",
        body: "Planting a fruit tree provides families with nourishing food, environmental benefits, and the opportunity to earn income from surplus harvests. This meaningful gift supports long-term food security and comes with a personalized e-certificate in the name of your choice.",
        src: tree,
        alt: "A person watering a young sapling with a watering can",
      },
    ],
  },

  health: {
    heading: "Restoring Health",
    intro:
      "Millions suffer from preventable and treatable illnesses due to poverty, poor sanitation, and limited healthcare access. When health fails, education, work, and family stability suffer too. Your Major Giving contribution can support eye camps, maternal health clinics, and essential medical aid, restoring dignity and saving lives. Each project includes a personalized feedback report with photos and beneficiary details.",
    surface: "mist",
    items: [
      {
        title: "Wheelchair",
        body: "Wheelchairs restore mobility, independence, and dignity for individuals with disabilities. Your gift includes a personalized e-certificate.",
        src: wheelchair,
        alt: "A young man in a wheelchair enjoying a sunny day",
      },
      {
        title: "Gift of Sight Eye Camp",
        body: "The Gift of Sight provides eye care services, such as eye tests, treatment, and corrective support, allowing individuals to restore sight and regain independence.",
        src: eye,
        alt: "An optometrist examining a child's eyes",
      },
      {
        title: "Maternal Health Clinics",
        body: "By supporting the rehabilitation of maternal health clinics, you can help restore access to healthcare for mothers living in vulnerable communities.",
        src: maternal,
        alt: "A healthcare worker examining a child held by their mother at a clinic",
      },
    ],
  },

  /* Zakat is still offered — it is one of the routes on /giving — but this
     section no longer assumes the reader gives it. It states the fact for
     donors who do and reads as information, not instruction, for everyone
     else. The photograph was hands raised in prayer inside a mosque; it is
     now the project the money builds, which is what the section is about. */
  zakat: {
    heading: "Zakat-Eligible",
    paragraphs: [
      "Major Giving projects qualify for Zakat.",
      "If you give Zakat, it can fund a borehole, a clinic or a classroom in full — and we will account for it separately, as Zakat requires.",
    ],
    cta: { label: "More ways to give", to: "/giving" },
    src: borehole,
    alt: "Workers digging the trench for a new village borehole",
    flip: true,
  },

  newsletter: {
    heading: "Stay tuned",
    body: "Project updates and feedback reports from the field, straight to your inbox.",
    consent: "Yes, I give permission to store and process my data",
    src: events,
    alt: "A group of young volunteers in matching shirts at an outdoor event",
  },
};

export default GIFTS;
