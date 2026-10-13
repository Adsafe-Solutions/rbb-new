import { api } from "../api";
import { submissionsQuery, type SubmissionFilters } from "./format";

/* Form submissions (owners only): GET /api/v1/submissions …; the API
   checks every call. */

export interface SubmissionSummary {
  id: string;
  formId: string;
  reference: string;
  createdAt: string;
  status: "new" | "read";
  name: string;
  email: string;
  organization: string | null;
  topic: string | null;
  preview: string;
}

export interface Submission {
  id: string;
  formId: string;
  reference: string;
  fields: Record<string, string>;
  status: "new" | "read";
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionCounts {
  total: number;
  new: number;
  byForm: Record<string, { total: number; new: number }>;
}

export interface SubmissionPage {
  items: SubmissionSummary[];
  next: string | null;
  counts: SubmissionCounts;
}

const one = (id: string) => `/api/v1/submissions/${encodeURIComponent(id)}`;

export const submissionsApi = {
  list: (filters: SubmissionFilters, before: string | null = null) => api<SubmissionPage>(`/api/v1/submissions${submissionsQuery(filters, before)}`),
  get: (id: string) => api<Submission>(one(id)),
  setStatus: (id: string, status: "new" | "read") => api<Submission>(`${one(id)}/status`, { method: "POST", body: JSON.stringify({ status }) }),
  remove: (id: string) => api<{ deleted: true }>(one(id), { method: "DELETE" }),
};
