/* Copy for /about-us.

   The project highlights are PLACEHOLDERS in RBB's voice, modelled on the
   field-update format the reference uses: country, project, one line of
   what happened, and when. Replace them with real field reports before
   this ships — a highlight reel of work that did not happen is worse than
   no reel. Photography is the same free-license stock used elsewhere. */

import { NGO } from "./ngo.js";

import volunteers from "../assets/ngo-volunteers.jpg";
import waterPump from "../assets/ngo-water-pump.jpg";
import kitchen from "../assets/ngo-kitchen.jpg";
import foodParcels from "../assets/ngo-food-parcels.jpg";
import classroom from "../assets/ngo-classroom.jpg";
import tentGirl from "../assets/ngo-tent-girl.jpg";
import medical from "../assets/zakat-medical.jpg";
import waterChild from "../assets/ngo-water-child.jpg";

const DONATE = { label: "Donate Now", to: "/donate" };

export const ABOUT = {
  hero: {
    heading: "About Us",
    body: "Aid that reaches people, and a record of how it got there.",
    src: volunteers,
    alt: "Volunteers in matching shirts handing out aid boxes",
  },

  /* The same "who we are" block the homepage closes with — one statement
     of the organisation, not two that can drift apart. */
  intro: NGO.about,

  highlights: {
    heading: "Our Work on the Ground: Recent Project Highlights",
    items: [
      {
        place: "Pakistan",
        title: "Thar Village Water Project",
        body: "A new hand pump bringing clean water to a whole village for the first time.",
        date: "Aug 27",
        src: waterPump,
        alt: "A child working a hand pump to fill a bucket with water",
        donate: DONATE,
        more: { label: "Learn More", to: "/giving/build-a-well" },
      },
      {
        place: "Gaza",
        title: "Hot Meals Kitchen",
        body: "15,000 hot meals cooked and served every day.",
        date: "Aug 18",
        src: kitchen,
        alt: "Volunteers ladling food from a large steaming pot at a community kitchen",
        donate: DONATE,
        more: { label: "Learn More", to: "/giving/emergencies/gaza-emergency" },
      },
      {
        place: "Sudan",
        title: "Emergency Food Parcels",
        body: "A month of staple food for displaced families arriving in the camps.",
        date: "Aug 18",
        src: foodParcels,
        alt: "Boxes marked AID stacked in a van",
        donate: DONATE,
        more: { label: "Learn More", to: "/giving/emergencies/sudan-emergency-appeal" },
      },
      {
        place: "Bangladesh",
        title: "Back-to-School Classrooms",
        body: "Tented classrooms, desks and a year of supplies so children can return to lessons.",
        date: "Aug 1–31",
        src: classroom,
        alt: "Children at their desks in a tented classroom",
        donate: DONATE,
        more: { label: "Learn More", to: "/stories" },
      },
      {
        place: "Yemen",
        title: "Winter Shelter Kits",
        body: "Insulated tents, blankets and stoves for families facing their first winter displaced.",
        date: "Jul 22",
        src: tentGirl,
        alt: "A girl beside a tent in a camp",
        donate: DONATE,
        more: { label: "Learn More", to: "/giving/emergencies/yemen-emergency-appeal" },
      },
      {
        place: "Sudan",
        title: "Mobile Medical Camps",
        body: "Doctors and medicine reaching villages hours from the nearest clinic.",
        date: "Jul 9",
        src: medical,
        alt: "A doctor examining a child",
        donate: DONATE,
        more: { label: "Learn More", to: "/giving/medical-camps" },
      },
      {
        place: "Kenya",
        title: "Borehole Restoration",
        body: "Three broken boreholes repaired and handed back to the communities that run them.",
        date: "Jun 30",
        src: waterChild,
        alt: "A girl drinking from an outdoor tap",
        donate: DONATE,
        more: { label: "Learn More", to: "/giving/give-the-gift-of-water" },
      },
    ],
  },
};
