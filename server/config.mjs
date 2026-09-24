/* Server-side configuration for the submission endpoint — Document 21.

   Read ONLY from the server/runtime environment, never from a VITE_*
   variable or anything under src/ (those ship to every browser). Nothing
   here is ever returned in a response or written to a log.

   Variables (names only — values live in the host's secret store):
     EMAIL_API_KEY            Resend API key. SECRET. A sending-access key
                              restricted to the verified domain.
                              (RESEND_API_KEY is accepted as an alias for
                              platforms that name it that way.)
     EMAIL_MODE               off | test | staging | live   (default: off)
                                off      — the endpoint accepts nothing
                                test     — validates and renders, sends
                                           NOTHING (emails are captured
                                           in memory for tests/dev)
                                staging  — sends via Resend, but EVERY
                                           recipient is replaced by
                                           EMAIL_TEST_RECIPIENT and the
                                           subject is marked [TEST]
                                live     — production
     EMAIL_FROM               the approved From, e.g. "Rising Beyond
                              Borders <forms@verified-domain>"
     EMAIL_TO_CONTACT         approved RBB recipient per form
     EMAIL_TO_VOLUNTEER
     EMAIL_TO_PARTNER
     EMAIL_TO_FUNDRAISE
     EMAIL_TO_NEWSLETTER      where sign-ups are notified (subscriber
                              management is still an open RBB decision)
     EMAIL_ACK_FORMS          comma list of forms that send the submitter
                              an acknowledgement (default: none)
     NEWSLETTER_ENABLED       true only once consent wording, unsubscribe
                              handling and subscriber management exist
     EMAIL_TEST_RECIPIENT     staging only: the one inbox that receives
     ALLOWED_ORIGIN           the site's origin; requests from any other
                              Origin are refused
     RATE_LIMIT_MAX           submissions per window per client+form (5)
     RATE_LIMIT_WINDOW_S      window length in seconds (600)
     RATE_LIMIT_STORE         memory (default) | shared — see rate-limit.mjs
     RATE_LIMIT_SINGLE_INSTANCE  true only for one long-lived process

   A form is available only when the mode is not "off" AND it has an
   approved recipient; "live" additionally needs a key and a From on a
   real domain. */

import { rateLimitSettings } from "./rate-limit.mjs";

export const FORM_IDS = ["contact", "volunteer", "partner", "fundraise", "newsletter"];
const MODES = ["off", "test", "staging", "live"];
const SINGLE_ADDRESS = /^[^\s@,;<>"'()]+@[^\s@,;<>"'()]+\.[^\s@,;<>"'()]{2,}$/;
/* "Name <address>" or a bare address, on one line. */
const FROM_PATTERN =
  /^(?:[^<>\r\n"]{1,80}\s<)?[^\s@,;<>"'()]+@[^\s@,;<>"'()]+\.[^\s@,;<>"'()]{2,}>?$/;
const TEMPORARY_SENDERS = /@resend\.dev>?$/i;

const clean = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function loadConfig(env = process.env) {
  const problems = [];
  const mode = MODES.includes(clean(env.EMAIL_MODE)) ? clean(env.EMAIL_MODE) : "off";
  const apiKey = clean(env.EMAIL_API_KEY) ?? clean(env.RESEND_API_KEY);
  const from = clean(env.EMAIL_FROM);

  const recipients = {};
  for (const id of FORM_IDS) {
    const to = clean(env[`EMAIL_TO_${id.toUpperCase()}`]);
    if (to && !SINGLE_ADDRESS.test(to))
      problems.push(`EMAIL_TO_${id.toUpperCase()} is not a single email address`);
    recipients[id] = to && SINGLE_ADDRESS.test(to) ? to : null;
  }

  const testRecipient = clean(env.EMAIL_TEST_RECIPIENT);
  if (mode === "live" || mode === "staging") {
    if (!apiKey) problems.push("EMAIL_API_KEY is not set");
    if (!from || !FROM_PATTERN.test(from))
      problems.push("EMAIL_FROM is missing or not a valid From");
    else if (mode === "live" && TEMPORARY_SENDERS.test(from))
      problems.push(
        "EMAIL_FROM uses a temporary resend.dev sender, not allowed in live mode"
      );
  }
  if (mode === "staging" && !(testRecipient && SINGLE_ADDRESS.test(testRecipient)))
    problems.push("EMAIL_TEST_RECIPIENT is required in staging mode");

  const ack = new Set(
    (clean(env.EMAIL_ACK_FORMS) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => FORM_IDS.includes(s))
  );
  const positive = (v, d) =>
    Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d;

  return {
    /* A misconfigured deployment behaves as "off" rather than half-working. */
    mode: problems.length ? "off" : mode,
    problems,
    apiKey,
    from,
    recipients,
    acknowledge: (formId) => ack.has(formId),
    newsletterEnabled: clean(env.NEWSLETTER_ENABLED) === "true",
    testRecipient,
    allowedOrigin: clean(env.ALLOWED_ORIGIN),
    rateLimit: {
      ...rateLimitSettings(env),
      max: positive(env.RATE_LIMIT_MAX, 5),
      windowMs: positive(env.RATE_LIMIT_WINDOW_S, 600) * 1000,
    },
  };
}

/* Is this form accepting submissions under this configuration? */
export function formAvailable(config, formId) {
  if (config.mode === "off" || !FORM_IDS.includes(formId)) return false;
  if (!config.recipients[formId]) return false;
  if (formId === "newsletter" && !config.newsletterEnabled) return false;
  return true;
}
