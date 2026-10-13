import type { FormDefinitionData, FormFieldDefinition } from "@rbb/content-schema/form-defaults";
import { api } from "../api";

/* The website forms (owners only, live when saved): GET/PUT/DELETE
   /api/v1/forms-admin[/:id]. The API checks every call. */

export type { FormDefinitionData, FormFieldDefinition };

export interface FormListItem {
  definition: FormDefinitionData;
  saved: boolean;
  updatedAt: string | null;
}

export interface FormRole {
  id: string;
  title: string;
  formId: string;
  hasForm: boolean;
}

export type FormEdit = Pick<FormDefinitionData, "title" | "heading" | "intro" | "submitLabel" | "successMessage" | "errorMessage" | "fields">;

const one = (id: string) => `/api/v1/forms-admin/${encodeURIComponent(id)}`;

export const formsApi = {
  list: () => api<{ forms: FormListItem[]; roles: FormRole[] }>("/api/v1/forms-admin"),
  get: (id: string) => api<FormListItem>(one(id)),
  save: (id: string, form: FormEdit) => api<{ form: FormListItem; publishedVersion: number | null }>(one(id), { method: "PUT", body: JSON.stringify(form) }),
  remove: (id: string) => api<{ removed: boolean; publishedVersion: number | null }>(one(id), { method: "DELETE" }),
};
