/* Every string on /giving/zakat.

   ⚠ Placeholder page. It was first filled from another charity's Zakat
   page — its explanation of Zakat, Nisab values, Fitrana amount,
   eligibility guidance, eligible projects and FAQs. All of that has been
   removed. Zakat information, and any religious guidance with it, is
   RBB's to write and review; nothing goes back here until it has.

   The route stays (it is linked from /giving) so the page can be
   redesigned later without a new URL. Photography is free-license Pexels
   stock, credited beside each import. */

import hero from "../assets/zakat-hero.jpg"; /* Shkraba Anthony, 7345444 */
import classroom from "../assets/ngo-classroom.jpg";
import { SITE } from "./site.js";

/* No visitor-facing "to be provided" line, and nothing religious added
   (content brief, 2026-10-04): the page points to the one donation page. */
const PLACEHOLDER = "Find out how to give to Rising Beyond Borders on our donation page.";

export const ZAKAT = {
  hero: {
    heading: "Zakat",
    body: PLACEHOLDER,
    src: hero,
    alt: "Two people passing a filled donation box between them",
  },

  newsletter: {
    heading: "Stay Informed",
    body: "News and updates, straight to your inbox.",
    pending: SITE.newsletterPending,
    src: classroom,
    alt: "Children at wooden desks in a tented classroom",
  },
};

export default ZAKAT;
