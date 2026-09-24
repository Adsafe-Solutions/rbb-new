/* Donation configuration — Document 22 §3, §16. Read ONLY from the
   server/runtime environment. Nothing here is a VITE_* variable, nothing
   is bundled for the browser, nothing is logged.

   Variables (names only — values live in the host's secret store):
     DONATION_ENABLED         "true" to accept donations at all (default off)
     RAZORPAY_MODE            test | live — no default. Anything else: off
     RAZORPAY_KEY_ID          the Checkout key id. Public by design (the
                              browser needs it), but it must MATCH the mode:
                              rzp_test_… in test, rzp_live_… in live
     RAZORPAY_KEY_SECRET      SECRET. Creates orders, verifies payments
     RAZORPAY_WEBHOOK_SECRET  SECRET. Verifies webhook signatures. Set a
                              DIFFERENT one on the test and live webhooks
     DONATION_CURRENCY        the approved ISO code — no default, ever
     DONATION_MIN_AMOUNT      approved minimum, as a decimal ("100.00")
     DONATION_MAX_AMOUNT      approved maximum
     DONATION_ALLOWED_AMOUNTS optional approved presets, comma-separated,
                              no thousands separators ("500,1000,2500")
     DONATION_CUSTOM_AMOUNT   "true" to let a donor type an amount
     DONATION_EMAIL_ENABLED   "true" to send donation emails (Document 21's
                              EMAIL_MODE / EMAIL_API_KEY / EMAIL_FROM apply)
     EMAIL_TO_DONATIONS       the approved RBB inbox for notifications
     DONATION_DONOR_EMAILS    which donor emails are approved to send:
                              any of success,processing,failed,refunded
                              (default none — the wording is PROPOSED)
     ALLOWED_ORIGIN           shared with the form endpoint

   FAIL CLOSED: any problem — a missing secret, a key id from the other
   mode, no currency, bounds that make no sense — and donations are OFF.
   There is NO fallback from live to test or back: the mode is what
   RAZORPAY_MODE says, and a key from the other mode is an error, not a
   hint. */
import { currencyExponent, isCurrencyCode, toMinorUnits } from "../../src/lib/money.js";
import { rateLimitSettings } from "../rate-limit.mjs";

const clean = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
const SINGLE_ADDRESS = /^[^\s@,;<>"'()]+@[^\s@,;<>"'()]+\.[^\s@,;<>"'()]{2,}$/;
const KEY_PREFIX = { test: "rzp_test_", live: "rzp_live_" };
export const DONOR_EMAILS = ["success", "processing", "failed", "refunded"];

export function loadDonationConfig(env = process.env) {
  const problems = [];
  const enabled = clean(env.DONATION_ENABLED) === "true";
  const mode = clean(env.RAZORPAY_MODE);
  const keyId = clean(env.RAZORPAY_KEY_ID);
  const keySecret = clean(env.RAZORPAY_KEY_SECRET);
  const webhookSecret = clean(env.RAZORPAY_WEBHOOK_SECRET);

  if (enabled) {
    if (!KEY_PREFIX[mode]) problems.push("RAZORPAY_MODE must be test or live");
    else if (!keyId || !keyId.startsWith(KEY_PREFIX[mode]))
      problems.push(`RAZORPAY_KEY_ID is missing or is not a ${mode} key`);
    if (!keySecret) problems.push("RAZORPAY_KEY_SECRET is not set");
    if (!webhookSecret) problems.push("RAZORPAY_WEBHOOK_SECRET is not set");
  }

  const currency = clean(env.DONATION_CURRENCY);
  const currencyOk = isCurrencyCode(currency);
  if (enabled && !currencyOk) problems.push("DONATION_CURRENCY is missing or not an ISO code");
  const exponent = currencyOk ? currencyExponent(currency) : null;

  const amount = (name) => (currencyOk ? toMinorUnits(clean(env[name]) ?? "", exponent) : null);
  const min = amount("DONATION_MIN_AMOUNT");
  const max = amount("DONATION_MAX_AMOUNT");
  /* Comma-separated plain amounts, no thousands separators: "500,1000". */
  const presetsRaw = (clean(env.DONATION_ALLOWED_AMOUNTS) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const presets = currencyOk ? presetsRaw.map((p) => toMinorUnits(p, exponent)) : [];
  const custom = clean(env.DONATION_CUSTOM_AMOUNT) === "true";

  if (enabled && currencyOk) {
    if (!min || min < 1) problems.push("DONATION_MIN_AMOUNT is missing or invalid");
    if (!max || (min && max < min)) problems.push("DONATION_MAX_AMOUNT is missing or below the minimum");
    if (presets.some((p) => p === null)) problems.push("DONATION_ALLOWED_AMOUNTS has an invalid amount");
    else if (min && max && presets.some((p) => p < min || p > max))
      problems.push("DONATION_ALLOWED_AMOUNTS has an amount outside the minimum/maximum");
    if (!presets.length && !custom)
      problems.push("no amounts: set DONATION_ALLOWED_AMOUNTS or DONATION_CUSTOM_AMOUNT=true");
  }

  const notifyTo = clean(env.EMAIL_TO_DONATIONS);
  if (notifyTo && !SINGLE_ADDRESS.test(notifyTo))
    problems.push("EMAIL_TO_DONATIONS is not a single email address");
  const donorEmails = new Set(
    (clean(env.DONATION_DONOR_EMAILS) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => DONOR_EMAILS.includes(s))
  );
  const positive = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);

  const on = enabled && problems.length === 0;
  return {
    /* "off" unless everything above holds — never half-working. */
    mode: on ? mode : "off",
    problems,
    keyId: on ? keyId : null,
    keySecret: on ? keySecret : null,
    webhookSecret: on ? webhookSecret : null,
    currency: on ? currency : null,
    exponent: on ? exponent : null,
    min: on ? min : null,
    max: on ? max : null,
    /* Sorted, de-duplicated. */
    presets: on ? [...new Set(presets)].sort((a, b) => a - b) : [],
    custom: on && custom,
    email: {
      enabled: clean(env.DONATION_EMAIL_ENABLED) === "true",
      notifyTo: notifyTo && SINGLE_ADDRESS.test(notifyTo) ? notifyTo : null,
      donor: (kind) => donorEmails.has(kind),
    },
    allowedOrigin: clean(env.ALLOWED_ORIGIN),
    rateLimit: {
      ...rateLimitSettings(env),
      max: positive(env.RATE_LIMIT_MAX, 5),
      windowMs: positive(env.RATE_LIMIT_WINDOW_S, 600) * 1000,
    },
  };
}

/* What the browser may know: the public key id, the mode (so a test
   checkout can say so) and the approved amount rules. Nothing secret. */
export const publicDonationConfig = (config) => ({
  mode: config.mode,
  keyId: config.keyId,
  currency: config.currency,
  exponent: config.exponent,
  min: config.min,
  max: config.max,
  presets: config.presets,
  custom: config.custom,
});
