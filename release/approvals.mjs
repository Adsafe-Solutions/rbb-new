/* RBB approval matrix and release evidence — Document 24 §22–23, §26.

   THE record of what Rising Beyond Borders has approved for production
   and which release tests have actually been run. `npm run
   release:status` reads it together with what the latest production build
   says about its own content (build-meta/readiness.json) and reports the
   release state. Technical tests alone never move the state past an
   approval that is missing here.

   How to record an approval: set `status: "approved"`, who approved it
   (`by`, a name or role — no personal contact details), the ISO `date`,
   and where the approved material lives (`ref`: a file, ticket or
   document name). Never put a credential, key or secret in this file.

   Nothing below is approved yet: no RBB-approved replacement content,
   credentials or provider configuration had been supplied as of
   2026-09-24. */

const pending = (what) => ({ status: "pending", by: null, date: null, ref: null, what });

export const APPROVALS = {
  coreIdentity: pending("Name, mission, vision and final positioning (the annual report wording is in place, awaiting RBB's confirmation)"),
  impact: pending("50K+ lives, 25 countries, 200+ partners & donors — and any other published figure"),
  financials: pending("2026 shares 78 / 12 / 10, and the actual reports and documents"),
  programs: pending("Final descriptions, projects and impact claims for the four programs"),
  team: pending("Names, roles, bios, photographs (with consent) and governance"),
  geography: pending("Countries and locations actually served"),
  stories: pending("Final text, quotes, authors, dates and imagery"),
  contact: pending("Email, phone, office, social accounts, hours and response time"),
  forms: pending("Fields, consent wording, recipients, acknowledgement and success/error wording"),
  donation: pending("Currency, amounts, donor fields, donor wording, Razorpay account settings (or: launch without online donations)"),
  email: pending("From domain and sender, recipients, newsletter confirmation and unsubscribe process"),
  policies: pending("Privacy, Terms, Accessibility, and a decision on Cookies"),
  images: pending("Ownership, licences and permissions for every published image (docs/IMAGE_INVENTORY.md)"),
  infrastructure: pending("Domain, host, HTTPS, redirects, headers, and any scripts the host adds"),
};

/* Release tests that need real providers. "passed" only after the test
   was actually run against the named environment, with a `ref` to its
   record. */
const notRun = (what) => ({ status: "not-run", date: null, ref: null, what });

export const EVIDENCE = {
  previewQa: {
    status: "passed",
    date: "2026-09-24",
    ref: "Documents 23/27 QA: build, hydration, CSP, axe, responsive, forms (test mode), donation states (stand-in Razorpay)",
    what: "Complete site experience verified on a local/preview build",
  },
  resendStagingDelivery: notRun("Real email delivery in EMAIL_MODE=staging through a verified Resend domain"),
  razorpayTestE2E: notRun("Real Razorpay TEST-mode payments: card, UPI, netbanking, 3-D Secure; success, failure, cancel"),
  razorpayWebhookTest: notRun("Real TEST webhook deliveries: signature, idempotency, redelivery"),
  razorpayCspReverified: notRun("Checkout CSP re-verified in report-only mode with test keys (docs/DONATIONS.md)"),
  liveCredentialsConfigured: notRun("Live Razorpay and Resend credentials stored in the host's secrets (never in the repo)"),
  hostHeadersVerified: notRun("Security headers, HTTPS, redirects and 404 verified on the production host"),
  /* Document 26 — the real host. Record the URL tested in `ref`. */
  previewSmoke: notRun("Preview deployment of the release artifact: `npm run smoke -- --url=<preview> --expect=preview --origin=<production>` + --browser"),
  hostTechnologyAudit: notRun("scripts/audit-technology.mjs against the real host: cookies, storage, injected scripts, third parties"),
  productionSmoke: notRun("After DNS cutover: `npm run smoke -- --url=https://<domain>` + --browser, release digest recorded"),
  finalQa: notRun("Full Document 24 §21 QA matrix on the frozen release candidate"),
  /* Content freeze (§23): the contentRevision of the approved release
     candidate (build-meta/build-revision.json). A later build with a
     different revision needs validation and QA again. */
  contentFreeze: { status: "not-started", date: null, contentRevision: null, what: "Content frozen after RBB approves the release candidate" },
};
