/* Step 1 of `npm run build`: fetch the CMS's published snapshot, ONCE.

     RBB_SNAPSHOT_URL       the API's public snapshot endpoint, e.g.
                            https://api.example.org/api/v1/public/snapshot
                            Unset → no snapshot: the site builds from its
                            source content, exactly as before.
     RBB_SNAPSHOT_VERSION   optional: the version a deploy hook announced;
                            an older snapshot fails the build
     RBB_SNAPSHOT_REQUIRED  "1": the build FAILS if the snapshot cannot be
                            fetched (production, once the CMS is the source).
                            Otherwise an unreachable API or nothing published
                            yet → the source content, with a loud warning.
     RBB_SNAPSHOT=off       ignore the snapshot entirely

   A snapshot that arrives but is malformed, for another organization or
   older than announced ALWAYS fails the build: published data is never
   half-used or silently ignored.

   Writes (git-ignored, never published):
     build-meta/published-snapshot.json         the snapshot the Vite builds apply
     build-meta/published-snapshot-status.json  which mode this build used, and why
   Any snapshot left over from an earlier build is deleted first. */
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ORG_ID } from "../src/contract/org.js";
import { structuralProblems } from "./snapshot-adapter.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const meta = join(root, "build-meta");
export const SNAPSHOT_FILE = join(meta, "published-snapshot.json");
const STATUS_FILE = join(meta, "published-snapshot-status.json");

const status = async (value) => writeFile(STATUS_FILE, JSON.stringify({ ...value, at: new Date().toISOString() }, null, 2) + "\n");
const fail = (message) => {
  console.error(`\n✗ published snapshot: ${message}\n`);
  process.exit(1);
};

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
  await status({ mode: "source-content", reason: process.env.RBB_SNAPSHOT === "off" ? "RBB_SNAPSHOT=off" : "RBB_SNAPSHOT_URL is not set" });
  console.log("  published snapshot: none configured — building from the source content");
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
    if (required) fail(`${why}. RBB_SNAPSHOT_REQUIRED=1, so the build stops rather than fall back.`);
    await status({ mode: "source-content", reason: why, url: new URL(url).origin });
    console.warn(`\n  ⚠ published snapshot: ${why} — building from the SOURCE CONTENT instead.\n    Published CMS changes are NOT in this build. Set RBB_SNAPSHOT_REQUIRED=1 to make this an error.\n`);
  } else {
    const body = await response.json().catch(() => null);
    const snapshot = body?.data;
    const problems = structuralProblems(snapshot, { orgId: ORG_ID, minimumVersion });
    if (problems.length) fail(`the snapshot from ${new URL(url).origin} is not usable:\n    - ${problems.join("\n    - ")}`);
    await writeFile(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2) + "\n");
    await status({ mode: "snapshot", version: snapshot.version, generatedAt: snapshot.generatedAt, url: new URL(url).origin });
    console.log(`  published snapshot: version ${snapshot.version} (published ${snapshot.generatedAt})`);
  }
}
