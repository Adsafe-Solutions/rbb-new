/* Release state — Document 24 §22. Combines what RBB has approved
   (release/approvals.mjs), which release tests have really been run, and
   what the latest build says about its own content
   (build-meta/readiness.json, content-readiness.json,
   build-revision.json), and reports:

     CONTENT-INCOMPLETE → PREVIEW-READY → PRODUCTION-CONTENT-READY
       → PRODUCTION-INTEGRATION-READY → RELEASE-READY

   There is one content source and one build (Document 27), so the
   question is no longer "is this a production build?" but "has the final
   production content replaced the working placeholders?" — which is what
   PRODUCTION-CONTENT-READY now means.

   with every blocker that stops the next state. An approval recorded
   while the content still says otherwise (e.g. impact "approved" but the
   figures still pending-review) is a blocker too: the record and the
   content must agree.

     npm run build && npm run release:status

   Writes build-meta/release-status.json. Exits 0; pass --require=STATE
   to exit 1 unless at least that state is reached (for CI). */
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { APPROVALS, EVIDENCE } from "../release/approvals.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const meta = join(root, "build-meta");
const STATES = [
  "CONTENT-INCOMPLETE",
  "PREVIEW-READY",
  "PRODUCTION-CONTENT-READY",
  "PRODUCTION-INTEGRATION-READY",
  "RELEASE-READY",
];
const read = async (f) => JSON.parse(await readFile(join(meta, f), "utf8").catch(() => "null"));

const readiness = await read("readiness.json");
const contentReadiness = await read("content-readiness.json");
const revision = await read("build-revision.json");
const approved = (k) => APPROVALS[k]?.status === "approved";
const passed = (k) => EVIDENCE[k]?.status === "passed";
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
    ["privacy", "terms", "accessibility"].every((p) => r.policiesPublished.includes(p)) ||
    "Privacy, Terms and Accessibility are not all published (content/policies.js)",
  forms: (r) =>
    Object.values(r.forms).some((s) => s === "ready") || "no form is enabled (content/forms.js + VITE_FORM_ENDPOINT_*)",
  donation: (r) =>
    r.donation.state === "approved-live" ||
    "donation page is not live (content/donation.js) — or record an approved decision to launch without online donations",
  infrastructure: (r) => r.siteOrigin || "VITE_SITE_URL (verified production origin) is not set",
};
const CONTENT_AREAS = ["coreIdentity", "impact", "financials", "programs", "team", "geography", "stories", "contact", "policies", "images"];
const INTEGRATION_AREAS = ["forms", "email", "donation", "infrastructure"];

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
    const check = readiness && CONTENT_CHECKS[k]?.(readiness);
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
const report = {
  state,
  next: next ?? null,
  blockersToNext: next ? blockers[next] : [],
  allBlockers: blockers,
  build: revision,
  checkedAt: new Date().toISOString(),
};
await writeFile(join(meta, "release-status.json"), JSON.stringify(report, null, 2) + "\n");

console.log(`Release state: ${state}`);
if (next) {
  console.log(`Blocking ${next} (${report.blockersToNext.length}):`);
  for (const b of report.blockersToNext) console.log(`  - ${b}`);
  const later = STATES.slice(STATES.indexOf(next) + 1).reduce((n, s) => n + blockers[s].length, 0);
  if (later) console.log(`…and ${later} further blocker(s) for the later states (build-meta/release-status.json).`);
}
if (revision) console.log(`Build: content revision ${revision.contentRevision}${revision.gitCommit ? `, commit ${revision.gitCommit}` : ""}${revision.uncommittedSourceChanges ? " (+ uncommitted changes)" : ""}`);

const required = process.argv.find((a) => a.startsWith("--require="))?.split("=")[1];
if (required && STATES.indexOf(state) < STATES.indexOf(required)) process.exit(1);
