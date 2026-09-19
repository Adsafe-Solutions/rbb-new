/* Every string on /giving/zakat, in page order.

   ⚠ This page moved. It used to be served at /giving — the main nav's
   "Giving" entry — which meant every donor arriving from the header landed
   on Nisab thresholds and scholar verification whether or not they give
   Zakat. RBB is not a faith-specific organisation, so /giving is now the
   Ways to Give hub (content/giving.js) and Zakat is one route on it, with
   this page kept whole underneath.

   The copy here is ADDRESSED TO SOMEONE WHO GIVES ZAKAT and should stay
   that way — a reader who has followed a link marked "Zakat & Sadaqah" has
   told you who they are. It is the pages above it that must not assume.

   Reproduced from muslimhands.ca/giving/islamic-giving/zakat (fetched
   2026-09-15), organisation name via BRAND.name. Where the source was
   only available in summary the answer is a close paraphrase, marked
   (paraphrased). Nisab values are the source's on that date — they move
   with the gold and silver price and must be kept current. Photography is
   free-license Pexels stock, credited beside each import. */

import { BRAND } from "./brand.js";

import hero from "../assets/zakat-hero.jpg"; /* Shkraba Anthony, 7345444 */
import orphan from "../assets/zakat-orphan.jpg"; /* umar-muazu, 32662981 */
import shop from "../assets/zakat-shop.jpg"; /* Abduljalil Attahir, 37323281 */
import medical from "../assets/zakat-medical.jpg"; /* Pavel Danilyuk, 5998449 */
import sewing from "../assets/zakat-sewing.jpg"; /* Illustrate Digital UG, 20853652 */
import tentGirl from "../assets/ngo-tent-girl.jpg";
import foodParcels from "../assets/ngo-food-parcels.jpg";
import waterChild from "../assets/ngo-water-child.jpg";
import sudan from "../assets/ngo-sudan.jpg";
import waterPump from "../assets/ngo-water-pump.jpg";
import classroom from "../assets/ngo-classroom.jpg";

const CALCULATOR = "/giving/zakat/calculator";

