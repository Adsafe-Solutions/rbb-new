/* Browser smoke test of media governance (M16), against a running admin
   and API (storage: the local fake R2 — or REAL R2, unchanged): drag and
   drop and keyboard uploads that go straight to storage; empty, corrupt
   and mislabelled files refused (the API checks the file's own bytes);
   storage refusing the PUT (403) ends failed and retryable, never ready;
   an image the live website uses cannot be deleted, and the admin says
   where it is used; the library at 1440, 1024, 768 and 375px with axe.

     ADMIN_URL=http://localhost:5174 \
     ADMIN_SMOKE_EMAIL=<owner> ADMIN_SMOKE_PASSWORD=… \
       npx -y -p playwright -p axe-core node scripts/smoke-media-governance.mjs

   LOCAL or test data only: it uploads "smoke-<run>-…" images, creates a
   story, PUBLISHES THE WEBSITE, then archives the story, publishes again
   and deletes every image it uploaded. Passwords are never printed. */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
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
  console.error("Needs Playwright: npx -y -p playwright -p axe-core node scripts/smoke-media-governance.mjs");
  process.exit(1);
}
const playwright = await import(pathToFileURL(playwrightPath).href).then((m) => (m.chromium ? m : m.default));
const axePath = resolveFromPath("axe-core/axe.min.js");
const axeSource = axePath ? readFileSync(axePath, "utf8") : null;

const base = process.env.ADMIN_URL ?? "http://localhost:5174";
/* Phase 0: never against a production API — asked before anything is written. */
await requireTestTarget(base);
const owner = { email: process.env.ADMIN_SMOKE_EMAIL, password: process.env.ADMIN_SMOKE_PASSWORD };
const editor = { email: process.env.ADMIN_SMOKE_EDITOR_EMAIL, password: process.env.ADMIN_SMOKE_EDITOR_PASSWORD };
const shots = process.env.SCREENSHOTS;
if (!owner.email || !owner.password) {
  console.error("Set ADMIN_SMOKE_EMAIL and ADMIN_SMOKE_PASSWORD (an OWNER in a local/test database).");
  process.exit(1);
}
const run = Math.random().toString(36).slice(2, 7);
const T = (s) => `Smoke ${run} ${s}`;

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail });
const browser = await playwright.chromium.launch();
const consoleErrors = [];
const visibleSoon = (locator, timeout = 6000) => locator.waitFor({ state: "visible", timeout }).then(() => true, () => false);
const toast = (page, text) => page.getByRole("region", { name: "Notifications" }).getByText(text).first();
const shot = async (page, name) => shots && page.screenshot({ path: join(shots, `${name}.png`), fullPage: true });
/* M14: an owner's review in the editor — Submit for review, then Approve
   (confirmed in its dialog). The website publish puts it live. */
const approveUi = async (page) => {
  await page.getByRole("button", { name: "Submit for review" }).click();
  await visibleSoon(toast(page, "Submitted for review"));
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /^Approve this/ });
  await dialog.waitFor();
  await dialog.getByRole("button", { name: "Approve", exact: true }).click();
  return visibleSoon(toast(page, "Approved"));
};
const field = (page, name) => page.getByRole("textbox", { name, exact: true });

