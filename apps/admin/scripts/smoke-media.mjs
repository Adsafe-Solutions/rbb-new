/* Browser smoke test of the Media Library, against a running admin and the
   API behind it, with working media storage — real R2 (bucket CORS must
   allow this admin's origin) or, locally, the signature-checking fake:

     # API with the fake R2 (apps/api):  node test/support/dev-server-fake-storage.ts
     ADMIN_URL=http://localhost:5174 ADMIN_SMOKE_EMAIL=… ADMIN_SMOKE_PASSWORD=… \
       npx -y -p playwright -p axe-core node scripts/smoke-media.mjs

   Use a LOCAL or test account. Every file it uploads is named
   smoke-<run>-…, and it deletes exactly those at the end — never anything
   else in the library. The password is never printed.

   Checks: direct browser upload of JPEG/PNG/WebP/AVIF (bytes never sent to
   the API), client-side refusal of unsupported or oversized files, cancel
   and retry, the grid and its states, the alt-text warning, editing and
   saving details, search / filter / sort, delete with confirmation,
   2/3/4+ column layouts with no page overflow, the detail drawer on
   mobile, keyboard focus return, and an axe scan of each view.
   SCREENSHOTS=<dir> saves a screenshot per view. Exits 1 on any failure. */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { pathToFileURL } from "node:url";

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
  console.error("Needs Playwright: npx -y -p playwright -p axe-core node scripts/smoke-media.mjs");
  process.exit(1);
}
const playwright = await import(pathToFileURL(playwrightPath).href).then((m) => (m.chromium ? m : m.default));
const axePath = resolveFromPath("axe-core/axe.min.js");
const axeSource = axePath ? readFileSync(axePath, "utf8") : null;

const base = process.env.ADMIN_URL ?? "http://localhost:5174";
const email = process.env.ADMIN_SMOKE_EMAIL;
const password = process.env.ADMIN_SMOKE_PASSWORD;
const shots = process.env.SCREENSHOTS;
if (!email || !password) {
  console.error("Set ADMIN_SMOKE_EMAIL and ADMIN_SMOKE_PASSWORD (a local/test account).");
  process.exit(1);
}

const FIXTURES = new URL("../../api/test/fixtures/media/", import.meta.url);
const run = Math.random().toString(36).slice(2, 8);
const file = (fixture, mimeType, as) => ({ name: `smoke-${run}-${as ?? fixture}`, mimeType, buffer: readFileSync(new URL(fixture, FIXTURES)) });

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail });
const browser = await playwright.chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const consoleErrors = [];
// 401: /auth/me before signing in. CONNECTION_RESET: the transfer this test breaks on purpose.
page.on("console", (m) => m.type() === "error" && !/status of 401|ERR_CONNECTION_RESET/.test(m.text()) && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(e.message));

/* Every request the browser makes: file bytes must go to storage only. */
const apiBodies = [];
const storagePuts = [];
page.on("request", (request) => {
  const url = new URL(request.url());
  if (url.pathname.startsWith("/api/")) apiBodies.push(request.postDataBuffer()?.length ?? 0);
  if (request.method() === "PUT" && url.searchParams.has("X-Amz-Signature")) storagePuts.push(url.host);
});
const isStoragePut = (url) => url.searchParams.has("X-Amz-Signature");

const visibleSoon = (locator, timeout = 5000) => locator.waitFor({ state: "visible", timeout }).then(() => true, () => false);
/* The library keeps the previous results on screen until its new list
   request answers — over a real network that can outlast any fixed pause.
   Wait for THAT response (by its query), then for it to render. */
const listLoaded = (match) =>
  page
    .waitForResponse((r) => {
      const u = new URL(r.url());
      return r.request().method() === "GET" && u.pathname === "/api/v1/media" && match(u.searchParams);
    }, { timeout: 20_000 })
    .then(() => page.waitForTimeout(150), () => {});
const shot = async (name) => shots && page.screenshot({ path: join(shots, `${name}.png`) });
const noHorizontalScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const columns = () => page.locator('ul[aria-label="Media files"]').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
const mine = () => page.locator(`[data-media-id]`).filter({ hasText: `smoke-${run}-` });
const tile = (name) => page.locator("[data-media-id]").filter({ hasText: `smoke-${run}-${name}` });

