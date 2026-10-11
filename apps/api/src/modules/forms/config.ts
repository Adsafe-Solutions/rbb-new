/* M18 — the public forms' configuration (Document 21), from the API's
   environment. Values are never logged or returned: problems name the
   variable and the rule, nothing more.

   Which forms the API can take at all is fixed here (FORM_IDS); which are
   ENABLED is configuration: a supported form with an approved recipient,
   while the email mode is not "off". Newsletter and Travel are not
   supported in M18 — Newsletter waits for approved consent, recipient and
   subscriber processing; Travel was not approved for this milestone.

   Fail closed:
     - a global problem (unknown mode; staging/live without a key or a
       valid From; staging without a test inbox; live with a temporary
       resend.dev sender) turns EVERY form off;
     - a form-specific problem (a recipient that is not one address) turns
       THAT form off. Other forms are unaffected. */

export const FORM_IDS = ["contact", "volunteer", "partner", "fundraise"] as const;
export type FormId = (typeof FORM_IDS)[number];
export const EMAIL_MODES = ["off", "test", "staging", "live"] as const;
export type EmailMode = (typeof EMAIL_MODES)[number];

export interface FormsConfig {
  mode: EmailMode;
  /* Variable names and rules only — safe to log. */
  problems: string[];
  apiKey: string | null;
  from: string | null;
  /* The approved recipient of each ENABLED form. */
  recipients: Partial<Record<FormId, string>>;
  /* Forms that email the submitter an acknowledgement. */
  acknowledge: FormId[];
  testRecipient: string | null;
  rateLimit: { max: number; windowMs: number };
}

export const FORMS_OFF: FormsConfig = { mode: "off", problems: [], apiKey: null, from: null, recipients: {}, acknowledge: [], testRecipient: null, rateLimit: { max: 5, windowMs: 600_000 } };

/* One address, no display name, none of the characters that could add a
   recipient or a header (the same rule as @rbb/forms' EMAIL_PATTERN). */
const SINGLE_ADDRESS = /^[^\s@,;<>"'()]+@[^\s@,;<>"'()]+\.[^\s@,;<>"'()]{2,}$/;
/* "Name <address>" or a bare address, on one line. */
const FROM_PATTERN = /^(?:[^<>\r\n"]{1,80}\s<)?[^\s@,;<>"'()]+@[^\s@,;<>"'()]+\.[^\s@,;<>"'()]{2,}>?$/;
const TEMPORARY_SENDER = /@resend\.dev>?$/i;

const clean = (value: string | undefined) => (typeof value === "string" && value.trim() ? value.trim() : null);
const isFormId = (value: string): value is FormId => (FORM_IDS as readonly string[]).includes(value);

export function loadFormsConfig(env: Record<string, string | undefined>): FormsConfig {
  const global: string[] = [];
  const problems: string[] = [];

  const rawMode = clean(env.EMAIL_MODE);
  let mode: EmailMode = "off";
  if (rawMode && (EMAIL_MODES as readonly string[]).includes(rawMode)) mode = rawMode as EmailMode;
  else if (rawMode) global.push("EMAIL_MODE must be off, test, staging or live");

  const apiKey = clean(env.EMAIL_API_KEY) ?? clean(env.RESEND_API_KEY);
  const from = clean(env.EMAIL_FROM);
  const testRecipient = clean(env.EMAIL_TEST_RECIPIENT);
  if (mode === "staging" || mode === "live") {
    if (!apiKey) global.push("EMAIL_API_KEY (or RESEND_API_KEY) is not set");
    if (!from || !FROM_PATTERN.test(from)) global.push("EMAIL_FROM is missing or not a valid From");
    else if (mode === "live" && TEMPORARY_SENDER.test(from)) global.push("EMAIL_FROM uses a temporary resend.dev sender, not allowed in live mode");
  }
  if (mode === "staging" && !(testRecipient && SINGLE_ADDRESS.test(testRecipient))) global.push("EMAIL_TEST_RECIPIENT is required in staging mode");

  const recipients: Partial<Record<FormId, string>> = {};
  for (const id of FORM_IDS) {
    const name = `EMAIL_TO_${id.toUpperCase()}`;
    const to = clean(env[name]);
    if (!to) continue;
    if (SINGLE_ADDRESS.test(to)) recipients[id] = to;
    else problems.push(`${name} is not a single email address — the ${id} form stays off`);
  }
  for (const name of ["EMAIL_TO_TRAVEL", "EMAIL_TO_NEWSLETTER", "NEWSLETTER_ENABLED"])
    if (clean(env[name])) problems.push(`${name} is ignored: that form is not enabled in the API`);

  const acknowledge: FormId[] = [];
  for (const entry of (clean(env.EMAIL_ACK_FORMS) ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    if (isFormId(entry)) acknowledge.push(entry);
    else problems.push("EMAIL_ACK_FORMS lists a form the API does not take — ignored");
  }

  const positive = (name: string, fallback: number) => {
    const raw = clean(env[name]);
    if (raw === null) return fallback;
    const value = Number(raw);
    if (Number.isInteger(value) && value > 0) return value;
    problems.push(`${name} must be a positive whole number — the default is used`);
    return fallback;
  };
  const rateLimit = { max: positive("FORMS_RATE_LIMIT_MAX", 5), windowMs: positive("FORMS_RATE_LIMIT_WINDOW_S", 600) * 1000 };

  return {
    /* A misconfigured deployment takes no submission rather than half-working. */
    mode: global.length ? "off" : mode,
    problems: [...global, ...problems],
    apiKey,
    from,
    recipients: global.length ? {} : recipients,
    acknowledge,
    testRecipient,
    rateLimit,
  };
}

/* Is this form taking submissions under this configuration? */
export const formEnabled = (config: FormsConfig, formId: string): formId is FormId =>
  config.mode !== "off" && isFormId(formId) && Boolean(config.recipients[formId]);
