/* Production smoke test — Document 25 §12. Repeatable, against ANY
   deployed copy of the site: the real host on launch day, a preview, or
   the local reference server (server/dev-server.mjs).

     npm run smoke -- --url=https://www.<domain>              (production)
     npm run smoke -- --url=http://localhost:5190             (local)
     npm run smoke -- --url=… --expect=local                  (a working copy)
     npm run smoke -- --url=https://<preview> --expect=preview --origin=https://www.<domain>
                                         (the production artifact on a preview URL)
     npx -p playwright node scripts/smoke-test.mjs --url=… --browser

   HTTP checks (no dependencies — plain fetch, redirects NOT followed):
     - every pre-rendered route (build-meta/routes.json) answers 200 HTML
       with an <h1>
     - an unknown path answers a real 404
     - every permanent redirect (build-meta/redirects.json) answers
       301/308 to its target
     - security headers on a page and on an asset; HSTS required on https
     - on https, plain http redirects to https
     - robots.txt / sitemap.xml / canonicals match the mode and the origin
     - every image and asset the pages reference loads
     - no credential in any page, ever (src/lib/releaseMarkers.js); and
       for --expect=production, no working placeholder content or
       placeholder contact value either — a release must carry RBB's own
       content (Document 27)
     - the form and donation endpoints answer according to their state
     - the host serves THIS release (not a default page or an old deploy):
       its page references the same hashed bundle as the local dist/
     - HTML is revalidated (not cached stale), API answers are no-store
     - preview (--expect=preview): the host marks it non-indexable
       (X-Robots-Tag: noindex or robots Disallow) and canonicals point at
       the production --origin, never at the preview
   Browser checks (--browser, needs Playwright): console errors, CSP
   violations, cookies and web storage, third-party requests (approved
   origins only), the skip link, and the mobile menu.

   Uses the build-meta/ of the artifact that was deployed — run it from the
   same checkout that built the release. Exits 1 on any failure. */
import { readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPlaywright } from "./lib/playwright.mjs";
import { CREDENTIALS, WORKING_MARKERS, PLACEHOLDER_CONTACT } from "../src/lib/releaseMarkers.js";
import { APPROVED_ORIGINS, RAZORPAY } from "./security-policy.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? fallback;
const base = arg("url", "http://localhost:5190").replace(/\/$/, "");
const expect = arg("expect", "production");
/* The production origin a preview's canonicals must point at. */
const origin = arg("origin", null);
const https = base.startsWith("https://");
const meta = (f) => JSON.parse(readFileSync(join(root, "build-meta", f), "utf8"));
const routes = meta("routes.json");
const redirects = meta("redirects.json");

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });
const get = (path, init = {}) => fetch(path.startsWith("http") ? path : base + path, { redirect: "manual", ...init });

/* ---------------- routes ---------------- */
const pages = {};
const bad = [];
for (const route of routes) {
  const res = await get(route);
  const html = await res.text();
  pages[route] = { html, headers: res.headers };
  if (res.status !== 200 || !/text\/html/.test(res.headers.get("content-type") ?? "") || !/<h1[\s>]/.test(html))
    bad.push(`${route} → ${res.status}`);
}
check(`${routes.length} pre-rendered routes answer 200 HTML with an <h1>`, !bad.length, bad.slice(0, 5).join(", "));

const missing = await get(`/__smoke-missing-${Date.now()}`);
check("an unknown path answers a real 404", missing.status === 404, `got ${missing.status}`);

const wrong = [];
for (const { from, to } of redirects) {
  const res = await get(from);
  const location = res.headers.get("location") ?? "";
  const target = location.replace(base, "").replace(/^https?:\/\/[^/]+/, "");
  if (![301, 308].includes(res.status) || target !== to) wrong.push(`${from} → ${res.status} ${location || "(no Location)"}`);
}
check(`${redirects.length} redirects are permanent (301/308) to the right target`, !wrong.length, wrong.slice(0, 4).join("; "));

/* ---------------- headers & HTTPS ---------------- */
const home = pages["/"]?.headers ?? new Headers();
const need = {
  "content-security-policy": /default-src 'self'/,
  "x-content-type-options": /nosniff/,
  "referrer-policy": /strict-origin-when-cross-origin/,
  "permissions-policy": /camera=\(\)/,
  "cross-origin-opener-policy": /same-origin/,
};
const missingHeaders = Object.entries(need)
  .filter(([h, re]) => !re.test(home.get(h) ?? ""))
  .map(([h]) => h);
if (!/DENY/i.test(home.get("x-frame-options") ?? "") && !/frame-ancestors 'none'/.test(home.get("content-security-policy") ?? ""))
  missingHeaders.push("x-frame-options / frame-ancestors");
