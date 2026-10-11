/* Browser smoke test of the Careers page editor (M13), against a running
   admin and API:

     ADMIN_URL=http://localhost:5174 \
     ADMIN_SMOKE_EMAIL=<owner> ADMIN_SMOKE_PASSWORD=… \
     ADMIN_SMOKE_EDITOR_EMAIL=<editor> ADMIN_SMOKE_EDITOR_PASSWORD=… \
       npx -y -p playwright -p axe-core node scripts/smoke-careers.mjs

   LOCAL or test data only: it REPLACES the organization's Careers page
   draft with "Smoke <run> …" wording and test role titles (never real
   vacancies), and archives the page at the end. It never publishes the
   website. Passwords are never printed. SCREENSHOTS=<dir> saves
   screenshots. Exits 1 on any failure. */
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
  console.error("Needs Playwright: npx -y -p playwright -p axe-core node scripts/smoke-careers.mjs");
  process.exit(1);
}
const playwright = await import(pathToFileURL(playwrightPath).href).then((m) => (m.chromium ? m : m.default));
const axePath = resolveFromPath("axe-core/axe.min.js");
const axeSource = axePath ? readFileSync(axePath, "utf8") : null;

const base = process.env.ADMIN_URL ?? "http://localhost:5174";
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
let ownerPage = null;
const saveButton = (page) => page.getByRole("button", { name: /^(Save|Create Careers page)$/ });

