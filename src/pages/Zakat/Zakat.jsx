import PageHero from "../../components/PageHero/PageHero.jsx";
import FeatureGrid from "../../components/FeatureGrid/FeatureGrid.jsx";
import ProjectGrid from "../../components/ProjectGrid/ProjectGrid.jsx";
import NisabCallout from "../../components/NisabCallout/NisabCallout.jsx";
import GetInvolved from "../../components/GetInvolved/GetInvolved.jsx";
import Faq from "../../components/Faq/Faq.jsx";
import Newsletter from "../../components/Newsletter/Newsletter.jsx";
import useReveal from "../../hooks/useReveal.js";
import { ZAKAT } from "../../content/index.js";

/* The Zakat page, served at /giving, in the order the reference stacks it:

     honey band   PageHero       heading, line, calculator CTA
     mist band    FeatureGrid    "with confidence" — four promises
     white        ProjectGrid    six Zakat-eligible projects
     honey card   NisabCallout   how to calculate, the two Nisab values
     ink card     GetInvolved    impact tabs — the same tabbed card
     mist band    Faq            the accordion
     white        Newsletter     stay informed */
export default function Zakat() {
  useReveal();

  return (
    <>
      <PageHero {...ZAKAT.hero} />
      <FeatureGrid {...ZAKAT.trust} />
      <ProjectGrid {...ZAKAT.projects} />
      <NisabCallout {...ZAKAT.calc} />
      <GetInvolved {...ZAKAT.impact} />
      <Faq {...ZAKAT.faq} />
      <Newsletter {...ZAKAT.newsletter} />
    </>
  );
}
