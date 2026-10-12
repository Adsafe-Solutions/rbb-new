/* The RUNTIME snapshot — what the built site does once it is in a
   visitor's browser (docs/PUBLISHING.md "Runtime snapshot").

   A build still bakes the published snapshot it fetched into its HTML
   (scripts/published-snapshot.mjs → the Vite plugin → prerender), so the
   pre-rendered pages, search engines and a browser without JavaScript
   see published content. On top of that, when this file says so, the
   browser asks the API for the LATEST published snapshot before the
   content modules load (src/lib/runtimeBoot.js): a newer version is
   validated and applied in place of the baked one, so a publication
   shows on the next page load without a rebuild; the same version — the
   usual case, a 304 under the browser's own ETag revalidation — costs one
   small request; anything else keeps the baked snapshot, which is always
   valid (the build refused it otherwise).

   Decided here, from the build environment, in one place for the Vite
   plugin (which compiles it into the bundle) and the prerender (which
   lets the page policy connect to it):

     RBB_SNAPSHOT_URL                 the endpoint — the same one the build
                                      fetched; runtime fetching is on only
                                      for a build that applied a snapshot
     RBB_SNAPSHOT_RUNTIME=off         keep the site fully static (the build
                                      bakes the snapshot and nothing more)
     RBB_SNAPSHOT_RUNTIME_TIMEOUT_MS  how long the browser waits for the
                                      API before showing the baked content
                                      (default 3000)
     RBB_MEDIA_ORIGINS                extra https origins published images
                                      may load from, comma-separated — for
                                      a media domain the baked snapshot
                                      happens not to show yet. The origins
                                      of the baked snapshot's own media are
                                      always allowed. */

const DEFAULT_TIMEOUT_MS = 3000;

/* https anywhere; plain http only to this machine (a local API) — the
   same rule as the build's fetch. */
export const allowedSnapshotUrl = (value) => {
  try {
    const url = new URL(value);
    return !url.username && !url.password && (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)));
  } catch {
    return false;
  }
};

const httpsOrigin = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && url.origin;
  } catch {
    return null;
  }
};

/* Every origin the snapshot's media loads from — all of it, referenced
   or not, since a newer snapshot may show any of it. */
export const mediaOriginsOf = (snapshot) =>
  [...new Set(Object.values(snapshot?.media ?? {}).map((m) => httpsOrigin(m?.url)).filter(Boolean))].sort();

/* The runtime configuration for a build, or null: what the bundle
   carries (`url`, the baked `version`, `orgId`, `timeoutMs`) and what the
   page policy needs (`origin`, `mediaOrigins`). Throws on a configuration
   that cannot be honoured — never silently off. */
export function runtimeSnapshotConfig({ env = process.env, snapshot }) {
  if (!snapshot || env.RBB_SNAPSHOT === "off" || env.RBB_SNAPSHOT_RUNTIME === "off") return null;
  const url = env.RBB_SNAPSHOT_URL?.trim();
  if (!url) return null;
  if (!allowedSnapshotUrl(url)) throw new Error("runtime snapshot: RBB_SNAPSHOT_URL must be an https:// URL (http only for localhost)");
  const timeoutMs = env.RBB_SNAPSHOT_RUNTIME_TIMEOUT_MS === undefined || env.RBB_SNAPSHOT_RUNTIME_TIMEOUT_MS === "" ? DEFAULT_TIMEOUT_MS : Number(env.RBB_SNAPSHOT_RUNTIME_TIMEOUT_MS);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > 30_000) throw new Error("runtime snapshot: RBB_SNAPSHOT_RUNTIME_TIMEOUT_MS must be a whole number of milliseconds between 500 and 30000");
  const extra = (env.RBB_MEDIA_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const o of extra) if (httpsOrigin(o) !== o) throw new Error(`runtime snapshot: RBB_MEDIA_ORIGINS entry "${o}" is not a plain https origin`);
  return {
    url,
    origin: new URL(url).origin,
    version: snapshot.version,
    orgId: snapshot.organization.id,
    timeoutMs,
    mediaOrigins: [...new Set([...mediaOriginsOf(snapshot), ...extra])].sort(),
  };
}

/* What the bundle gets (src/config/env.js reads it): public values only. */
export const runtimeSnapshotEnv = (config) => (config ? JSON.stringify({ url: config.url, version: config.version, orgId: config.orgId, timeoutMs: config.timeoutMs }) : "");
