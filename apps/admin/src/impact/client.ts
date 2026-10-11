import type { Impact, ImpactSection } from "@rbb/content-schema";
import { api } from "../api";
import { pageAct, pageSchedule, pageUnschedule } from "../content/client";
import type { BlockPageView } from "../blocks/BlockPageEditor";

/* The Impact page API — one per organization (GET, POST create, PATCH
   { revision, changes }, DELETE archives), as the About page's. Shapes
   are the content contract's (type-only import); the API validates every
   write. */

export type { Impact, ImpactSection };
export type ImpactBlockType = ImpactSection["type"];
export type ImpactBlockData<T extends ImpactBlockType> = Extract<ImpactSection, { type: T }>["data"];

type Changes = { sections?: ImpactSection[]; status?: Impact["status"]; seo?: Impact["seo"] | null };

export const impactApi = {
  get: () => api<BlockPageView<ImpactSection>>("/api/v1/impact"),
  create: (draft: { sections: ImpactSection[]; status: Impact["status"]; seo?: Impact["seo"] }) => api<BlockPageView<ImpactSection>>("/api/v1/impact", { method: "POST", body: JSON.stringify(draft) }),
  update: (revision: number, changes: Changes) => api<BlockPageView<ImpactSection>>("/api/v1/impact", { method: "PATCH", body: JSON.stringify({ revision, changes }) }),
  archive: () => api<BlockPageView<ImpactSection>>("/api/v1/impact", { method: "DELETE" }),
  act: pageAct<BlockPageView<ImpactSection>>("impact"),
  schedule: pageSchedule<BlockPageView<ImpactSection>>("impact"),
  unschedule: pageUnschedule<BlockPageView<ImpactSection>>("impact"),
};
