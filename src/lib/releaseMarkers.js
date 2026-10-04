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
  /* "Demo — …", and the variants the working copy also uses: one word
     after it ("Demo consent —", "Demo confirmation —", "Demo Partner —"),
     or a colon ("Demo: …"); at a line start, after a tag, a bracket, a
     space or an opening quote (a record read as JSON). */
  ["demo prefix", /(^|[\s>("])Demo(nstration)?( [A-Za-z]+)?( —|:)/m],
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
  /* The visible labels sample records carry (content/work.js,
     stories.js, team.js): one plain label per record instead of "demo"
     on every line, so the preview reads as editorial — and the release
     scan still finds every one. */
  ["sample project", /\bSample project\b/],
  ["sample story", /\bSample story\b/],
  ["sample profile", /\bSample profile\b/],
  ["sample video", /\bSample video\b/],
  ["sample event", /\bSample event\b/],
];

/* Placeholder contact values that must be replaced before release. */
export const PLACEHOLDER_CONTACT = [
  ["example.* address or URL", /\b[\w.+-]*@?example\.(org|com|net)\b/i],
  ["fictional 555 phone number", /\+?1?[\s.-]?\(?555\)?[\s.-]?01\d\d\b/],
  /* A social link that is only the platform's home page — a stand-in, not
     an RBB account. An account URL ("…/risingbeyondborders") never matches. */
  ["platform home page as social link", /https?:\/\/(www\.)?(instagram|facebook|linkedin|youtube|x|twitter|tiktok)\.com\/?(?=["'\s<)]|$)/],
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


/* A working placeholder PHOTOGRAPH, by its file name (`demo-*.jpg`) —
   the same rule the readiness scan applies to the build output, here for
   content records, whose image paths carry the name. */
export const WORKING_PHOTOGRAPH = /(^|\/)demo-[\w-]+\.(jpg|jpeg|png|webp)/;

/* Which placeholder rules a piece of content trips — a record, a policy,
   a rendered page — as rule names, empty when there are none.

   This is how the SEO rules (content/seo.js) and the policy pages tell
   WORKING content from final content WITHOUT a second status field: the
   records' own `status: "approved"` only means "renders" (Document 27),
   and the self-labelling below is what actually marks a placeholder.
   "name@example.com" is the email field's format hint, never a finding
   (scripts/production-gate.mjs drops it the same way). */
export function workingContentFindings(value) {
  const text = (typeof value === "string" ? value : JSON.stringify(value ?? "")).replaceAll("name@example.com", "");
  const found = [...WORKING_MARKERS, ...PLACEHOLDER_CONTACT].filter(([, re]) => re.test(text)).map(([rule]) => rule);
  if (WORKING_PHOTOGRAPH.test(text)) found.push("working placeholder photograph");
  return found;
}

export const isWorkingContent = (value) => workingContentFindings(value).length > 0;
