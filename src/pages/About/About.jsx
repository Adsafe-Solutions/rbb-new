import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import BrandPanel from "../../components/BrandPanel/BrandPanel.jsx";
import Button from "../../components/Button/Button.jsx";
import StatementSplit from "../../components/StatementSplit/StatementSplit.jsx";
import MissionVision from "../../components/MissionVision/MissionVision.jsx";
import ValuesList from "../../components/ValuesList/ValuesList.jsx";
import ApproachFlow from "../../components/ApproachFlow/ApproachFlow.jsx";
import TeamGrid from "../../components/TeamGrid/TeamGrid.jsx";
import TrustPanel from "../../components/TrustPanel/TrustPanel.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import useReveal from "../../hooks/useReveal.js";
import { ABOUT, featuredMembers } from "../../content/index.js";

/* /about — Document 03, in its section order. The page reads: who we are
   → what we stand for → how we create change → who is behind it → how we
   are accountable → where to go next.

     01  mist band   PageHeader       breadcrumb, h1, positioning, brand panel
     02  white       StatementSplit   who we are, as an editorial opening
     03  white       MissionVision    two statements, two grounds
     04  mist band   ValuesList       values — placeholder until supplied
     05  white       ApproachFlow     how we work — heading, line, CTA only
     06  white       TeamGrid         the team — placeholder until supplied
     07  white       TrustPanel       → /about/transparency
     08  mist band   ClosingCta       onward to Work and Impact

   Sections 02, 03 and 04 carry ids that the About Us dropdown's "Who We
   Are", "Mission & Vision" and "Values" land on (see `section` in
   content/nav.js). Every string comes from content/about.js. */
export default function About() {
  useReveal();
  const { hero, whoWeAre, missionVision, values, approach, team, transparency, closingCta } =
    ABOUT;

  return (
    <>
      <PageHeader
        title={hero.heading}
        crumb={hero.crumb}
        kicker={hero.kicker}
        aside={<BrandPanel className="reveal" />}
      >
        <p className="mt-5 max-w-prose text-[length:var(--text-subheading)] leading-subheading tracking-subheading text-graphite">
          {hero.body}
        </p>
        <Button to={hero.cta.to} className="mt-8">
          {hero.cta.label}
        </Button>
      </PageHeader>

      <StatementSplit {...whoWeAre} />
      <MissionVision {...missionVision} />
      <ValuesList {...values} />
      <ApproachFlow {...approach} />
      {/* The approved, featured people from content/team.js. */}
      <TeamGrid {...team} members={featuredMembers()} />
      <TrustPanel {...transparency} />
      <ClosingCta {...closingCta} />
    </>
  );
}
