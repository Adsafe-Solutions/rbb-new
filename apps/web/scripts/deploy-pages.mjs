/* PRODUCTION deployment of the website to Cloudflare Pages, from a
   terminal — `pnpm deploy:web` at the repository root
   (docs/DEPLOY_CLOUDFLARE_PAGES.md).

   A fallback while the Pages project's Git integration is disconnected,
   and nothing more: it uploads a build of the CURRENT, PUSHED commit of
   `main` to the one project and branch the Git integration would have
   deployed, with the pinned Wrangler in this package's node_modules.
   Everything else — the project's settings, the API, the CMS, DNS, the
   separate www site — is never touched.

   It fails closed. Before the build: the configuration must be exactly
   the production one (the production snapshot endpoint, the snapshot
   required, the runtime snapshot on), the checkout must be `main`,
   clean and pushed, and no Vite-loaded env file may hold anything but
   VITE_ keys. After the build: dist/ and build-meta must show that the
   build really applied a published snapshot from the production API.
   Then — and only after a typed confirmation, or --yes — the deployment.

     --check   preflight and build only; never deploys
     --yes     skip the confirmation (for a deliberate, scripted run)

   Authentication is Wrangler's own: a `wrangler login` session, or
   CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in the environment (an
   ignored apps/web/.env.deploy.local is read first). No value of any
   variable is ever printed. */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseEnv } from "node:util";

export const PAGES_PROJECT = "rbb-web";
export const PAGES_BRANCH = "main";
export const PRODUCTION_SNAPSHOT_URL = "https://api.risingbeyondborders.org/api/v1/public/snapshot";
export const PRODUCTION_SITE_ORIGIN = "https://prod.risingbeyondborders.org";
/* The same build the Pages project runs ("cd ../.. && pnpm --filter @rbb/web run build"). */
export const BUILD_COMMAND = ["pnpm", ["--filter", "@rbb/web", "run", "build"]];
/* The env files Vite reads for a production build (apps/web), in its order. */
export const VITE_ENV_FILES = [".env", ".env.local", ".env.production", ".env.production.local"];
/* The variables the preflight looks at — names only, never values. */
/* The website forms that post to the production API (2026-10-13: Contact
   Us, Volunteer, Partner With Us, and the footer's Newsletter sign-up —
   stored for owners in the admin). When set, each must be exactly its
   production endpoint. */
export const FORM_ENDPOINTS = {
  VITE_FORM_ENDPOINT_CONTACT: "https://api.risingbeyondborders.org/api/v1/forms/contact",
  VITE_FORM_ENDPOINT_VOLUNTEER: "https://api.risingbeyondborders.org/api/v1/forms/volunteer",
  VITE_FORM_ENDPOINT_PARTNER: "https://api.risingbeyondborders.org/api/v1/forms/partner",
  VITE_FORM_ENDPOINT_NEWSLETTER: "https://api.risingbeyondborders.org/api/v1/forms/newsletter",
};
export const KNOWN_VARIABLES = ["RBB_SNAPSHOT_URL", "RBB_SNAPSHOT_REQUIRED", "RBB_SNAPSHOT_RUNTIME", "RBB_SNAPSHOT", "RBB_SNAPSHOT_VERSION", "RBB_SNAPSHOT_RUNTIME_TIMEOUT_MS", "RBB_MEDIA_ORIGINS", "RBB_PREVIEW", "VITE_SITE_URL", "VITE_ENVIRONMENT", ...Object.keys(FORM_ENDPOINTS), "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"];

const web = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(web, "../..");

/* Set, or not — what the log may say about a variable. */
export const describeEnv = (env) => KNOWN_VARIABLES.map((name) => `${name}: ${env[name] === undefined || env[name] === "" ? "unset" : "set"}`);

/* The keys an env file declares (never their values). */
export const envFileKeys = (text) => Object.keys(parseEnv(text));

