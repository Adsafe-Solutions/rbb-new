/* Forms — Document 12. ONE source for every form the site may one day
   show: the general inquiry on /contact, the Volunteer, Partner, Travel
   With Us and Fundraise inquiries, and newsletter sign-up. The components in
   components/Form* render these; lib/forms.js validates and submits them.

   A form is drawn only when `formState` (lib/forms.js) finds ALL of:
     - status: "approved"
     - an endpoint (config/env.js — a public address of RBB's own backend)
     - RBB's own successMessage and errorMessage
     - no `recipient` in this file (see below)
     - a PUBLISHED Privacy Policy (content/policies.js) — every form
     - for the newsletter, also approved consent wording
   Anything missing and the form stays disabled, silently. The endpoint
   is infrastructure (config/env.js) and whether a submission is actually
   delivered is the server's EMAIL_MODE, so a form drawn in development
   still emails nobody.

   ⚠ Nothing here may be invented: no recipient, email address, provider,
   CRM, anti-spam vendor, response time, eligibility rule or privacy
   text. Those are RBB's to supply. The success, error and consent
   wording below is PROPOSED interface copy — what happened, nothing
   more: no response time, no promise of a reply. RBB approves it.

   ⚠ This file ships to every browser. `recipient` is a SERVER setting —
   where the backend delivers a submission — and must stay null here; a
   form with a recipient set in this file is treated as misconfigured and
   stays disabled. Same for keys: none, ever.

   The fields below are PROPOSED — the least each inquiry could need
   (Document 12 §7). RBB approves, trims or extends them before a form
   goes live. None asks for sensitive information or screens anyone out.

   One config:
     {
       formId,
       status:          "draft" | "approved" | "archived"
       heading, intro:  the form's own heading and line (PROPOSED copy)
       fields:          [{ name, type, label, required?, hint?, missing?,
                           autoComplete?, maxLength?, options? }]
                        type: "text" | "email" | "textarea" | "select"
                              | "checkbox"
       submitLabel
       recipient:       null — server-side only (see above)
       provider:        the form service RBB chooses, by name — display
                        and configuration only, never a credential
       endpoint:        from config/env.js
       consent:         { label, required, status } — RBB's exact wording
       antiSpam:        { provider, siteKey? } — a PUBLIC site key only;
                        see lib/antiSpam.js
       successMessage:  RBB's approved text — no response-time promise
       errorMessage:    RBB's approved text
       privacyLink:     from content/policies.js — null until /privacy is
                        published
       requires:        extra approvals this form cannot go live without
     } */

import { ENV } from "../config/env.js";
import { GET_INVOLVED } from "./getInvolved.js";
import { policyLink } from "./policies.js";
import { FIELD_RULES } from "../lib/formSchema.js";

/* `missing` is the field's own "you left this empty" message, where the
   generic "Enter <label>" would read badly (a label that is a question). */
/* Types, required flags, lengths and allowed values come from the shared
   schema (lib/formSchema.js) — the same rules the server enforces. This
   file adds only what a person reads: labels and messages. */
const field = (name, extra) => ({ name, ...FIELD_RULES[name], ...extra });
const NAME = field("name", { label: "Your name", autoComplete: "name", missing: "Enter your name" });
const EMAIL = field("email", { label: "Email address", autoComplete: "email", missing: "Enter your email address" });
const message = (label, missing) => field("message", { label, missing });

/* What every config starts from. A form still needs its endpoint, the
   server's own delivery configuration and the published Privacy Policy
   before anything is drawn, so nothing is faked in the browser. */
const SUCCESS = "Thank you — your message has been sent to Rising Beyond Borders.";
const ERROR = "Sorry, your message could not be sent. Please try again in a moment.";

const pending = (formId) => ({
  ...base(formId),
  status: "approved",
  successMessage: SUCCESS,
  errorMessage: ERROR,
  ...(formId === "newsletter" && {
    consent: {
      label: "I agree to receive news from Rising Beyond Borders by email, and understand I can unsubscribe at any time.",
      required: true,
      status: "approved",
    },
  }),
});

