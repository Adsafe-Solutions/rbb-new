import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BUILD_COMMAND, PAGES_BRANCH, PAGES_PROJECT, PRODUCTION_SITE_ORIGIN, PRODUCTION_SNAPSHOT_URL, VITE_ENV_FILES, artifactProblems, describeEnv, envFileKeys, preflightProblems, wranglerArgs } from "../deploy-pages.mjs";

/* The terminal deployment to Cloudflare Pages (scripts/deploy-pages.mjs):
   every check that keeps an unsafe deployment from happening, as plain
   functions. Nothing here builds or deploys. */

const OK_ENV = { RBB_SNAPSHOT_URL: PRODUCTION_SNAPSHOT_URL, RBB_SNAPSHOT_REQUIRED: "1", RBB_SNAPSHOT_RUNTIME: "on" };
const OK_GIT = { branch: "main", dirty: [], head: "a".repeat(40), upstream: "a".repeat(40), subject: "feat: x" };
const problems = (env = {}, git = {}, envFiles = []) => preflightProblems({ env: { ...OK_ENV, ...env }, git: { ...OK_GIT, ...git }, envFiles });

test("the fixed facts: the one project and branch, the production endpoint and origin, the Pages build command", () => {
  assert.equal(PAGES_PROJECT, "rbb-web");
  assert.equal(PAGES_BRANCH, "main");
  assert.equal(PRODUCTION_SNAPSHOT_URL, "https://api.risingbeyondborders.org/api/v1/public/snapshot");
  assert.equal(PRODUCTION_SITE_ORIGIN, "https://prod.risingbeyondborders.org");
  assert.deepEqual(BUILD_COMMAND, ["pnpm", ["--filter", "@rbb/web", "run", "build"]]);
  assert.deepEqual(VITE_ENV_FILES, [".env", ".env.local", ".env.production", ".env.production.local"]);
});

test("preflight passes only for the exact production configuration on a clean, pushed main", () => {
  assert.deepEqual(problems(), []);
  assert.deepEqual(problems({ VITE_SITE_URL: PRODUCTION_SITE_ORIGIN, VITE_ENVIRONMENT: "prod", RBB_SNAPSHOT_VERSION: "8", CLOUDFLARE_API_TOKEN: "t", CLOUDFLARE_ACCOUNT_ID: "a" }), []);
});

test("preflight: the snapshot configuration — production endpoint only, required, runtime explicitly on, never off or a preview", () => {
  assert.match(problems({ RBB_SNAPSHOT_URL: "http://localhost:4000/api/v1/public/snapshot" }).join(), /exactly the production snapshot endpoint/);
  assert.match(problems({ RBB_SNAPSHOT_URL: undefined }).join(), /exactly the production snapshot endpoint/);
  assert.match(problems({ RBB_SNAPSHOT_URL: `${PRODUCTION_SNAPSHOT_URL}/` }).join(), /exactly the production snapshot endpoint/);
  assert.match(problems({ RBB_SNAPSHOT_REQUIRED: "" }).join(), /RBB_SNAPSHOT_REQUIRED must be 1/);
  assert.match(problems({ RBB_SNAPSHOT_REQUIRED: "true" }).join(), /RBB_SNAPSHOT_REQUIRED must be 1/);
  assert.match(problems({ RBB_SNAPSHOT_RUNTIME: undefined }).join(), /RBB_SNAPSHOT_RUNTIME must be "on"/, "on by default in the build, but a deployment says so explicitly");
  assert.match(problems({ RBB_SNAPSHOT_RUNTIME: "off" }).join(), /RBB_SNAPSHOT_RUNTIME must be "on"/);
  assert.match(problems({ RBB_SNAPSHOT_RUNTIME: "ON" }).join(), /RBB_SNAPSHOT_RUNTIME must be "on"/);
  assert.match(problems({ RBB_SNAPSHOT: "off" }).join(), /RBB_SNAPSHOT=off/);
  assert.match(problems({ RBB_PREVIEW: "1" }).join(), /RBB_PREVIEW is set/);
  assert.match(problems({ RBB_SNAPSHOT_VERSION: "v8" }).join(), /positive whole number/);
  assert.match(problems({ VITE_SITE_URL: "https://www.risingbeyondborders.org" }).join(), /VITE_SITE_URL, when set, must be the production origin/);
  assert.match(problems({ VITE_ENVIRONMENT: "preview" }).join(), /VITE_ENVIRONMENT, when set, must be "prod"/);
  assert.match(problems({ CLOUDFLARE_API_TOKEN: "t" }).join(), /CLOUDFLARE_ACCOUNT_ID is not/);
});

