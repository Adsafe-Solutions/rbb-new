import { DEFAULT_MAX_LENGTH, FILE_TYPES, MAX_FILE_FIELDS, SYSTEM_FIELD_IDS, type FormDefinitionData, type FormFieldDefinition, type FormFieldType } from "@rbb/content-schema/form-defaults";
import { idFrom } from "../blocks/ids.ts";

/* The form builder's rules, as plain functions (unit-tested): field ids,
   which types a form may use, what is sent on save. The API checks it all
   again (packages/content-schema FormDefinition). */

export const TYPE_LABELS: Record<FormFieldType, string> = {
  text: "Short text",
  email: "Email address",
  tel: "Phone number",
  textarea: "Long text",
  select: "Dropdown",
  checkbox: "Checkbox",
  file: "File upload (PDF or Word)",
};

/* The types a form may add (file uploads: career forms only). */
export const typesFor = (kind: FormDefinitionData["kind"]): FormFieldType[] => (Object.keys(TYPE_LABELS) as FormFieldType[]).filter((t) => t !== "file" || kind === "career");

export const isSystemField = (id: string) => (SYSTEM_FIELD_IDS as readonly string[]).includes(id);

/* A field id from its label ("Your city" → "your_city"), unique on the
   form; fixed once the form is saved (submissions are keyed by it). */
export const fieldIdFrom = (label: string, others: readonly { id: string }[]): string =>
  idFrom(label, others.map((o) => ({ id: o.id.replace(/_/g, "-") })), "field").replace(/-/g, "_").replace(/^([0-9])/, "f_$1").slice(0, 40);

export const newField = (type: FormFieldType, others: readonly { id: string }[]): FormFieldDefinition => ({
  id: fieldIdFrom(TYPE_LABELS[type], others),
  type,
  label: "",
  required: false,
  ...(type === "select" && { options: [] as string[] }),
});

/* A type change keeps what still applies (options for a dropdown only,
   no placeholder on a checkbox, dropdown or file, a length only where the
   type has one). */
export function retype(field: FormFieldDefinition, type: FormFieldType): FormFieldDefinition {
  const { options, placeholder, maxLength, ...rest } = field;
  return {
    ...rest,
    type,
    ...(type === "select" && { options: options ?? [] }),
    ...(placeholder && !["checkbox", "select", "file"].includes(type) && { placeholder }),
    ...(maxLength && DEFAULT_MAX_LENGTH[type] && maxLength <= DEFAULT_MAX_LENGTH[type]! && { maxLength }),
  };
}

/* Problems the editor can show before saving (the API's are shown after). */
export function builderProblems(form: Pick<FormDefinitionData, "kind" | "fields">): string[] {
  const problems: string[] = [];
  for (const id of SYSTEM_FIELD_IDS) if (!form.fields.some((f) => f.id === id)) problems.push(`The “${id}” field is needed for replies and cannot be removed.`);
  form.fields.forEach((f, i) => {
    if (!f.label.trim()) problems.push(`Field ${i + 1} needs a label.`);
    if (f.type === "select" && !(f.options ?? []).some((o) => o.trim())) problems.push(`“${f.label || `Field ${i + 1}`}” needs at least one option.`);
  });
  if (form.fields.filter((f) => f.type === "file").length > MAX_FILE_FIELDS) problems.push(`At most ${MAX_FILE_FIELDS} file uploads.`);
  return problems;
}

/* What is sent: trimmed words, options without blanks, optional parts left out when empty. */
export function cleanForm<F extends Pick<FormDefinitionData, "title" | "heading" | "intro" | "submitLabel" | "successMessage" | "errorMessage" | "fields">>(form: F) {
  const t = (s: string | undefined) => (s ?? "").trim();
  return {
    title: t(form.title),
    heading: t(form.heading),
    ...(t(form.intro) && { intro: t(form.intro) }),
    submitLabel: t(form.submitLabel),
    successMessage: t(form.successMessage),
    errorMessage: t(form.errorMessage),
    fields: form.fields.map((f) => ({
      id: f.id,
      type: f.type,
      label: t(f.label),
      ...(t(f.help) && { help: t(f.help) }),
      ...(t(f.placeholder) && { placeholder: t(f.placeholder) }),
      required: f.type === "email" && f.id === "email" ? true : f.id === "name" ? true : f.required,
      ...(f.type === "select" && { options: [...new Set((f.options ?? []).map((o) => o.trim()).filter(Boolean))] }),
      ...(f.maxLength && { maxLength: f.maxLength }),
    })),
  };
}

export const FILE_TYPE_NAMES = Object.values(FILE_TYPES).join(", ");
