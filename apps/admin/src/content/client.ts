import type { Appeal, Event, Metric, Post, Program, Project, Report, TeamMember } from "@rbb/content-schema";
import { api, apiEnvelope } from "../api";
import type { Pagination } from "../media/client";

/* The posts, events and appeals API. Record shapes are the content contract's
   (type-only import); the API validates every write against them. */

export type { Appeal, Event, Metric, Post, Program, Project, Report, TeamMember };
/* M14: the editorial workflow's states (content/workflow.tsx). */
export type ContentStatus = "draft" | "submitted" | "approved" | "published" | "archived";
export type WorkflowAction = "submit" | "withdraw" | "approve" | "reject" | "unmark";
/* M15: when an approved revision joins a website publication (the API's
   publishing/schedule.ts view): a UTC instant, and the IANA zone it was
   chosen in. */
export interface ScheduleView {
  at: string;
  timeZone: string;
  revision: number;
  by: { name: string };
  createdAt: string;
  failedAt?: string;
  problems?: string[];
}
export interface ScheduleInput {
  localTime: string;
  timeZone: string;
}

export interface ContentView<R> {
  record: R;
  revision: number;
  createdAt: string;
  updatedAt: string;
  createdBy: { name: string };
  updatedBy: { name: string; isYou: boolean };
  previousSlugs: string[];
  /* A version of it is on the website (when the status is not
     "published", an earlier one: these changes are pending). */
  live: boolean;
  schedule: ScheduleView | null;
}

export interface ListParams {
  search?: string;
  status?: ContentStatus;
  type?: string;
  sort?: "updated" | "date" | "title";
  page?: number;
  pageSize?: number;
}

export const contentApi = <R>(base: "posts" | "events" | "appeals" | "team" | "programs" | "metrics" | "reports" | "stories" | "projects") => ({
  async list(params: ListParams = {}) {
    const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)]));
    const body = await apiEnvelope<ContentView<R>[], { pagination: Pagination }>(`/api/v1/${base}${query.size ? `?${query}` : ""}`);
    return { items: body.data, pagination: body.pagination ?? { page: 1, pageSize: body.data.length, total: body.data.length, totalPages: 1 } };
  },
  get: (id: string) => api<ContentView<R>>(`/api/v1/${base}/${encodeURIComponent(id)}`),
  create: (fields: Record<string, unknown>) => api<ContentView<R>>(`/api/v1/${base}`, { method: "POST", body: JSON.stringify(fields) }),
  update: (id: string, revision: number, changes: Record<string, unknown>, confirmSlugChange = false) =>
    api<ContentView<R>>(`/api/v1/${base}/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ revision, changes, ...(confirmSlugChange && { confirmSlugChange }) }) }),
  archive: (id: string) => api<ContentView<R>>(`/api/v1/${base}/${encodeURIComponent(id)}`, { method: "DELETE" }),
  /* M14: submit / withdraw (editors and owners), approve / reject (owners),
     based on the revision on screen (a stale one: 409). */
  act: (id: string, action: WorkflowAction, revision: number) =>
    api<ContentView<R>>(`/api/v1/${base}/${encodeURIComponent(id)}/${action}`, { method: "POST", body: JSON.stringify({ revision }) }),
  /* M15 (owners): queue the approved revision for a website publication, or drop that. */
  schedule: (id: string, revision: number, input: ScheduleInput) => api<ContentView<R>>(`/api/v1/${base}/${encodeURIComponent(id)}/schedule`, { method: "POST", body: JSON.stringify({ revision, ...input }) }),
  unschedule: (id: string, revision: number) => api<ContentView<R>>(`/api/v1/${base}/${encodeURIComponent(id)}/unschedule`, { method: "POST", body: JSON.stringify({ revision }) }),
});

/* M14: a single page's workflow transition (the homepage, About, Impact,
   Transparency, Careers, the donation page): POST /api/v1/<base>/<action>. */
export const pageAct =
  <V>(base: string) =>
  (action: WorkflowAction, revision: number) =>
    api<V>(`/api/v1/${base}/${action}`, { method: "POST", body: JSON.stringify({ revision }) });

/* M15: a single page's schedule. */
export const pageSchedule =
  <V>(base: string) =>
  (revision: number, input: ScheduleInput) =>
    api<V>(`/api/v1/${base}/schedule`, { method: "POST", body: JSON.stringify({ revision, ...input }) });
export const pageUnschedule =
  <V>(base: string) =>
  (revision: number) =>
    api<V>(`/api/v1/${base}/unschedule`, { method: "POST", body: JSON.stringify({ revision }) });

export const postsApi = contentApi<Post>("posts");
export const eventsApi = contentApi<Event>("events");
export const appealsApi = contentApi<Appeal>("appeals");
export const teamApi = {
  ...contentApi<TeamMember>("team"),
  /* Everyone's position at once, in the new order; each with the revision
     it was read at (a stale one changes nothing: 409). */
  order: (items: { id: string; revision: number }[]) => api<ContentView<TeamMember>[]>("/api/v1/team/order", { method: "POST", body: JSON.stringify({ items }) }),
};
export const programsApi = {
  ...contentApi<Program>("programs"),
  /* Every program's position at once, in the new order (see teamApi). */
  order: (items: { id: string; revision: number }[]) => api<ContentView<Program>[]>("/api/v1/programs/order", { method: "POST", body: JSON.stringify({ items }) }),
};
/* Stories (M12): posts of type "story", their own module (/api/v1/stories). */
export const storiesApi = contentApi<Post>("stories");
export const projectsApi = {
  ...contentApi<Project>("projects"),
  /* Every project's position at once, in the new order (see teamApi). */
  order: (items: { id: string; revision: number }[]) => api<ContentView<Project>[]>("/api/v1/projects/order", { method: "POST", body: JSON.stringify({ items }) }),
};
export const metricsApi = {
  ...contentApi<Metric>("metrics"),
  /* Every figure's position at once, in the new order (see teamApi). */
  order: (items: { id: string; revision: number }[]) => api<ContentView<Metric>[]>("/api/v1/metrics/order", { method: "POST", body: JSON.stringify({ items }) }),
};
export const reportsApi = {
  ...contentApi<Report>("reports"),
  /* Every document's position at once, in the new order (see teamApi). */
  order: (items: { id: string; revision: number }[]) => api<ContentView<Report>[]>("/api/v1/reports/order", { method: "POST", body: JSON.stringify({ items }) }),
};

/* "6:30 PM" ↔ the <input type="time"> value "18:30". */
export function toTimeInput(time: string | undefined): string {
  const m = /^(1[0-2]|[1-9]):([0-5]\d) (AM|PM)$/.exec(time ?? "");
  if (!m) return "";
  const h = (Number(m[1]) % 12) + (m[3] === "PM" ? 12 : 0);
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}
export function fromTimeInput(value: string): string | undefined {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return undefined;
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}

export const formatDate = (iso: string | undefined) => (iso ? new Date(`${iso.length === 10 ? `${iso}T12:00:00Z` : iso}`).toLocaleDateString(undefined, { dateStyle: "medium", ...(iso.length === 10 && { timeZone: "UTC" }) }) : "—");
export const formatDateTime = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
