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
  replied: boolean;
  /* A form saved in the admin (career applications): its name. */
  formTitle: string | null;
  attachments: number;
}

export interface SubmissionAttachment {
  id: string;
  fieldId: string;
  name: string;
  size: number;
  contentType: string;
}

export interface SubmissionReply {
  id: string;
  at: string;
  by: { id: string; name: string };
  message: string;
}

export interface Submission {
  id: string;
  formId: string;
  reference: string;
  fields: Record<string, string>;
  status: "new" | "read";
  createdAt: string;
  updatedAt: string;
  replies?: SubmissionReply[];
  formTitle?: string;
  labels?: Record<string, string>;
  attachments?: SubmissionAttachment[];
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
  /* Email is set up: replies can be sent from the admin. */
  canReply: boolean;
  /* Forms saved in the admin, by id → name (for the filter). */
  formTitles: Record<string, string>;
}

const one = (id: string) => `/api/v1/submissions/${encodeURIComponent(id)}`;

export const submissionsApi = {
  list: (filters: SubmissionFilters, before: string | null = null) => api<SubmissionPage>(`/api/v1/submissions${submissionsQuery(filters, before)}`),
  get: (id: string) => api<Submission>(one(id)),
  setStatus: (id: string, status: "new" | "read") => api<Submission>(`${one(id)}/status`, { method: "POST", body: JSON.stringify({ status }) }),
  remove: (id: string) => api<{ deleted: true }>(one(id), { method: "DELETE" }),
  /* A short-lived signed link to an attached file. */
  attachment: (id: string, attachmentId: string) => api<{ url: string; expiresAt: string; name: string }>(`${one(id)}/attachments/${encodeURIComponent(attachmentId)}`),
  reply: (id: string, message: string) => api<Submission>(`${one(id)}/replies`, { method: "POST", body: JSON.stringify({ message }) }),
};
