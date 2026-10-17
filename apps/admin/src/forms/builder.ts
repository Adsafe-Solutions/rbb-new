import { DEFAULT_MAX_LENGTH, FILE_TYPES, MARKETING_FIELD_ID, MARKETING_LABEL, MAX_FILE_FIELDS, NO_PLACEHOLDER_TYPES, SYSTEM_FIELD_IDS, hasOptions, type EventRegistrationData, type FormDefinitionData, type FormFieldDefinition, type FormFieldType } from "@rbb/content-schema/form-defaults";
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
  radio: "Choose one",
  checkboxes: "Choose any",
  checkbox: "Checkbox",
  number: "Number",
  date: "Date",
  file: "File upload (PDF or Word)",
};

/* Whose fields these are: a website form, or an event's registration
   form (2026-10-17; packages/content-schema EventRegistration). Only a
   career form takes file uploads. */
export type BuilderKind = FormDefinitionData["kind"] | "event";
const takesFiles = (kind: BuilderKind) => kind === "career";

/* The types a form may add (file uploads: career forms only). */
export const typesFor = (kind: BuilderKind): FormFieldType[] => (Object.keys(TYPE_LABELS) as FormFieldType[]).filter((t) => t !== "file" || takesFiles(kind));

export const isSystemField = (id: string) => (SYSTEM_FIELD_IDS as readonly string[]).includes(id);
/* The marketing emails checkbox every form keeps (never required). */
export const isMarketingField = (id: string) => id === MARKETING_FIELD_ID;
export const marketingField = (): FormFieldDefinition => ({ id: MARKETING_FIELD_ID, type: "checkbox", label: MARKETING_LABEL, required: false, defaultChecked: true });
/* The type has a placeholder (something is typed into an empty box). */
export const hasPlaceholder = (type: FormFieldType) => !(NO_PLACEHOLDER_TYPES as readonly string[]).includes(type);

/* A field id from its label ("Your city" → "your_city"), unique on the
   form; fixed once the form is saved (submissions are keyed by it). */
export const fieldIdFrom = (label: string, others: readonly { id: string }[]): string =>
  idFrom(label, others.map((o) => ({ id: o.id.replace(/_/g, "-") })), "field").replace(/-/g, "_").replace(/^([0-9])/, "f_$1").slice(0, 40);

export const newField = (type: FormFieldType, others: readonly { id: string }[]): FormFieldDefinition => ({
  id: fieldIdFrom(TYPE_LABELS[type], others),
  type,
  label: "",
  required: false,
  ...(hasOptions(type) && { options: [] as string[] }),
});

/* "Add a question": one button per kind of question, each a field ready
   to word. Name and E-mail fill the system field ("name" / "email") when
   the form has lost it, so a removed one can be put back; otherwise they
   add an ordinary field with its own id. A choice starts with two options
   to rename. File uploads: career forms only. */
export interface FieldPreset {
  key: string;
  name: string;
  type: FormFieldType;
  make: (others: readonly { id: string }[]) => FormFieldDefinition;
}
const TWO_OPTIONS = ["Option 1", "Option 2"];
const preset = (key: string, name: string, type: FormFieldType, label: string, extra: Partial<FormFieldDefinition> = {}): FieldPreset => ({
  key,
  name,
  type,
  make: (others) => ({ id: fieldIdFrom(label || name, others), type, label, required: false, ...(hasOptions(type) && { options: [...TWO_OPTIONS] }), ...extra }),
});
const systemPreset = (key: "name" | "email", name: string, type: FormFieldType, label: string): FieldPreset => {
  const plain = preset(key, name, type, label);
  return { ...plain, make: (others) => (others.some((f) => f.id === key) ? plain.make(others) : { id: key, type, label, required: true, maxLength: DEFAULT_MAX_LENGTH[type]! }) };
};
export const PALETTE: readonly FieldPreset[] = [
  systemPreset("name", "Name", "text", "Full name"),
  systemPreset("email", "E-mail", "email", "Email address"),
  preset("phone", "Phone", "tel", "Phone number"),
  preset("text", "Short text", "text", ""),
  preset("textarea", "Long text", "textarea", ""),
  preset("radio", "Choose one", "radio", ""),
  preset("checkboxes", "Choose any", "checkboxes", ""),
  preset("select", "Dropdown", "select", ""),
  preset("number", "Number", "number", ""),
  preset("date", "Date", "date", ""),
  preset("agreement", "Agreement", "checkbox", "I agree to …", { required: true }),
  preset("file", "File upload", "file", "", { help: "PDF or Word document, up to 4 MB." }),
];
export const paletteFor = (kind: BuilderKind): FieldPreset[] => PALETTE.filter((p) => p.type !== "file" || takesFiles(kind));

/* A copy, under the original, with its own id (never a system one). */
export const duplicateField = (field: FormFieldDefinition, others: readonly { id: string }[]): FormFieldDefinition => ({
  ...structuredClone(field),
  id: fieldIdFrom(field.label || TYPE_LABELS[field.type], others),
});

/* A type change keeps what still applies: options between the choice
   types (dropdown, choose one, choose any), a placeholder where the type
   has one, a length only where the type has one, the smallest and largest
   answer only on a number, "ticked" only on a checkbox. */
