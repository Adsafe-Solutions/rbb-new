import PageHero from "../../components/PageHero/PageHero.jsx";
import Newsletter from "../../components/Newsletter/Newsletter.jsx";
import useReveal from "../../hooks/useReveal.js";
import { ZAKAT } from "../../content/index.js";

/* /giving/zakat — a placeholder until RBB supplies and reviews its own
   Zakat information (see content/zakat.js):

     mist band    PageHero     heading and the placeholder line
     white        Newsletter   stay informed

   The sections it used to stack — promises, eligible projects, the Nisab
   callout, impact tabs, FAQs — held another charity's content. Their
   components (FeatureGrid, ProjectGrid, NisabCallout, GetInvolved, Faq)
   are all still in the codebase for the redesign. */
export default function Zakat() {
  useReveal();

  return (
    <>
      <PageHero {...ZAKAT.hero} />
      <Newsletter {...ZAKAT.newsletter} />
    </>
  );
}
