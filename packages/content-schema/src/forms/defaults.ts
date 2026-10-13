/* The website's forms as they are before anyone edits them in the admin —
   in plain data (no schema library) so the admin can import it on its own
   (`@rbb/content-schema/form-defaults`). The words are the website's own
   (apps/web content/forms.js); editing a form in the admin starts here.

   Until a form is saved in the admin, the website and the API keep using
   their built-in form (packages/forms); once saved, the saved definition
   is the form. */

export const FORM_FIELD_TYPES = ["text", "email", "tel", "textarea", "select", "checkbox", "file"] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export const BUILT_IN_FORM_IDS = ["contact", "volunteer", "partner"] as const;
export type BuiltInFormId = (typeof BUILT_IN_FORM_IDS)[number];
export type FormKind = BuiltInFormId | "career";

/* The fields every form keeps (replies need a name and an address). */
export const SYSTEM_FIELD_IDS = ["name", "email"] as const;

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
    fields: [NAME, EMAIL, message("How would you like to help?")],
  },
  partner: {
    id: "partner",
    kind: "partner",
    title: "Partner With Us",
    heading: "Start a conversation",
    submitLabel: "Send",
    successMessage: SUCCESS,
    errorMessage: ERROR,
    fields: [NAME, { id: "organization", type: "text", label: "Organization", required: false, maxLength: 200 }, EMAIL, message("What would you like to explore?")],
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
  fields: [NAME, EMAIL, { id: "cv", type: "file", label: "Your CV", help: "PDF or Word document, up to 4 MB.", required: true }, { id: "message", type: "textarea", label: "Why are you interested in this role?", required: false, maxLength: 5000 }],
});
