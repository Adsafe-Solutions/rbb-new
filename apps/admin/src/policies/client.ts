import type { Policy, PolicyId } from "@rbb/content-schema";
import { api } from "../api";
import { pageAct, pageSchedule, pageUnschedule, type ScheduleView } from "../content/client";

/* The site policies API (M19) — exactly three, each a single page at
   /api/v1/policies/<id> (GET; PATCH { revision, changes } — revision 0
   creates; DELETE archives), and the list of all three with the contact
   methods a policy may name. Each change is a WHOLE part (`contactReference:
   null` clears it). Shapes are the content contract's (type-only import);
   the API validates every write. */

export type { Policy, PolicyId };
export type PolicyParts = Pick<Policy, "title" | "effectiveDate" | "lastUpdated" | "intro" | "sections" | "contactReference" | "relatedPolicies" | "seo">;

export interface PolicyView {
  record: Policy | null;
  revision: number;
  updatedAt: string | null;
  updatedBy: { name: string; isYou: boolean } | null;
  /* A version of it is on the website. */
  live: boolean;
  /* When the approved revision joins a website publication. */
  schedule: ScheduleView | null;
}

export interface PolicySummary {
  id: PolicyId;
  route: string;
  label: string;
  view: PolicyView;
}

export interface ContactMethodOption {
  id: string;
  type: string;
  label: string;
  value: string;
}

/* Whole parts (null clears an optional one), or a status for reopening. */
type Changes = Partial<Record<keyof PolicyParts, unknown>> & { status?: Policy["status"] };

const base = (id: PolicyId) => `policies/${id}`;

export const policiesApi = {
  list: () => api<{ policies: PolicySummary[]; contactMethods: ContactMethodOption[] }>("/api/v1/policies"),
  get: (id: PolicyId) => api<PolicyView>(`/api/v1/${base(id)}`),
  update: (id: PolicyId, revision: number, changes: Changes) => api<PolicyView>(`/api/v1/${base(id)}`, { method: "PATCH", body: JSON.stringify({ revision, changes }) }),
  archive: (id: PolicyId) => api<PolicyView>(`/api/v1/${base(id)}`, { method: "DELETE" }),
  act: (id: PolicyId) => pageAct<PolicyView>(base(id)),
  schedule: (id: PolicyId) => pageSchedule<PolicyView>(base(id)),
  unschedule: (id: PolicyId) => pageUnschedule<PolicyView>(base(id)),
};
