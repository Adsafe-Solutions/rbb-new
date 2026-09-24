/* Server-side validation — Document 21 §5. The browser's checks are for
   the person filling the form in; these are the ones that count. Every
   rule comes from the shared schema (src/lib/formSchema.js).

   Returns either { ok: true, data } — the normalised fields, and nothing
   else — or { ok: false, status, error, fields? } where `fields` maps a
   field name to a short code ("required", "format", "too-long",
   "invalid"). Codes, never the submitted text: nothing a visitor typed is
   ever echoed back. */
import {
  EMAIL_PATTERN,
  FIELD_RULES,
  FORM_SCHEMA,
  HONEYPOT_FIELD,
} from "../src/lib/formSchema.js";

/* The only keys a request body may have. */
const BODY_KEYS = new Set([
  "formId",
  "fields",
  HONEYPOT_FIELD,
  "elapsedMs",
  "antiSpamToken",
]);

/* Control characters other than tab and newline — never legitimate in a
   form field, and a vehicle for header and display tricks. */
export const CONTROL =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069]/g;

const normalise = (value, rule) => {
  let v = value.replace(/\r\n?/g, "\n").replace(CONTROL, "");
  v = rule.type === "textarea" ? v.replace(/[ \t]+$/gm, "").trim() : v.trim();
  return v;
};

export function validateSubmission(body) {
  const bad = (error, status = 400) => ({ ok: false, status, error });

  if (!body || typeof body !== "object" || Array.isArray(body)) return bad("bad-request");
  for (const key of Object.keys(body)) if (!BODY_KEYS.has(key)) return bad("bad-request");

  const { formId, fields } = body;
  const allowed = FORM_SCHEMA[formId];
  if (!allowed) return bad("unknown-form", 404);
  if (!fields || typeof fields !== "object" || Array.isArray(fields))
    return bad("bad-request");
  /* Unknown fields are REJECTED, not stripped: a request carrying fields
     this form never sends did not come from this form. */
  for (const key of Object.keys(fields))
    if (!allowed.includes(key)) return bad("bad-request");

  const data = {};
  const errors = {};
  for (const name of allowed) {
    const rule = FIELD_RULES[name];
    const raw = fields[name];

    if (rule.type === "checkbox") {
      if (raw !== undefined && typeof raw !== "boolean") return bad("bad-request");
      if (rule.required && raw !== true) errors[name] = "required";
      else data[name] = raw === true;
      continue;
    }

    if (raw !== undefined && raw !== null && typeof raw !== "string")
      return bad("bad-request");
    const hadBreak = typeof raw === "string" && /[\r\n]/.test(raw.trim());
    const value = typeof raw === "string" ? normalise(raw, rule) : "";

    if (!value) {
      if (rule.required) errors[name] = "required";
      continue;
    }
    if (rule.singleLine && hadBreak) errors[name] = "invalid";
    else if (rule.maxLength && value.length > rule.maxLength) errors[name] = "too-long";
    else if (rule.type === "email" && !EMAIL_PATTERN.test(value)) errors[name] = "format";
    else if (rule.options && !rule.options.includes(value)) errors[name] = "invalid";
    else data[name] = value;
  }

  if (Object.keys(errors).length)
    return { ok: false, status: 422, error: "invalid", fields: errors };
  return { ok: true, formId, data };
}
