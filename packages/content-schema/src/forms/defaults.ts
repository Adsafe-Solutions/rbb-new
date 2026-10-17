/* The website's forms as they are before anyone edits them in the admin —
   in plain data (no schema library) so the admin can import it on its own
   (`@rbb/content-schema/form-defaults`). The words are the website's own
   (apps/web content/forms.js); editing a form in the admin starts here.

   Until a form is saved in the admin, the website and the API keep using
   their built-in form (packages/forms); once saved, the saved definition
   is the form. */

/* select = a dropdown, radio = choose one, checkboxes = choose any (each
   lists its options); checkbox = one tick box (an agreement when it is
   required); number and date are typed answers. */
export const FORM_FIELD_TYPES = ["text", "email", "tel", "textarea", "select", "radio", "checkboxes", "checkbox", "number", "date", "file"] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];
/* The types that list options. */
export const OPTION_FIELD_TYPES = ["select", "radio", "checkboxes"] as const;
export const hasOptions = (type: FormFieldType) => (OPTION_FIELD_TYPES as readonly string[]).includes(type);
/* The types with no placeholder (nothing is typed into an empty box). */
export const NO_PLACEHOLDER_TYPES = ["select", "radio", "checkboxes", "checkbox", "date", "file"] as const;

export const BUILT_IN_FORM_IDS = ["contact", "volunteer", "partner"] as const;
export type BuiltInFormId = (typeof BUILT_IN_FORM_IDS)[number];
export type FormKind = BuiltInFormId | "career";

/* The fields every form keeps (replies need a name and an address). */
export const SYSTEM_FIELD_IDS = ["name", "email"] as const;

/* The advertising / news emails checkbox every form keeps (2026-10-13):
   optional for the visitor, TICKED when the form opens (owner decision;
   see docs/ADMIN_IMPLEMENTATION_PLAN.md #18 — a pre-ticked box is not
   valid consent under UK/EU or Indian law). Admin → Audience lists each
   person's latest choice. */
export const MARKETING_FIELD_ID = "marketing";
export const MARKETING_LABEL = "Send me news and updates from Rising Beyond Borders by email. I can unsubscribe at any time.";

/* Uploads (career forms): PDF, Word — at most 4 MB each. */
export const FILE_TYPES = { "application/pdf": "PDF", "application/msword": "DOC", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX" } as const;
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_FILE_FIELDS = 3;

/* Default length limits per type (the shared form rules). */
export const DEFAULT_MAX_LENGTH: Partial<Record<FormFieldType, number>> = { text: 200, email: 254, tel: 30, textarea: 5000 };

export interface FormFieldDefinition {
  id: string;
  type: FormFieldType;
  label: string;
  help?: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  maxLength?: number;
  /* A checkbox ticked when the form opens. */
  defaultChecked?: boolean;
  /* A number field's smallest and largest answer (whole numbers). */
  min?: number;
  max?: number;
}

export interface FormDefinitionData {
  id: string;
  kind: FormKind;
  roleId?: string;
  title: string;
  heading: string;
  intro?: string;
  submitLabel: string;
  successMessage: string;
  errorMessage: string;
  fields: FormFieldDefinition[];
}

const SUCCESS = "Thank you — your message has been sent to Rising Beyond Borders.";
const ERROR = "Sorry, your message could not be sent. Please try again in a moment.";
const NAME: FormFieldDefinition = { id: "name", type: "text", label: "Your name", required: true, maxLength: 200 };
const EMAIL: FormFieldDefinition = { id: "email", type: "email", label: "Email address", required: true, maxLength: 254 };
const message = (label: string): FormFieldDefinition => ({ id: "message", type: "textarea", label, required: true, maxLength: 5000 });
const MARKETING: FormFieldDefinition = { id: MARKETING_FIELD_ID, type: "checkbox", label: MARKETING_LABEL, required: false, defaultChecked: true };

export const DEFAULT_FORMS: Record<BuiltInFormId, FormDefinitionData> = {
  contact: {
    id: "contact",
    kind: "contact",
    title: "Contact Us",
    heading: "Send us a message",
    submitLabel: "Send message",
    successMessage: SUCCESS,
    errorMessage: ERROR,
    fields: [
      NAME,
      EMAIL,
      { id: "topic", type: "select", label: "What is your message about?", required: false, options: ["A general question", "Donate", "Volunteer", "Fellowship", "Partner With Us", "Travel With Us"] },
      message("Your message"),
      MARKETING,
    ],
  },
  volunteer: {
    id: "volunteer",
    kind: "volunteer",
    title: "Volunteer",
    heading: "Tell us you are interested",
    submitLabel: "Send",
    successMessage: SUCCESS,
    errorMessage: ERROR,
    fields: [NAME, EMAIL, message("How would you like to help?"), MARKETING],
  },
  partner: {
    id: "partner",
    kind: "partner",
    title: "Partner With Us",
    heading: "Start a conversation",
    submitLabel: "Send",
    successMessage: SUCCESS,
    errorMessage: ERROR,
    fields: [NAME, { id: "organization", type: "text", label: "Organization", required: false, maxLength: 200 }, EMAIL, message("What would you like to explore?"), MARKETING],
  },
};

/* A new career application form for a role: name, email, a CV upload
   and a short message — all editable before saving. */
export const newCareerForm = (roleId: string, roleTitle: string): FormDefinitionData => ({
  id: `career-${roleId}`,
  kind: "career",
  roleId,
  title: `Application — ${roleTitle}`.slice(0, 120),
  heading: `Apply for ${roleTitle}`.slice(0, 160),
  submitLabel: "Send application",
  successMessage: "Thank you — your application has been sent to Rising Beyond Borders.",
  errorMessage: "Sorry, your application could not be sent. Please try again in a moment.",
  fields: [NAME, EMAIL, { id: "cv", type: "file", label: "Your CV", help: "PDF or Word document, up to 4 MB.", required: true }, { id: "message", type: "textarea", label: "Why are you interested in this role?", required: false, maxLength: 5000 }, MARKETING],
});

/* An event's registration form (2026-10-17): on the event's own page,
   checked by the API against the PUBLISHED event. Every registration form
   keeps a name and an email address — the confirmation goes to it — and
   the marketing checkbox, like every other form. */
export interface EventRegistrationData {
  open: boolean;
  /* Places; absent = no limit. */
  capacity?: number;
  submitLabel: string;
  successMessage: string;
  fields: FormFieldDefinition[];
}

export const newEventRegistration = (): EventRegistrationData => ({
  open: true,
  submitLabel: "Register",
  successMessage: "You're registered. We've emailed a confirmation to the address you gave.",
  fields: [
    { ...NAME, label: "Your full name" },
    EMAIL,
    { id: "phone", type: "tel", label: "Phone number", required: false, maxLength: 30 },
    MARKETING,
  ],
});
