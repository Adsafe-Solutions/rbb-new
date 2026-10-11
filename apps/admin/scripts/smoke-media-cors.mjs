/* Browser proof of the storage CORS rule for direct uploads (M16),
   against a running admin and API — whatever storage the API is
   configured with: the local fake R2, or REAL R2 once its token and CORS
   rule are in place. A real browser:
     - PUTs from the admin origin with Content-Type only → allowed;
     - PUTs the same way from another origin → blocked by CORS;
     - PUTs from the admin origin with an extra header → blocked;
   and the preflight is inspected: the admin origin is allowed PUT with
   content-type, a foreign origin and DELETE get nothing.

     ADMIN_URL=http://localhost:5174 \
     ADMIN_SMOKE_EMAIL=<owner> ADMIN_SMOKE_PASSWORD=… \
       npx -y -p playwright node scripts/smoke-media-cors.mjs

   LOCAL or test data only: every upload it starts is aborted or deleted.
   It prints outcomes only — never an upload URL, key or password. */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { delimiter, join } from "node:path";
import { pathToFileURL } from "node:url";
import { requireTestTarget } from "../../api/test/support/smoke-target.mjs";

function resolveFromPath(name) {
  try {
    return createRequire(import.meta.url).resolve(name);
  } catch {}
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (!dir.endsWith(join("node_modules", ".bin"))) continue;
    try {
      return createRequire(join(dir, "..", "noop.js")).resolve(name);
    } catch {}
  }
  return null;
}
const playwrightPath = resolveFromPath("playwright");
if (!playwrightPath) {
  console.error("Needs Playwright: npx -y -p playwright node scripts/smoke-media-cors.mjs");
  process.exit(1);
}
const playwright = await import(pathToFileURL(playwrightPath).href).then((m) => (m.chromium ? m : m.default));

const base = process.env.ADMIN_URL ?? "http://localhost:5174";
/* Phase 0: never against a production API — asked before anything is written. */
await requireTestTarget(base);
const owner = { email: process.env.ADMIN_SMOKE_EMAIL, password: process.env.ADMIN_SMOKE_PASSWORD };
if (!owner.email || !owner.password) {
  console.error("Set ADMIN_SMOKE_EMAIL and ADMIN_SMOKE_PASSWORD (an OWNER in a local/test database).");
  process.exit(1);
}
const adminOrigin = new URL(base).origin;
const jpeg = readFileSync(new URL("../../api/test/fixtures/media/sample.jpg", import.meta.url));
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail });

const browser = await playwright.chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
await page.goto(`${base}/login`);
await page.getByLabel("Email").fill(owner.email);
await page.getByLabel("Password").fill(owner.password);
await page.getByRole("button", { name: "Sign in" }).click();
await page.getByTestId("user-role").waitFor();

const started = [];
const intent = async () => {
  const data = await page.evaluate(async (size) => {
    const r = await fetch("/api/v1/media/upload-intents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: "cors-smoke.jpg", mimeType: "image/jpeg", size }) });
    return (await r.json()).data;
  }, jpeg.byteLength);
  started.push(data.mediaId);
  return data;
};
/* A PUT from a page, as the upload dialog makes it: a CORS refusal is a TypeError. */
const putFrom = (from, url, headers) =>
  from.evaluate(
    async ({ url, headers, b64 }) => {
      try {
        const r = await fetch(url, { method: "PUT", headers, body: Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)) });
        return { status: r.status };
      } catch (e) {
        return { blocked: e.name };
      }
    },
    { url, headers, b64: jpeg.toString("base64") }
  );
const preflight = (url, origin, method, headers) =>
  fetch(url, { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": method, ...(headers ? { "Access-Control-Request-Headers": headers } : {}) } });

const foreignServer = createServer((_, res) => res.writeHead(200, { "content-type": "text/html" }).end("<!doctype html><title>Another site</title>")).listen(0, "127.0.0.1");
await new Promise((r) => foreignServer.once("listening", r));
const foreignOrigin = `http://127.0.0.1:${foreignServer.address().port}`;

try {
  const a = await intent();
  check("the upload goes to the storage origin — not the admin, not the API", new URL(a.uploadUrl).origin !== adminOrigin && !a.uploadUrl.includes("/api/"));
  check("the browser is told to send one header only: Content-Type", JSON.stringify(Object.keys(a.uploadHeaders)) === '["Content-Type"]', Object.keys(a.uploadHeaders).join(","));

  let p = await preflight(a.uploadUrl, adminOrigin, "PUT", "content-type");
  check("preflight: the admin origin may PUT with content-type", p.ok && p.headers.get("access-control-allow-origin") === adminOrigin, `status ${p.status}`);
  check("preflight: the allowed methods include PUT and not DELETE/POST", /PUT/.test(p.headers.get("access-control-allow-methods") ?? "") && !/DELETE|POST/.test(p.headers.get("access-control-allow-methods") ?? ""), p.headers.get("access-control-allow-methods") ?? "none");
  p = await preflight(a.uploadUrl, foreignOrigin, "PUT", "content-type");
  check("preflight: another origin gets no allowance", !p.headers.get("access-control-allow-origin"), `status ${p.status}`);
  p = await preflight(a.uploadUrl, adminOrigin, "DELETE");
  check("preflight: DELETE from the admin origin is not allowed", !p.ok || !/DELETE/.test(p.headers.get("access-control-allow-methods") ?? ""), `status ${p.status}`);

  const put = await putFrom(page, a.uploadUrl, a.uploadHeaders);
  check("a real browser PUT from the admin origin succeeds", put.status === 200, JSON.stringify(put));
  const done = await page.evaluate(async (id) => (await fetch(`/api/v1/media/${id}/complete`, { method: "POST" })).status, a.mediaId);
  check("the API then verifies the stored object (complete → 200)", done === 200, `status ${done}`);

  const b = await intent();
  const other = await context.newPage();
  await other.goto(foreignOrigin);
  const foreign = await putFrom(other, b.uploadUrl, b.uploadHeaders);
  check("the same PUT from another origin is blocked by CORS", foreign.blocked === "TypeError", JSON.stringify(foreign));

  const c = await intent();
  const extra = await putFrom(page, c.uploadUrl, { ...c.uploadHeaders, "X-Extra": "1" });
  check("a PUT with an extra header is blocked (only Content-Type is allowed)", extra.blocked === "TypeError", JSON.stringify(extra));
} finally {
  // Every upload this run started: abort (pending) or delete (ready).
  for (const id of started)
    await page.evaluate(async (id) => {
      await fetch(`/api/v1/media/${id}/abort`, { method: "POST" });
      await fetch(`/api/v1/media/${id}`, { method: "DELETE" });
    }, id);
  const left = await page.evaluate(async (ids) => (await Promise.all(ids.map((id) => fetch(`/api/v1/media/${id}`).then((r) => r.status)))).filter((s) => s !== 404).length, started);
  check("cleanup: every upload this run started is gone", left === 0, `${left} left`);
  foreignServer.close();
  await browser.close();
}

for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok || !r.detail ? "" : `  [${r.detail}]`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
