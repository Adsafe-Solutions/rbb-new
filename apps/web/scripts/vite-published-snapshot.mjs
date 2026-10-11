/* The Vite plugin that applies a published snapshot to a build (see
   scripts/snapshot-adapter.mjs for WHAT it sets, and
   scripts/published-snapshot.mjs for where the snapshot comes from).

   Runs in BUILDS only (client and server alike, so they agree). With no
   build-meta/published-snapshot.json — or RBB_SNAPSHOT=off — it changes
   nothing at all: the build is byte-identical to one without the plugin.

   It also serves `virtual:rbb-published-snapshot` (the snapshot, or null)
   for the server build's contract check; the client never imports it.

   M36 — LOCAL PREVIEW (`npm run preview:cms`, scripts/cms-preview.mjs):
   with RBB_PREVIEW=1 it applies build-meta/preview-snapshot.json — what an
   owner's next publish WOULD put live — to the DEV SERVER only, and marks
   every page as a preview (a banner, noindex, "[Preview]" in the title).
   A build refuses to run in that mode, so a preview never reaches dist/;
   without it the preview file is never read. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SNAPSHOT_TARGETS, appendOverrides, applyRewrites, hasCheckouts, overridesFrom, rewritesFrom } from "./snapshot-adapter.mjs";

export const VIRTUAL_ID = "virtual:rbb-published-snapshot";
const RESOLVED = "\0rbb-published-snapshot";
export const PREVIEW_FILE = "build-meta/preview-snapshot.json";
export const PREVIEW_STATUS_FILE = "build-meta/preview-snapshot-status.json";

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

export default function publishedSnapshot({ root }) {
  const preview = process.env.RBB_PREVIEW === "1";
  const file = join(root, preview ? PREVIEW_FILE : "build-meta/published-snapshot.json");
  if (preview && !existsSync(file)) throw new Error(`RBB_PREVIEW=1 but there is no ${PREVIEW_FILE}: start the preview with \`npm run preview:cms\`.`);
  const snapshot = process.env.RBB_SNAPSHOT !== "off" && existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
  const status = preview && existsSync(join(root, PREVIEW_STATUS_FILE)) ? JSON.parse(readFileSync(join(root, PREVIEW_STATUS_FILE), "utf8")) : null;
  const overrides = snapshot ? overridesFrom(snapshot) : null;
  /* M23: the few source expressions a published snapshot rewrites. */
  const rewrites = snapshot ? rewritesFrom(snapshot) : {};

  return {
    name: "rbb-published-snapshot",
    /* A published snapshot: builds only. A preview: the dev server only. */
    apply(_config, { command }) {
      if (preview && command === "build") throw new Error("RBB_PREVIEW=1 is for the local dev server only (npm run preview:cms) — a preview is never built.");
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
    /* A published page with a Givebutter checkout needs the build's
       public account id; without it the page keeps the site's own form
       (never a broken checkout) — said loudly, not silently. */
    configResolved(config) {
      if (snapshot && hasCheckouts(snapshot) && !config.env.VITE_GIVEBUTTER_ACCOUNT_ID)
        config.logger.warn("\n⚠ published snapshot: pages configure a Givebutter checkout, but VITE_GIVEBUTTER_ACCOUNT_ID is not set — they keep the site's own donation form.\n");
    },
    resolveId: (id) => (id === VIRTUAL_ID ? RESOLVED : null),
    load: (id) => (id === RESOLVED ? `export default ${JSON.stringify(snapshot)};` : null),
    transform(code, id) {
      if (!overrides) return null;
      const target = Object.keys(SNAPSHOT_TARGETS).find((f) => id.split("?")[0].endsWith(f));
      if (!target || (!overrides[target] && !rewrites[target])) return null;
      try {
        const rewritten = applyRewrites(code, target, rewrites[target]);
        return { code: overrides[target] ? appendOverrides(rewritten, target, overrides[target]) : rewritten, map: null };
      } catch (error) {
        this.error(error.message);
      }
    },
  };
}
