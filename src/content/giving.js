/* Every string on /giving — the legacy "Ways to Give" address.

   Document 11 keeps this URL working, but the page no longer offers giving
   routes of its own. It used to list six — Give Once, Give Monthly, Zakat
   & Sadaqah, Gift Catalogue, Major Giving, Gifts in Wills — with a promise
   that every gift would "get to the people who need it". None of those
   programs, nor the promise, is anything RBB has supplied: monthly giving
   and bequests are recurring-payment and legal commitments Document 11
   forbids inventing. The page now says what giving currently is, from
   content/donation.js, and points to the one donation page.

   /giving/zakat keeps its own placeholder page (content/zakat.js); it is
   no longer linked from here, because nothing on it is RBB's yet. */

import { DONATION } from "./donation.js";
import { SITE } from "./site.js";

import hero from "../assets/ngo-volunteers.jpg";
import events from "../assets/ngo-events.jpg";

export const GIVING = {
  hero: {
    heading: "Ways to Give",
    body: DONATION.hero.body,
    cta: DONATION.legacy.onward,
    src: hero,
    alt: "Volunteers sorting boxes of supplies at a distribution point",
  },

  newsletter: {
    heading: "Stay Informed",
    body: "News and updates, straight to your inbox.",
    pending: SITE.newsletterPending,
    src: events,
    alt: "Young volunteers in matching shirts at an outdoor event",
  },
};

export default GIVING;
