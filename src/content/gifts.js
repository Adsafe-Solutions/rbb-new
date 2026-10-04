/* Every string on /gifts (and /giving/major-giving) — legacy addresses.

   This page was reproduced verbatim from another charity's Major Giving
   page: its gift catalogue, project locations, capacity figures, and its
   feedback-report and name-plaque promises. None of that was RBB's. Its
   section headings — water solutions, economic empowerment, restoring
   health, "Zakat-Eligible" — outlived the content and still named giving
   programs RBB has not supplied, so Document 11 removes them too. The
   addresses keep working; the page says what giving currently is, from
   content/donation.js, and points to the one donation page. Photography
   is free-license Pexels stock, credited beside each import. */

import { SITE } from "./site.js";

import hero from "../assets/gifts-hero.jpg"; /* Dauphotographer, 35106287 */
import events from "../assets/ngo-events.jpg";

export const GIFTS = {
  hero: {
    heading: "Major Giving",
    body: "Find out how to give to Rising Beyond Borders on our donation page.",
    src: hero,
    alt: "Workers digging foundation trenches with shovels in a rural area",
  },

  newsletter: {
    heading: "Stay tuned",
    body: "News and updates, straight to your inbox.",
    pending: SITE.newsletterPending,
    src: events,
    alt: "A group of young volunteers in matching shirts at an outdoor event",
  },
};

export default GIFTS;