/* What must be true BEFORE the build. `env`: the process environment.
   `git`: { branch, dirty: [paths], head, upstream } (gitFacts below).
   `envFiles`: [{ file, keys }] for every Vite env file that exists. */
export function preflightProblems({ env, git, envFiles = [] }) {
  const problems = [];
  const value = (name) => (env[name] === undefined ? undefined : String(env[name]).trim());
  if (value("RBB_SNAPSHOT_URL") !== PRODUCTION_SNAPSHOT_URL) problems.push(`RBB_SNAPSHOT_URL must be exactly the production snapshot endpoint (${PRODUCTION_SNAPSHOT_URL})`);
  if (value("RBB_SNAPSHOT_REQUIRED") !== "1") problems.push("RBB_SNAPSHOT_REQUIRED must be 1: a production build never falls back to the source content");
  if (value("RBB_SNAPSHOT_RUNTIME") !== "on") problems.push('RBB_SNAPSHOT_RUNTIME must be "on" — the runtime snapshot is enabled explicitly for production (scripts/runtime-snapshot.mjs accepts "on" or "off")');
  if (value("RBB_SNAPSHOT") === "off") problems.push("RBB_SNAPSHOT=off would ignore the published snapshot");
  if (value("RBB_PREVIEW") !== undefined && value("RBB_PREVIEW") !== "") problems.push("RBB_PREVIEW is set — a preview is never built, let alone deployed");
  const version = value("RBB_SNAPSHOT_VERSION");
  if (version !== undefined && version !== "" && !/^[1-9]\d*$/.test(version)) problems.push("RBB_SNAPSHOT_VERSION, when set, must be a positive whole number");
  const site = value("VITE_SITE_URL");
  if (site !== undefined && site !== "" && site !== PRODUCTION_SITE_ORIGIN) problems.push(`VITE_SITE_URL, when set, must be the production origin (${PRODUCTION_SITE_ORIGIN})`);
  const environment = value("VITE_ENVIRONMENT");
  if (environment !== undefined && environment !== "" && environment !== "prod") problems.push('VITE_ENVIRONMENT, when set, must be "prod" for a production deployment');
  for (const [name, endpoint] of Object.entries(FORM_ENDPOINTS)) {
    const set = value(name);
    if (set !== undefined && set !== "" && set !== endpoint) problems.push(`${name}, when set, must be exactly the production form endpoint (${endpoint})`);
  }
  for (const name of ["VITE_FORM_ENDPOINT_TRAVEL", "VITE_FORM_ENDPOINT_FUNDRAISE"])
    if (value(name)) problems.push(`${name} is set — only the Contact, Volunteer, Partner and Newsletter forms are taken in production`);
  const token = value("CLOUDFLARE_API_TOKEN");
  if (token !== undefined && token !== "" && !value("CLOUDFLARE_ACCOUNT_ID")) problems.push("CLOUDFLARE_API_TOKEN is set but CLOUDFLARE_ACCOUNT_ID is not — set both, or neither and use `wrangler login`");
  if (git.branch !== PAGES_BRANCH) problems.push(`the checkout is on "${git.branch}", not ${PAGES_BRANCH} — only ${PAGES_BRANCH} is deployed to production`);
  if (git.dirty.length) problems.push(`the working tree has ${git.dirty.length} modified tracked file(s) (${git.dirty.slice(0, 5).join(", ")}${git.dirty.length > 5 ? ", …" : ""}) — commit or discard them; a deployment is of a commit, never of a working copy`);
  if (!git.upstream) problems.push(`${PAGES_BRANCH} has no upstream (origin/${PAGES_BRANCH}) to compare with`);
  else if (git.head !== git.upstream) problems.push(`HEAD (${git.head.slice(0, 7)}) is not origin/${PAGES_BRANCH} (${git.upstream.slice(0, 7)}) — push first, or pull: production must be what the repository holds`);
  for (const { file, keys } of envFiles) {
    const foreign = keys.filter((k) => !k.startsWith("VITE_"));
    if (foreign.length) problems.push(`${file} holds ${foreign.length} key(s) that are not VITE_ (${foreign.join(", ")}) — a website env file carries public VITE_ values only; move anything else out (the API has its own environment) before deploying`);
  }
  return problems;
}