const base = (formId) => ({
  formId,
  status: "draft",
  recipient: null,
  provider: null,
  endpoint: ENV.formEndpoints[formId] ?? null,
  consent: null,
  antiSpam: null,
  successMessage: null,
  errorMessage: null,
  /* The published Privacy Policy (content/policies.js), or null. Every
     form collects personal details, so every form requires it: none goes
     live before /privacy is approved (Document 13 §9). */
  privacyLink: policyLink("privacy"),
  requires: ["privacyLink"],
});

export const FORMS = {
  /* /contact — general inquiries. The topic list is the site's own paths,
     so a question can reach whoever handles it without a second form. */
  contact: {
    ...pending("contact"),
    heading: "Send us a message",
    submitLabel: "Send message",
    fields: [
      NAME,
      EMAIL,
      field("topic", {
        label: "What is your message about?",
        options: [
          { value: "general", label: "A general question" },
          { value: "donate", label: "Donate" },
          ...GET_INVOLVED.paths.map((p) => ({ value: p.id, label: p.title })),
        ],
      }),
      message("Your message", "Enter your message"),
    ],
  },

  /* /get-involved/volunteer — interest, not an application: no
     eligibility questions, ages, locations or availability grids. */
  volunteer: {
    ...pending("volunteer"),
    heading: "Tell us you are interested",
    submitLabel: "Send",
    fields: [NAME, EMAIL, message("How would you like to help?", "Tell us how you would like to help")],
  },

  /* /get-involved/partner — no packages, tiers or organisation types. */
  partner: {
    ...pending("partner"),
    heading: "Start a conversation",
    submitLabel: "Send",
    fields: [
      NAME,
      field("organization", { label: "Organization", autoComplete: "organization" }),
      EMAIL,
      message("What would you like to explore?", "Tell us what you would like to explore"),
    ],
  },

  /* /get-involved/travel — registering interest in a trip, not booking
     one: no dates, prices, destinations or travel documents. */
  travel: {
    ...pending("travel"),
    heading: "Register your interest",
    intro: "Tell us a little about yourself and we will keep you informed as trips are planned.",
    submitLabel: "Register interest",
    fields: [
      NAME,
      EMAIL,
      field("phone", { label: "Phone number", autoComplete: "tel" }),
      message("What kind of trip interests you?", "Tell us what kind of trip interests you"),
    ],
  },

  /* Fundraise — no page in the current sitemap; kept for the server's
     fundraise form id (server/config.mjs). */
  fundraise: {
    ...pending("fundraise"),
    heading: "Tell us about your fundraiser",
    submitLabel: "Send",
    fields: [NAME, EMAIL, message("What are you planning?", "Tell us what you are planning")],
  },

  /* Newsletter sign-up, wherever a newsletter card appears. Cannot go
     live without approved consent wording and a real privacy policy,
     whatever else is supplied (Document 12 §10).
     M18: OFF — status "draft" — until RBB approves its consent wording,
     recipient and subscriber processing; the API does not take it either.
     An endpoint in the environment does not change that. */
  newsletter: {
    ...pending("newsletter"),
    status: "draft",
    heading: "Sign up",
    submitLabel: "Sign up",
    /* The card's inline field (components/Newsletter) shows a placeholder;
       the label stays for assistive technology. */
    fields: [{ ...EMAIL, placeholder: "Your email" }],
    requires: ["privacyLink", "consent"],
  },
};

/* ---------------- Forms saved in the admin ----------------
   2026-10-13: owners edit the website's forms in the admin (Contact Us,
   Volunteer, Partner With Us, and one application form per open role on
   the Careers page); a saved form is live at once. The published snapshot
   carries them as content.forms, which the build and the runtime snapshot
   set here (scripts/snapshot-adapter.mjs) — `items` are the content
   contract's FormDefinitions. Empty: every page keeps the forms above.

   Pages ask for a form with formConfig(id) — never FORMS[id] directly —
   so a saved form replaces the built-in one wherever it is drawn. */
export const PUBLISHED_FORMS = { items: [] };

/* Where a form posts: its own endpoint, or — for a career form, which has
   none of its own — the Contact form's, with its id in place of "contact"
   (the same API route, POST /api/v1/forms/:formId). */
