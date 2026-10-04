/* The release state — Document 24 §22 — as a function, so the two
   release commands share ONE calculation: `npm run release:status` (the
   progress view: which state the project has reached) and `npm run
   release:check` (the final gate: is this build READY or BLOCKED). Moved
   here unchanged from scripts/release-status.mjs. */
export const STATES = [
  "CONTENT-INCOMPLETE",
  "PREVIEW-READY",
  "PRODUCTION-CONTENT-READY",
  "PRODUCTION-INTEGRATION-READY",
  "RELEASE-READY",
];
const ok = (s) => ["verified", "approved"].includes(s);

/* What the content itself must show for each approval to be credible. */
const CONTENT_CHECKS = {
  impact: (r) => r.impactFigures.every((m) => ok(m.status)) || "impact figures are still pending-review in content/impact.js",
  financials: (r) =>
    (ok(r.financialOverview) && r.documents.annualReports > 0) ||
    "financial overview not verified, or no approved annual report file (content/transparency.js)",
  programs: (r) => r.programsWithDetail === 4 || `only ${r.programsWithDetail}/4 programs have approved detail (content/work.js)`,
  team: (r) => r.team > 0 || "no approved team members (content/team.js)",
  geography: (r) => ok(r.geography) || "no verified geography (content/impact.js)",
  stories: (r) => r.stories > 0 || "no approved stories (content/stories.js)",
  contact: (r) => r.contactMethods > 0 || "no verified contact method (content/contact.js)",
  policies: (r) =>
    ["privacy", "terms"].every((p) => r.policiesPublished.includes(p)) ||
    "Privacy and Terms are not both published (content/policies.js)",
  /* `decided`: the area is approved in release/approvals.mjs. Forms off,
     or donations not live, is then an APPROVED launch decision (decision
     register D21 / D31), not missing work. Without that approval both
     still block. */
  forms: (r, decided) =>
    Object.values(r.forms).some((s) => s === "ready") ||
    decided ||
    "no form is enabled (content/forms.js + VITE_FORM_ENDPOINT_*) — or approve launching with forms off",
  donation: (r, decided) =>
    r.donation.state === "approved-live" ||
    decided ||
    "donation page is not live (content/donation.js) — or record an approved decision to launch without online donations",
  infrastructure: (r) => r.siteOrigin || "VITE_SITE_URL (verified production origin) is not set",
};
const CONTENT_AREAS = ["coreIdentity", "impact", "financials", "programs", "team", "geography", "stories", "contact", "policies", "images"];
const INTEGRATION_AREAS = ["forms", "email", "donation", "infrastructure"];

export const CONTENT_AREA_KEYS = CONTENT_AREAS;
export const INTEGRATION_AREA_KEYS = INTEGRATION_AREAS;

export function releaseState({ approvals, evidence, readiness, contentReadiness, revision }) {
  const APPROVALS = approvals;
  const EVIDENCE = evidence;
  const approved = (k) => APPROVALS[k]?.status === "approved";
  const passed = (k) => EVIDENCE[k]?.status === "passed";
  const blockers = { "PREVIEW-READY": [], "PRODUCTION-CONTENT-READY": [], "PRODUCTION-INTEGRATION-READY": [], "RELEASE-READY": [] };
  if (!passed("previewQa")) blockers["PREVIEW-READY"].push("QA of the complete site has not passed (EVIDENCE.previewQa)");

  if (!readiness) blockers["PRODUCTION-CONTENT-READY"].push("no build to assess — run `npm run build` first");

  /* Document 27: working placeholder content is normal while the site is
     being built and never fails a build — but none of it may survive into
     the release. scripts/production-gate.mjs finds it in the output. */
  if (!contentReadiness)
    blockers["PRODUCTION-CONTENT-READY"].push("no content-readiness scan — run `npm run build` first");
  else if (contentReadiness.placeholders > 0)
    blockers["PRODUCTION-CONTENT-READY"].push(
      `working placeholder content is still published in ${contentReadiness.files.length} file(s): ${contentReadiness.rules.join(", ")} — replace it with Rising Beyond Borders' final content`
    );
  const areaBlockers = (areas, target) => {
    for (const k of areas) {
      if (!approved(k)) blockers[target].push(`RBB approval missing — ${k}: ${APPROVALS[k].what}`);
      const check = readiness && CONTENT_CHECKS[k]?.(readiness, approved(k));
      if (readiness && check !== undefined && check !== true)
        blockers[target].push(`${approved(k) ? "approved but " : ""}content not ready — ${k}: ${check}`);
    }
  };
  areaBlockers(CONTENT_AREAS, "PRODUCTION-CONTENT-READY");
  areaBlockers(INTEGRATION_AREAS, "PRODUCTION-INTEGRATION-READY");
  for (const k of ["resendStagingDelivery", "razorpayTestE2E", "razorpayWebhookTest", "razorpayCspReverified", "liveCredentialsConfigured", "hostHeadersVerified", "previewSmoke", "hostTechnologyAudit"])
    if (!passed(k)) blockers["PRODUCTION-INTEGRATION-READY"].push(`not done — ${EVIDENCE[k].what}`);
  if (!passed("finalQa")) blockers["RELEASE-READY"].push(`not done — ${EVIDENCE.finalQa.what}`);
  if (!passed("productionSmoke")) blockers["RELEASE-READY"].push(`not done — ${EVIDENCE.productionSmoke.what}`);
  const freeze = EVIDENCE.contentFreeze;
  if (freeze.status !== "frozen") blockers["RELEASE-READY"].push("content freeze not recorded (EVIDENCE.contentFreeze)");
  else if (revision && freeze.contentRevision !== revision.contentRevision)
    blockers["RELEASE-READY"].push(
      `content changed after the freeze (frozen ${freeze.contentRevision}, built ${revision.contentRevision}) — re-run validation and QA`
    );

  /* The state is the last one whose own blockers AND every earlier one's
     are clear. */
  let state = "CONTENT-INCOMPLETE";
  for (const s of STATES.slice(1)) {
    if (blockers[s].length) break;
    state = s;
  }
  const next = STATES[STATES.indexOf(state) + 1];
  return {
    state,
    next: next ?? null,
    blockersToNext: next ? blockers[next] : [],
    allBlockers: blockers,
    build: revision,
  };
}
