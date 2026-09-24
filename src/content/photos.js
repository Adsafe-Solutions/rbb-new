/* The site's photographs — ONE source (Document 27). Every image a page
   shows, whether it is RBB's own or a temporary working photograph, is a
   normal file in src/assets/ imported here once, so an image and its alt
   text are written in a single place and every section that shows it
   reads the same record.

   RBB_PHOTOS — RBB's own branded field photographs (compressed from the
   supplied PNGs). They read as illustrative rather than documentary; RBB
   should confirm they are approved for use as photographs of its work.
   The alt text describes what is in the frame and nothing more: no
   place, no date, no programme, because none was supplied
   (docs/IMAGE_INVENTORY.md).

   WORKING_PHOTOS, TEAM_PORTRAITS — temporary photographs (Pexels licence)
   used while RBB's own photography and team photos are not yet supplied,
   so every section has something to show rather than an empty box. None
   of them is RBB's own work, people or places; alt text describes only
   what is in the frame. Source, photographer and licence for each are in
   docs/IMAGE_INVENTORY.md. Replace with RBB-approved photography before
   launch (Document 27 §16: final content replacement). */
import fieldKids from "../assets/rbb-field-kids.jpg";
import fieldDistribution from "../assets/rbb-field-distribution.jpg";
import fieldElder from "../assets/rbb-field-elder.jpg";

export const RBB_PHOTOS = {
  kids: {
    src: fieldKids,
    alt: "A volunteer in a Rising Beyond Borders vest hands a wrapped package to a smiling girl, with other children gathered around",
    focal: "72% 45%",
  },
  distribution: {
    src: fieldDistribution,
    alt: "Volunteers in Rising Beyond Borders vests unloading a truck and packing boxes alongside families",
    focal: "45% 50%",
  },
  elder: {
    src: fieldElder,
    alt: "A volunteer in a Rising Beyond Borders vest hands a package to a smiling older woman",
    focal: "60% 45%",
  },
};

import ruralClassroomSrc from "../assets/demo-edu-rural-classroom.jpg";
import teacherClassroomSrc from "../assets/demo-edu-teacher-classroom.jpg";
import girlReadingSrc from "../assets/demo-edu-girl-reading.jpg";
import readingCircleSrc from "../assets/demo-edu-reading-circle.jpg";
import checkupSrc from "../assets/demo-health-checkup.jpg";
import healthTeamSrc from "../assets/demo-health-team.jpg";
import waterPumpSrc from "../assets/demo-health-water-pump.jpg";
import drinkingWaterSrc from "../assets/demo-health-drinking-water.jpg";
import vegetableSellerSrc from "../assets/demo-live-vegetable-seller.jpg";
import marketSrc from "../assets/demo-live-market.jpg";
import sewingSrc from "../assets/demo-live-sewing.jpg";
import harvestSrc from "../assets/demo-live-harvest.jpg";
import gatheringSrc from "../assets/demo-comm-gathering.jpg";
import aidBoxesSrc from "../assets/demo-comm-aid-boxes.jpg";
import packingSrc from "../assets/demo-comm-packing.jpg";
import foodPrepSrc from "../assets/demo-comm-food-prep.jpg";
import reliefPackingSrc from "../assets/demo-comm-relief-packing.jpg";
import teamPortrait1 from "../assets/demo-team-1.jpg";
import teamPortrait2 from "../assets/demo-team-2.jpg";
import teamPortrait3 from "../assets/demo-team-3.jpg";
import teamPortrait4 from "../assets/demo-team-4.jpg";
import teamPortrait5 from "../assets/demo-team-5.jpg";
import teamPortrait6 from "../assets/demo-team-6.jpg";

/* One photograph, as content records carry images: { src, alt, focal? }. */
const photo = (src, alt, focal) => ({ src, alt, ...(focal && { focal }) });

export const WORKING_PHOTOS = {
  ruralClassroom: photo(ruralClassroomSrc, "Children sitting on the floor of a classroom, writing in notebooks", "50% 40%"),
  teacherClassroom: photo(teacherClassroomSrc, "A teacher at the front of a classroom leading a lesson with students at their desks"),
  girlReading: photo(girlReadingSrc, "A young girl standing among trees, smiling as she reads a picture book", "50% 35%"),
  readingCircle: photo(readingCircleSrc, "A woman reading a book aloud to a small group of young children seated around her"),
  checkup: photo(checkupSrc, "A doctor in a white coat listening to a patient's breathing with a stethoscope"),
  healthTeam: photo(healthTeamSrc, "Two health workers in scrubs and a white coat talking in a hospital corridor"),
  waterPump: photo(waterPumpSrc, "Children gathered around a hand pump, filling containers with water"),
  drinkingWater: photo(drinkingWaterSrc, "A child bending to drink water flowing from a hand pump", "50% 45%"),
  vegetableSeller: photo(vegetableSellerSrc, "A woman seated at a street stall selling vegetables and marigold flowers", "40% 40%"),
  market: photo(marketSrc, "A woman arranging tomatoes and vegetables on her market stall", "50% 35%"),
  sewing: photo(sewingSrc, "A person in a red top guiding fabric through a sewing machine"),
  harvest: photo(harvestSrc, "Farmers in straw hats loading harvested crops onto a trailer in a field"),
  gathering: photo(gatheringSrc, "A large group of people sitting and standing together on the grass at an outdoor gathering"),
  aidBoxes: photo(aidBoxesSrc, "Two volunteers carrying cardboard boxes marked aid and food"),
  packing: photo(packingSrc, "Volunteers in gloves packing donation boxes at a table"),
  foodPrep: photo(foodPrepSrc, "Volunteers in masks sorting food into containers on a long table"),
  reliefPacking: photo(reliefPackingSrc, "Two volunteers packing supplies into cardboard boxes"),
};

/* Team portraits: stock photographs standing in for people who do not
   exist at this organisation. Each alt says so, so no reader mistakes
   them for RBB staff. */
export const TEAM_PORTRAITS = [teamPortrait1, teamPortrait2, teamPortrait3, teamPortrait4, teamPortrait5, teamPortrait6];
export const TEAM_PORTRAIT_ALT = "Stock portrait used as a placeholder — not a member of Rising Beyond Borders";

export default RBB_PHOTOS;
