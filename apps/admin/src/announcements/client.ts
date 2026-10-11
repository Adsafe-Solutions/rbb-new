import type { AnnouncementBar } from "@rbb/content-schema";
import { api } from "../api";
import { pageAct, pageSchedule, pageUnschedule, type ScheduleView } from "../content/client";

/* The announcement bar API (M21) — one per organization (GET; PATCH
   { revision, changes: { items } } — revision 0 creates; DELETE
   archives). Its on/off switch and interval are site settings
   (engagement.announcementBar), saved through the settings API. */

export type { AnnouncementBar };

export interface AnnouncementBarView {
  record: AnnouncementBar | null;
  revision: number;
  updatedAt: string | null;
  updatedBy: { name: string; isYou: boolean } | null;
  live: boolean;
  schedule: ScheduleView | null;
}

export const announcementBarApi = {
  get: () => api<AnnouncementBarView>("/api/v1/announcement-bar"),
  update: (revision: number, changes: Record<string, unknown>) => api<AnnouncementBarView>("/api/v1/announcement-bar", { method: "PATCH", body: JSON.stringify({ revision, changes }) }),
  archive: () => api<AnnouncementBarView>("/api/v1/announcement-bar", { method: "DELETE" }),
  act: pageAct<AnnouncementBarView>("announcement-bar"),
  schedule: pageSchedule<AnnouncementBarView>("announcement-bar"),
  unschedule: pageUnschedule<AnnouncementBarView>("announcement-bar"),
};