try {
  const { page } = await signIn(owner);
  ownerPage = page;
  // Start from a fresh draft (a previous run archives the page).
  let before = (await apiCall(page, "/api/v1/careers")).body.data;
  if (before.record && before.record.status !== "archived") {
    await apiCall(page, "/api/v1/careers", { method: "DELETE" });
    before = (await apiCall(page, "/api/v1/careers")).body.data;
  }
  if (before.record) await apiCall(page, "/api/v1/careers", { method: "PATCH", body: JSON.stringify({ revision: before.revision, changes: { status: "draft", why: null, apply: null, seo: null, opportunities: { heading: "Open opportunities", empty: "None at the moment.", roles: [] } } }) });

  await page.locator('a[data-nav-item="careers"]').click();
  await page.getByRole("heading", { level: 1, name: "Careers page" }).waitFor();
  check("careers: in the sidebar and current", (await page.locator('a[data-nav-item="careers"]').getAttribute("aria-current")) === "page");
  await axe(page, "Careers editor");
  await field(page, "Title").fill(T("careers"));
  await field(page, "Opening line").fill("");
  await saveButton(page).click();
  check("validation: refused with a summary", await visibleSoon(page.getByRole("alert").filter({ hasText: "Some fields need attention" })));
  check("validation: the field says why", await visibleSoon(page.getByText("must not be empty").first()));
  await field(page, "Opening line").fill("A smoke opening line.");
  await page.getByRole("checkbox", { name: "Include “Why work with us”" }).check();
  await page.getByRole("group").first().waitFor();
  await page.getByRole("textbox", { name: "Paragraphs" }).first().fill("A smoke paragraph.\n\nA second smoke paragraph.");
  await field(page, "When there is no open role").fill("No smoke roles at the moment.");
  for (const n of [1, 2, 3]) {
    await page.getByRole("button", { name: "Add a role" }).click();
    await field(page, `Role ${n} title`).fill(T(`role ${n}`));
  }
  const closing = page.getByRole("region").or(page.locator("section")).filter({ has: page.getByRole("heading", { name: "Closing", exact: true }) }).first();
  await closing.getByRole("textbox", { name: "Heading", exact: true }).fill("Explore Rising Beyond Borders.");
  await page.getByRole("group", { name: "Main button" }).getByRole("textbox", { name: "Button text" }).fill("About Us");
  await page.getByRole("group", { name: "Main button" }).getByRole("textbox", { name: "Link" }).fill("/about");
  await field(page, "SEO description").fill("A smoke careers description.");
  await axe(page, "Careers editor (filled)");
  await saveButton(page).click();
  check("careers: saved as a draft", await visibleSoon(toast(page, /^(Saved|Careers page created)$/)));
  let stored = (await apiCall(page, "/api/v1/careers")).body.data;
  check("stored: the sections, the roles in order, SEO without an image", stored.record.status === "draft" && stored.record.why.body.length === 2 && stored.record.apply === undefined && JSON.stringify(stored.record.opportunities.roles.map((r) => r.title)) === JSON.stringify([1, 2, 3].map((n) => T(`role ${n}`))) && stored.record.seo.description === "A smoke careers description." && !("ogImageId" in stored.record.seo), JSON.stringify(stored.record));
  await shot(page, "careers-editor");

  // Reorder roles by keyboard: focus follows the moved role.
  const up = page.getByRole("button", { name: "Move Role 3 up" });
  await up.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  check("roles: moved up by keyboard", (await field(page, "Role 2 title").inputValue()) === T("role 3"));
  check("roles: focus follows the moved role", (await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))) === "Move Role 2 up");
  await page.getByRole("button", { name: "Remove Role 3" }).click();
  await saveButton(page).click();
  check("roles: saved in the new order", await visibleSoon(toast(page, "Saved")) && JSON.stringify((await apiCall(page, "/api/v1/careers")).body.data.record.opportunities.roles.map((r) => r.title)) === JSON.stringify([T("role 1"), T("role 3")]));
  await page.getByRole("button", { name: "Add a role" }).click();
  await field(page, "Role 3 title").fill("Not kept.");
  await page.getByRole("button", { name: "Discard" }).click();
  check("discard: back to the saved roles", (await page.getByRole("textbox", { name: /^Role \d title$/ }).count()) === 2);

  // Conflict.
  await field(page, "Opening line").fill("A local edit.");
  const other = await signIn(owner);
  stored = (await apiCall(other.page, "/api/v1/careers")).body.data;
  await apiCall(other.page, "/api/v1/careers", { method: "PATCH", body: JSON.stringify({ revision: stored.revision, changes: { title: T("changed elsewhere") } }) });
  await other.context.close();
  await saveButton(page).click();
  check("conflict: the Careers message", await visibleSoon(page.getByRole("alert").filter({ hasText: "These Careers changes are out of date." })));
  await page.getByRole("button", { name: "Reload latest" }).click();
  check("conflict: reload shows the other change", await page.waitForFunction((v) => document.querySelector("input[maxlength='120']")?.value === v, T("changed elsewhere"), { timeout: 6000 }).then(() => true, () => false));
  check("owner: submits and approves the Careers page", (await approveUi(page)) && (await apiCall(page, "/api/v1/careers")).body.data.record.status === "approved");

  /* ================= Editors ================= */
  if (editor.email && editor.password) {
    const ed = await signIn(editor);
    const c = (await apiCall(ed.page, "/api/v1/careers")).body.data;
    const edit = await apiCall(ed.page, "/api/v1/careers", { method: "PATCH", body: JSON.stringify({ revision: c.revision, changes: { intro: "Edited by an editor." } }) });
    check("editor: can edit the approved page (it returns to draft)", edit.status === 200 && edit.body.data.record.status === "draft");
    check("editor: a save never publishes it (400)", (await apiCall(ed.page, "/api/v1/careers", { method: "PATCH", body: JSON.stringify({ revision: edit.body.data.revision, changes: { status: "published" } }) })).status === 400);
    check("editor: cannot approve it (403)", (await apiCall(ed.page, "/api/v1/careers/approve", { method: "POST", body: JSON.stringify({ revision: edit.body.data.revision }) })).status === 403);
    check("editor: cannot publish the website (403)", (await apiCall(ed.page, "/api/v1/publish", { method: "POST" })).status === 403);
    await ed.page.goto(`${base}/careers`);
    await ed.page.getByTestId("workflow").waitFor();
    check("editor UI: Submit for review, no status choice, no Approve", (await ed.page.getByRole("button", { name: "Submit for review" }).isVisible()) && (await ed.page.getByLabel("Status").count()) === 0 && (await ed.page.getByRole("button", { name: "Approve", exact: true }).count()) === 0);
    check("editor: sees the owner-only message", await visibleSoon(ed.page.getByText("Only an owner can publish website changes.").first()));
    await ed.context.close();
  }

  // Archive, with its dialog.
  await page.goto(`${base}/careers`);
  await page.getByRole("button", { name: "Archive" }).click();
  const dialog = page.getByRole("dialog", { name: "Archive the Careers page?" });
  await dialog.waitFor();
  await axe(page, "archive dialog");
  check("dialog: focus moves into it", await page.evaluate(() => Boolean(document.activeElement?.closest('dialog, [role="dialog"]'))));
  await page.keyboard.press("Escape");
  check("dialog: Escape closes it", await dialog.waitFor({ state: "hidden", timeout: 4000 }).then(() => true, () => false));
  await page.getByRole("button", { name: "Archive" }).click();
  await dialog.getByRole("button", { name: "Archive", exact: true }).click();
  check("careers: archived", await visibleSoon(page.getByText("This Careers page is archived")));

  /* ================= Responsive ================= */
  for (const width of [375, 768, 1024, 1440]) {
    const m = await signIn(owner, { width, height: 900 });
    await m.page.goto(`${base}/careers`);
    await m.page.getByRole("heading", { level: 1, name: "Careers page" }).waitFor();
    await m.page.waitForTimeout(500);
    check(`${width}px /careers: no horizontal page scroll`, await m.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    if (width === 375) {
      await axe(m.page, "Careers editor at 375px");
      await shot(m.page, "careers-mobile");
    }
    await m.context.close();
  }

  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
} catch (error) {
  check("flow completed", false, error.message.split("\n")[0]);
  if (ownerPage) await shot(ownerPage, "failure").catch(() => {});
} finally {
  if (ownerPage) {
    const v = (await apiCall(ownerPage, "/api/v1/careers").catch(() => ({}))).body?.data;
    const archived = v?.record && v.record.status !== "archived" && (await apiCall(ownerPage, "/api/v1/careers", { method: "DELETE" })).status === 200;
    console.log(`(cleanup: ${archived ? "archived the Careers page" : "the Careers page is archived"})`);
  }
  await browser.close();
}

for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.ok || !r.detail ? "" : `  [${r.detail}]`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