check("security headers are sent as HTTP headers", !missingHeaders.length, missingHeaders.join(", "));
if (/unsafe-eval|\*\s|\*;/.test(home.get("content-security-policy") ?? ""))
  check("CSP has no wildcard or unsafe-eval", false, "found");
if (https) {
  check("HSTS is sent on https", /max-age=\d+/.test(home.get("strict-transport-security") ?? ""));
  const plain = await get(base.replace(/^https:/, "http:") + "/").catch(() => null);
  check(
    "plain http redirects permanently to https",
    plain && [301, 308].includes(plain.status) && /^https:/.test(plain.headers.get("location") ?? ""),
    plain ? `got ${plain.status}` : "http not reachable"
  );
} else {
  check("HSTS is NOT sent on a non-https address", !home.get("strict-transport-security"));
}
const asset = Object.values(pages)[0]?.html.match(/\/assets\/[\w.-]+\.js/)?.[0];
if (asset) {
  const res = await get(asset);
  check("hashed assets are cached immutably", /immutable/.test(res.headers.get("cache-control") ?? ""), res.headers.get("cache-control") ?? "none");
}

/* ---------------- robots, sitemap, canonicals ---------------- */
const robots = await (await get("/robots.txt")).text();
const disallowAll = /Disallow:\s*\/\s*$/m.test(robots);
if (expect === "preview") {
  const robotsHeader = home.get("x-robots-tag") ?? "";
  check("preview is not indexable (X-Robots-Tag: noindex or robots Disallow)", /noindex/i.test(robotsHeader) || disallowAll, robotsHeader || "no X-Robots-Tag");
} else {
  check("robots.txt allows crawling", !disallowAll);
}
const sitemapRes = await get("/sitemap.xml");
const canonicals = Object.entries(pages)
  .map(([route, p]) => [route, p.html.match(/rel="canonical" href="([^"]+)"/)?.[1]])
  .filter(([, c]) => c);
if (expect === "preview") {
  if (!origin) check("preview needs --origin=https://<production domain>", false);
  else
    check(
      "preview canonicals point at the production origin, not the preview",
      canonicals.length > 0 && canonicals.every(([, c]) => c.startsWith(origin)),
      `${canonicals.length} canonicals`
    );
} else if (https) {
  const xml = sitemapRes.status === 200 ? await sitemapRes.text() : "";
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  check("sitemap.xml lists only this origin's pages", locs.length > 0 && locs.every((l) => l.startsWith(base)), `${locs.length} URLs`);
  check("canonicals point at this origin", canonicals.length > 0 && canonicals.every(([, c]) => c.startsWith(base)), `${canonicals.length} canonicals`);
} else {
  check("no production origin here: no canonicals point anywhere else", canonicals.every(([, c]) => c.startsWith(base)));
}

/* ---------------- images & assets ---------------- */
const refs = new Set();
for (const { html } of Object.values(pages))
  for (const m of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"|srcSet="([^"]+)"/gi)) {
    if (m[1]) refs.add(m[1]);
    else for (const part of m[2].split(",")) refs.add(part.trim().split(" ")[0]);
  }
const brokenAssets = [];
for (const ref of refs) {
  if (!ref.startsWith("/")) continue;
  const res = await get(ref, { method: "HEAD" });
  if (res.status !== 200) brokenAssets.push(`${ref} → ${res.status}`);
}
check(`${refs.size} referenced images/assets load`, !brokenAssets.length, brokenAssets.slice(0, 4).join(", "));

/* ---------------- this release, caching ---------------- */
const localBundle = readFileSync(join(root, "dist", "index.html"), "utf8").match(/\/assets\/index-[\w-]+\.js/)?.[0];
const liveBundle = pages["/"]?.html.match(/\/assets\/index-[\w-]+\.js/)?.[0];
check(
  "the host serves this release (same hashed bundle as the local build)",
  Boolean(localBundle) && localBundle === liveBundle,
  `local ${localBundle ?? "none"} · deployed ${liveBundle ?? "none"}`
);
const htmlCache = home.get("cache-control") ?? "";
check(
  "HTML is revalidated on every visit (no stale pages after a release)",
  /no-cache|no-store|max-age=0|must-revalidate/.test(htmlCache),
  htmlCache || "no Cache-Control"
);

/* ---------------- credentials, and final content ----------------
   A credential is a failure wherever this runs. Working placeholder
   content is normal until launch (Document 27), so it only fails a
   --expect=production run. */
const scan = (rules) => {
  const found = [];
  for (const [route, { html }] of Object.entries(pages)) {
    const text = html.replaceAll("name@example.com", "");
    for (const [rule, re] of rules) if (re.test(text)) found.push(`${route}: ${rule}`);
  }
  return found;
};
const secrets = scan(CREDENTIALS);
check("no credential on any page", !secrets.length, secrets.slice(0, 4).join("; "));
if (expect === "production") {
  const placeholders = scan([...WORKING_MARKERS, ...PLACEHOLDER_CONTACT]);
  check(
    "no working placeholder content or placeholder contact value on any page",
    !placeholders.length,
    placeholders.slice(0, 4).join("; ")
  );
}

/* ---------------- endpoints, by activation state ---------------- */
const forms = await get("/api/forms");
if (forms.status === 405)
  check("form endpoint answers are never cached (no-store)", /no-store/.test(forms.headers.get("cache-control") ?? ""));
check(
  "form endpoint: deployed and refusing GET (405), or not deployed (404)",
  [404, 405].includes(forms.status),
  `GET /api/forms → ${forms.status}${forms.status === 404 ? " (no form function deployed — forms must stay disabled)" : ""}`
);
const donations = await get("/api/donations/config");
const donationBody = donations.status === 200 ? await donations.json().catch(() => ({})) : null;
if (donations.status === 200)
  check("payment endpoint answers are never cached (no-store)", /no-store/.test(donations.headers.get("cache-control") ?? ""));
check(
  "donation endpoint answers according to its state",
  donations.status === 404 || donations.status === 200,
  donations.status === 404
    ? "not deployed (donations must stay closed)"
    : donationBody?.ok
      ? `ON — mode ${donationBody.mode}${donationBody.mode === "test" && expect === "production" ? " ⚠ TEST mode on production" : ""}`
      : "deployed, OFF"
);
if (expect === "production" && donationBody?.ok && donationBody.mode !== "live")
  check("production does not take test payments", false, `mode ${donationBody.mode}`);

/* ---------------- browser ---------------- */
if (process.argv.includes("--browser")) {
  const loaded = await loadPlaywright();
  const pw = loaded?.chromium ? loaded : loaded?.default;
  if (!pw?.chromium) {
    check("browser checks", false, "Playwright not found — npx -p playwright node scripts/smoke-test.mjs --browser");
  } else {
    const browser = await pw.chromium.launch();
    const approved = new Set([new URL(base).origin, ...Object.values(APPROVED_ORIGINS).flat(), ...RAZORPAY.script, ...RAZORPAY.frame, ...RAZORPAY.connect]);
    for (const width of [1280, 375]) {
      const ctx = await browser.newContext({ viewport: { width, height: 850 } });
      const page = await ctx.newPage();
      const errors = [];
      const thirdParty = new Set();
      const mixed = new Set();
      page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 100)));
      page.on("pageerror", (e) => errors.push(e.message.slice(0, 100)));
      page.on("request", (r) => {
        if (https && r.url().startsWith("http:")) mixed.add(r.url().slice(0, 80));
        const o = new URL(r.url()).origin;
        if (!approved.has(o) && !o.startsWith("data:")) thirdParty.add(o);
      });
      await page.addInitScript(() => {
        window.__csp = [];
        document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(e.violatedDirective));
      });
      let csp = 0;
      let storage = 0;
      for (const route of routes) {
        const res = await page.goto(base + route, { waitUntil: "networkidle" });
        if (!res || res.status() !== 200) errors.push(`${route} → ${res?.status()}`);
        csp += await page.evaluate(() => window.__csp.length);
        storage += await page.evaluate(() => localStorage.length + sessionStorage.length);
      }
      const cookies = await ctx.cookies();
      check(`@${width}px: no console errors on ${routes.length} routes`, !errors.length, errors.slice(0, 3).join(" | "));
      check(`@${width}px: no CSP violations`, csp === 0, `${csp}`);
      check(`@${width}px: no cookies or web storage set`, cookies.length === 0 && storage === 0, `${cookies.length} cookies, ${storage} storage keys`);
      check(`@${width}px: no unapproved third-party requests`, !thirdParty.size, [...thirdParty].join(", "));
      if (https) check(`@${width}px: no mixed-content (http) requests`, !mixed.size, [...mixed].slice(0, 3).join(", "));
      await page.goto(base + "/", { waitUntil: "networkidle" });
      await page.keyboard.press("Tab");
      const skip = await page.evaluate(() => document.activeElement?.getAttribute("href"));
      check(`@${width}px: first Tab reaches the skip link`, skip === "#main", skip ?? "none");
      if (width === 375) {
        await page.getByRole("button", { name: /menu/i }).first().click();
        await page.waitForTimeout(400);
        check("mobile menu opens with its links", await page.getByRole("link", { name: "Stories" }).last().isVisible());
      }
      await ctx.close();
    }
    await browser.close();
  }
}

/* ---------------- report ---------------- */
const failed = results.filter((r) => !r.ok);
console.log(`Smoke test — ${base} (expecting ${expect})`);
for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.detail ? `  [${r.detail}]` : ""}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