async function axe(page, name) {
  if (!axeSource) return;
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"), null, { timeout: 5000 }).catch(() => {});
  await page.evaluate(axeSource);
  const v = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ["violations"] })).violations.map((x) => `${x.id} (${x.impact}): ${x.nodes[0]?.target?.join(" ")}`));
  check(`axe: no violations — ${name}`, v.length === 0, v.join(" | "));
}
async function signIn(who, viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on("console", (m) => m.type() === "error" && !/status of (401|400|403|409)/.test(m.text()) && consoleErrors.push(m.text()));
  page.on("pageerror", (e) => consoleErrors.push(e.message));
  await page.goto(`${base}/login`);
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(who.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByTestId("user-role").waitFor();
  return { context, page };
}
const apiCall = (page, path, init = {}) =>
  page.evaluate(async ({ path, init }) => {
    const r = await fetch(path, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...init });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, { path, init });

const FIXTURES = new URL("../../api/test/fixtures/media/", import.meta.url);
const jpeg = readFileSync(new URL("sample.jpg", FIXTURES));
const uploaded = [];
let storyId = null;
let ownerPage = null;
const body = [{ type: "paragraph", children: [{ type: "text", text: "A smoke paragraph." }] }];
const noHorizontalScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const findMedia = async (page, name) => (await apiCall(page, `/api/v1/media?search=${encodeURIComponent(name)}&pageSize=50`)).body.data;

try {
  const { page } = await signIn(owner);
  ownerPage = page;
  const puts = [];
  const apiBodies = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) apiBodies.push(request.postDataBuffer()?.length ?? 0);
    if (request.method() === "PUT" && url.searchParams.has("X-Amz-Signature")) puts.push(url.origin);
  });
  await page.goto(`${base}/media`);
  await page.getByRole("heading", { level: 1, name: "Media" }).waitFor();

  /* ---------- Keyboard: open the dialog, reach the file chooser, close ---------- */
  await page.getByRole("button", { name: "Upload" }).first().focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Upload media" });
  check("keyboard: Upload opens the dialog", await visibleSoon(dialog));
  // "Choose files" is enabled once the upload policy has loaded (a network round trip).
  await dialog.getByRole("button", { name: "Choose files" }).and(page.locator("button:enabled")).waitFor({ timeout: 15_000 }).catch(() => {});
  let reached = false;
  for (let i = 0; i < 6 && !reached; i++) {
    await page.keyboard.press("Tab");
    reached = (await page.evaluate(() => document.activeElement?.textContent?.trim())) === "Choose files";
  }
  check("keyboard: Choose files is reachable by Tab", reached);
  await axe(page, "upload dialog");
  await page.keyboard.press("Escape");
  check("keyboard: Escape closes; focus returns to Upload", !(await dialog.isVisible()) && (await page.evaluate(() => document.activeElement?.textContent?.trim())) === "Upload");

  /* ---------- Drag and drop: straight to storage ---------- */
  await page.getByRole("button", { name: "Upload" }).first().click();
  const dropName = `smoke-${run}-dropped.jpg`;
  const data = await page.evaluateHandle(({ b64, name }) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], name, { type: "image/jpeg" }));
    return dt;
  }, { b64: jpeg.toString("base64"), name: dropName });
  await page.getByTestId("upload-dropzone").dispatchEvent("dragover", { dataTransfer: data });
  await page.getByTestId("upload-dropzone").dispatchEvent("drop", { dataTransfer: data });
  check("drag and drop: the dropped image uploads", await visibleSoon(dialog.locator('[data-phase="done"]').first(), 30_000));
  check("upload: the PUT went straight to storage, not the API or the admin", puts.length === 1 && puts[0] !== base && !puts[0].includes("/api"), puts.join(","));
  check("upload: no API request carried file bytes", Math.max(0, ...apiBodies) < 2048, `largest ${Math.max(0, ...apiBodies)} B`);
  const dropped = (await findMedia(page, dropName))[0];
  if (dropped) uploaded.push(dropped.id);
  check("ready: the record is ready, with a public URL and the file's own dimensions", dropped?.status === "ready" && dropped.publicUrl?.startsWith("http") && dropped.width > 0);

  /* ---------- Refused: empty, corrupt, mislabelled ---------- */
  const before = puts.length;
  await page.getByTestId("upload-input").setInputFiles([{ name: `smoke-${run}-empty.jpg`, mimeType: "image/jpeg", buffer: Buffer.alloc(0) }]);
  check("empty file: refused before any request", (await visibleSoon(dialog.getByText("This file is empty."))) && puts.length === before);
  await page.getByTestId("upload-input").setInputFiles([
    { name: `smoke-${run}-corrupt.jpg`, mimeType: "image/jpeg", buffer: Buffer.from("not an image at all — just bytes".repeat(64)) },
    { name: `smoke-${run}-lying.png`, mimeType: "image/png", buffer: jpeg },
  ]);
  await page.waitForFunction(() => document.querySelectorAll('[data-phase="failed"]').length >= 3, null, { timeout: 30_000 }).catch(() => {});
  const failedTexts = (await dialog.locator('[data-phase="failed"]').allInnerTexts()).join(" | ");
  check("corrupt / mislabelled: stored, then refused by the API's check of the bytes", (failedTexts.match(/isn't a valid image of the type it claims to be/g) ?? []).length === 2, failedTexts);
  for (const name of [`smoke-${run}-corrupt.jpg`, `smoke-${run}-lying.png`]) {
    const rec = (await findMedia(page, name))[0];
    if (rec) uploaded.push(rec.id);
    check(`${name.replace(`smoke-${run}-`, "")}: never ready (failed, no public URL)`, rec?.status === "failed" && rec.publicUrl === null, JSON.stringify(rec && [rec.status, rec.failureReason]));
  }
  /* ---------- Storage refuses the PUT (403 AccessDenied — as R2 does when
     its token lacks Object Write): failed, retryable, never ready ---------- */
  const isSignedPut = (route) => route.request().method() === "PUT" && new URL(route.request().url()).searchParams.has("X-Amz-Signature");
  await page.route("**/*", (route) => (isSignedPut(route) ? route.fulfill({ status: 403, contentType: "application/xml", body: "<Error><Code>AccessDenied</Code></Error>" }) : route.fallback()));
  const deniedName = `smoke-${run}-denied.jpg`;
  await page.getByTestId("upload-input").setInputFiles([{ name: deniedName, mimeType: "image/jpeg", buffer: jpeg }]);
  const deniedItem = dialog.locator("li").filter({ hasText: deniedName });
  await page.waitForFunction((n) => [...document.querySelectorAll("li[data-phase]")].some((li) => li.textContent.includes(n) && li.dataset.phase === "failed"), deniedName, { timeout: 15_000 }).catch(() => {});
  const deniedText = await deniedItem.innerText();
  check("storage refuses the PUT: 'Upload failed. Please try again.', no storage detail shown", deniedText.includes("Upload failed. Please try again.") && !/AccessDenied|X-Amz|r2\.cloudflarestorage/.test(deniedText), deniedText);
  check("storage refuses the PUT: Retry is offered", (await deniedItem.getByRole("button", { name: "Retry", exact: true }).count()) === 1);
  const denied = (await findMedia(page, deniedName))[0];
  if (denied) uploaded.push(denied.id);
  check("storage refuses the PUT: the record is aborted (failed), never ready", denied?.status === "failed" && denied.publicUrl === null, JSON.stringify(denied && [denied.status, denied.failureReason]));
  await page.unroute("**/*");
  await page.getByRole("button", { name: "Done" }).click();

  /* ---------- An image the live website uses cannot be deleted ---------- */
  const meta = (await apiCall(page, `/api/v1/media/${dropped.id}`)).body.data;
  await apiCall(page, `/api/v1/media/${dropped.id}`, { method: "PATCH", body: JSON.stringify({ version: meta.version, alt: "A smoke photograph" }) });
  const created = (await apiCall(page, "/api/v1/stories", { method: "POST", body: JSON.stringify({ title: T("pictured story"), category: "field", body, imageId: dropped.id }) })).body.data;
  storyId = created.record.id;
  const sub = (await apiCall(page, `/api/v1/stories/${storyId}/submit`, { method: "POST", body: JSON.stringify({ revision: created.revision }) })).body.data;
  await apiCall(page, `/api/v1/stories/${storyId}/approve`, { method: "POST", body: JSON.stringify({ revision: sub.revision }) });
  check("setup: the website is published with the image", (await apiCall(page, "/api/v1/publish", { method: "POST" })).status === 200);
  await page.reload();
  await page.getByRole("heading", { level: 1, name: "Media" }).waitFor();
  await page.locator(`[data-media-id="${dropped.id}"]`).click();
  const drawer = page.getByRole("dialog").filter({ hasText: dropName });
  await drawer.waitFor();
  await axe(page, "media detail drawer");
  await drawer.getByRole("button", { name: "Delete" }).click();
  const confirm = page.getByRole("dialog", { name: "Delete this file?" });
  await confirm.waitFor();
  check("delete dialog: says a file in use is not deleted", (await confirm.innerText()).includes("still uses is not deleted"));
  await axe(page, "delete dialog");
  await confirm.getByRole("button", { name: "Delete file" }).click();
  const alert = page.getByRole("alert").filter({ hasText: "still in use" });
  // The refusal is decided server-side under the publish lock, after scanning every use: allow a slow database link.
  check("in use: deletion refused, and the admin says where", await visibleSoon(alert, 20_000));
  const where = await alert.getByRole("list", { name: "Where this file is used" }).innerText().catch(() => "");
  check("in use: the live website and the story are named", /The live website \(published version \d+\)/.test(where) && where.includes(`Stories: ${T("pictured story")} (published)`), where);
  await axe(page, "deletion refused");
  check("in use: the image is still ready, and still on the website", (await apiCall(page, `/api/v1/media/${dropped.id}`)).body.data.status === "ready" && (await page.evaluate(async (id) => JSON.stringify((await (await fetch("/api/v1/public/snapshot")).json()).data.media).includes(id), dropped.id)));
  await page.keyboard.press("Escape");

  /* ---------- Responsive ---------- */
  for (const width of [1440, 1024, 768, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}/media`);
    await page.getByRole("heading", { level: 1, name: "Media" }).waitFor();
    await page.waitForTimeout(300);
    check(`${width}px: no horizontal scroll (library)`, await noHorizontalScroll(page));
    await page.locator(`[data-media-id="${dropped.id}"]`).click();
    await page.getByRole("dialog").filter({ hasText: dropName }).waitFor();
    check(`${width}px: no horizontal scroll (detail)`, await noHorizontalScroll(page));
    await axe(page, `media detail at ${width}px`);
    await page.keyboard.press("Escape");
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
} catch (error) {
  check("flow completed", false, error.message.split("\n")[0]);
} finally {
  if (ownerPage) {
    // Release the image (archive the story, publish), then delete every uploaded file.
    if (storyId) {
      await apiCall(ownerPage, `/api/v1/stories/${storyId}`, { method: "DELETE" }).catch(() => {});
      await apiCall(ownerPage, "/api/v1/publish", { method: "POST" }).catch(() => {});
    }
    let deleted = 0;
    for (const id of uploaded) if ((await apiCall(ownerPage, `/api/v1/media/${id}`, { method: "DELETE" }).catch(() => ({}))).status === 200) deleted++;
    console.log(`(cleanup: archived the story; deleted ${deleted}/${uploaded.length} uploaded file(s))`);
    if (deleted !== uploaded.length) check("cleanup: every uploaded file deleted", false, `${deleted}/${uploaded.length}`);
  }
  await browser.close();
}

for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.ok || !r.detail ? "" : `  [${r.detail}]`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
