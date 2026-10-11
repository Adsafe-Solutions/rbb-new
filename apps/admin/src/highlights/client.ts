import type { StoryStrip } from "@rbb/content-schema";
import { api } from "../api";
import { pageAct, pageSchedule, pageUnschedule, type ScheduleView } from "../content/client";

/* Highlights — the story strip API (M23): one per organization (GET;
   PATCH { revision, changes: { appealIds } } — revision 0 creates; DELETE
   archives). Its on/off switch is a site setting (engagement.storyStrip),
   saved through the settings API. */

export type { StoryStrip };

export interface StoryStripView {
  record: StoryStrip | null;
  revision: number;
  updatedAt: string | null;
  updatedBy: { name: string; isYou: boolean } | null;
  live: boolean;
  schedule: ScheduleView | null;
}

export const storyStripApi = {
  get: () => api<StoryStripView>("/api/v1/story-strip"),
  update: (revision: number, changes: Record<string, unknown>) => api<StoryStripView>("/api/v1/story-strip", { method: "PATCH", body: JSON.stringify({ revision, changes }) }),
  archive: () => api<StoryStripView>("/api/v1/story-strip", { method: "DELETE" }),
  act: pageAct<StoryStripView>("story-strip"),
  schedule: pageSchedule<StoryStripView>("story-strip"),
  unschedule: pageUnschedule<StoryStripView>("story-strip"),
};
