/* Copy for the inner pages: /get-involved/volunteer, /blogs, /contact-us.

   Reproduced from muslimhands.ca (fetched 2026-09-15), organisation name
   via BRAND.name. Where the source only came through in summary the copy
   is a close paraphrase, marked (paraphrased). Contact details are
   theirs and are PLACEHOLDERS here: replace the phone, address and
   mailboxes with RBB's own before this ships. Photography is
   free-license Pexels stock, credited beside each import. */

import { BRAND } from "./brand.js";

import volunteerHero from "../assets/volunteer-hero.jpg"; /* Shvetsa, 5029855 */
import azipha from "../assets/vol-azipha.jpg"; /* SilverKBlack, 36763549 */
import esrea from "../assets/vol-esrea.jpg"; /* Kampus, 7895774 */
import zainab from "../assets/vol-zainab.jpg"; /* Theo Decker, 5955102 */
import ammar from "../assets/vol-ammar.jpg"; /* Henly Nndsouz, 5715795 */
import blogEthiopia from "../assets/blog-ethiopia.jpg"; /* Abiy Fikru, 27534668 */
import blogWomen from "../assets/blog-women.jpg"; /* Chris Wade Ntezicimpa, 30095131 */
import blogChildLabour from "../assets/blog-child-labour.jpg"; /* Audy Of Course, 18807697 */
import classroom from "../assets/ngo-classroom.jpg";
import sudan from "../assets/ngo-sudan.jpg";
import orphan from "../assets/zakat-orphan.jpg";
import zakatHero from "../assets/zakat-hero.jpg";
import volunteers from "../assets/ngo-volunteers.jpg";
import events from "../assets/ngo-events.jpg";
import about from "../assets/ngo-about.jpg";
import fundraise from "../assets/ngo-fundraise.jpg";
import foodParcels from "../assets/ngo-food-parcels.jpg";

const EMAIL = "mail@muslimhands.ca";
const PHONE = "+1 (289) 722-7272";
const PHONE_HREF = "tel:+12897227272";
const ADDRESS = ["Skyward Business Centre", "2255 Dundas Street West, Unit #405", "Mississauga, ON", "L5K 1R6"];

/* The same details the footer shows on every page. One copy, so the
   placeholder swap before launch is one edit, not a hunt. */