export function retype(field: FormFieldDefinition, type: FormFieldType): FormFieldDefinition {
  const { options, placeholder, maxLength, min, max, defaultChecked, ...rest } = field;
  return {
    ...rest,
    type,
    ...(hasOptions(type) && { options: options ?? [] }),
    ...(placeholder && hasPlaceholder(type) && { placeholder }),
    ...(maxLength && DEFAULT_MAX_LENGTH[type] && maxLength <= DEFAULT_MAX_LENGTH[type]! && { maxLength }),
    ...(type === "number" && min !== undefined && { min }),
    ...(type === "number" && max !== undefined && { max }),
    ...(type === "checkbox" && defaultChecked && { defaultChecked }),
  };
}

/* Problems the editor can show before saving (the API's are shown after).
   The same for a website form and an event's registration form. */
export function builderProblems(form: { kind: BuilderKind; fields: readonly FormFieldDefinition[] }): string[] {
  const problems: string[] = [];
  for (const id of SYSTEM_FIELD_IDS) if (!form.fields.some((f) => f.id === id)) problems.push(`The “${id}” field is needed for replies and cannot be removed. Add it back with “${id === "name" ? "Name" : "E-mail"}” under “Add a question”.`);
  if (!form.fields.some((f) => f.id === MARKETING_FIELD_ID)) problems.push("The marketing emails checkbox stays on every form (Audience reads it). Add it back with “Restore marketing checkbox”.");
  form.fields.forEach((f, i) => {
    const name = `“${f.label || `Field ${i + 1}`}”`;
    if (!f.label.trim()) problems.push(`Field ${i + 1} needs a label.`);
    if (hasOptions(f.type) && !(f.options ?? []).some((o) => o.trim())) problems.push(`${name} needs at least one option.`);
    if (f.type === "number" && f.min !== undefined && f.max !== undefined && f.min > f.max) problems.push(`${name}: the smallest answer is above the largest.`);
  });
  const files = form.fields.filter((f) => f.type === "file").length;
  if (files && !takesFiles(form.kind)) problems.push("File uploads are for career application forms only.");
  else if (files > MAX_FILE_FIELDS) problems.push(`At most ${MAX_FILE_FIELDS} file uploads.`);
  return problems;
}

const t = (s: string | undefined) => (s ?? "").trim();
const whole = (n: number | undefined) => (n !== undefined && Number.isFinite(n) ? Math.trunc(n) : undefined);

/* What is sent for a list of fields: trimmed words, options without
   blanks (each once), only the parts the type has, optional parts left
   out when empty; name, email and the marketing checkbox as every form
   keeps them. Used by a form's save and an event's registration form. */
export function cleanFields(fields: readonly FormFieldDefinition[]): FormFieldDefinition[] {
  return fields.map((f) => {
    const min = f.type === "number" ? whole(f.min) : undefined;
    const max = f.type === "number" ? whole(f.max) : undefined;
    return {
      id: f.id,
      type: f.type,
      label: t(f.label),
      ...(t(f.help) && { help: t(f.help) }),
      ...(t(f.placeholder) && hasPlaceholder(f.type) && { placeholder: t(f.placeholder) }),
      required: f.id === MARKETING_FIELD_ID ? false : f.type === "email" && f.id === "email" ? true : f.id === "name" ? true : f.required,
      ...(f.type === "checkbox" && f.defaultChecked && { defaultChecked: true }),
      ...(hasOptions(f.type) && { options: [...new Set((f.options ?? []).map((o) => o.trim()).filter(Boolean))] }),
      ...(f.maxLength && { maxLength: f.maxLength }),
      ...(min !== undefined && { min }),
      ...(max !== undefined && { max }),
    };
  });
}

/* What an event's save sends for its registration form: trimmed words,
   clean fields, no capacity when it is not a whole number of places. */
export function cleanRegistration(registration: EventRegistrationData): EventRegistrationData {
  const capacity = whole(registration.capacity);
  return {
    open: registration.open,
    ...(capacity !== undefined && capacity > 0 && { capacity }),
    submitLabel: t(registration.submitLabel),
    successMessage: t(registration.successMessage),
    fields: cleanFields(registration.fields),
  };
}

/* What a form's save sends. */
export function cleanForm<F extends Pick<FormDefinitionData, "title" | "heading" | "intro" | "submitLabel" | "successMessage" | "errorMessage" | "fields">>(form: F) {
  return {
    title: t(form.title),
    heading: t(form.heading),
    ...(t(form.intro) && { intro: t(form.intro) }),
    submitLabel: t(form.submitLabel),
    successMessage: t(form.successMessage),
    errorMessage: t(form.errorMessage),
    fields: cleanFields(form.fields),
  };
}

/* The API's messages for a list of fields, by path RELATIVE to the list
   ("" = the list itself, "3.label" = field 4's label): a form's are under
   "fields", an event's under "registration.fields". */
export function errorsUnder(errors: ReadonlyMap<string, string>, prefix: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const [path, message] of errors) {
    if (path === prefix) out.set("", message);
    else if (path.startsWith(`${prefix}.`)) out.set(path.slice(prefix.length + 1), message);
  }
  return out;
}

export const FILE_TYPE_NAMES = Object.values(FILE_TYPES).join(", ");
