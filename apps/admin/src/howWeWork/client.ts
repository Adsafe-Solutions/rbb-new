import type { HowWeWork } from "@rbb/content-schema";
import { api } from "../api";
import { pageAct, pageSchedule, pageUnschedule, type ScheduleView } from "../content/client";

/* The How We Work page API (#7) — one per organization (GET, PATCH
   { revision, changes } creates it the first time, DELETE archives). Each
   change is a WHOLE part. Shapes are the content contract's (type-only
   import); the API validates every write. */

export type { HowWeWork };
export type HowWeWorkParts = Pick<HowWeWork, "kicker" | "heading" | "body" | "practices" | "rows">;

export interface HowWeWorkView {
  record: HowWeWork | null;
  revision: number;
  updatedAt: string | null;
  updatedBy: { name: string; isYou: boolean } | null;
  live: boolean;
  schedule: ScheduleView | null;
}

type Changes = { [K in keyof HowWeWorkParts]?: HowWeWorkParts[K] | null } & { status?: HowWeWork["status"] };

export const howWeWorkApi = {
  get: () => api<HowWeWorkView>("/api/v1/how-we-work"),
  update: (revision: number, changes: Changes) => api<HowWeWorkView>("/api/v1/how-we-work", { method: "PATCH", body: JSON.stringify({ revision, changes }) }),
  archive: () => api<HowWeWorkView>("/api/v1/how-we-work", { method: "DELETE" }),
  act: pageAct<HowWeWorkView>("how-we-work"),
  schedule: pageSchedule<HowWeWorkView>("how-we-work"),
  unschedule: pageUnschedule<HowWeWorkView>("how-we-work"),
};
