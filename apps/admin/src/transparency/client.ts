import type { Transparency } from "@rbb/content-schema";
import { api } from "../api";
import { pageAct, pageSchedule, pageUnschedule, type ScheduleView } from "../content/client";

/* The Transparency record API — one per organization (GET, POST create,
   PATCH { revision, changes }, DELETE archives). Each change is a WHOLE
   part (`governance: null` clears it). Shapes are the content contract's
   (type-only import); the API validates every write. */

export type { Transparency };
export type TransparencyParts = Pick<Transparency, "kicker" | "heading" | "intro" | "financialOverview" | "governance" | "accountability">;

export interface TransparencyView {
  record: Transparency | null;
  revision: number;
  updatedAt: string | null;
  updatedBy: { name: string; isYou: boolean } | null;
  /* M14: a version of it is on the website. */
  live: boolean;
  /* M15: when the approved revision joins a website publication. */
  schedule: ScheduleView | null;
}

type Changes = { [K in keyof TransparencyParts]?: TransparencyParts[K] | null } & { status?: Transparency["status"] };

export const transparencyApi = {
  get: () => api<TransparencyView>("/api/v1/transparency"),
  create: (draft: Partial<TransparencyParts> & { status: Transparency["status"] }) => api<TransparencyView>("/api/v1/transparency", { method: "POST", body: JSON.stringify(draft) }),
  update: (revision: number, changes: Changes) => api<TransparencyView>("/api/v1/transparency", { method: "PATCH", body: JSON.stringify({ revision, changes }) }),
  archive: () => api<TransparencyView>("/api/v1/transparency", { method: "DELETE" }),
  act: pageAct<TransparencyView>("transparency"),
  schedule: pageSchedule<TransparencyView>("transparency"),
  unschedule: pageUnschedule<TransparencyView>("transparency"),
};
