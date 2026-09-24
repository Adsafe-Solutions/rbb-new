/* Find Playwright for the scripts that drive a browser (audit, smoke,
   image checks, responsive images). It is deliberately NOT a project
   dependency: these run through `npx -p playwright node scripts/…`, which
   puts the package on PATH — not on the script's own module path, so a
   plain `import "playwright"` cannot see it. Look there as well.

   Resolves to the Playwright module (with `chromium`), or null. */
import { createRequire } from "node:module";
import { delimiter, join } from "node:path";
import { pathToFileURL } from "node:url";

const usable = (mod) => (mod?.chromium ? mod : mod?.default?.chromium ? mod.default : null);

export async function loadPlaywright() {
  try {
    const mod = usable(await import("playwright"));
    if (mod) return mod;
  } catch {}
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (!dir.endsWith(join("node_modules", ".bin"))) continue;
    try {
      const mod = usable(await import(pathToFileURL(createRequire(join(dir, "..", "noop.js")).resolve("playwright")).href));
      if (mod) return mod;
    } catch {}
  }
  return null;
}

/* The same, or stop with the command that works. */
export async function requirePlaywright(script) {
  const pw = await loadPlaywright();
  if (!pw) {
    console.error(`✗ needs Playwright: npx -p playwright node ${script}  (first time: npx playwright install chromium)`);
    process.exit(1);
  }
  return pw;
}
