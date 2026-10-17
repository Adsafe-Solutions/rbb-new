import { CONTROL, EMAIL_PATTERN } from "@rbb/forms";
import { DEFAULT_MAX_LENGTH, type FormDefinition } from "@rbb/content-schema";

/* A submission checked against a form AS SAVED in the admin (2026-10-13)
   — the built-in forms keep @rbb/forms' fixed schema until first saved.
   Same rules and codes as validateSubmission: strings are normalised
   (CRLF → LF, control characters removed, trimmed; one line unless the
   field is long text), then each field is required / format / too-long /
   invalid. Fields the form does not have are ignored (a page opened just
   before the form changed); the ones it has are checked. A file field
   carries the id of an upload made for it (uploads.ts).

   Choice fields (2026-10-17): "choose one" (radio) is a dropdown's rule —
   one of its options; "choose any" (checkboxes) arrives as an ARRAY of
   its options, each once, kept as one "A; B" string so every reader of a
   submission (the admin, the emails, Audience) stays a string reader. A
   number is a whole number within the field's min / max; a date a real
   YYYY-MM-DD day. */

const BODY_KEYS = new Set(["formId", "fields", "website", "elapsedMs", "antiSpamToken"]);
const UPLOAD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PHONE = /^[0-9+()\-.\s]{3,30}$/;

export type DefinitionResult =
  | { ok: true; data: Record<string, string>; files: Record<string, string> }
  | { ok: false; status: 400 | 422; fields?: Record<string, "required" | "format" | "too-long" | "invalid"> };

/* What is checked: a website form as saved, or an event's registration
   form — the fields are all that matter. */
type Checked = Pick<FormDefinition, "fields">;
const INTEGER = /^-?\d{1,7}$/;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const realDay = (text: string) => {
  const m = DAY.exec(text);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
};
export const CHOICE_SEPARATOR = "; ";

export function validateAgainstDefinition(definition: Checked, body: unknown): DefinitionResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, status: 400 };
  for (const key of Object.keys(body)) if (!BODY_KEYS.has(key)) return { ok: false, status: 400 };
  const raw = (body as { fields?: unknown }).fields;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, status: 400 };
  const input = raw as Record<string, unknown>;
  const data: Record<string, string> = {};
  const files: Record<string, string> = {};
  const problems: Record<string, "required" | "format" | "too-long" | "invalid"> = {};

  for (const field of definition.fields) {
    const value = input[field.id];
    if (field.type === "checkbox") {
      if (value !== undefined && typeof value !== "boolean") return { ok: false, status: 400 };
      if (field.required && value !== true) problems[field.id] = "required";
      else if (value !== undefined) data[field.id] = value ? "Yes" : "No";
      continue;
    }
    if (field.type === "checkboxes") {
      if (value !== undefined && value !== null && !(Array.isArray(value) && value.length <= 30 && value.every((v) => typeof v === "string"))) return { ok: false, status: 400 };
      const chosen = [...new Set(((value as string[] | null | undefined) ?? []).map((v) => v.trim()).filter(Boolean))];
      if (!chosen.length) {
        if (field.required) problems[field.id] = "required";
      } else if (!chosen.every((v) => (field.options ?? []).includes(v))) problems[field.id] = "invalid";
      /* In the form's own order, whatever order they were ticked in. */
      else data[field.id] = (field.options ?? []).filter((o) => chosen.includes(o)).join(CHOICE_SEPARATOR);
      continue;
    }
    if (field.type === "number" && typeof value === "number") {
      if (!Number.isInteger(value)) problems[field.id] = "format";
      else if ((field.min !== undefined && value < field.min) || (field.max !== undefined && value > field.max)) problems[field.id] = "invalid";
      else data[field.id] = String(value);
      continue;
    }
    if (value !== undefined && value !== null && typeof value !== "string") return { ok: false, status: 400 };
    let text = typeof value === "string" ? value.replace(/\r\n?/g, "\n").replace(CONTROL, "") : "";
    text = field.type === "textarea" ? text.replace(/[ \t]+$/gm, "").trim() : text.replace(/\s*\n\s*/g, " ").trim();
    if (!text) {
      if (field.required) problems[field.id] = "required";
      continue;
    }
    if (field.type === "file") {
      if (!UPLOAD_ID.test(text)) problems[field.id] = "invalid";
      else files[field.id] = text;
      continue;
    }
    const max = field.maxLength ?? DEFAULT_MAX_LENGTH[field.type];
    if (max && text.length > max) problems[field.id] = "too-long";
    else if (field.type === "email" && !EMAIL_PATTERN.test(text)) problems[field.id] = "format";
    else if (field.type === "tel" && !PHONE.test(text)) problems[field.id] = "format";
    else if ((field.type === "select" || field.type === "radio") && !(field.options ?? []).includes(text)) problems[field.id] = "invalid";
    else if (field.type === "number" && !INTEGER.test(text)) problems[field.id] = "format";
    else if (field.type === "number" && ((field.min !== undefined && Number(text) < field.min) || (field.max !== undefined && Number(text) > field.max))) problems[field.id] = "invalid";
    else if (field.type === "date" && !realDay(text)) problems[field.id] = "format";
    else data[field.id] = field.type === "number" ? String(Number(text)) : text;
  }
  if (Object.keys(problems).length) return { ok: false, status: 422, fields: problems };
  return { ok: true, data, files };
}
