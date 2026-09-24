/* The form schema — Document 21. The ONE definition of what each form
   accepts, shared by the browser (content/forms.js adds labels and
   messages) and the server-side submission handler (server/), so the two
   can never disagree about a field, a length or an allowed value.

   Plain data, no imports, no browser or Vite APIs: it must load in the
   serverless runtime as-is.

   ⚠ A field is here only because it has an approved purpose (Document 21
   §4). Adding one means RBB approves it, the privacy policy covers it,
   and both email templates (server/email/templates.mjs) show it. */

/* The contact form's topics: a general question plus the site's four ways
   to take part (content/getInvolved.js ids — content/validate.js checks
   they still match). */
export const TOPICS = ["general", "donate", "volunteer", "partner", "fundraise"];

/* Every field any form may carry. `singleLine` fields are rejected if they
   contain a line break — they reach email headers (Reply-To) or subjects,
   where a newline is a header-injection attempt. */
export const FIELD_RULES = {
  name: { type: "text", required: true, maxLength: 200, singleLine: true },
  email: { type: "email", required: true, maxLength: 254, singleLine: true },
  organization: { type: "text", required: false, maxLength: 200, singleLine: true },
  topic: { type: "select", required: false, options: TOPICS, singleLine: true },
  message: { type: "textarea", required: true, maxLength: 5000 },
  consent: { type: "checkbox", required: true },
};

/* Which fields each form sends, in order. Anything else is rejected. */
export const FORM_SCHEMA = {
  contact: ["name", "email", "topic", "message"],
  volunteer: ["name", "email", "message"],
  partner: ["name", "organization", "email", "message"],
  fundraise: ["name", "email", "message"],
  newsletter: ["email", "consent"],
};

/* A deliberately plain check — something@something.tld, and none of the
   characters that would let an address smuggle extra recipients or
   headers (comma, semicolon, angle brackets, quotes, whitespace). */
export const EMAIL_PATTERN = /^[^\s@,;<>"'()]+@[^\s@,;<>"'()]+\.[^\s@,;<>"'()]{2,}$/;

/* The honeypot: a field no person sees or fills in (FormShell). */
export const HONEYPOT_FIELD = "website";

/* Faster than this from first render to submit is not a person typing. */
export const MIN_FILL_MS = 1500;

/* The largest request body the endpoint reads (bytes). The biggest
   legitimate form is well under this. */
export const MAX_BODY_BYTES = 16 * 1024;
