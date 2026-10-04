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
import { STATES, releaseState } from "./lib/release-state.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const meta = join(root, "build-meta");

const read = async (f) => JSON.parse(await readFile(join(meta, f), "utf8").catch(() => "null"));
const readiness = await read("readiness.json");
const contentReadiness = await read("content-readiness.json");
const revision = await read("build-revision.json");

const result = releaseState({ approvals: APPROVALS, evidence: EVIDENCE, readiness, contentReadiness, revision });
const { state, next, allBlockers: blockers } = result;
const report = { ...result, checkedAt: new Date().toISOString() };
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