async function axe(name) {
  if (!axeSource) return;
  await page.evaluate(axeSource);
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, { resultTypes: ["violations"] });
    return result.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s) — ${v.nodes[0]?.target?.join(" ")}`);
  });
  check(`axe: no violations — ${name}`, violations.length === 0, violations.join(" | "));
}

async function openMedia() {
  await page.goto(`${base}/media`);
  await page.getByRole("heading", { level: 1, name: "Media" }).waitFor();
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
}

try {
  await page.goto(`${base}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByTestId("user-role").waitFor();

  // Navigation: Media is a real module now.
  const nav = page.locator('a[data-nav-item="media"]');
  check("sidebar: Media is a link (no longer 'Soon')", (await nav.count()) === 1);
  await nav.click();
  await page.getByRole("heading", { level: 1, name: "Media" }).waitFor();
  check("sidebar: Media is the current page", (await nav.getAttribute("aria-current")) === "page");
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
  const emptyLibrary = (await page.locator("[data-media-id]").count()) === 0;
  if (emptyLibrary) {
    check("empty library: says so plainly", await page.getByRole("heading", { name: "Your media library is empty." }).isVisible());
    check("empty library: no demo/sample wording", !/demo|sample|coming soon/i.test(await page.locator("main").innerText()));
    await shot("media-empty");
    await axe("empty media library");
  }

  // Upload four formats at once.
  await page.getByRole("button", { name: "Upload" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Upload media" });
  await dialog.waitFor();
  await page.getByTestId("upload-input").setInputFiles([
    file("sample.png", "image/png"),
    file("sample.jpg", "image/jpeg"),
    file("sample.webp", "image/webp"),
    file("sample.avif", "image/avif"),
  ]);
  const uploaded = dialog.locator('[data-phase="done"]');
  await page.waitForFunction(() => document.querySelectorAll('[data-phase="done"]').length >= 4, null, { timeout: 30_000 }).catch(() => {});
  check("upload: four images (JPEG, PNG, WebP, AVIF) uploaded", (await uploaded.count()) === 4, `${await uploaded.count()} done`);
  check("upload: the files went straight to storage (4 presigned PUTs)", storagePuts.length === 4, `${storagePuts.length} PUT(s)`);
  check("upload: no request to the API carried file bytes", Math.max(0, ...apiBodies) < 2048, `largest API body ${Math.max(0, ...apiBodies)} bytes`);
  check("upload: no presigned URL left on the page", !(await page.content()).includes("X-Amz-Signature"));

  // Refused before any request: unsupported type, oversize.
  const putsBefore = storagePuts.length;
  await page.getByTestId("upload-input").setInputFiles([
    { name: `smoke-${run}-logo.svg`, mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') },
    { name: `smoke-${run}-anim.gif`, mimeType: "image/gif", buffer: Buffer.from("GIF89a") },
    { name: `smoke-${run}-huge.jpg`, mimeType: "image/jpeg", buffer: Buffer.alloc(10 * 1024 * 1024 + 1, 0xff) },
  ]);
  await page.waitForTimeout(300);
  const failedText = await dialog.locator('[data-phase="failed"]').allInnerTexts();
  check("refused: SVG and GIF — 'This file type isn't supported.'", failedText.filter((t) => t.includes("This file type isn't supported.")).length === 2, failedText.join(" | "));
  check("refused: oversized — 'File exceeds the maximum allowed size'", failedText.some((t) => t.includes("File exceeds the maximum allowed size")), failedText.join(" | "));
  check("refused files: no Retry offered, nothing sent", (await dialog.locator('[data-phase="failed"]').getByRole("button", { name: "Retry", exact: true }).count()) === 0 && storagePuts.length === putsBefore);
  await shot("upload-dialog");
  await axe("upload dialog");

  // A failed transfer, then Retry.
  let failOnce = true;
  await page.route(isStoragePut, (route) => (failOnce ? ((failOnce = false), route.abort("connectionreset")) : route.continue()));
  await page.getByTestId("upload-input").setInputFiles([file("sample.png", "image/png", "retry.png")]);
  const retryItem = dialog.locator("li").filter({ hasText: "retry.png" });
  await page.waitForFunction(() => [...document.querySelectorAll("li[data-phase]")].some((li) => li.textContent.includes("retry.png") && li.dataset.phase === "failed"), null, { timeout: 15_000 }).catch(() => {});
  check("network failure: 'Upload failed. Please try again.'", (await retryItem.innerText()).includes("Upload failed. Please try again."), await retryItem.innerText());
  await retryItem.getByRole("button", { name: "Retry", exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll("li[data-phase]")].some((li) => li.textContent.includes("retry.png") && li.dataset.phase === "done"), null, { timeout: 15_000 }).catch(() => {});
  check("retry: the second attempt succeeds", (await retryItem.getAttribute("data-phase")) === "done");
  await page.unroute(isStoragePut);

  // Cancel mid-transfer.
  await page.route(isStoragePut, (route) => setTimeout(() => route.continue().catch(() => {}), 4000));
  await page.getByTestId("upload-input").setInputFiles([file("sample.jpg", "image/jpeg", "cancel.jpg")]);
  const cancelItem = dialog.locator("li").filter({ hasText: "cancel.jpg" });
  await cancelItem.getByRole("button", { name: "Cancel", exact: true }).click({ timeout: 10_000 });
  await page.waitForFunction(() => [...document.querySelectorAll("li[data-phase]")].some((li) => li.textContent.includes("cancel.jpg") && li.dataset.phase === "cancelled"), null, { timeout: 10_000 }).catch(() => {});
  check("cancel: the upload is cancelled", (await cancelItem.getAttribute("data-phase")) === "cancelled");
  await page.unroute(isStoragePut);

  await page.getByRole("button", { name: "Done" }).click();
  await page.waitForTimeout(500);
  check("dialog: closes, focus returns to Upload", (await page.evaluate(() => document.activeElement?.textContent?.trim())) === "Upload");

  // The grid.
  await openMedia();
  check("grid: the uploads are listed", (await mine().count()) >= 6, `${await mine().count()} of this run's tiles`);
  check("grid: a cancelled upload shows as failed, not ready", (await tile("cancel.jpg").getAttribute("data-status")) === "failed");
  const thumb = tile("sample.png").locator("img");
  check("grid: thumbnails lazy-load from the public URL", (await thumb.getAttribute("loading")) === "lazy" && /^https?:\/\//.test((await thumb.getAttribute("src")) ?? ""));
  check("grid: thumbnails sit in a fixed 4:3 frame", (await tile("sample.png").locator("span").first().evaluate((el) => getComputedStyle(el).aspectRatio)) === "4 / 3");
  check("grid: alt text missing is flagged", await tile("sample.png").getByText("Alt text missing").isVisible());
  check("desktop: 4+ columns", (await columns()) >= 4, `${await columns()} columns`);
  check("no horizontal scroll (1440)", await noHorizontalScroll());
  await shot("media-grid-desktop");
  await axe("media library");

  // Detail: edit alt text, save; the warning goes.
  await tile("sample.png").click();
  const drawer = page.getByRole("dialog", { name: /^Details: / });
  await drawer.waitFor();
  const detailText = await drawer.innerText();
  check("detail: shows type, size, dimensions, date, ID and public URL", ["PNG", "48 × 32 px", "Uploaded", "Media ID", "Public URL"].every((t) => detailText.includes(t)));
  check("detail: alt-text warning shown", await drawer.getByText("Alt text missing").first().isVisible());
  check("detail: no storage secret or signed URL", !/X-Amz|secret|access.?key/i.test(await drawer.innerHTML()));
  await shot("media-detail-desktop");
  await axe("media detail");
  await drawer.getByLabel("Alt text").fill("A flat blue test square");
  await drawer.getByLabel("Credit").fill("Smoke test");
  await drawer.getByLabel("Consent").selectOption("not-required");
  await drawer.getByRole("button", { name: "Save details" }).click();
  await visibleSoon(page.getByRole("region", { name: "Notifications" }).getByText("Details saved"));
  check("detail: save confirms with a toast", await page.getByRole("region", { name: "Notifications" }).getByText("Details saved").isVisible());
  check("detail: alt-text warning cleared after save", (await drawer.getByText("Alt text missing").count()) === 0);
  await page.keyboard.press("Escape");
  await drawer.waitFor({ state: "hidden" });
  check("detail: Escape closes it", !(await drawer.isVisible()));
  check("detail: focus returns to the tile", (await page.evaluate(() => document.activeElement?.closest("[data-media-id]")?.textContent ?? "")).includes(`smoke-${run}-sample.png`));
  check("grid: the saved tile no longer warns", (await tile("sample.png").getByText("Alt text missing").count()) === 0);

  // Search, filter, sort.
  await page.getByLabel("Search by file name").fill(`smoke-${run}-sample.webp`);
  await page.waitForFunction((n) => document.querySelectorAll("[data-media-id]").length === 1 && document.querySelector("[data-media-id]").textContent.includes(n), `smoke-${run}-sample.webp`, { timeout: 5000 }).catch(() => {});
  check("search: by file name", (await page.locator("[data-media-id]").count()) === 1);
  const failedList = listLoaded((q) => q.get("status") === "failed" && q.get("search") === `smoke-${run}`);
  await page.getByLabel("Search by file name").fill(`smoke-${run}`);
  await page.getByLabel("Filter").selectOption("failed");
  await failedList;
  check("filter: Failed shows only failed uploads", (await page.locator("[data-media-id]").evaluateAll((els) => els.every((e) => e.dataset.status === "failed"))) && (await page.locator("[data-media-id]").count()) >= 1);
  const readyList = listLoaded((q) => q.get("status") === "ready");
  await page.getByLabel("Filter").selectOption("ready");
  await readyList;
  check("filter: Ready shows only ready media", await page.locator("[data-media-id]").evaluateAll((els) => els.length > 0 && els.every((e) => e.dataset.status === "ready")));
  const allList = listLoaded((q) => !q.has("status") && !q.has("type") && q.get("sort") !== "oldest");
  await page.getByLabel("Filter").selectOption("all");
  // Uploads run in parallel, so several can share a timestamp: compare
  // whole orders — oldest first must be newest first, reversed.
  const order = () => page.locator("[data-media-id]").evaluateAll((els) => els.map((e) => e.dataset.mediaId));
  await allList; // the "All media" filter's refresh
  const newest = await order();
  const oldestList = listLoaded((q) => q.get("sort") === "oldest");
  await page.getByLabel("Sort").selectOption("oldest");
  await oldestList;
  const oldest = await order();
  check("sort: oldest first is newest first reversed", newest.length > 1 && JSON.stringify(oldest) === JSON.stringify([...newest].reverse()), `${newest.length} items`);
  await page.getByLabel("Search by file name").fill("");
  await page.getByLabel("Sort").selectOption("newest");

  // Responsive.
  await page.setViewportSize({ width: 900, height: 1000 });
  await openMedia();
  check("tablet: 3 columns", (await columns()) === 3);
  check("no horizontal scroll (900)", await noHorizontalScroll());
  await page.setViewportSize({ width: 375, height: 812 });
  await openMedia();
  check("mobile: 2 columns", (await columns()) === 2);
  check("no horizontal scroll (375)", await noHorizontalScroll());
  await shot("media-grid-mobile");
  await tile("sample.jpg").click();
  await drawer.waitFor();
  const drawerBox = await drawer.boundingBox();
  check("mobile: details take the full screen width", drawerBox && drawerBox.width >= 370, `${drawerBox?.width}px`);
  await page.waitForTimeout(400); // let the drawer finish sliding in
  await shot("media-detail-mobile");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1440, height: 900 });

  // Delete (this run's files only), with confirmation.
  await openMedia();
  await page.getByLabel("Search by file name").fill(`smoke-${run}`);
  await page.waitForTimeout(600);
  await tile("sample.webp").click();
  await drawer.getByRole("button", { name: "Delete" }).click();
  const confirm = page.getByRole("dialog", { name: "Delete this file?" });
  await confirm.waitFor();
  check("delete: asks for confirmation; Cancel has focus", (await page.evaluate(() => document.activeElement?.textContent?.trim())) === "Cancel");
  await confirm.getByRole("button", { name: "Delete file" }).click();
  await visibleSoon(page.getByRole("region", { name: "Notifications" }).getByText("Media deleted"), 20_000);
  await tile("sample.webp").waitFor({ state: "detached", timeout: 20_000 }).catch(() => {});
  check("delete: removed from the library", (await tile("sample.webp").count()) === 0);

  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
  if (!axeSource) console.log("(axe-core not found: accessibility scans skipped)");
} catch (error) {
  check("flow completed", false, error.message.split("\n")[0]);
} finally {
  // Remove every file this run created, through the API (soft delete + storage cleanup).
  try {
    const removed = await page.evaluate(async (prefix) => {
      let count = 0;
      const res = await fetch(`/api/v1/media?search=${encodeURIComponent(prefix)}&pageSize=100`, { credentials: "same-origin" });
      for (const media of (await res.json()).data ?? []) {
        if (!media.originalFilename.startsWith(prefix)) continue;
        const del = await fetch(`/api/v1/media/${media.id}`, { method: "DELETE", credentials: "same-origin" });
        if (del.ok) count++;
      }
      return count;
    }, `smoke-${run}-`);
    console.log(`(cleanup: deleted ${removed} file(s) created by this run)`);
  } catch {}
  await browser.close();
}

for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.ok || !r.detail ? "" : `  [${r.detail}]`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
