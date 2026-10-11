import { HOMEPAGE_BLOCKS, type HomepageBlockInfo } from "@rbb/content-schema/homepage-registry";
import type { BlockType, HomepageSection } from "./client";

/* What the editor knows about each block type beyond the contract's
   registry (names, rules): a new block's starting data, and a one-line
   summary for the section list. The registry itself is the contract's. */

export const BLOCKS = HOMEPAGE_BLOCKS;
export const blockInfo = (type: BlockType): HomepageBlockInfo => BLOCKS.find((b) => b.type === type)!;

const link = () => ({ label: "", href: "" });

/* Starting data: the fields an editor fills in. Saving checks them all. */
export function newBlockData(type: BlockType): HomepageSection["data"] {
  switch (type) {
    case "hero":
      return { slides: [{ id: "slide-1", headline: [""], cta: link(), imageId: "", insetId: "" }], secondaryCta: link(), intervalMs: 7000 };
    case "imageText":
      return { heading: "", body: [""], imageId: "" };
    case "stats":
      return { heading: "", metricIds: [] as unknown as [string] };
    case "timeline":
      return { heading: "", items: [] };
    case "stories":
      return { heading: "", count: 3 };
    case "video":
      return { heading: "", youtubeId: "", title: "", posterId: "" };
    case "getInvolved":
      return { heading: "", imageIds: {} };
    case "faq":
      return { heading: "", items: [{ question: "", answer: "" }] };
    case "cta":
      return { heading: "", primary: link() };
    case "postList":
      return { heading: "", postIds: [] as unknown as [string] };
    case "eventList":
      return { heading: "", eventIds: [] as unknown as [string] };
    default:
      return { heading: "" };
  }
}

/* One line for the section list. */
export function blockSummary(section: HomepageSection): string {
  const d = section.data as Record<string, unknown>;
  if (section.type === "hero") return `${section.data.slides.length} slide${section.data.slides.length === 1 ? "" : "s"} · ${section.data.slides[0]?.headline.filter(Boolean).join(" ") || "No headline yet"}`;
  return (typeof d.heading === "string" && d.heading) || "No heading yet";
}