export const CONTACT_INFO = { email: EMAIL, phone: PHONE, phoneHref: PHONE_HREF, address: ADDRESS };

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
      "Get involved by volunteering your time with food banks, community initiatives, events, outreach, and fundraising. We welcome people of all ages, backgrounds, and skill levels - there is a role for everyone! (paraphrased)",
    ],
  },

  signup: {
    heading: "Sign Up to Volunteer With Us",
    body: "Fill out our volunteer form below, and our team will get in touch with you!",
    consent: "Yes, I give permission to store and process my data",
    cta: "Submit",
  },

  steps: {
    heading: "What happens next?",
    items: [
      {
        title: "Register",
        body: "Once registered, a welcome pack including everything you need to get started will be sent your way.",
      },
      {
        title: "Choose an Opportunity",
        body: "Choose from one of our many volunteering opportunities in communications, fundraising or administration.",
      },
      {
        title: "Support",
        body: "We will support you every step of the way. And you can be sure that whatever role you chose, you will be making a huge contribution.",
      },
    ],
  },

  feedback: {
    heading: "Volunteer Feedback",
    items: [
      {
        name: "Azipha",
        quote: `Volunteering with ${BRAND.name} has transformed my life. After witnessing poverty firsthand in Mali, I returned determined to make a difference.`,
        src: azipha,
      },
      {
        name: "Esrea",
        quote: `Being part of ${BRAND.name}'s local volunteer team has been an incredibly rewarding experience. From organizing community events to distributing food parcels, every day brings a new way to help.`,
        src: esrea,
      },
      {
        name: "Zainab",
        quote: `One of the greatest things I've learned through volunteering with ${BRAND.name} is the strength of community. When people come together with a shared purpose, anything is possible.`,
        src: zainab,
      },
      {
        name: "Ammar",
        quote: "The ability to give is itself a blessing from Allah, reminding us that what we possess is a trust meant to uplift those in need.",
        src: ammar,
      },
    ],
  },

  faq: {
    heading: "Volunteer FAQs",
    items: [
      {
        q: "How do I apply?",
        a: `Sign up using the volunteer form above, email ${EMAIL}, or call ${PHONE} (9 AM–5 PM EST, Monday to Friday). (paraphrased)`,
      },
      {
        q: "How long does it take to start volunteering?",
        a: "Applications typically take 2–3 business days to review and approve. (paraphrased)",
      },
      {
        q: "Can I volunteer abroad?",
        a: "Yes — international opportunities are available. See our Volunteer Abroad page for what is open now. (paraphrased)",
      },
      {
        q: "Do you offer internships?",
        a: "Yes. Current openings are listed on our Careers page. (paraphrased)",
      },
      {
        q: "Is there a minimum age?",
        a: "Age requirements vary by role. Younger volunteers may take part with parental consent. (paraphrased)",
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
    consent: "Yes, I give permission to store and process my data",
    src: events,
    alt: "A group of young volunteers in matching shirts at an outdoor event",
  },
};

export const BLOGS = {
  heading: "Blogs",
  searchPlaceholder: "Search",
  items: [
    {
      slug: "10-famous-quotes-for-international-day-of-education",
      title: "10 Famous Quotes for International Day of Education",
      excerpt: "Discover 10 famous education quotes for International Day of Education that inspire learning, knowledge, and positive change worldwide.",
      src: classroom,
      alt: "Children at desks in a tented classroom",
    },
    {
      slug: "2026-the-ongoing-humanitarian-crises-in-gaza-and-yemen",
      title: "2026: The Ongoing Humanitarian Crises in Gaza and Yemen",
      excerpt: `An update on the ongoing humanitarian crises in Gaza and Yemen, and how ${BRAND.name} is delivering life-saving aid and support.`,
      src: sudan,
      alt: "A woman and children walk past tents in a camp",
    },
    {
      slug: "a-future-without-child-labour",
      title: "A Future Without Child Labour",
      excerpt: "Learn how ending child labour through education, protection, and support can empower children and break the cycle of poverty.",
      src: blogChildLabour,
      alt: "A child carrying a stack of bricks across a dry field",
    },
    {
      slug: "children-and-islam",
      title: "Children and Islam",
      excerpt: "Learn how Islam values children, emphasizing love, compassion, education, and moral upbringing.",
      src: orphan,
      alt: "A smiling child outdoors",
    },
    {
      slug: "ethiopia-7-beautiful-links-to-the-messenger-of-allah-swt",
      title: "Ethiopia: Seven Places Our Teams Reached This Year",
      excerpt: "From the highlands to the border camps, a field report on where aid arrived in Ethiopia this year, what it bought, and who it reached.",
      src: blogEthiopia,
      alt: "Misty green hills in the Ethiopian highlands",
    },
    {
      slug: "what-a-distribution-day-actually-looks-like",
      title: "What a Distribution Day Actually Looks Like",
      excerpt: "Six in the morning to last light: a walk through one day at a distribution point, from the truck manifest to the last family in the queue.",
      src: volunteers,
      alt: "Volunteers sorting boxes of supplies at a distribution point",
    },
    {
      slug: "why-people-give-the-international-day-of-charity",
      title: "Why People Give: The International Day of Charity",
      excerpt: "Duty, faith, gratitude, a news report that would not leave them alone — our donors give for very different reasons. We asked them.",
      src: zakatHero,
      alt: "Two people passing a donation box between them",
    },
    {
      slug: "her-roots-her-revolution-honoring-african-women-and-girls",
      title: "Her Roots, Her Revolution: Honoring African Women and Girls",
      excerpt: "Empowerment, heritage, and leadership - explore how African women and girls are shaping their futures.",
      src: blogWomen,
      alt: "Four women in colourful traditional dresses embracing outdoors",
    },
    {
      slug: "honouring-humanitarians",
      title: "Honouring Humanitarians",
      excerpt: "Celebrate individuals making a difference in humanitarian work and inspiring, compassionate action worldwide.",
      src: volunteers,
      alt: "Volunteers in matching shirts handing out aid boxes",
    },
  ],
};

export const CONTACT = {
  details: {
    heading: "Contact Us",
    subheading: "We're Here to Help",
    body: "Connect with our team for support, guidance, or answers to your questions. We proudly serve our community with care, compassion, and integrity.",
    tiles: [
      {
        icon: "phone",
        title: "Phone",
        lines: [{ label: "General Hotline", text: PHONE, href: PHONE_HREF }],
      },
      {
        icon: "pin",
        title: "Address",
        lines: ADDRESS.map((text) => ({ text })),
      },
      {
        icon: "mail",
        title: "Email",
        lines: [
          { label: "General Inquiries", text: EMAIL, href: `mailto:${EMAIL}` },
          { label: "Major Giving", text: "majorgiving@muslimhands.ca", href: "mailto:majorgiving@muslimhands.ca" },
          { label: "Donations", text: "donation@muslimhands.ca", href: "mailto:donation@muslimhands.ca" },
        ],
      },
      {
        icon: "clock",
        title: "Hours of Operation",
        lines: [
          { label: "Mon–Fri", text: "9am to 5pm" },
          { label: "Sat–Sun", text: "Closed" },
        ],
      },
    ],
  },

  links: {
    heading: "Where next",
    items: [
      { title: "Get Involved", body: "Your chance to make a difference", to: "/get-involved", src: fundraise, alt: "Volunteers packing food donations" },
      { title: "About Us", body: "Learn more about our mission, values, and impact", to: "/about-us", src: about, alt: "A volunteer handing over a food aid box" },
      { title: "Careers", body: `Work with ${BRAND.name}`, to: "/about-us/careers", src: events, alt: "Young volunteers at an outdoor event" },
      { title: "Giving", body: "Support our emergency appeals and long-term humanitarian initiatives", to: "/giving", src: foodParcels, alt: "Boxes marked AID in a van" },
      { title: "Reports", body: "Annual reports and field updates — exactly where your giving went", to: "/reports", src: classroom, alt: "Children at their desks in a tented classroom" },
    ],
  },

  newsletter: {
    heading: "Stay in touch",
    body: "News from the field and updates on our work, straight to your inbox.",
    consent: "Yes, I give permission to store and process my data",
    src: volunteers,
    alt: "Volunteers in matching shirts handing out aid boxes",
  },
};
