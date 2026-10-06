/* Package the production release artifact — Document 25 §11, §13.

   Turns a finished PRODUCTION build into one immutable, identifiable file
   that is what gets deployed — and what gets redeployed to roll back:

     release-artifacts/rbb-<contentRevision>-<commit>.tar.gz
       dist/                        the site, exactly as built
       deploy/redirects.json        permanent redirects for the host
       deploy/security-headers.json headers for the host
       deploy/routes.json           the valid routes (everything else 404)
       deploy/build-revision.json   content revision + commit
       deploy/artifact-manifest.json sha256 of every file + one digest

     npm run build && npm run release:status && npm run release:package

   The manifest's `digest` identifies the artifact. Two builds of the same
   commit and content produce the same digest (the build is deterministic:
   content-hashed file names, no timestamps in the output), so "is this
   the approved candidate?" is a comparison, not a judgement.

   Contains no secret: dist/ has passed the
   release gate, and server configuration never enters it. release-
   artifacts/ is git-ignored — keep the files in the host's or the team's
   release storage, at least the current and previous known-good ones. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const meta = join(root, "build-meta");
const read = (f) => JSON.parse(readFileSync(join(meta, f), "utf8"));

const revision = read("build-revision.json");
/* One content source and one build (Document 27), so there is no build
   mode to refuse. Whether the build carries RBB's FINAL content is a
   release-state question — `npm run release:status` answers it, and the
   packaged manifest records what the scan found. */
const contentReadiness = read("content-readiness.json");
if (contentReadiness.placeholders > 0)
  console.warn(
    `⚠ this build still carries working placeholder content (${contentReadiness.rules.join(", ")}) — see npm run release:status`
  );

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = walk(dist).sort();
const manifest = {
  revision,
  contentPlaceholders: contentReadiness.placeholders,
  files: Object.fromEntries(
    files.map((f) => [relative(dist, f), createHash("sha256").update(readFileSync(f)).digest("hex")])
  ),
};
manifest.fileCount = files.length;
manifest.digest = createHash("sha256")
  .update(Object.entries(manifest.files).map(([f, h]) => `${f} ${h}`).join("\n"))
  .digest("hex")
  .slice(0, 16);
writeFileSync(join(meta, "artifact-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

if (process.argv.includes("--manifest-only")) {
  console.log(`artifact digest ${manifest.digest} (${files.length} files) — build-meta/artifact-manifest.json`);
  process.exit(0);
}

const name = `rbb-${revision.contentRevision}-${revision.gitCommit ?? "nocommit"}${revision.uncommittedSourceChanges ? "-dirty" : ""}`;
const stage = mkdtempSync(join(tmpdir(), "rbb-release-"));
execFileSync("cp", ["-R", dist, join(stage, "dist")]);
mkdirSync(join(stage, "deploy"));
for (const f of ["redirects.json", "security-headers.json", "routes.json", "build-revision.json", "artifact-manifest.json"])
  copyFileSync(join(meta, f), join(stage, "deploy", f));
const outDir = join(root, "release-artifacts");
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `${name}.tar.gz`);
if (existsSync(out)) rmSync(out);
execFileSync("tar", ["-czf", out, "-C", stage, "dist", "deploy"]);
rmSync(stage, { recursive: true, force: true });
console.log(`✓ ${relative(root, out)}\n  artifact digest ${manifest.digest}, ${files.length} files, content revision ${revision.contentRevision}${revision.uncommittedSourceChanges ? "\n  ⚠ built with uncommitted source changes — commit before packaging a real release" : ""}`);
