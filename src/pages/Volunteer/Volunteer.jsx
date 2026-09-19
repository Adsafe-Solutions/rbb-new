import BannerHero from "../../components/BannerHero/BannerHero.jsx";
import Prose from "../../components/Prose/Prose.jsx";
import SignupCard from "../../components/SignupCard/SignupCard.jsx";
import Steps from "../../components/Steps/Steps.jsx";
import Testimonials from "../../components/Testimonials/Testimonials.jsx";
import Faq from "../../components/Faq/Faq.jsx";
import Newsletter from "../../components/Newsletter/Newsletter.jsx";
import useReveal from "../../hooks/useReveal.js";
import { VOLUNTEER } from "../../content/index.js";

/* /get-involved/volunteer, in the order the reference stacks it. */
export default function Volunteer() {
  useReveal();

  return (
    <>
      <BannerHero {...VOLUNTEER.hero} />
      <Prose {...VOLUNTEER.purpose} />
      <SignupCard {...VOLUNTEER.signup} />
      <Steps {...VOLUNTEER.steps} />
      <Testimonials {...VOLUNTEER.feedback} />
      <Faq {...VOLUNTEER.faq} />
      <Newsletter {...VOLUNTEER.newsletter} />
    </>
  );
}
