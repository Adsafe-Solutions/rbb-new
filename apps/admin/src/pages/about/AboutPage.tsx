import { BlockPageEditor, type BlockPageConfig } from "../../blocks/BlockPageEditor";
import { FileText } from "../../design-system";
import { ABOUT_BLOCK_INFO, AboutBlockEditor, aboutSummary, newAboutBlockData } from "../../about/BlockEditor";
import { aboutApi, type AboutBlockType, type AboutSection } from "../../about/client";

/* /about — the website's About page as an ordered list of its chapters
   (the contract's About registry), in the shared block-page editor
   (blocks/). Until an About page is PUBLISHED here and an owner publishes
   the website, the website keeps its own About page. */

const CONFIG: BlockPageConfig<AboutSection> = {
  title: "About page",
  noun: "About page",
  icon: FileText,
  description: "The About page's chapters, in order. Until an About page is published here, the website shows its own.",
  addDescription: "The chapters the About page can show — each once. New sections go at the end; the introduction always goes first.",
  api: aboutApi as BlockPageConfig<AboutSection>["api"],
  blocks: ABOUT_BLOCK_INFO,
  newBlockData: (type) => newAboutBlockData(type as AboutBlockType),
  summary: aboutSummary,
  editor: (props) => <AboutBlockEditor {...props} />,
  preview: {
    unnumbered: new Set(["pageHero", "cta"]),
    imagesOf: (block) => {
      const d = block.data as { imageId?: string };
      return d.imageId ? [d.imageId] : [];
    },
    headingOf: (block) => {
      const s = block as AboutSection;
      return s.type === "pageHero" ? s.data.title : s.type === "transparency" ? "Transparency and governance" : undefined;
    },
  },
};

export default function AboutPage() {
  return <BlockPageEditor config={CONFIG} />;
}
