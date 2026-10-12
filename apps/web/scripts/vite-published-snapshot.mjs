/* The Vite plugin that applies a published snapshot to a build (see
   scripts/snapshot-adapter.mjs for WHAT it sets, and
   scripts/published-snapshot.mjs for where the snapshot comes from).

   Runs in BUILDS only (client and server alike, so they agree). With no
   build-meta/published-snapshot.json — or RBB_SNAPSHOT=off — it changes
   nothing at all: the build is byte-identical to one without the plugin.

   Two ways of applying the snapshot, decided by scripts/runtime-snapshot.mjs:

     static   (no RBB_SNAPSHOT_URL at runtime, or RBB_SNAPSHOT_RUNTIME=off)
              assignments to each target module's own exports are appended
              to it (appendOverrides) — the site is fully static
     runtime  each target module ends with a call to applyRuntimeOverrides
              (src/lib/runtimeOverrides.js) instead, and the SAME values
              are compiled in as __RBB_BAKED_OVERRIDES__ — so the
              pre-render applies exactly what the static way would, and a
              visitor's browser may apply a NEWER published snapshot in
              their place before the modules load (src/lib/runtimeBoot.js).
              The bundle learns where to ask through
              import.meta.env.VITE_RBB_RUNTIME_SNAPSHOT (src/config/env.js),
              and the prerender learns the API's origin for the page
              policy from build-meta/runtime-snapshot.json.

   It also serves `virtual:rbb-published-snapshot` (the snapshot, or null)
   for the server build's contract check; the client never imports it.

   M36 — LOCAL PREVIEW (`npm run preview:cms`, scripts/cms-preview.mjs):
   with RBB_PREVIEW=1 it applies build-meta/preview-snapshot.json — what an
   owner's next publish WOULD put live — to the DEV SERVER only, and marks
   every page as a preview (a banner, noindex, "[Preview]" in the title).
   A build refuses to run in that mode, so a preview never reaches dist/;
   without it the preview file is never read. A preview is always static. */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { SNAPSHOT_TARGETS, appendOverrides, hasCheckouts, overridesFrom } from "./snapshot-adapter.mjs";
import { runtimeSnapshotConfig, runtimeSnapshotEnv } from "./runtime-snapshot.mjs";

export const VIRTUAL_ID = "virtual:rbb-published-snapshot";
const RESOLVED = "\0rbb-published-snapshot";
export const PREVIEW_FILE = "build-meta/preview-snapshot.json";
export const PREVIEW_STATUS_FILE = "build-meta/preview-snapshot-status.json";
/* The runtime configuration this build was made with, for the prerender
   (scripts/prerender.mjs) — deleted when the build is static. */
export const RUNTIME_FILE = "build-meta/runtime-snapshot.json";
/* The hook every target module calls at its end, in a runtime build. */
export const RUNTIME_HOOK_MODULE = "/src/lib/runtimeOverrides.js";

/* The names a target module exports in capitals — the content objects
   the snapshot can set — handed to the hook by name, live. */
export const exportedRoots = (code) => [...new Set([...code.matchAll(/export const ([A-Z_][A-Z0-9_]*)\s*=/g)].map((m) => m[1]))];

export function appendRuntimeHook(code, file) {
  const roots = exportedRoots(code);
  if (!roots.length) throw new Error(`${file} declares no "export const NAME" the snapshot could set — update scripts/snapshot-adapter.mjs`);
  return `${code}\n/* Runtime snapshot (scripts/vite-published-snapshot.mjs): the chosen snapshot's values, applied before this module's dependents load. */\nimport { applyRuntimeOverrides as __rbbApplyRuntimeOverrides } from ${JSON.stringify(RUNTIME_HOOK_MODULE)};\n__rbbApplyRuntimeOverrides(${JSON.stringify(file)}, { ${roots.join(", ")} });\n`;
}

/* What marks a preview page: in the HTML before any script runs, so it
   cannot be missed — and pointer-events off, so it hides nothing. */
