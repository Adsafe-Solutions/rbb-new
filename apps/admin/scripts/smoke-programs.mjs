/* Browser smoke test of the Programs list and editor (M10), against a
   running admin and API (with working media storage — the local fake R2
   is fine):

     ADMIN_URL=http://localhost:5174 \
     ADMIN_SMOKE_EMAIL=<owner> ADMIN_SMOKE_PASSWORD=… \
     ADMIN_SMOKE_EDITOR_EMAIL=<editor> ADMIN_SMOKE_EDITOR_PASSWORD=… \
       npx -y -p playwright -p axe-core node scripts/smoke-programs.mjs

   LOCAL or test data only: it creates programs named "Smoke <run> …",
   marks one published, and archives every program it created at the end.
   It never publishes the website. Passwords are never printed.
   SCREENSHOTS=<dir> saves screenshots. Exits 1 on any failure. */
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
  console.error("Needs Playwright: npx -y -p playwright -p axe-core node scripts/smoke-programs.mjs");
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

const group = (page, name) => page.getByRole("group", { name });
const created = [];
let ownerPage = null;
const saveButton = (page) => page.getByRole("button", { name: /^(Save|Create program)$/ });

try {
  const { page } = await signIn(owner);
  ownerPage = page;
  const png = readFileSync(new URL("../../api/test/fixtures/media/sample.png", import.meta.url)).toString("base64");
  const imageId = await page.evaluate(async ({ b64, name }) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const post = (u, body) => fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) }).then((r) => r.json());
    const i = (await post("/api/v1/media/upload-intents", { filename: name, mimeType: "image/png", size: bytes.length })).data;
    await fetch(i.uploadUrl, { method: "PUT", headers: i.uploadHeaders, body: bytes });
    await post(`/api/v1/media/${i.mediaId}/complete`);
    return i.mediaId;
  }, { b64: png, name: `smoke-${run}-share.png` });

  /* ================= List and editor ================= */
  await page.locator('a[data-nav-item="programs"]').click();
  await page.getByRole("heading", { level: 1, name: "Programs" }).waitFor();
  check("programs: in the sidebar and current", (await page.locator('a[data-nav-item="programs"]').getAttribute("aria-current")) === "page");
  await axe(page, "Programs list");
  await page.getByRole("button", { name: "New program" }).first().click();
  await page.getByRole("heading", { level: 1, name: "New program" }).waitFor();
  await field(page, "Title").fill(T("first area"));
  check("program: the address follows the title", (await field(page, "Web address").inputValue()) === `smoke-${run}-first-area`);
  check("program: the public address is shown", (await page.getByLabel("Public address").innerText()) === `/work/smoke-${run}-first-area`);
  await saveButton(page).click();
  check("program: the API names the missing description", await visibleSoon(page.getByText("is required").first()));
  await field(page, "Description").fill("A smoke description line.");
  await page.getByLabel("Icon").selectOption("health");
  await page.getByRole("checkbox", { name: "Write “Why this matters”" }).click();
  await field(page, "Why this matters").fill("A smoke paragraph.\n\nA second smoke paragraph.");
  await page.getByRole("button", { name: "Add a focus" }).click();
  await field(page, "Focus 1").fill("A smoke focus.");
  await page.getByRole("button", { name: "Add a story" }).click();
  await field(page, "Story 1").fill("A smoke story line.");
  await field(page, "SEO title").fill(T("SEO"));
  await group(page, "Social image").getByRole("button", { name: "Choose image" }).click();
  await page.getByRole("dialog", { name: "Choose: Social image" }).locator(`[data-media-id="${imageId}"]`).click();
  await axe(page, "program editor");
  await saveButton(page).click();
  await page.waitForURL(/\/programs\/[0-9a-f-]{36}$/, { timeout: 10_000 });
  const firstId = page.url().split("/").pop();
  created.push(firstId);
  const stored = (await apiCall(page, `/api/v1/programs/${firstId}`)).body.data.record;
  check("program: created as a draft with its sections", stored.status === "draft" && stored.icon === "health" && stored.why.length === 2 && stored.activities[0] === "A smoke focus." && stored.stories.length === 1 && stored.seo.ogImageId === imageId && stored.impact === undefined, JSON.stringify(stored));
  await shot(page, "program-editor");

  // Clear an optional section; edit; discard.
  await page.getByRole("button", { name: "Remove Story 1" }).click();
  await saveButton(page).click();
  check("program: saved", await visibleSoon(toast(page, "Saved")));
  check("program: a cleared section is removed", (await apiCall(page, `/api/v1/programs/${firstId}`)).body.data.record.stories === undefined);
  await field(page, "Description").fill("Not kept.");
  await page.getByRole("button", { name: "Discard" }).click();
  check("discard: back to the saved description", (await field(page, "Description").inputValue()) === "A smoke description line.");

  // Conflict in the editor.
  await field(page, "Description").fill("A local edit.");
  const other = await signIn(owner);
  const fresh = (await apiCall(other.page, `/api/v1/programs/${firstId}`)).body.data;
  await apiCall(other.page, `/api/v1/programs/${firstId}`, { method: "PATCH", body: JSON.stringify({ revision: fresh.revision, changes: { title: T("renamed elsewhere") } }) });
  await other.context.close();
  await saveButton(page).click();
  check("conflict: the editor says so", await visibleSoon(page.getByRole("alert").filter({ hasText: "changed elsewhere" })));
  await page.getByRole("button", { name: "Reload latest" }).click();
  check("conflict: reload shows the other change", await page.waitForFunction((v) => document.querySelector("input[maxlength='80']")?.value === v, T("renamed elsewhere"), { timeout: 6000 }).then(() => true, () => false));

  // Owner submits and approves it (it goes live at the next website publish).
  check("owner: approves a program", (await approveUi(page)) && (await apiCall(page, `/api/v1/programs/${firstId}`)).body.data.record.status === "approved");

  for (const name of ["second area", "third area"]) {
    const r = (await apiCall(page, "/api/v1/programs", { method: "POST", body: JSON.stringify({ title: T(name), slug: `smoke-${run}-${name.replace(" ", "-")}`, icon: "community", description: "A smoke line." }) })).body.data;
    created.push(r.record.id);
  }

  /* ================= Reorder ================= */
  await page.goto(`${base}/programs`);
  const list = page.getByRole("list", { name: "Programs, in order" });
  await list.waitFor();
  const titles = async () => list.locator(":scope > li").evaluateAll((els) => els.map((e) => e.querySelector("button span")?.firstChild?.textContent).filter((n) => n?.includes("Smoke")));
  const before = [T("renamed elsewhere"), T("second area"), T("third area")];
  check("list: in order", JSON.stringify(await titles()) === JSON.stringify(before), JSON.stringify(await titles()));
  const moveUp = list.locator(`[data-ordered-id="${created[2]}"]`).getByRole("button", { name: /up$/ });
  await moveUp.focus();
  await page.keyboard.press("Enter");
  check("reorder: moved up by keyboard and saved", await visibleSoon(toast(page, "moved up")));
  await page.waitForTimeout(200);
  check("reorder: the new order", JSON.stringify(await titles()) === JSON.stringify([before[0], before[2], before[1]]), JSON.stringify(await titles()));
  check("reorder: focus follows the moved program", (await page.evaluate(() => document.activeElement?.closest("[data-ordered-id]")?.getAttribute("data-ordered-id"))) === created[2]);
  const orders = (await apiCall(page, "/api/v1/programs?pageSize=100")).body.data.filter((v) => created.includes(v.record.id)).sort((a, b) => a.record.order - b.record.order).map((v) => v.record.id);
  check("reorder: stored", JSON.stringify(orders) === JSON.stringify([created[0], created[2], created[1]]), JSON.stringify(orders));
  const second = (await apiCall(page, `/api/v1/programs/${created[1]}`)).body.data;
  await apiCall(page, `/api/v1/programs/${created[1]}`, { method: "PATCH", body: JSON.stringify({ revision: second.revision, changes: { description: "Edited elsewhere" } }) });
  await list.locator(`[data-ordered-id="${created[2]}"]`).getByRole("button", { name: /down$/ }).click();
  check("reorder: a stale order is refused", await visibleSoon(page.getByRole("alert").filter({ hasText: "changed elsewhere" })));
  await page.getByRole("button", { name: "Reload latest" }).click();
  check("reorder: reload shows the other change", await visibleSoon(list.getByText("Edited elsewhere")));
  await page.getByLabel("Status").selectOption("archived");
  check("filter: a status filter hides the move controls", await list.locator("[data-move]").first().isDisabled().catch(() => true));
  await page.getByLabel("Status").selectOption("");
  await shot(page, "programs-list");

  /* ================= Editors ================= */
  if (editor.email && editor.password) {
    const ed = await signIn(editor);
    const p = await apiCall(ed.page, "/api/v1/programs", { method: "POST", body: JSON.stringify({ title: T("editor area"), slug: `smoke-${run}-editor-area`, icon: "education", description: "D." }) });
    check("editor: can add a program (draft)", p.status === 201 && p.body.data.record.status === "draft");
    if (p.status === 201) created.push(p.body.data.record.id);
    check("editor: a save never publishes a program (400)", (await apiCall(ed.page, `/api/v1/programs/${p.body.data.record.id}`, { method: "PATCH", body: JSON.stringify({ revision: p.body.data.revision, changes: { status: "published" } }) })).status === 400);
    check("editor: cannot approve a program (403)", (await apiCall(ed.page, `/api/v1/programs/${p.body.data.record.id}/approve`, { method: "POST", body: JSON.stringify({ revision: p.body.data.revision }) })).status === 403);
    const all = (await apiCall(ed.page, "/api/v1/programs?pageSize=100")).body.data.filter((v) => v.record.status !== "archived").sort((a, b) => a.record.order - b.record.order);
    check("editor: can reorder", (await apiCall(ed.page, "/api/v1/programs/order", { method: "POST", body: JSON.stringify({ items: all.map((v) => ({ id: v.record.id, revision: v.revision })) }) })).status === 200);
    await ed.page.goto(`${base}/programs/${firstId}`);
    await ed.page.getByTestId("workflow").waitFor();
    check("editor UI: an approved program — no status choice, no Approve or Return", (await ed.page.getByLabel("Status").count()) === 0 && (await ed.page.getByTestId("workflow").getByRole("button").count()) === 0);
    check("editor: told an owner puts it live", await visibleSoon(ed.page.getByText("An owner publishes the website to put it live.").first()));
    await ed.context.close();
  }

  // Archive from the editor.
  await page.goto(`${base}/programs/${created[1]}`);
  await page.getByRole("button", { name: "Archive" }).click();
  const archiveDialog = page.getByRole("dialog", { name: "Archive this program?" });
  await archiveDialog.waitFor();
  await axe(page, "archive dialog");
  await archiveDialog.getByRole("button", { name: "Archive", exact: true }).click();
  check("program: archived", await visibleSoon(page.getByText("This program is archived")));
  await page.goto(`${base}/programs`);
  await page.getByRole("list", { name: "Programs, in order" }).waitFor();
  check("list: archived programs are hidden by default", !(await page.getByRole("list", { name: "Programs, in order" }).getByText(T("second area")).isVisible().catch(() => false)));

  /* ================= Responsive ================= */
  for (const width of [375, 768, 1024, 1440]) {
    const m = await signIn(owner, { width, height: 900 });
    for (const path of ["/programs", `/programs/${firstId}`, "/programs/new"]) {
      await m.page.goto(`${base}${path}`);
      await m.page.waitForTimeout(700);
      check(`${width}px ${path.replace(firstId, ":id")}: no horizontal page scroll`, await m.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    }
    if (width === 375) {
      await m.page.goto(`${base}/programs`);
      await m.page.getByRole("heading", { level: 1, name: "Programs" }).waitFor();
      check("375px: reorder controls reachable", await m.page.getByRole("button", { name: /^Move “.*” down$/ }).first().isVisible());
      await axe(m.page, "Programs list at 375px");
      await m.page.goto(`${base}/programs/${firstId}`);
      await m.page.getByTestId("workflow").waitFor();
      await axe(m.page, "program editor at 375px");
      await shot(m.page, "programs-mobile");
    }
    await m.context.close();
  }

  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
} catch (error) {
  check("flow completed", false, error.message.split("\n")[0]);
} finally {
  if (ownerPage) {
    let archived = 0;
    for (const id of created) if ((await apiCall(ownerPage, `/api/v1/programs/${id}`, { method: "DELETE" }).catch(() => ({}))).status === 200) archived++;
    console.log(`(cleanup: archived ${archived} program(s) created by this run)`);
  }
  await browser.close();
}

for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.ok || !r.detail ? "" : `  [${r.detail}]`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