export const ZAKAT = {
  hero: {
    heading: "Give Your Zakat",
    body: "One of several ways to give with us — and one we have been distributing faithfully for over 30 years.",
    cta: { label: "Calculate Your Zakat", to: CALCULATOR },
    src: hero,
    alt: "Two people passing a filled donation box between them",
  },

  trust: {
    heading: "Give Your Zakat with Confidence",
    intro: `Your Zakat is a sacred trust (Amanah). ${BRAND.name} makes sure it reaches the vulnerable communities it is owed to.`,
    items: [
      { title: "Scholar Verified", body: "Distributions follow Islamic principles verified by qualified scholars." },
      { title: "Global Impact", body: "Over three decades delivering Zakat worldwide." },
      { title: "Sustainable Progress", body: "Supporting thousands through emergency relief and long-term solutions." },
      { title: "Accountable", body: "Zakat is used exclusively for eligible projects, with clear oversight." },
    ],
  },

  projects: {
    heading: "Zakat Eligible Projects",
    items: [
      { title: "Sponsor an Orphan", to: "/giving/sponsorships/sponsor-an-orphan", src: orphan, alt: "A smiling child outdoors" },
      { title: "Gift a Hope Shop", to: "/giving/hope-shops", src: shop, alt: "A young woman selling fruit at a market stall" },
      { title: "Support a Medical Camp", to: "/giving/medical-camps", src: medical, alt: "A doctor examining a child" },
      { title: "Zakat for Gaza", to: "/giving/emergencies/gaza-emergency", src: tentGirl, alt: "A girl beside a tent in a camp" },
      { title: "Zakat Where Most Needed", to: "/donate", src: foodParcels, alt: "Boxes marked AID stacked in a van" },
      { title: "Zakat for Yemen", to: "/giving/emergencies/yemen-emergency-appeal", src: waterChild, alt: "A girl drinking from an outdoor tap" },
    ],
  },

  calc: {
    heading: "How to calculate Zakat?",
    paragraphs: [
      "The Zakat you owe is 2.5% of the wealth you have held for a full lunar year.",
      "For example, if your total assets (minus any debts) have been held for an entire lunar year and amount to $1,000 your Zakat payment would be $25.",
    ],
    values: [
      { label: "Gold Nisab", value: "$16,599.33" },
      { label: "Silver Nisab", value: "$1,708.48" },
    ],
    note: "Current Nisab values. They follow the gold and silver price, so check before you calculate.",
    cta: { label: "Calculate Your Zakat", to: CALCULATOR },
  },

  impact: {
    heading: "Impact of Your Zakat",
    tabs: [
      {
        key: "emergencies",
        label: "Emergencies",
        heading: "Emergencies",
        body: "When crisis strikes, your Zakat delivers food, water, shelter and medical support to the most vulnerable communities, fast. (paraphrased)",
        src: sudan,
        alt: "A woman and children walk past tents in a camp",
      },
      {
        key: "orphans",
        label: "Orphans",
        heading: "Orphans",
        body: "Sponsorship gives an orphan food, healthcare, quality education, transport, and a safe, nurturing environment.",
        src: orphan,
        alt: "A smiling child outdoors",
      },
      {
        key: "water",
        label: "Water",
        heading: "Water",
        body: "2.1 million people globally lack access to safely managed drinking water. Your Zakat funds tube wells, community wells and filtration plants. (paraphrased)",
        src: waterPump,
        alt: "A child working a hand pump",
      },
      {
        key: "livelihoods",
        label: "Livelihoods",
        heading: "Livelihoods",
        body: "Nearly 700 million people live in extreme poverty. Your Zakat supports vocational training and skills development so families can earn their own living. (paraphrased)",
        src: sewing,
        alt: "A student at a sewing machine during a training class",
      },
      {
        key: "health",
        label: "Health",
        heading: "Health",
        body: "Up to 8.4 million people die yearly due to poor-quality care. Your Zakat funds medical camps and health projects where care is out of reach. (paraphrased)",
        src: medical,
        alt: "A doctor examining a child",
      },
    ],
  },

  faq: {
    heading: "Zakat FAQs",
    items: [
      {
        q: "What is Zakat?",
        a: "The word Zakat means 'to purify' - reflecting the belief that giving it cleanses one's wealth, brings blessings, and increases its value in both this life and the hereafter.",
      },
      {
        q: "What is the Nisab?",
        a: "The Nisab is the minimum amount of wealth a Muslim must hold before Zakat is due: the value of 87.5g of gold or 625g of silver. Many scholars favour the lower, silver value so that more people give. (paraphrased)",
      },
      {
        q: "What type of wealth is Zakat due on?",
        a: "Zakat is due on:",
        list: [
          "Gold and silver, including ornaments or jewellery",
          "Cash held at home or in bank accounts",
          "Stocks and shares",
          "Money lent to others; business inventory",
          "Agricultural produce",
          "Livestock animals",
          "Produce of mines",
          "Pensions",
          "Property owned for investment",
        ],
      },
      {
        q: "When should I pay my Zakat?",
        a: "You can pay your Zakat at any time, but many people choose to do so during the month of Ramadan when the reward for our good deeds is multiplied.",
      },
      {
        q: "Can I pay my Zakat in installments?",
        a: "Yes. Divide your total Zakat by 12 and give it monthly, making sure to mark the donation as Zakat. (paraphrased)",
      },
      {
        q: "What is the difference between Zakat and Sadaqah?",
        a: "Zakat is an obligatory annual charity with a set rate; Sadaqah is voluntary, with no fixed amount. (paraphrased)",
      },
      {
        q: "Are non-Muslims required to pay Zakat?",
        a: "Zakat is a mandatory charity specifically for Muslims. Non-Muslims are not required to pay it. However, donations from all faiths are warmly welcomed.",
      },
      {
        q: "How much Zakat should I give?",
        a: "2.5% of your qualifying wealth, once it meets the Nisab and has been held for one lunar year. Calculations vary by asset type — the calculator walks through each. (paraphrased)",
      },
      {
        q: "Should I calculate my Zakat using the Islamic or Gregorian calendar?",
        a: "The Hawl is the lunar year (about 354 days) that must pass before Zakat is due. On the lunar (Hijri) year the rate is 2.5%; on the solar (Gregorian) year it is 2.577%. Most scholars recommend the Hijri calendar. (paraphrased)",
      },
      {
        q: "Who is eligible to receive my Zakat?",
        a: "The Qur'an names eight categories:",
        list: [
          "The Poor (Al-Fuqara) — cannot meet basic needs",
          "The Needy (Al-Masakin) — facing hardship from illness, disability or misfortune",
          "Zakat Collectors (Amil Zakat) — responsible for collection and distribution",
          "New Muslims (Muallafatul Qulub) — new converts needing assistance",
          "Slaves or Captives (Riqab) — those in slavery; less common today",
          "Debtors (Al-Gharimun) — unable to pay their debts",
          "For the Cause of Allah (Fi Sabilillah)",
          "The Wayfarer (Ibn as-Sabil) — stranded travellers needing support",
        ],
      },
      {
        q: "What is Fitrana?",
        a: "Fitrana, also known as Zakat al-Fitr, is a charitable food donation made prior to Eid al-Fitr prayer.",
      },
      {
        q: "How much is Fitrana?",
        a: "Zakat al-Fitr should be the equivalent to one saa' of food. In today's value, one saa' is the cash value equivalent of food staples like rice or flour in Canada, which is equivalent to approximately $10 CAD.",
      },
      {
        q: "Who has to pay Fitrana?",
        a: "Fitrana must be paid by every Muslim who has food in excess. It is an obligation on every person in your household, but can be paid by the head of the household, parents or guardians on behalf of family members.",
      },
    ],
  },

  newsletter: {
    heading: "Stay Informed",
    body: "News from the field and reminders before Ramadan, straight to your inbox.",
    consent: "Yes, I give permission to store and process my data",
    src: classroom,
    alt: "Children at wooden desks in a tented classroom",
  },
};

export default ZAKAT;
