/* Step 1 of `npm run build`: fetch the CMS's published snapshot, ONCE.

     RBB_SNAPSHOT_URL       the API's public snapshot endpoint, e.g.
                            https://api.example.org/api/v1/public/snapshot
                            Unset → the SAVED copy, fixtures/published-
                            snapshot.json (2026-10-13: the CMS is the only
                            source of its content — the website keeps no
                            built-in copy of it, so a build without the
                            API's data would have empty pages). A local or
                            test build; never deployed (deploy-pages.mjs
                            requires mode "snapshot").
     RBB_SNAPSHOT_VERSION   optional: the version a deploy hook announced;
                            an older snapshot fails the build
     RBB_SNAPSHOT_REQUIRED  "1": RBB_SNAPSHOT_URL must be set (production —
                            never the saved copy). With a URL, an unreachable
                            API or nothing published always fails the build.
     RBB_SNAPSHOT=off       no snapshot at all: the CMS's sections are empty
                            (tests that apply their own snapshots)

   A snapshot that arrives but is malformed, for another organization or
   older than announced ALWAYS fails the build: published data is never
   half-used or silently ignored.

   Writes (git-ignored, never published):
     build-meta/published-snapshot.json         the snapshot the Vite builds apply
     build-meta/published-snapshot-status.json  which mode this build used, and why
   Any snapshot left over from an earlier build is deleted first. */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ORG_ID } from "../src/contract/org.js";
import { structuralProblems } from "./snapshot-adapter.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const meta = join(root, "build-meta");
export const SNAPSHOT_FILE = join(meta, "published-snapshot.json");
/* The saved copy of the live snapshot, for local and test builds. */
export const FIXTURE_FILE = join(root, "fixtures/published-snapshot.json");
const STATUS_FILE = join(meta, "published-snapshot-status.json");

const status = async (value) => writeFile(STATUS_FILE, JSON.stringify({ ...value, at: new Date().toISOString() }, null, 2) + "\n");
const fail = (message) => {
  console.error(`\n✗ published snapshot: ${message}\n`);
  process.exit(1);
};

/* The pages the website has no built-in copy of, and would draw blank
   without (2026-10-13): a snapshot must carry each, published. */
export const REQUIRED_PAGES = { homepage: "the homepage", about: "the About page", impact: "the Impact page", generalDonation: "the donation page" };
const missingPages = (snapshot) =>
  Object.entries(REQUIRED_PAGES)
    .filter(([key]) => snapshot.content?.[key]?.status !== "published")
    .map(([, name]) => `${name} is not published in it — the website has no built-in copy to show instead; publish it in the Admin`);

/* https anywhere; plain http only to this machine (a local API). */
const allowedUrl = (value) => {
  try {
    const url = new URL(value);
    return !url.username && !url.password && (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)));
  } catch {
    return false;
  }
};

await mkdir(meta, { recursive: true });
await rm(SNAPSHOT_FILE, { force: true });

const url = process.env.RBB_SNAPSHOT_URL?.trim();
const required = process.env.RBB_SNAPSHOT_REQUIRED === "1";
const minimumVersion = Number(process.env.RBB_SNAPSHOT_VERSION ?? 0) || 0;

if (process.env.RBB_SNAPSHOT === "off" || !url) {
  if (required) fail("RBB_SNAPSHOT_REQUIRED=1 but RBB_SNAPSHOT_URL is not set (or RBB_SNAPSHOT=off).");
  if (process.env.RBB_SNAPSHOT === "off") {
    await status({ mode: "none", reason: "RBB_SNAPSHOT=off" });
    console.warn("  ⚠ published snapshot: off — the CMS's sections are EMPTY in this build");
  } else {
    const saved = JSON.parse(await readFile(FIXTURE_FILE, "utf8"));
    const problems = [...structuralProblems(saved, { orgId: ORG_ID, minimumVersion: 0 }), ...missingPages(saved)];
    if (problems.length) fail(`fixtures/published-snapshot.json is not usable:\n    - ${problems.join("\n    - ")}`);
    await writeFile(SNAPSHOT_FILE, JSON.stringify(saved, null, 2) + "\n");
    await status({ mode: "fixture", version: saved.version, generatedAt: saved.generatedAt });
    console.log(`  published snapshot: the saved copy (version ${saved.version}) — RBB_SNAPSHOT_URL is not set`);
  }
} else {
  if (!allowedUrl(url)) fail("RBB_SNAPSHOT_URL must be an https:// URL (http only for localhost).");
  let response;
  try {
    response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
  } catch (error) {
    response = { ok: false, status: 0, statusText: error.name };
  }
  if (!response.ok) {
    const why = response.status === 404 ? "nothing has been published yet (404)" : response.status ? `the API answered ${response.status}` : `the API could not be reached (${response.statusText})`;
    /* No built-in copy to fall back to any more: a build with the API's
       address but without its data stops. */
    fail(`${why}. The website has no built-in copy of the CMS's content, so the build stops.`);
  } else {
    const body = await response.json().catch(() => null);
    const snapshot = body?.data;
    const problems = structuralProblems(snapshot, { orgId: ORG_ID, minimumVersion });
    if (!problems.length) problems.push(...missingPages(snapshot));
    if (problems.length) fail(`the snapshot from ${new URL(url).origin} is not usable:\n    - ${problems.join("\n    - ")}`);
    await writeFile(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2) + "\n");
    await status({ mode: "snapshot", version: snapshot.version, generatedAt: snapshot.generatedAt, url: new URL(url).origin });
    console.log(`  published snapshot: version ${snapshot.version} (published ${snapshot.generatedAt})`);
  }
}