/* What must be true AFTER the build, from dist/ and build-meta/. */
export function artifactProblems({ dist, meta }) {
  const problems = [];
  const read = (dir, file) => {
    try {
      return readFileSync(join(dir, file), "utf8");
    } catch {
      return null;
    }
  };
  const json = (dir, file) => {
    const text = read(dir, file);
    if (text === null) return null;
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  };
  const apiOrigin = new URL(PRODUCTION_SNAPSHOT_URL).origin;
  for (const file of ["index.html", "404.html", "_headers", "_redirects", "robots.txt"]) if (read(dist, file) === null) problems.push(`dist/${file} is missing`);
  const status = json(meta, "published-snapshot-status.json");
  if (status?.mode !== "snapshot") problems.push(`build-meta/published-snapshot-status.json does not say the build applied a published snapshot (mode ${JSON.stringify(status?.mode ?? null)})`);
  else if (status.url !== apiOrigin) problems.push(`the snapshot was fetched from ${status.url}, not ${apiOrigin}`);
  const runtime = json(meta, "runtime-snapshot.json");
  if (!runtime) problems.push("build-meta/runtime-snapshot.json is missing — the build is static, not a runtime-snapshot build");
  else if (runtime.url !== PRODUCTION_SNAPSHOT_URL || runtime.origin !== apiOrigin) problems.push("build-meta/runtime-snapshot.json names another endpoint than the production API");
  const headers = read(dist, "_headers") ?? "";
  const escaped = apiOrigin.replace(/[.*+?^$()|[\]\\/{}]/g, "\\$&");
  if (!new RegExp("connect-src [^\\n]*" + escaped).test(headers)) problems.push(`dist/_headers does not allow connect-src to ${apiOrigin}`);
  const index = read(dist, "index.html") ?? "";
  if (!index.includes(`connect-src 'self' ${apiOrigin}`)) problems.push(`dist/index.html's page policy does not allow connect-src to ${apiOrigin}`);
  if (/https?:\/\/(localhost|127\.0\.0\.1)/.test(index + headers)) problems.push("the build names a local host — not a production build");
  return problems;
}

/* The exact Wrangler invocation. */
export const wranglerArgs = ({ dist, commit, message }) => ["pages", "deploy", dist, "--project-name", PAGES_PROJECT, "--branch", PAGES_BRANCH, "--commit-hash", commit, "--commit-message", message, "--commit-dirty=false"];

const git = (args) => execFileSync("git", args, { cwd: repo, stdio: ["ignore", "pipe", "ignore"], env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } }).toString().trim();
export function gitFacts() {
  const branch = git(["branch", "--show-current"]);
  const dirty = git(["status", "--porcelain", "--untracked-files=no"]).split("\n").filter(Boolean).map((l) => l.slice(3));
  const head = git(["rev-parse", "HEAD"]);
  let upstream = null;
  try {
    git(["fetch", "--quiet", "origin", PAGES_BRANCH]);
    upstream = git(["rev-parse", `origin/${PAGES_BRANCH}`]);
  } catch {
    upstream = null;
  }
  const subject = git(["log", "-1", "--format=%s"]);
  return { branch, dirty, head, upstream, subject };
}

const countFiles = (dir) => readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? countFiles(join(dir, e.name)) : 1), 0);
const fail = (lines) => {
  console.error(`\n✗ deploy:web stopped — nothing was deployed.\n  - ${[].concat(lines).join("\n  - ")}\n`);
  process.exit(2);
};

