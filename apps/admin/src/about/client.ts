import type { About, AboutSection } from "@rbb/content-schema";
import { api } from "../api";
import { pageAct, pageSchedule, pageUnschedule } from "../content/client";
import type { BlockPageView } from "../blocks/BlockPageEditor";

/* The About page API — one per organization (GET, POST create, PATCH
   { revision, changes }, DELETE archives). Shapes are the content
   contract's (type-only import); the API validates every write. */

export type { About, AboutSection };
export type AboutBlockType = AboutSection["type"];
export type AboutBlockData<T extends AboutBlockType> = Extract<AboutSection, { type: T }>["data"];

type Changes = { sections?: AboutSection[]; status?: About["status"]; seo?: About["seo"] | null };

export const aboutApi = {
  get: () => api<BlockPageView<AboutSection>>("/api/v1/about"),
  create: (draft: { sections: AboutSection[]; status: About["status"]; seo?: About["seo"] }) => api<BlockPageView<AboutSection>>("/api/v1/about", { method: "POST", body: JSON.stringify(draft) }),
  update: (revision: number, changes: Changes) => api<BlockPageView<AboutSection>>("/api/v1/about", { method: "PATCH", body: JSON.stringify({ revision, changes }) }),
  archive: () => api<BlockPageView<AboutSection>>("/api/v1/about", { method: "DELETE" }),
  act: pageAct<BlockPageView<AboutSection>>("about"),
  schedule: pageSchedule<BlockPageView<AboutSection>>("about"),
  unschedule: pageUnschedule<BlockPageView<AboutSection>>("about"),
};
