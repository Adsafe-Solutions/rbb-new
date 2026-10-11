import type { Homepage, HomepageSection } from "@rbb/content-schema";
import { api } from "../api";
import { pageAct, pageSchedule, pageUnschedule, type ScheduleView } from "../content/client";

/* The homepage API — one per organization (GET, POST create, PATCH
   { revision, changes }, DELETE archives). Shapes are the content
   contract's (type-only import); the API validates every write. */

export type { Homepage, HomepageSection };
export type BlockType = HomepageSection["type"];
export type BlockData<T extends BlockType> = Extract<HomepageSection, { type: T }>["data"];

export interface HomepageView {
  record: Homepage | null;
  revision: number;
  updatedAt: string | null;
  updatedBy: { name: string; isYou: boolean } | null;
  /* M14: a version of it is on the website. */
  live: boolean;
  /* M15: when the approved revision joins a website publication. */
  schedule: ScheduleView | null;
}

export interface HomepageDraft {
  sections: HomepageSection[];
  seo?: Homepage["seo"];
  status: Homepage["status"];
}

export const homepageApi = {
  get: () => api<HomepageView>("/api/v1/homepage"),
  create: (draft: HomepageDraft) => api<HomepageView>("/api/v1/homepage", { method: "POST", body: JSON.stringify(draft) }),
  update: (revision: number, changes: Partial<Omit<HomepageDraft, "seo">> & { seo?: Homepage["seo"] | null }) =>
    api<HomepageView>("/api/v1/homepage", { method: "PATCH", body: JSON.stringify({ revision, changes }) }),
  archive: () => api<HomepageView>("/api/v1/homepage", { method: "DELETE" }),
  act: pageAct<HomepageView>("homepage"),
  schedule: pageSchedule<HomepageView>("homepage"),
  unschedule: pageUnschedule<HomepageView>("homepage"),
};
