import type { GetInvolvedHub, GetInvolvedPage, GetInvolvedPageId, GetInvolvedPath } from "@rbb/content-schema";
import { api } from "../api";
import { pageAct, pageSchedule, pageUnschedule, type ScheduleView } from "../content/client";

/* The Get Involved API (M20) — five fixed pages, each a single page at
   /api/v1/get-involved/<id> (GET; PATCH { revision, changes } — revision
   0 creates; DELETE archives), and the list of all five. Each change is a
   WHOLE part (`why: null` clears it). Shapes are the content contract's
   (type-only import); the API validates every write. */

export type { GetInvolvedHub, GetInvolvedPage, GetInvolvedPageId, GetInvolvedPath };

export interface GetInvolvedView {
  record: GetInvolvedPage | null;
  revision: number;
  updatedAt: string | null;
  updatedBy: { name: string; isYou: boolean } | null;
  /* A version of it is on the website. */
  live: boolean;
  /* When the approved revision joins a website publication. */
  schedule: ScheduleView | null;
}

export interface GetInvolvedSummary {
  id: GetInvolvedPageId;
  route: string;
  label: string;
  view: GetInvolvedView;
}

/* Whole parts (null clears an optional one), or a status for reopening. */
type Changes = Record<string, unknown> & { status?: GetInvolvedPage["status"] };

const base = (id: GetInvolvedPageId) => `get-involved/${id}`;

export const getInvolvedApi = {
  list: () => api<{ pages: GetInvolvedSummary[] }>("/api/v1/get-involved"),
  get: (id: GetInvolvedPageId) => api<GetInvolvedView>(`/api/v1/${base(id)}`),
  update: (id: GetInvolvedPageId, revision: number, changes: Changes) => api<GetInvolvedView>(`/api/v1/${base(id)}`, { method: "PATCH", body: JSON.stringify({ revision, changes }) }),
  archive: (id: GetInvolvedPageId) => api<GetInvolvedView>(`/api/v1/${base(id)}`, { method: "DELETE" }),
  act: (id: GetInvolvedPageId) => pageAct<GetInvolvedView>(base(id)),
  schedule: (id: GetInvolvedPageId) => pageSchedule<GetInvolvedView>(base(id)),
  unschedule: (id: GetInvolvedPageId) => pageUnschedule<GetInvolvedView>(base(id)),
};
