import { CONTROL, EMAIL_PATTERN } from "@rbb/forms";
import { DEFAULT_MAX_LENGTH, type FormDefinition } from "@rbb/content-schema";

/* A submission checked against a form AS SAVED in the admin (2026-10-13)
   — the built-in forms keep @rbb/forms' fixed schema until first saved.
   Same rules and codes as validateSubmission: strings are normalised
   (CRLF → LF, control characters removed, trimmed; one line unless the
   field is long text), then each field is required / format / too-long /
   invalid. Fields the form does not have are ignored (a page opened just
   before the form changed); the ones it has are checked. A file field
   carries the id of an upload made for it (uploads.ts). */

const BODY_KEYS = new Set(["formId", "fields", "website", "elapsedMs", "antiSpamToken"]);
const UPLOAD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PHONE = /^[0-9+()\-.\s]{3,30}$/;

export type DefinitionResult =
  | { ok: true; data: Record<string, string>; files: Record<string, string> }
  | { ok: false; status: 400 | 422; fields?: Record<string, "required" | "format" | "too-long" | "invalid"> };

export function validateAgainstDefinition(definition: FormDefinition, body: unknown): DefinitionResult {
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
    else if (field.type === "select" && !(field.options ?? []).includes(text)) problems[field.id] = "invalid";
    else data[field.id] = text;
  }
  if (Object.keys(problems).length) return { ok: false, status: 422, fields: problems };
  return { ok: true, data, files };
}
