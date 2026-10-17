/* Form logic — Document 12. Validation, readiness and submission, shared
   by every form; the forms themselves are data (content/forms.js).

   Client-side validation is for the person filling the form in. It is
   NOT a safeguard: the backend behind each endpoint must validate every
   field again, rate-limit, and verify any anti-spam token. */
import { FORM_COPY } from "../content/forms.js";
import { antiSpamReady, antiSpamToken } from "./antiSpam.js";
import { EMAIL_PATTERN, HONEYPOT_FIELD } from "./formSchema.js";
import { fieldCodesFrom, registrationOutcome } from "./formResponse.js";

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
  if (!config) return "disabled";
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

/* The rules the API applies to a number and a date (apps/api forms
   definition.ts): a whole number of at most seven digits, and a day that
   exists — "2026-02-30" is the right shape and still not a date. */
const INTEGER = /^-?\d{1,7}$/;
const realDay = (text) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
};
const isOption = (field, v) => (field.options ?? []).some((o) => o.value === v);
const outOfRange = (field, n) => (field.min != null && n < field.min) || (field.max != null && n > field.max);

/* One field's error message, or null. The message names the field and
   says how to put it right — never repeats what was typed. */
export function validateField(field, value) {
  const m = FORM_COPY.messages;
  const text = typeof value === "string" ? value.trim() : value;

  if (field.type === "checkbox")
    return field.required && !value ? m.checkbox(field.label) : null;
  /* A file field holds the id of a finished upload (components/FileField). */
  if (field.type === "file") return field.required && !text ? m.file(field.label) : null;
  /* "Choose any" holds an ARRAY of the chosen options (none = []); a
     required one needs at least one. */
  if (field.type === "checkboxes") {
    const chosen = Array.isArray(value) ? value : [];
    if (chosen.length === 0) return field.required ? field.missing ?? m.chooseAny(field.label) : null;
    return chosen.every((v) => isOption(field, v)) ? null : m.invalid(field.label);
  }
  if (!text) {
    if (!field.required) return null;
    if (field.missing) return field.missing;
    if (field.type === "select") return m.select(field.label);
    if (field.type === "radio") return m.choose(field.label);
    /* A date or number box the browser could not read is empty to us too
       (a half-typed date, letters in a number); "enter a real date" is
       the more useful message there, and still right for a blank. */
    if (field.type === "date") return m.date(field.label);
    if (field.type === "number") return m.number(field.label);
    return m.required(field.label);
  }
  if (field.type === "radio") return isOption(field, text) ? null : m.choose(field.label);
  if (field.type === "number") {
    if (!INTEGER.test(text)) return m.number(field.label);
    return outOfRange(field, Number(text)) ? m.numberRange(field.label, field.min, field.max) : null;
  }
  if (field.type === "date") return realDay(text) ? null : m.date(field.label);
  /* The server's own pattern (lib/formSchema.js), so a value the browser
     accepts is never one the server rejects. */
  if (field.type === "email" && !EMAIL_PATTERN.test(text)) return m.email(field.label);
  if (field.type === "tel" && !/^[0-9+()\-.\s]{3,30}$/.test(text)) return m.phone(field.label);
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

/* The server's field codes (@rbb/forms validateSubmission) as this form's
   own messages — the server never sends wording, only a code. */
export function serverFieldMessage(field, code) {
  const m = FORM_COPY.messages;
  if (code === "required")
    return validateField(field, field.type === "checkbox" ? false : field.type === "checkboxes" ? [] : "");
  if (code === "format" && field.type === "email") return m.email(field.label);
  if (code === "format" && field.type === "tel") return m.phone(field.label);
  if (code === "format" && field.type === "number") return m.number(field.label);
  if (code === "format" && field.type === "date") return m.date(field.label);
  /* "invalid" on a number is the API's "outside min / max". */
  if (code === "invalid" && field.type === "number" && (field.min != null || field.max != null))
    return m.numberRange(field.label, field.min, field.max);
  if (code === "invalid" && field.type === "radio") return m.choose(field.label);
  if (code === "required" && field.type === "file") return m.file(field.label);
  if (code === "too-long" && field.maxLength)
    return m.tooLong(field.label, field.maxLength);
  return m.invalid(field.label);
}

/* Sends one submission (Document 21). Resolves to one outcome:
     { outcome: "ok" }
     { outcome: "invalid", fields }   — the server's field codes
     { outcome: "rate-limited" }
     { outcome: "full" | "closed" }   — an event's registration (409):
                                        the event is full, or registration
                                        has closed or the event has ended
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
        /* Only this form's own fields — the server rejects any other.
           A "choose any" answer goes as the array it is. */
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
      /* The API's error envelope (M18) or the old form server's shape —
         lib/formResponse.js; codes only. */
      const body = await response.json().catch(() => null);
      return { outcome: "invalid", fields: fieldCodesFrom(body) };
    }
    if (response.status === 409) {
      const body = await response.json().catch(() => null);
      return { outcome: registrationOutcome(body) };
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