const endpointFor = (id) => ENV.formEndpoints[id] ?? (ENV.formEndpoints.contact ? ENV.formEndpoints.contact.replace(/\/contact$/, `/${id}`) : null);
const MAX_LENGTH = { text: 200, email: 254, tel: 30, textarea: 5000 };
const AUTOCOMPLETE = { name: "name", email: "email", organization: "organization", phone: "tel" };
export const UPLOAD_ACCEPT = ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

const webField = (f, endpoint) => ({
  name: f.id,
  type: f.type,
  label: f.label,
  required: f.required,
  ...(f.help && { hint: f.help }),
  ...(f.placeholder && { placeholder: f.placeholder }),
  ...((f.maxLength ?? MAX_LENGTH[f.type]) && { maxLength: f.maxLength ?? MAX_LENGTH[f.type] }),
  ...(f.options && { options: f.options.map((o) => ({ value: o, label: o })) }),
  ...(AUTOCOMPLETE[f.id] && { autoComplete: AUTOCOMPLETE[f.id] }),
  ...(f.type === "file" && { accept: UPLOAD_ACCEPT, maxBytes: UPLOAD_MAX_BYTES, uploadEndpoint: endpoint ? `${endpoint}/files` : null }),
});

/* The form to draw for `id`: as saved in the admin, else the built-in one
   (or null — a career form that was never saved). */
export function formConfig(id) {
  const saved = PUBLISHED_FORMS.items.find((d) => d.id === id);
  const built = Object.hasOwn(FORMS, id) ? FORMS[id] : null;
  if (!saved) return built;
  const endpoint = built?.endpoint ?? endpointFor(id);
  return {
    ...(built ?? pending(id)),
    endpoint,
    heading: saved.heading,
    intro: saved.intro,
    submitLabel: saved.submitLabel,
    successMessage: saved.successMessage,
    errorMessage: saved.errorMessage,
    fields: saved.fields.map((f) => webField(f, endpoint)),
  };
}

/* ---------------- Interface copy ----------------
   PROPOSED. Labels and validation messages only — nothing here says what
   happens to a submission; that is RBB's successMessage / errorMessage. */
export const FORM_COPY = {
  required: "required",
  optional: "optional",
  /* The "nothing chosen" entry of an optional select — words, not a dash,
     which a screen reader reads as "dash" or not at all (Document 16). */
  selectNone: "Choose an option",
  summaryHeading: "There is a problem",
  errorPrefix: "Error:",
  submitting: "Sending…",
  submittingStatus: "Sending your message. Please wait.",
  alternativeLead: "You can also reach us here:",
  /* Document 21. Generic on purpose: no limits or anti-spam detail. */
  rateLimited: "There have been too many attempts to send this form. Please wait a few minutes and try again.",
  /* Shown in place of a working form when JavaScript is off: the form is
     sent by the page's script, and without it nothing could be sent. */
  needsJavaScript: "This form needs JavaScript to send. Please enable it, or use another way to reach us.",
  honeypotLabel: "Leave this field empty",
  messages: {
    required: (label) => `Enter ${label.toLowerCase()}`,
    select: (label) => `Choose an answer for “${label}”`,
    checkbox: (label) => `Tick the box to confirm: ${label}`,
    email: () => "Enter an email address in the correct format, with an @ and a domain",
    tooLong: (label, max) => `${label} must be ${max} characters or fewer`,
    invalid: (label) => `Check “${label}” and try again`,
    phone: (label) => `Enter ${label.toLowerCase()} using digits, spaces and + ( ) - only`,
    file: (label) => `Choose a file for “${label}”`,
  },
  /* A file field (career applications). */
  upload: {
    choose: "Choose a file",
    replace: "Choose a different file",
    remove: "Remove",
    uploading: "Uploading…",
    uploaded: "Attached",
    types: "PDF or Word document, up to 4 MB.",
    tooBig: "That file is larger than 4 MB. Choose a smaller one.",
    wrongType: "Choose a PDF or Word document.",
    rateLimited: "Too many uploads. Please wait a few minutes and try again.",
    failed: "The file could not be uploaded. Please try again.",
  },
};

export default FORMS;
