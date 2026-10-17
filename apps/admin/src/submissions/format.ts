/* Form submissions in the admin: the request, the forms' names and the
   field labels. Plain functions, unit-tested (scripts/test). */

/* Newsletter: the footer's subscribe form (2026-10-13). It is fixed in the
   website, so it never appears in Admin → Forms. */
export const FORM_LABELS: Record<string, string> = { contact: "Contact Us", volunteer: "Volunteer", partner: "Partner With Us", newsletter: "Newsletter" };
/* An event's registration form (2026-10-17): `event-<event record id>`;
   its submissions carry their name ("Registration — <event>"), and this is
   the fallback when none is at hand. */
export const isEventForm = (formId: string): boolean => /^event-[A-Za-z0-9_-]+$/.test(formId);
export const formLabel = (formId: string): string => (Object.hasOwn(FORM_LABELS, formId) ? FORM_LABELS[formId]! : isEventForm(formId) ? "Event registration" : formId);

/* The Contact form's topics (packages/forms TOPICS), worded as the
   website's own select offers them (apps/web content/forms.js). */
const TOPIC_LABELS: Record<string, string> = { general: "A general question", donate: "Donate", volunteer: "Volunteer", fellowship: "Fellowship", partner: "Partner With Us", travel: "Travel With Us" };
export const topicLabel = (topic: string): string => (Object.hasOwn(TOPIC_LABELS, topic) ? TOPIC_LABELS[topic]! : topic);

/* The fields of a submission, in reading order, with their labels. */
const FIELD_ORDER: [string, string][] = [
  ["name", "Name"],
  ["email", "Email"],
  ["organization", "Organisation"],
  ["phone", "Phone"],
  ["topic", "Topic"],
  ["message", "Message"],
  ["marketing", "Marketing emails"],
  ["consent", "Newsletter consent"],
];
export function fieldRows(fields: Record<string, string>, labels?: Record<string, string>): { key: string; label: string; value: string }[] {
  /* A form saved in the admin: its own labels, in its own order. */
  if (labels) {
    const ordered = Object.keys(labels).filter((k) => fields[k]).map((k) => ({ key: k, label: labels[k]!, value: fields[k]! }));
    const rest = Object.keys(fields).filter((k) => !Object.hasOwn(labels, k) && fields[k]).sort().map((k) => ({ key: k, label: k, value: fields[k]! }));
    return [...ordered, ...rest];
  }
  const known = FIELD_ORDER.filter(([key]) => fields[key]).map(([key, label]) => ({ key, label, value: key === "topic" ? topicLabel(fields[key]!) : fields[key]! }));
  const other = Object.keys(fields).filter((k) => !FIELD_ORDER.some(([key]) => key === k) && fields[k]).sort().map((k) => ({ key: k, label: k, value: fields[k]! }));
  return [...known, ...other];
}

export interface SubmissionFilters {
  form: string;
  status: string;
  from: string;
  to: string;
  q: string;
}
export const NO_FILTERS: SubmissionFilters = { form: "", status: "", from: "", to: "", q: "" };

/* The list request's query string — only what is set. */
export function submissionsQuery(filters: SubmissionFilters, before: string | null = null): string {
  const params = new URLSearchParams();
  for (const key of ["form", "status", "from", "to"] as const) if (filters[key]) params.set(key, filters[key]);
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (before) params.set("before", before);
  const text = params.toString();
  return text ? `?${text}` : "";
}

/* A reply in the member's own mail program — the address and a subject;
   nothing is sent by the admin. */
export const replyHref = (email: string, formId: string, reference: string): string =>
  `mailto:${encodeURIComponent(email).replace(/%40/g, "@")}?subject=${encodeURIComponent(`Re: your ${isEventForm(formId) ? "registration" : `${formLabel(formId)} message`} (${reference})`)}`;

/* The form filter's choice from the address (`/submissions?form=…`, e.g.
   an event's "View registrations"). */
export const filtersFromSearch = (search: string): SubmissionFilters => ({ ...NO_FILTERS, form: new URLSearchParams(search).get("form")?.trim() ?? "" });