test("preflight: the checkout — main only, no modified tracked files, HEAD pushed to origin/main", () => {
  assert.match(problems({}, { branch: "feature/x" }).join(), /on "feature\/x", not main/);
  assert.match(problems({}, { dirty: ["apps/web/src/main.jsx"] }).join(), /1 modified tracked file\(s\) \(apps\/web\/src\/main\.jsx\)/);
  assert.match(problems({}, { upstream: null }).join(), /no upstream/);
  assert.match(problems({}, { upstream: "b".repeat(40) }).join(), /HEAD \(aaaaaaa\) is not origin\/main \(bbbbbbb\)/);
  assert.deepEqual(problems({}, { dirty: [] }), [], "untracked files (the content-import writer) do not count");
});

test("preflight: a Vite env file may hold VITE_ keys only — a secret in apps/web/.env.production stops the deployment, by key name, never by value", () => {
  const out = problems({}, {}, [{ file: "apps/web/.env.production", keys: ["VITE_ENVIRONMENT", "VITE_SITE_URL", "MONGODB_URI", "RESEND_API_KEY"] }]);
  assert.equal(out.length, 1);
  assert.match(out[0], /apps\/web\/\.env\.production holds 2 key\(s\) that are not VITE_ \(MONGODB_URI, RESEND_API_KEY\)/);
  assert.deepEqual(problems({}, {}, [{ file: "apps/web/.env.production", keys: ["VITE_ENVIRONMENT"] }]), []);
  assert.deepEqual([...envFileKeys("VITE_A=1\n# comment\nSECRET=hunter2\n\nVITE_B=\n")].sort(), ["SECRET", "VITE_A", "VITE_B"]);
});

test("the log names variables and whether they are set — never a value", () => {
  const lines = describeEnv({ ...OK_ENV, CLOUDFLARE_API_TOKEN: "cf-token-value-123", VITE_SITE_URL: "" });
  assert.ok(lines.includes("CLOUDFLARE_API_TOKEN: set"));
  assert.ok(lines.includes("CLOUDFLARE_ACCOUNT_ID: unset"));
  assert.ok(lines.includes("VITE_SITE_URL: unset"), "empty counts as unset");
  assert.ok(!lines.join("\n").includes("cf-token-value-123"));
  assert.ok(!lines.join("\n").includes(PRODUCTION_SNAPSHOT_URL), "not even the URL");
  const text = problems({ RBB_SNAPSHOT_URL: "https://evil.example/x", CLOUDFLARE_API_TOKEN: "cf-token-value-123" }).join("\n");
  assert.ok(!text.includes("evil.example") && !text.includes("cf-token-value-123"), "a wrong value is reported as wrong, not echoed");
});

test("the Wrangler invocation: Pages, the one project and branch, the commit, never dirty", () => {
  assert.deepEqual(wranglerArgs({ dist: "dist", commit: "c".repeat(40), message: "feat: x" }), ["pages", "deploy", "dist", "--project-name", "rbb-web", "--branch", "main", "--commit-hash", "c".repeat(40), "--commit-message", "feat: x", "--commit-dirty=false"]);
});

/* A dist/ + build-meta/ pair as the build writes them. */
function artifact({ mode = "snapshot", url = "https://api.risingbeyondborders.org", runtime = true, connect = "https://api.risingbeyondborders.org", missing = [] } = {}) {
  const root = mkdtempSync(join(tmpdir(), "rbb-deploy-"));
  const dist = join(root, "dist");
  const meta = join(root, "build-meta");
  mkdirSync(dist);
  mkdirSync(meta);
  const csp = `default-src 'self'; connect-src 'self'${connect ? ` ${connect}` : ""}; img-src 'self'`;
  const files = { "index.html": `<meta http-equiv="Content-Security-Policy" content="${csp}" />`, "404.html": "<h1>404</h1>", _headers: `/*\n  Content-Security-Policy: ${csp}\n`, _redirects: "", "robots.txt": "" };
  for (const [name, text] of Object.entries(files)) if (!missing.includes(name)) writeFileSync(join(dist, name), text);
  writeFileSync(join(meta, "published-snapshot-status.json"), JSON.stringify({ mode, version: 7, url }));
  if (runtime) writeFileSync(join(meta, "runtime-snapshot.json"), JSON.stringify({ url: PRODUCTION_SNAPSHOT_URL, origin: "https://api.risingbeyondborders.org", version: 7 }));
  return { dist, meta };
}

test("after the build: dist/ and build-meta must show a runtime-snapshot build from the production API — anything else stops before Wrangler", () => {
  assert.deepEqual(artifactProblems(artifact()), []);
  assert.match(artifactProblems(artifact({ mode: "source-content" })).join(), /does not say the build applied a published snapshot/);
  assert.match(artifactProblems(artifact({ url: "http://localhost:5192" })).join(), /fetched from http:\/\/localhost:5192/);
  assert.match(artifactProblems(artifact({ runtime: false })).join(), /runtime-snapshot\.json is missing/);
  assert.match(artifactProblems(artifact({ connect: "" })).join(), /does not allow connect-src/);
  assert.match(artifactProblems(artifact({ connect: "http://localhost:5192" })).join(), /names a local host/);
  assert.match(artifactProblems(artifact({ missing: ["_headers", "robots.txt"] })).join(), /dist\/_headers is missing/);
});
