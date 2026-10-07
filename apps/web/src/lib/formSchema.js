/* The form schema now lives in packages/forms — the one definition shared
   by this site's forms, its form endpoint (server/handler.mjs) and the
   API. This module keeps the site's existing imports working; it adds
   nothing of its own. */
export {
  EMAIL_PATTERN,
  FIELD_RULES,
  FORM_SCHEMA,
  HONEYPOT_FIELD,
  MAX_BODY_BYTES,
  MIN_FILL_MS,
  TOPICS,
} from "@rbb/forms/schema";
