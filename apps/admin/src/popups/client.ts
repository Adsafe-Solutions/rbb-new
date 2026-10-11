import type { Popup } from "@rbb/content-schema";
import { api } from "../api";
import { pageAct, pageSchedule, pageUnschedule, type ScheduleView } from "../content/client";

/* The site popup API (M22) — one per organization (GET; PATCH
   { revision, changes } — revision 0 creates; DELETE archives). Whether it
   shows at all is a site setting (engagement.popup), saved through the
   settings API. */

export type { Popup };

export interface PopupView {
  record: Popup | null;
  revision: number;
  updatedAt: string | null;
  updatedBy: { name: string; isYou: boolean } | null;
  live: boolean;
  schedule: ScheduleView | null;
}

export const popupApi = {
  get: () => api<PopupView>("/api/v1/popup"),
  update: (revision: number, changes: Record<string, unknown>) => api<PopupView>("/api/v1/popup", { method: "PATCH", body: JSON.stringify({ revision, changes }) }),
  archive: () => api<PopupView>("/api/v1/popup", { method: "DELETE" }),
  act: pageAct<PopupView>("popup"),
  schedule: pageSchedule<PopupView>("popup"),
  unschedule: pageUnschedule<PopupView>("popup"),
};
