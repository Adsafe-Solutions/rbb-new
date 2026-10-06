import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import BrandPanel from "../../components/BrandPanel/BrandPanel.jsx";
import Button from "../../components/Button/Button.jsx";
import StatementSplit from "../../components/StatementSplit/StatementSplit.jsx";
import MissionVision from "../../components/MissionVision/MissionVision.jsx";
import ValuesList from "../../components/ValuesList/ValuesList.jsx";
import ApproachFlow from "../../components/ApproachFlow/ApproachFlow.jsx";
import TransparencySection from "../../components/TransparencySection/TransparencySection.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import { ABOUT } from "../../content/index.js";

/* /about — THE About page. The About section is two pages: this one and
   Our Team (/about/team). Everything else that used to be its own page
   is a chapter here, and the old addresses forward to the chapter
   (`section` in content/nav.js): /about/who-we-are, /about/mission-vision,
   /about/values, /about/transparency.

   It reads as one numbered editorial story, not five pages stacked:

         paper   PageHeader         About Rising Beyond Borders
     01  white   StatementSplit     who we are            #who-we-are
     02  paper   MissionVision      two posters           #mission-vision
     03  white   ValuesList         numbered flyers       #values
     04  accent  ApproachFlow       how we work           #how-we-work
     05  ink     TransparencySection financials, reports,  #transparency
         white                      governance (#annual-reports,
                                    #financial-information, #governance)
         accent  ClosingCta         onward to Work and Impact

   The <h1> is the hero's own line, "About Rising Beyond Borders" — the
   page's subject now that "Who we are" is its first chapter rather than
   its title. Every string comes from content/about.js and
   content/transparency.js. */
export default function About() {
  const { hero, whoWeAre, missionVision, values, approach, closingCta } = ABOUT;

  return (
    <>
      <PageHeader title={hero.kicker} crumb={hero.crumb} aside={<BrandPanel />}>
        <p className="type-lead mt-7 max-w-[46ch] text-copy">{hero.body}</p>
        <Button size="lg" to={hero.cta.to} className="mt-9">
          {hero.cta.label}
        </Button>
      </PageHeader>

      <StatementSplit index={1} {...whoWeAre} highlight="solutions" />
      <MissionVision index={2} {...missionVision} />
      {/* White, not the list's default Deep Trust Blue: chapters 04 and 05
          are Sky Blue and Deep Trust Blue, and three saturated bands in a
          row would bury both. */}
      <ValuesList index={3} {...values} tone="white" />
      {/* No steps here. content/about.js carries Listen → Partner → Act →
          Sustain as demo steps, but its own note — and Documents 02/05 —
          say the framework must not appear as RBB's method until RBB
          approves it, and nothing records that approval. */}
      <ApproachFlow index={4} {...approach} steps={[]} />
      <TransparencySection index={5} />
      <ClosingCta {...closingCta} />
    </>
  );
}
