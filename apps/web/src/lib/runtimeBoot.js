/* The one place the site decides WHICH published snapshot the content
   modules load with — before any of them loads.

   Every content module the snapshot drives ends, in a runtime-snapshot
   build, with a call to applyRuntimeOverrides (src/lib/runtimeOverrides.js,
   appended by scripts/vite-published-snapshot.mjs). That module imports
   this one, and this one AWAITS the API at the top level in the browser —
   so the content modules, and everything derived from them when they load
   (page titles, the footer, the routes, config/sections.js), wait for the
   decision and then see one snapshot, whole. The pre-rendered page is on
   screen throughout; what waits is hydration.

   The decision (src/lib/runtimeSnapshot.js): the baked snapshot's
   overrides — compiled in by the plugin as __RBB_BAKED_OVERRIDES__, the
   same values the build used to pre-render — unless the API serves a
   NEWER snapshot that passes every check, which replaces them whole.
   During the build's pre-render (SSR) there is no request: the baked
   overrides, always. A build without a runtime snapshot never loads this
   module's browser path at all (ENV.runtimeSnapshot is null, and no
   module calls applyRuntimeOverrides).

   Fail-safe: should a chosen snapshot fail to apply to a module — a
   target this site no longer has — the content would be inconsistent, so
   the page reloads ONCE without the runtime snapshot (a session flag,
   consumed by the reload) and shows the baked content. */
import { ENV } from "../config/env.js";
import { reportError } from "./monitoring.js";
import { loadRuntimeSnapshot, mountMode } from "./runtimeSnapshot.js";

const SKIP_FLAG = "rbb-runtime-snapshot-skip";
const ROOT_ID = "root";

/* The baked overrides: inlined by the build (vite-published-snapshot.mjs
   `define`) as a JSON string; undefined everywhere else. */
// eslint-disable-next-line no-undef
const BAKED = typeof __RBB_BAKED_OVERRIDES__ === "undefined" ? null : JSON.parse(__RBB_BAKED_OVERRIDES__);

const state = {
  /* "build" | "network" | "cache" — where the applied snapshot came from. */
  source: "build",
  version: ENV.runtimeSnapshot?.version ?? null,
  /* The loader's outcome in the browser (runtimeSnapshot.js), or null. */
  status: null,
  reason: null,
  problems: [],
  /* Whether the page was pre-rendered for this address. */
  prerendered: true,
  /* Set by applyRuntimeOverrides as the content modules load. */
  overrides: BAKED,
  applied: [],
  failed: null,
};

export const snapshotState = () => state;

const storage = (fn) => {
  try {
    return fn(window.sessionStorage);
  } catch {
    return undefined;
  }
};

/* The 404 shell while the API answers: not "Page not found" for an address
   a newer snapshot may well have a page for, not the page either — a
   plain status, read out by assistive technology, replaced by the render. */
function showLoading(root) {
  root.textContent = "";
  const note = document.createElement("p");
  note.setAttribute("role", "status");
  note.setAttribute("aria-live", "polite");
  note.className = "type-lead text-quiet px-4 py-20 text-center";
  note.textContent = "Loading…";
  root.append(note);
}

async function boot() {
  const config = ENV.runtimeSnapshot;
  const root = document.getElementById(ROOT_ID);
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  state.prerendered = Boolean(root && root.dataset.route === path && root.hasChildNodes());
  if (!config || !BAKED) return;
  if (storage((s) => s.getItem(SKIP_FLAG))) {
    storage((s) => s.removeItem(SKIP_FLAG));
    state.status = "skipped";
    return;
  }
  if (root && !state.prerendered && root.dataset.route === "/404") showLoading(root);
  const result = await loadRuntimeSnapshot({
    config,
    fetch: (url, init) => window.fetch(url, init),
    validate: async (snapshot) => (await import("./snapshotContract.js")).snapshotProblems(snapshot),
  });
  Object.assign(state, { status: result.status, reason: result.reason ?? null, problems: result.problems });
  if (result.status === "newer") Object.assign(state, { overrides: result.overrides, version: result.version, source: result.source });
  if (result.status === "rejected" || result.status === "unavailable") reportError(`snapshot-${result.status}`, path);
}

if (!ENV.ssr && typeof window !== "undefined") await boot();

/* After every module has loaded (main.jsx): how to mount — or, if a
   module could not take the chosen snapshot, the one-time reload. */
export function mountDecision() {
  if (state.failed && state.source !== "build") {
    reportError("snapshot-apply", window.location.pathname);
    if (storage((s) => (s.setItem(SKIP_FLAG, "1"), true))) {
      window.location.reload();
      return "reloading";
    }
  }
  return mountMode({ prerendered: state.prerendered, status: state.status });
}
