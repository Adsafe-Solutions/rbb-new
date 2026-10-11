import { BlockPageEditor, type BlockPageConfig } from "../../blocks/BlockPageEditor";
import { ChartBar } from "../../design-system";
import { IMPACT_BLOCK_INFO, ImpactBlockEditor, impactSummary, newImpactBlockData } from "../../impact/BlockEditor";
import { impactApi, type ImpactBlockType, type ImpactSection } from "../../impact/client";

/* /impact — the website's Impact page as an ordered list of its chapters
   (the contract's Impact registry), in the shared block-page editor
   (blocks/). Its figures are the Impact figures (/impact/figures). Until
   an Impact page is PUBLISHED here and an owner publishes the website,
   the website keeps its own Impact page. */

const CONFIG: BlockPageConfig<ImpactSection> = {
  title: "Impact page",
  noun: "Impact page",
  icon: ChartBar,
  description: "The Impact page's chapters, in order. Its figures are the Impact figures. Until an Impact page is published here, the website shows its own.",
  addDescription: "The chapters the Impact page can show — each once. New sections go at the end; the introduction always goes first.",
  api: impactApi as BlockPageConfig<ImpactSection>["api"],
  blocks: IMPACT_BLOCK_INFO,
  newBlockData: (type) => newImpactBlockData(type as ImpactBlockType),
  summary: impactSummary,
  editor: (props) => <ImpactBlockEditor {...props} />,
  preview: {
    unnumbered: new Set(["intro", "cta"]),
    imagesOf: (block) => {
      const d = block.data as { imageId?: string };
      return d.imageId ? [d.imageId] : [];
    },
    headingOf: (block) => {
      const s = block as ImpactSection;
      return s.type === "intro" ? s.data.title : s.type === "teasers" ? s.data.items.map((t) => t.heading).join(" · ") : undefined;
    },
    countOf: (block) => {
      const s = block as ImpactSection;
      return s.type === "stats" ? s.data.metricIds.length : s.type === "stories" ? s.data.storyIds.length : undefined;
    },
  },
};

export default function ImpactPage() {
  return <BlockPageEditor config={CONFIG} />;
}
