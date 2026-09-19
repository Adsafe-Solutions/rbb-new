import PageHero from "../../components/PageHero/PageHero.jsx";
import FeatureGrid from "../../components/FeatureGrid/FeatureGrid.jsx";
import ProjectGrid from "../../components/ProjectGrid/ProjectGrid.jsx";
import Newsletter from "../../components/Newsletter/Newsletter.jsx";
import useReveal from "../../hooks/useReveal.js";
import { GIVING } from "../../content/index.js";

/* /giving — the Ways to Give hub:

     mist band    PageHero       heading, line, donate CTA
     mist band    FeatureGrid    four promises that hold for every donor
     white        ProjectGrid    the six routes in, Zakat among them
     white        Newsletter     stay informed

   This route used to render the Zakat page. It does not any more, and the
   reason is not cosmetic: a donor arriving from the main nav was landing on
   Nisab thresholds and scholar verification, which tells anyone who does
   not give Zakat that the charity is not addressed to them. Zakat kept
   everything — page, calculator, FAQs — one level down at /giving/zakat,
   where it is one route among six rather than the front door. */
export default function Giving() {
  useReveal();

  return (
    <>
      <PageHero {...GIVING.hero} />
      <FeatureGrid {...GIVING.trust} />
      <ProjectGrid {...GIVING.routes} />
      <Newsletter {...GIVING.newsletter} />
    </>
  );
}