export async function main(argv = process.argv.slice(2)) {
  const check = argv.includes("--check");
  const yes = argv.includes("--yes");
  const unknown = argv.filter((a) => !["--check", "--yes"].includes(a));
  if (unknown.length) fail(`unknown option(s) ${unknown.join(" ")} (known: --check, --yes)`);

  console.log(`deploy:web — PRODUCTION deployment of the website to Cloudflare Pages project "${PAGES_PROJECT}", branch "${PAGES_BRANCH}"${check ? " (--check: build only, no deployment)" : ""}.`);
  console.log(`  configuration (names only):\n    ${describeEnv(process.env).join("\n    ")}`);

  const facts = gitFacts();
  const envFiles = VITE_ENV_FILES.filter((f) => existsSync(join(web, f))).map((f) => ({ file: `apps/web/${f}`, keys: envFileKeys(readFileSync(join(web, f), "utf8")) }));
  const problems = preflightProblems({ env: process.env, git: facts, envFiles });
  if (problems.length) fail(problems);
  console.log(`  commit ${facts.head.slice(0, 7)} "${facts.subject}" on ${facts.branch}, pushed; env files: ${envFiles.map((e) => e.file).join(", ") || "none"} (VITE_ keys only).`);

  const wrangler = join(web, "node_modules/.bin/wrangler");
  if (!existsSync(wrangler)) fail("wrangler is not installed in apps/web/node_modules — run `pnpm install`");
  if (!check) {
    console.log("  checking Cloudflare authentication (wrangler whoami)…");
    const who = spawnSync(wrangler, ["whoami"], { cwd: web, stdio: "inherit", env: process.env });
    if (who.status !== 0) fail("wrangler is not authenticated — run `pnpm --filter @rbb/web exec wrangler login`, or set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID (docs/DEPLOY_CLOUDFLARE_PAGES.md)");
  }

  console.log(`\n  building: ${BUILD_COMMAND[0]} ${BUILD_COMMAND[1].join(" ")} (from the repository root)\n`);
  const build = spawnSync(BUILD_COMMAND[0], BUILD_COMMAND[1], { cwd: repo, stdio: "inherit", env: process.env });
  if (build.status !== 0) fail(`the build exited with ${build.status ?? build.signal}`);
  const dist = join(web, "dist");
  const meta = join(web, "build-meta");
  const artifact = artifactProblems({ dist, meta });
  if (artifact.length) fail(artifact);
  const files = countFiles(dist);
  console.log(`\n  built apps/web/dist: ${files} files, from published snapshot version ${JSON.parse(readFileSync(join(meta, "published-snapshot-status.json"), "utf8")).version}, runtime snapshot on (${new URL(PRODUCTION_SNAPSHOT_URL).origin}).`);
  if (check) {
    console.log("  --check: stopping before the deployment. Nothing was deployed.\n");
    return 0;
  }

  const args = wranglerArgs({ dist: "dist", commit: facts.head, message: facts.subject });
  console.log(`\n  ABOUT TO DEPLOY TO PRODUCTION\n    project   ${PAGES_PROJECT}\n    branch    ${PAGES_BRANCH} (the production branch — this becomes ${PRODUCTION_SITE_ORIGIN})\n    commit    ${facts.head}\n    files     ${files} in apps/web/dist\n    command   wrangler ${args.join(" ")}\n  Not touched: the Pages project's settings, its Git integration, the API, the CMS, DNS, www.risingbeyondborders.org.`);
  if (!yes) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = (await rl.question(`  Type "deploy" to continue, anything else to stop: `)).trim();
    rl.close();
    if (answer !== "deploy") fail("not confirmed");
  }
  const deploy = spawnSync(wrangler, args, { cwd: web, stdio: "inherit", env: process.env });
  if (deploy.status !== 0) fail(`wrangler exited with ${deploy.status ?? deploy.signal} — the deployment did not complete; check the Cloudflare dashboard before retrying`);
  console.log(`\n✓ deployed commit ${facts.head.slice(0, 7)} to ${PAGES_PROJECT}/${PAGES_BRANCH}. Verify: ${PRODUCTION_SITE_ORIGIN} and the Pages deployments list (docs/DEPLOY_CLOUDFLARE_PAGES.md).\n`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exitCode = await main();
