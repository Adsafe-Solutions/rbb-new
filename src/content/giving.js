/* Every string on /giving — the Ways to Give hub, in page order.

   This page exists because RBB is not a faith-specific organisation. /giving
   used to BE the Zakat page: a donor arriving from the main nav landed on
   Zakat eligibility, Nisab thresholds and scholar verification, which tells
   anyone who does not give Zakat that this charity is not addressed to them.

   Zakat did not go anywhere. It is one of the routes below and it keeps its
   own page, its calculator and its full detail at /giving/zakat — the same
   content, one level down, offered rather than assumed. The rule for copy
   here: name a tradition only where a donor of that tradition needs the
   information, and never as the reason to give. */

import { BRAND } from "./brand.js";

import hero from "../assets/ngo-volunteers.jpg";
import once from "../assets/ngo-food-parcels.jpg";
import monthly from "../assets/ngo-water-child.jpg";
import zakat from "../assets/zakat-hero.jpg";
import gifts from "../assets/gifts-goats.jpg";
import legacy from "../assets/ngo-classroom.jpg";
import major from "../assets/gifts-borehole.jpg";
import events from "../assets/ngo-events.jpg";

export const GIVING = {
  hero: {
    heading: "Ways to Give",
    body: `However you give, and whatever moves you to, ${BRAND.name} will get it to the people who need it. Here is every route in.`,
    cta: { label: "Donate Now", to: "/donate" },
    src: hero,
    alt: "Volunteers sorting boxes of supplies at a distribution point",
  },

  /* The four promises. These used to be Zakat's: "Scholar Verified",
     "Zakat is used exclusively for eligible projects". Restricted funds
     still work exactly that way — the promise is simply stated so it holds
     for every donor, with the Zakat-specific version of it left on the
     Zakat page where it belongs. */
  trust: {
    heading: `Why give through ${BRAND.name}`,
    intro:
      "Thirty years of getting aid to the places it is hardest to reach, and accounting for every pound of it.",
    items: [
      {
        title: "Restricted Means Restricted",
        body: "Give to an appeal and it funds that appeal. Funds given for a specific purpose are tracked and reported separately — including Zakat, which is kept and distributed to its own rules.",
      },
      {
        title: "On the Ground Since 1993",
        body: "Thirty years of field teams and local partners across 15+ countries, in places most organisations reach late or not at all.",
      },
      {
        title: "Accountable in Public",
        body: "Annual reports, audited accounts and field updates, published — not summarised on request.",
      },
      {
        title: "Relief and Then Recovery",
        body: "We stay past the emergency. Water, clinics, classrooms and livelihoods are what turn a delivery into a difference.",
      },
    ],
  },

  /* The routes themselves. Order is by how many people use them, not by
     what the organisation would prefer — a first-time donor wants "give
     once" first, and a hub that opens with legacy giving is a hub written
     for the finance team. */
  routes: {
    heading: "Choose your route",
    items: [
      {
        title: "Give Once",
        to: "/donate",
        src: once,
        alt: "Boxes marked AID stacked in a van",
      },
      {
        title: "Give Monthly",
        to: "/giving/monthly",
        src: monthly,
        alt: "A child drinking from an outdoor tap",
      },
      {
        title: "Zakat & Sadaqah",
        to: "/giving/zakat",
        src: zakat,
        alt: "Two people passing a filled donation box between them",
      },
      {
        title: "Gift Catalogue",
        to: "/gifts",
        src: gifts,
        alt: "A boy standing among a herd of goats",
      },
      {
        title: "Major Giving",
        to: "/giving/major-giving",
        src: major,
        alt: "Workers digging the trench for a new village borehole",
      },
      {
        title: "Gifts in Wills",
        to: "/giving/gifts-in-wills",
        src: legacy,
        alt: "Children at their desks in a tented classroom",
      },
    ],
  },

  newsletter: {
    heading: "Stay Informed",
    body: "Appeal updates and field reports, straight to your inbox.",
    consent: "Yes, I give permission to store and process my data",
    src: events,
    alt: "Young volunteers in matching shirts at an outdoor event",
  },
};

export default GIVING;
