/* npm run release:check — THE final production gate.

   Answers one question about THIS build and THIS production environment:
   is it safe and ready to deploy publicly? Prints READY or BLOCKED, with
   every blocker as WHAT / WHY / WHAT IS NEEDED, by category, writes
   build-meta/release-check.json, and exits 0 only when READY.

     npm run release:check                       build, test, then check
     npm run release:check -- --env-file=<file>  check against the production
                                                 SERVER environment in <file>
                                                 (values are read, never printed)
     npm run release:check -- --url=https://…    also run the browser smoke test
                                                 against that deployment
     npm run release:check -- --skip-build       check the existing artifact
                                                 only (never READY: the build
                                                 and tests were not verified)

   The build uses the environment the command runs in — run it with the
   production VITE_* variables (VITE_SITE_URL, form endpoints, donations
   API) exactly as the release will be built.

   Fails closed: what it cannot confirm is a blocker. It reads the RBB
   approval record (release/approvals.mjs) and never changes it, and it
   never touches git. `npm run release:status` remains the progress view
   (which release state the project has reached); this is the go / no-go. */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { APPROVALS, EVIDENCE } from "../release/approvals.mjs";
import { productionGate } from "./production-gate.mjs";
import { CATEGORIES, evaluateRelease } from "./lib/release-checks.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const meta = join(root, "build-meta");
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? null;
const skipBuild = process.argv.includes("--skip-build");

/* ---------------- 1. Build and test (unless --skip-build) ---------------- */
const run = (label, script) => {
  console.log(`\n▸ ${label}`);
  const r = spawnSync("npm", ["run", "--silent", script], { cwd: root, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
  const out = `${r.stdout}${r.stderr}`.trim().split("\n");
  console.log(out.slice(-4).map((l) => `  ${l}`).join("\n"));
  return r.status === 0 ? "pass" : "fail";
};
const tests = skipBuild
  ? { build: "skipped", validate: "skipped", release: "skipped", server: "skipped" }
  : {
      build: run("Build and prerender", "build"),
      validate: run("Content validation", "validate:content"),
      release: run("Release tests", "test:release"),
      server: run("Server tests", "test:server"),
    };

/* ---------------- 2. The artifact ---------------- */
const readJson = (f) => {
  try {
    return JSON.parse(readFileSync(join(meta, f), "utf8"));
  } catch {
    return null;
  }
};
const walk = (dir) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : [relative(dist, join(dir, e.name))]
      )
    : [];
const files = walk(dist);
const text = new Map(
  files.filter((f) => /\.(html|xml|txt)$/.test(f)).map((f) => [f, readFileSync(join(dist, f), "utf8")])
);
const size = (re) => files.filter((f) => re.test(f)).reduce((n, f) => n + statSync(join(dist, f)).size, 0);
const gz = (re) => files.filter((f) => re.test(f)).reduce((n, f) => n + gzipSync(readFileSync(join(dist, f))).length, 0);
const routes = readJson("routes.json") ?? [];

/* ---------------- 3. The production server environment ---------------- */
/* Values are only ever passed to the server's own config loaders, which
   test them; nothing here prints one. */
const envFile = arg("env-file");
const env = envFile ? { ...parseEnv(readFileSync(resolve(envFile), "utf8")) } : { ...process.env };

/* ---------------- 4. Browser smoke against a deployment (optional) ---------------- */
let smoke = null;
const url = arg("url");
if (url) {
  console.log(`\n▸ Browser smoke test — ${url}`);
  const r = spawnSync("npx", ["-y", "-p", "playwright", "node", "scripts/smoke-test.mjs", `--url=${url}`, "--expect=production", "--browser"], {
    cwd: root,
    encoding: "utf8",
  });
  const out = `${r.stdout}${r.stderr}`.trim().split("\n");
  const failures = out.filter((l) => l.startsWith("✗"));
  console.log(out.filter((l) => l.startsWith("✗") || /passed$/.test(l)).map((l) => `  ${l}`).join("\n"));
  smoke = { url, ok: r.status === 0, summary: failures.slice(0, 5).join(" | ") || `exit ${r.status}` };
}

/* ---------------- 5. Evaluate ---------------- */
const report = evaluateRelease({
  approvals: APPROVALS,
  evidence: EVIDENCE,
  meta: {
    readiness: readJson("readiness.json"),
    contentReadiness: readJson("content-readiness.json"),
    revision: readJson("build-revision.json"),
    routes,
    redirects: readJson("redirects.json") ?? [],
    seoRoutes: readJson("seo-routes.json") ?? [],
    securityHeaders: readJson("security-headers.json"),
  },
  dist: { files, text },
  env,
  tests,
  smoke,
  safetyProblems: existsSync(dist) ? await productionGate(dist, { routes }) : [],
  performance: { js: size(/\.js$/), jsGzip: gz(/\.js$/), css: size(/\.css$/), cssGzip: gz(/\.css$/) },
});

/* ---------------- 6. Report ---------------- */
const revision = readJson("build-revision.json");
const record = {
  checkedAt: new Date().toISOString(),
  build: revision,
  result: report.result,
  blockerCount: report.blockerCount,
  releaseState: report.releaseState,
  categories: report.categories,
  routeCount: routes.length,
  placeholders: readJson("content-readiness.json")?.placeholders ?? null,
  environmentChecked: envFile ? "env-file" : "process environment",
  deploymentSmoke: smoke ? { url: smoke.url, ok: smoke.ok } : null,
  results: report.results,
};
writeFileSync(join(meta, "release-check.json"), JSON.stringify(record, null, 2) + "\n");

const icon = { pass: "✓", warning: "!", blocked: "✗" };
console.log("\n════════════════════════════════════════════");
console.log(" RBB PRODUCTION RELEASE CHECK");
console.log(`  build ${revision?.contentRevision ?? "?"} · commit ${revision?.gitCommit ?? "?"}${revision?.uncommittedSourceChanges ? " (+ uncommitted)" : ""}`);
console.log("════════════════════════════════════════════");
for (const c of CATEGORIES) {
  const mine = report.results.filter((r) => r.category === c);
  if (!mine.length) continue;
  console.log(`\n${c} — ${report.categories[c]}`);
  for (const r of mine) {
    console.log(`  ${icon[r.status]} ${r.what}`);
    if (r.status === "blocked") {
      console.log(`      why:    ${r.why}`);
      console.log(`      needed: ${r.need}`);
      if (r.affected?.length) console.log(`      pages:  ${r.affected.slice(0, 6).join(", ")}${r.affected.length > 6 ? `, +${r.affected.length - 6} more` : ""}`);
      if (r.files?.length) console.log(`      files:  ${r.files.slice(0, 12).join(", ")}${r.files.length > 12 ? `, +${r.files.length - 12} more` : ""}`);
    } else if (r.status === "warning") console.log(`      ${r.why}`);
  }
}
console.log("\n════════════════════════════════════════════");
console.log(` RESULT: ${report.result}${report.blockerCount ? ` — ${report.blockerCount} blocker(s)` : ""}`);
console.log("  (build-meta/release-check.json)");
console.log("════════════════════════════════════════════\n");
process.exit(report.result === "READY" ? 0 : 1);
