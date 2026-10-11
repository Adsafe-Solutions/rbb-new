import { BlockPageEditor, type BlockPageConfig } from "../../blocks/BlockPageEditor";
import { House } from "../../design-system";
import { BlockEditor } from "../../homepage/BlockEditor";
import { BLOCKS, blockSummary, newBlockData } from "../../homepage/blocks";
import { homepageApi, type BlockType, type HomepageSection } from "../../homepage/client";

/* /homepage — the homepage as an ordered list of blocks (the contract's
   homepage registry), in the shared block-page editor (blocks/). Until a
   homepage is PUBLISHED here and an owner publishes the website, the
   website keeps its own homepage. */

const CONFIG: BlockPageConfig<HomepageSection> = {
  title: "Homepage",
  noun: "homepage",
  icon: House,
  description: "The homepage's blocks, in order. Until a homepage is published here, the website shows its own.",
  addDescription: "Blocks the homepage can show. New sections go at the end; the hero slideshow always goes first.",
  api: homepageApi as BlockPageConfig<HomepageSection>["api"],
  blocks: BLOCKS,
  newBlockData: (type) => newBlockData(type as BlockType),
  summary: blockSummary,
  editor: (props) => <BlockEditor {...props} />,
  preview: {
    unnumbered: new Set(["hero", "cta"]),
    imagesOf: (block) => {
      const s = block as HomepageSection;
      if (s.type === "hero") return s.data.slides.flatMap((x) => [x.imageId, x.insetId]);
      if (s.type === "timeline") return s.data.items.map((i) => i.posterId);
      if (s.type === "video") return [s.data.posterId];
      const d = s.data as Record<string, unknown>;
      return typeof d.imageId === "string" ? [d.imageId] : [];
    },
    headingOf: (block) => {
      const s = block as HomepageSection;
      return s.type === "hero" ? s.data.slides[0]?.headline.join(" ") : undefined;
    },
    countOf: (block) => {
      const s = block as HomepageSection;
      return s.type === "postList" ? s.data.postIds.length : s.type === "eventList" ? s.data.eventIds.length : s.type === "appealList" ? s.data.appealIds?.length : undefined;
    },
  },
};

export default function HomepagePage() {
  return <BlockPageEditor config={CONFIG} />;
}
