import PageHeader from "../../components/PageHeader/PageHeader.jsx";
import BrandPanel from "../../components/BrandPanel/BrandPanel.jsx";
import Button from "../../components/Button/Button.jsx";
import StatementSplit from "../../components/StatementSplit/StatementSplit.jsx";
import MissionVision from "../../components/MissionVision/MissionVision.jsx";
import ValuesList from "../../components/ValuesList/ValuesList.jsx";
import ApproachFlow from "../../components/ApproachFlow/ApproachFlow.jsx";
import TransparencySection from "../../components/TransparencySection/TransparencySection.jsx";
import ClosingCta from "../../components/ClosingCta/ClosingCta.jsx";
import { resolveTones } from "../../lib/bandTones.js";
import { ABOUT } from "../../content/index.js";

/* The About page as the CMS published it: its chapters, in the editor's
   order, each drawn by the component pages/About already uses for it —
   same typography, colour, spacing and motion.

   RENDERERS is the explicit, allowlisted type → component table; a block
   type not in it stops the build. Each chapter keeps its address
   (#who-we-are, #mission-vision, #values, #how-we-work, #transparency —
   the old About pages forward to them), whatever the block's own id.
   Numbering counts the chapters (not the introduction, not the closing
   ask); colour follows lib/bandTones. */

const TONES = {
  pageHero: { start: "paper", end: "paper" },
  statement: ["white", "paper"],
  missionVision: ["paper", "white"],
  numberedCards: ["white", "paper"],
  approach: ["accent", "paper", "white"],
  transparency: { start: "ink", end: "white" },
  cta: ["accent", "paper"],
};
const UNNUMBERED = new Set(["pageHero", "cta"]);

const RENDERERS = {
  pageHero: ({ data }) => (
    <PageHeader title={data.title} crumb={data.crumb} aside={<BrandPanel />}>
      <p className="type-lead mt-7 max-w-[46ch] text-copy">{data.body}</p>
      {data.cta && (
        <Button size="lg" to={data.cta.to} className="mt-9">
          {data.cta.label}
        </Button>
      )}
    </PageHeader>
  ),
  statement: ({ index, tone, data }) => <StatementSplit id="who-we-are" index={index} tone={tone} kicker={data.kicker} heading={data.heading} body={data.body} highlight={data.highlight} cta={data.cta} />,
  missionVision: ({ index, tone, data }) => <MissionVision id="mission-vision" index={index} tone={tone} kicker={data.kicker} heading={data.heading} highlight={data.highlight} mission={data.mission} vision={data.vision} source={data.source} />,
  numberedCards: ({ index, tone, data }) => <ValuesList id="values" index={index} tone={tone} kicker={data.kicker} heading={data.heading} highlight={data.highlight} intro={data.intro} items={data.items} fallback={ABOUT.values.fallback} />,
  approach: ({ index, tone, data }) => <ApproachFlow id="how-we-work" index={index} tone={tone} kicker={data.kicker} heading={data.heading} highlight={data.highlight} intro={data.intro} cta={data.cta} steps={[]} />,
  transparency: ({ index }) => <TransparencySection index={index} />,
  cta: ({ tone, data }) => <ClosingCta tone={tone} heading={data.heading} highlight={data.highlight} body={data.body} ctas={data.ctas} image={data.image} />,
};

export default function CmsAbout({ page }) {
  const blocks = page.sections;
  const tones = resolveTones(blocks.map((b) => b.type), TONES);
  let n = 0;
  return (
    <>
      {blocks.map((block, i) => {
        const Renderer = RENDERERS[block.type];
        if (!Renderer) throw new Error(`About: no renderer for a "${block.type}" block`);
        const index = UNNUMBERED.has(block.type) ? undefined : ++n;
        return <Renderer key={block.id} index={index} tone={tones[i]} data={block.data} />;
      })}
    </>
  );
}
