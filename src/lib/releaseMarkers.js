/* Two different questions, both answered by matching patterns against
   what a build produces — Document 24 §18–19, as Document 27 redraws
   them. Plain data: it loads in the browser build, the SSR build and Node
   alike. Each entry is [rule name, pattern].

   CREDENTIALS is a SAFETY rule: a secret in a bundle is a defect at any
   stage, so it fails the content validator and the build.

   WORKING_MARKERS and PLACEHOLDER_CONTACT are a READINESS question, not a
   safety one. The site's normal working content is full of self-labelled
   placeholders — that is what lets `npm run dev` and `npm run build` show
   the whole site while RBB's own words are still being written — so
   finding them never fails a build. They are what
   scripts/release-status.mjs counts to decide whether the FINAL
   production content has been approved and put in
   (PRODUCTION-CONTENT-READY). */

/* The self-labelling that working placeholder content carries, and the
   fictional names it uses. Every one of these must be gone before
   release. */
export const WORKING_MARKERS = [
  ["demo text", /Demo text —/],
  ["demo summary", /Demo summary —/],
  ["demo prefix", /(^|[\s>(])Demo(nstration)? —/m],
  ["demo answer", /Demo answer —/],
  ["working text", /WORKING text —/],
  ["demo profile", /Demo profile/],
  ["demo figure", /\bdemo figure\b/i],
  ["demo location", /demo location/i],
  ["demo country", /Demo country [A-Z]\b/],
  ["demo author", /Demo Author/],
  ["demo quotation", /\(demo quotation\)/],
  ["demo document", /\(demo document\)/],
  ["demo role", /\(demo role\)/],
  ["fictional team name", /\b(Amara|Grace|Samuel|Leila|Daniel|Hannah) Demo\b/],
  ["demo address", /100 Demo Street|Demo City|Demo Country/],
];

/* Placeholder contact values that must be replaced before release. */
export const PLACEHOLDER_CONTACT = [
  ["example.* address or URL", /\b[\w.+-]*@?example\.(org|com|net)\b/i],
  ["fictional 555 phone number", /\+?1?[\s.-]?\(?555\)?[\s.-]?01\d\d\b/],
];

/* Credentials and test identifiers. Razorpay key ids are fetched from the
   server at run time and never belong in a bundle — test or live. */
export const CREDENTIALS = [
  ["Razorpay key id", /\brzp_(test|live)_[A-Za-z0-9]{6,}/],
  ["Resend API key", /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{8,}/],
  ["secret variable name", /RAZORPAY_(KEY|WEBHOOK)_SECRET|EMAIL_API_KEY|RESEND_API_KEY/],
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["Stripe-style secret key", /\bsk_(live|test)_[A-Za-z0-9]{10,}/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
];

