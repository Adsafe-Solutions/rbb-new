/* The production technology audit — Document 17 §8, §20.

   Crawls a deployed (or locally served) site in a CLEAN browser profile
   and records what it actually does, rather than what the source says it
   should:
     - cookies set, with domain, expiry, flags, and the response that set them
     - localStorage / sessionStorage keys, IndexedDB databases, service workers
     - every network request by origin and type, first-party vs third-party
     - script and font origins specifically
   Writes build-meta/technology-audit.json and prints a summary.

   Run it against the real host after deployment, and again after any
   analytics, form, monitoring or other third-party integration. Its output
   is evidence for docs/TECHNOLOGY_AUDIT.md — not a public cookie
   statement on its own.

   NOT part of the build and not a project dependency; it needs Playwright:
     npx -p playwright node scripts/audit-technology.mjs https://<site> [route ...]
     (first time: npx playwright install chromium)
   With no routes given, it crawls build-meta/routes.json when present. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { requirePlaywright } from "./lib/playwright.mjs";

const { chromium } = await requirePlaywright("scripts/audit-technology.mjs");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [base, ...given] = process.argv.slice(2);
if (!base) {
  console.error("Usage: node scripts/audit-technology.mjs <base-url> [route ...]");
  process.exit(1);
}
const site = new URL(base).origin;
const routes = given.length
  ? given
  : JSON.parse(await readFile(join(root, "build-meta/routes.json"), "utf8").catch(() => '["/"]'));

const browser = await chromium.launch();
const context = await browser.newContext(); // clean profile: no cookies, no storage
const requests = new Map(); // origin → { types:Set, count, firstParty }
const cookieSetters = [];
const page = await context.newPage();

page.on("request", (req) => {
  const url = new URL(req.url());
  if (!/^https?:$/.test(url.protocol)) return;
  const entry = requests.get(url.origin) ?? { types: new Set(), count: 0, firstParty: url.origin === site };
  entry.types.add(req.resourceType());
  entry.count++;
  requests.set(url.origin, entry);
});
page.on("response", async (res) => {
  const header = (await res.allHeaders().catch(() => ({})))["set-cookie"];
  if (header) cookieSetters.push({ url: res.url().split("?")[0], cookies: header.split("\n").map((c) => c.split("=")[0]) });
});

const storage = { localStorage: new Set(), sessionStorage: new Set(), indexedDB: new Set(), serviceWorkers: new Set() };
for (const route of routes) {
  await page.goto(site + route, { waitUntil: "networkidle" }).catch(() => {});
  /* Let anything that waits for interaction or idle time run. */
  await page.mouse.move(200, 200);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
  const s = await page.evaluate(async () => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
    idb: (await indexedDB.databases?.())?.map((d) => d.name) ?? [],
    sw: (await navigator.serviceWorker?.getRegistrations?.())?.map((r) => r.scope) ?? [],
  }));
  s.local.forEach((k) => storage.localStorage.add(k));
  s.session.forEach((k) => storage.sessionStorage.add(k));
  s.idb.forEach((k) => storage.indexedDB.add(k));
  s.sw.forEach((k) => storage.serviceWorkers.add(k));
}

const cookies = (await context.cookies()).map((c) => ({
  name: c.name,
  domain: c.domain,
  expires: c.expires === -1 ? "session" : new Date(c.expires * 1000).toISOString(),
  httpOnly: c.httpOnly,
  secure: c.secure,
  sameSite: c.sameSite,
  thirdParty: !site.endsWith(c.domain.replace(/^\./, "")),
}));

const origins = [...requests].map(([origin, e]) => ({ origin, firstParty: e.firstParty, types: [...e.types].sort(), requests: e.count }));
const report = {
  site,
  auditedAt: new Date().toISOString(),
  routesCrawled: routes.length,
  cookies,
  cookieSetters,
  storage: Object.fromEntries(Object.entries(storage).map(([k, v]) => [k, [...v]])),
  thirdPartyOrigins: origins.filter((o) => !o.firstParty),
  scriptOrigins: origins.filter((o) => o.types.includes("script")).map((o) => o.origin),
  fontOrigins: origins.filter((o) => o.types.includes("font") || o.types.includes("stylesheet")).map((o) => o.origin),
};

await mkdir(join(root, "build-meta"), { recursive: true });
await writeFile(join(root, "build-meta/technology-audit.json"), JSON.stringify(report, null, 2) + "\n");
await browser.close();

console.log(`Audited ${site} — ${routes.length} routes, clean profile`);
console.log(`  cookies:           ${cookies.length ? cookies.map((c) => `${c.name} (${c.domain})`).join(", ") : "none"}`);
for (const [k, v] of Object.entries(report.storage)) console.log(`  ${k.padEnd(18)} ${v.length ? v.join(", ") : "none"}`);
console.log(`  script origins:    ${report.scriptOrigins.join(", ") || "none"}`);
console.log(`  font/style origins:${" " + (report.fontOrigins.join(", ") || "none")}`);
console.log(`  third-party:       ${report.thirdPartyOrigins.map((o) => `${o.origin} [${o.types.join("/")}] ×${o.requests}`).join("; ") || "none"}`);
console.log("  → build-meta/technology-audit.json");
