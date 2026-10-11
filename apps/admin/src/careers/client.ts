import type { Careers } from "@rbb/content-schema";
import { api } from "../api";
import { pageAct, pageSchedule, pageUnschedule, type ScheduleView } from "../content/client";

/* The Careers page API — one per organization (GET, POST create, PATCH
   { revision, changes }, DELETE archives). Each change is a WHOLE part
   (`why: null` leaves the section out). Shapes are the content contract's
   (type-only import); the API validates every write. */

export type { Careers };
export type CareersParts = Pick<Careers, "kicker" | "title" | "intro" | "why" | "opportunities" | "apply" | "closing" | "seo">;

export interface CareersView {
  record: Careers | null;
  revision: number;
  updatedAt: string | null;
  updatedBy: { name: string; isYou: boolean } | null;
  /* M14: a version of it is on the website. */
  live: boolean;
  /* M15: when the approved revision joins a website publication. */
  schedule: ScheduleView | null;
}

type Changes = { [K in keyof CareersParts]?: CareersParts[K] | null } & { status?: Careers["status"] };

export const careersApi = {
  get: () => api<CareersView>("/api/v1/careers"),
  update: (revision: number, changes: Changes) => api<CareersView>("/api/v1/careers", { method: "PATCH", body: JSON.stringify({ revision, changes }) }),
  archive: () => api<CareersView>("/api/v1/careers", { method: "DELETE" }),
  act: pageAct<CareersView>("careers"),
  schedule: pageSchedule<CareersView>("careers"),
  unschedule: pageUnschedule<CareersView>("careers"),
};
