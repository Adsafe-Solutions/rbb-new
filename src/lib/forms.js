/* Form logic — Document 12. Validation, readiness and submission, shared
   by every form; the forms themselves are data (content/forms.js).

   Client-side validation is for the person filling the form in. It is
   NOT a safeguard: the backend behind each endpoint must validate every
   field again, rate-limit, and verify any anti-spam token. */
import { FORM_COPY } from "../content/forms.js";
import { antiSpamReady, antiSpamToken } from "./antiSpam.js";
import { EMAIL_PATTERN, HONEYPOT_FIELD } from "./formSchema.js";

/* A public endpoint: a same-origin path, or https. Anything else — a
   mailto:, plain http, a string with credentials in it — is refused. */
const validEndpoint = (endpoint) => {
  if (typeof endpoint !== "string" || !endpoint) return false;
  if (endpoint.startsWith("/") && !endpoint.startsWith("//")) return true;
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};

const approved = (block) => block?.status === "approved" && Boolean(block.label);

/* "ready" or "disabled" — the only two states a form can START in. The
   rest (submitting, success, error) happen inside FormShell. Every
   condition must hold; see the header of content/forms.js. */
export function formState(config) {
  if (!config || config.status !== "approved") return "disabled";
  if (config.recipient) return "disabled";
  if (!validEndpoint(config.endpoint)) return "disabled";
  if (!config.successMessage || !config.errorMessage) return "disabled";
  if (!config.fields?.length) return "disabled";
  if (config.consent && !approved(config.consent)) return "disabled";
  if (config.requires?.includes("consent") && !approved(config.consent))
    return "disabled";
  if (config.requires?.includes("privacyLink") && !config.privacyLink?.to)
    return "disabled";
  if (!antiSpamReady(config.antiSpam)) return "disabled";
  return "ready";
}

/* The consent box, as a field, when there is approved wording for one. */
export const consentField = (config) =>
  approved(config.consent)
    ? {
        name: "consent",
        type: "checkbox",
        label: config.consent.label,
        required: config.consent.required !== false,
      }
    : null;

export const formFields = (config) =>
  [...config.fields, consentField(config)].filter(Boolean);

/* One field's error message, or null. The message names the field and
   says how to put it right — never repeats what was typed. */
export function validateField(field, value) {
  const m = FORM_COPY.messages;
  const text = typeof value === "string" ? value.trim() : value;

  if (field.type === "checkbox")
    return field.required && !value ? m.checkbox(field.label) : null;
  if (!text) {
    if (!field.required) return null;
    if (field.missing) return field.missing;
    return field.type === "select" ? m.select(field.label) : m.required(field.label);
  }
  /* The server's own pattern (lib/formSchema.js), so a value the browser
     accepts is never one the server rejects. */
  if (field.type === "email" && !EMAIL_PATTERN.test(text)) return m.email(field.label);
  if (field.maxLength && text.length > field.maxLength)
    return m.tooLong(field.label, field.maxLength);
  if (field.type === "select" && !field.options.some((o) => o.value === text))
    return m.select(field.label);
  return null;
}

/* Every field's error, keyed by field name. Empty object = valid. */
export function validateForm(fields, values) {
  const errors = {};
  for (const field of fields) {
    const error = validateField(field, values[field.name]);
    if (error) errors[field.name] = error;
  }
  return errors;
}

const TIMEOUT_MS = 20000;

/* The server's field codes (server/validate.mjs) as this form's own
   messages — the server never sends wording, only a code. */
export function serverFieldMessage(field, code) {
  const m = FORM_COPY.messages;
  if (code === "required")
    return validateField(field, field.type === "checkbox" ? false : "");
  if (code === "format" && field.type === "email") return m.email(field.label);
  if (code === "too-long" && field.maxLength)
    return m.tooLong(field.label, field.maxLength);
  return m.invalid(field.label);
}

/* Sends one submission (Document 21). Resolves to one outcome:
     { outcome: "ok" }
     { outcome: "invalid", fields }   — the server's field codes
     { outcome: "rate-limited" }
     { outcome: "error" }             — anything else, network included
   Never the server's wording, which is not approved copy.

   - POST with a JSON body: personal data never goes in the URL.
   - `idempotencyKey` is the same for every retry of one submission, so a
     backend can recognise a repeat and not act on it twice.
   - `credentials: "omit"`: the form sends no cookies anywhere.
   - Nothing is logged, stored or sent to analytics. */
export async function submitForm(
  config,
  values,
  idempotencyKey,
  { honeypot = "", elapsedMs = null } = {}
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const token = await antiSpamToken(config.antiSpam, config.formId);
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({
        formId: config.formId,
        /* Only this form's own fields — the server rejects any other. */
        fields: Object.fromEntries(
          formFields(config)
            .map((f) => [f.name, values[f.name]])
            .filter(([, v]) => v !== undefined)
        ),
        [HONEYPOT_FIELD]: honeypot,
        elapsedMs,
        antiSpamToken: token,
      }),
      credentials: "omit",
      signal: controller.signal,
    });
    if (response.ok) return { outcome: "ok" };
    if (response.status === 429) return { outcome: "rate-limited" };
    if (response.status === 422) {
      const body = await response.json().catch(() => null);
      return { outcome: "invalid", fields: body?.fields ?? {} };
    }
    return { outcome: "error" };
  } catch {
    return { outcome: "error" };
  } finally {
    clearTimeout(timer);
  }
}

/* A fresh key for a new submission. */
export const newSubmissionKey = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;
