/* Fetching the latest published snapshot in the browser — the decision
   logic, with nothing of the browser in it (fetch, the validator and the
   clock are handed in), so it is tested as plain code
   (scripts/test/runtime-snapshot.test.mjs). src/lib/runtimeBoot.js runs
   it once per page load.

   One request to the API's public snapshot endpoint — no session, no
   custom header, so it is a simple cross-origin GET: no preflight, and
   the browser's own HTTP cache revalidates it with the ETag the API sends
   (`Cache-Control: no-cache` + `ETag: "snapshot-v<N>"`), so an unchanged
   snapshot is a 304 on the wire and the cached body here. Then, by
   version against the snapshot the build baked in:

     newer     checked — structure, this organization, the full content
               contract, and that the site can draw it (overridesFrom) —
               and applied; one failure rejects it whole
     same      the baked snapshot, untouched (no check needed: a version
               never changes once published)
     older     ignored: the baked snapshot is newer than what the API
               serves, so the build is the truth
     rejected  a newer snapshot that failed a check: the baked one stays
     unavailable
               the API could not be reached in time and the browser held
               no copy: the baked one stays — the last snapshot that was
               known to be valid, never the website's own sample content

   When the request fails, the browser's cached copy (`cache:
   "force-cache"` — whatever it holds, however old) is tried next: a
   snapshot a visitor saw on an earlier visit is better than a stale
   build, and it is checked exactly as a fresh one. */

import { ORG_ID } from "../contract/org.js";
import { overridesFrom, structuralProblems } from "../../scripts/snapshot-adapter.mjs";

export const DEFAULT_TIMEOUT_MS = 3000;

const compare = (version, baked) => (version > baked ? "newer" : version === baked ? "same" : "older");

/* One attempt: the response → a result, or a thrown reason. */
async function attempt({ url, fetch, signal, cache, baked, orgId, validate, apply }) {
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal, ...(cache && { cache }) });
  if (response.status === 304) return { status: "same", version: baked, snapshot: null, problems: [] };
  if (!response.ok) throw new Error(response.status === 404 ? "nothing is published (404)" : `the API answered ${response.status}`);
  const body = await response.json().catch(() => null);
  const snapshot = body?.data;
  const structural = structuralProblems(snapshot, { orgId });
  if (structural.length) return { status: "rejected", version: null, snapshot: null, problems: structural };
  const status = compare(snapshot.version, baked);
  if (status !== "newer") return { status, version: snapshot.version, snapshot: null, problems: [] };
  const problems = await validate(snapshot);
  if (problems.length) return { status: "rejected", version: snapshot.version, snapshot: null, problems };
  let overrides;
  try {
    overrides = apply(snapshot);
  } catch (error) {
    return { status: "rejected", version: snapshot.version, snapshot: null, problems: [error.message] };
  }
  return { status: "newer", version: snapshot.version, snapshot, overrides, problems: [] };
}

/* `config`: { url, version (baked), orgId?, timeoutMs? }. `validate`: the
   content-contract check (src/lib/snapshotContract.js) — called only for
   a newer snapshot, so its code loads only then. */
export async function loadRuntimeSnapshot({ config, fetch, validate, apply = overridesFrom, now = () => Date.now() }) {
  const started = now();
  const orgId = config.orgId ?? ORG_ID;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const base = { url: config.url, fetch, baked: config.version, orgId, validate, apply };
  const done = (result, source, reason) => ({ ...result, source, ...(reason && { reason }), elapsedMs: now() - started });
  let reason;
  try {
    return done(await attempt({ ...base, signal: AbortSignal.timeout(timeoutMs) }), "network");
  } catch (error) {
    reason = error?.name === "TimeoutError" ? `no answer within ${timeoutMs}ms` : error?.message ?? String(error);
  }
  try {
    const cached = await attempt({ ...base, cache: "force-cache", signal: AbortSignal.timeout(timeoutMs) });
    return done(cached, "cache", reason);
  } catch {
    return done({ status: "unavailable", version: null, snapshot: null, problems: [] }, "none", reason);
  }
}

/* Hydrate the pre-rendered HTML, or render afresh: afresh when the page is
   not the one pre-rendered for this address (404.html, the dev shell) —
   as before — and when a newer snapshot was applied, since the HTML was
   rendered from the baked one and must not be hydrated against content
   it does not hold. */
export const mountMode = ({ prerendered, status }) => (prerendered && status !== "newer" ? "hydrate" : "render");
