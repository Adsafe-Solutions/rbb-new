/* Sample content for components the /components catalog still renders
   (BannerHero, Prose, SignupCard, Steps, Testimonials, Faq, ContactDetails,
   LinkCards, Newsletter). No live page reads this file any more: /contact
   is built from content/contact.js and the Get Involved pages from
   content/getInvolved.js.

   It was first filled with another charity's copy, contact details,
   volunteer process, testimonials and blog; all of that was removed, and
   what remains is placeholder or general wording. Photography is
   free-license Pexels stock, credited beside each import. */

import { BRAND } from "./brand.js";
import { SITE } from "./site.js";

import volunteerHero from "../assets/volunteer-hero.jpg"; /* Shvetsa, 5029855 */
import classroom from "../assets/ngo-classroom.jpg";
import volunteers from "../assets/ngo-volunteers.jpg";
import events from "../assets/ngo-events.jpg";
import about from "../assets/ngo-about.jpg";
import fundraise from "../assets/ngo-fundraise.jpg";
import foodParcels from "../assets/ngo-food-parcels.jpg";

export const VOLUNTEER = {
  hero: {
    heading: "Volunteer With Us",
    body: "Turn compassion into action.",
    src: volunteerHero,
    alt: "A group of volunteers holding rubbish bags in a green field",
  },

  purpose: {
    heading: "Volunteer With Purpose",
    paragraphs: [
      "Volunteering with us is an opportunity to make a meaningful difference in the lives of those who need it most.",
      SITE.placeholder,
    ],
  },

  signup: {
    heading: "Sign Up to Volunteer With Us",
    body: SITE.placeholder,
    pending: "Volunteer sign-up to be provided by Rising Beyond Borders.",
  },

  steps: {
    heading: "What happens next?",
    items: [
      {
        title: "Register",
        body: SITE.placeholder,
      },
      {
        title: "Choose an Opportunity",
        body: SITE.placeholder,
      },
      {
        title: "Support",
        body: "We will support you every step of the way. And you can be sure that whatever role you chose, you will be making a huge contribution.",
      },
    ],
  },

  /* Testimonials go here once RBB has volunteers' own words, and their
     permission to publish them. */
  feedback: {
    heading: "Volunteer Feedback",
    items: [],
    empty: SITE.placeholder,
  },

  faq: {
    heading: "Volunteer FAQs",
    items: [
      {
        q: "How do I apply?",
        a: `Sign up using the volunteer form above. ${SITE.contactPlaceholder}`,
      },
      {
        q: "How long does it take to start volunteering?",
        a: SITE.placeholder,
      },
      {
        q: "Can I volunteer abroad?",
        a: SITE.placeholder,
      },
      {
        q: "Do you offer internships?",
        a: SITE.placeholder,
      },
      {
        q: "Is there a minimum age?",
        a: SITE.placeholder,
      },
      {
        q: "Who can volunteer?",
        a: "We welcome volunteers from all backgrounds, ages, and skill levels who are passionate about making a difference.",
      },
    ],
  },

  newsletter: {
    heading: "Stay tuned",
    body: "Volunteer opportunities and news from the field, straight to your inbox.",
    pending: SITE.newsletterPending,
    src: events,
    alt: "A group of young volunteers in matching shirts at an outdoor event",
  },
};

export const CONTACT = {
  details: {
    heading: "Contact Us",
    subheading: "We're Here to Help",
    body: "Connect with our team for support, guidance, or answers to your questions. We proudly serve our community with care, compassion, and integrity.",
    tiles: [
      {
        icon: "mail",
        title: "Contact information",
        lines: [{ text: SITE.contactPlaceholder }],
      },
    ],
  },

  links: {
    heading: "Where next",
    items: [
      { title: "Get Involved", body: "Your chance to make a difference", to: "/get-involved", src: fundraise, alt: "Volunteers packing food donations" },
      { title: "About Us", body: "Learn more about our mission, values, and impact", to: "/about", src: about, alt: "A volunteer handing over a food aid box" },
      { title: "Careers", body: `Work with ${BRAND.name}`, to: "/about-us/careers", src: events, alt: "Young volunteers at an outdoor event" },
      { title: "Giving", body: "Ways to give", to: "/giving", src: foodParcels, alt: "Boxes marked AID in a van" },
      { title: "Reports", body: SITE.placeholder, to: "/about/transparency", src: classroom, alt: "Children at their desks in a tented classroom" },
    ],
  },

  newsletter: {
    heading: "Stay in touch",
    body: "News from the field and updates on our work, straight to your inbox.",
    pending: SITE.newsletterPending,
    src: volunteers,
    alt: "Volunteers in matching shirts handing out aid boxes",
  },
};