export const previewTags = (status) => [
  { tag: "meta", attrs: { name: "robots", content: "noindex, nofollow" }, injectTo: "head" },
  {
    tag: "div",
    attrs: {
      id: "rbb-local-preview",
      role: "note",
      style: "position:fixed;left:0;right:0;bottom:0;z-index:2147483647;pointer-events:none;background:#b3261e;color:#fff;font:600 13px/1.4 system-ui,sans-serif;padding:8px 12px;text-align:center",
    },
    children: `LOCAL PREVIEW — approved CMS content as the next publish would show it${status?.basedOnVersion ? ` (live version ${status.basedOnVersion} + approved changes)` : ""}. Not published. Not the live website.`,
    injectTo: "body-prepend",
  },
  {
    tag: "script",
    children: `(function(){var p="[Preview] ",t=function(){if(document.title.indexOf(p)!==0)document.title=p+document.title};t();new MutationObserver(t).observe(document.head,{childList:true,subtree:true,characterData:true})})();`,
    injectTo: "head",
  },
];

/* `runtime`: tests only — a runtime configuration to use as given (and
   `applyInServe`, so a test's Vite loader gets the runtime hooks); the
   build decides from the environment. */
export default function publishedSnapshot({ root, runtime: givenRuntime, applyInServe = false } = {}) {
  const preview = process.env.RBB_PREVIEW === "1";
  const file = join(root, preview ? PREVIEW_FILE : "build-meta/published-snapshot.json");
  if (preview && !existsSync(file)) throw new Error(`RBB_PREVIEW=1 but there is no ${PREVIEW_FILE}: start the preview with \`npm run preview:cms\`.`);
  const snapshot = process.env.RBB_SNAPSHOT !== "off" && existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
  const status = preview && existsSync(join(root, PREVIEW_STATUS_FILE)) ? JSON.parse(readFileSync(join(root, PREVIEW_STATUS_FILE), "utf8")) : null;
  const overrides = snapshot ? overridesFrom(snapshot) : null;
  const runtime = preview ? null : givenRuntime !== undefined ? givenRuntime : runtimeSnapshotConfig({ env: process.env, snapshot });
  const runtimeFile = join(root, RUNTIME_FILE);

  return {
    name: "rbb-published-snapshot",
    /* A published snapshot: builds only. A preview: the dev server only. */
    apply(_config, { command }) {
      if (preview && command === "build") throw new Error("RBB_PREVIEW=1 is for the local dev server only (npm run preview:cms) — a preview is never built.");
      if (applyInServe && command === "serve") return true;
      return command === (preview ? "serve" : "build");
    },
    ...(preview && {
      transformIndexHtml: () => previewTags(status),
      /* Kept out of search engines by the server too, whatever a page's
         own robots tag says. */
      configureServer(server) {
        server.middlewares.use((_request, response, next) => {
          response.setHeader("X-Robots-Tag", "noindex, nofollow");
          next();
        });
      },
    }),
    enforce: "pre",
    /* The runtime build's compile-time constants: where to ask, and the
       baked values the hook applies when the API has nothing newer. */
    config: () =>
      runtime
        ? { define: { "import.meta.env.VITE_RBB_RUNTIME_SNAPSHOT": JSON.stringify(runtimeSnapshotEnv(runtime)), __RBB_BAKED_OVERRIDES__: JSON.stringify(JSON.stringify(overrides)) } }
        : {},
    /* A published page with a Givebutter checkout needs the build's
       public account id; without it the page keeps the site's own form
       (never a broken checkout) — said loudly, not silently. */
    configResolved(config) {
      if (snapshot && hasCheckouts(snapshot) && !config.env.VITE_GIVEBUTTER_ACCOUNT_ID)
        config.logger.warn("\n⚠ published snapshot: pages configure a Givebutter checkout, but VITE_GIVEBUTTER_ACCOUNT_ID is not set — they keep the site's own donation form.\n");
      if (config.command !== "build") return;
      if (runtime) {
        mkdirSync(dirname(runtimeFile), { recursive: true });
        writeFileSync(runtimeFile, `${JSON.stringify(runtime, null, 2)}\n`);
      } else rmSync(runtimeFile, { force: true });
    },
    resolveId: (id) => (id === VIRTUAL_ID ? RESOLVED : null),
    load: (id) => (id === RESOLVED ? `export default ${JSON.stringify(snapshot)};` : null),
    transform(code, id) {
      const target = Object.keys(SNAPSHOT_TARGETS).find((f) => id.split("?")[0].endsWith(f));
      if (!target) return null;
      try {
        /* Runtime: every target gets the hook — a newer snapshot may set
           any of them. Static: only what this snapshot sets. */
        if (runtime) return { code: appendRuntimeHook(code, target), map: null };
        if (!overrides?.[target]) return null;
        return { code: appendOverrides(code, target, overrides[target]), map: null };
      } catch (error) {
        this.error(error.message);
      }
    },
  };
}
