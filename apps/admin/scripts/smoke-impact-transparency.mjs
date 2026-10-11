/* Browser smoke test of the Impact page, the impact figures, Transparency
   and its documents (M11), against a running admin and API (with working
   media storage — the local fake R2 is fine):

     ADMIN_URL=http://localhost:5174 \
     ADMIN_SMOKE_EMAIL=<owner> ADMIN_SMOKE_PASSWORD=… \
     ADMIN_SMOKE_EDITOR_EMAIL=<editor> ADMIN_SMOKE_EDITOR_PASSWORD=… \
       npx -y -p playwright -p axe-core node scripts/smoke-impact-transparency.mjs

   LOCAL or test data only: it creates figures and documents named
   "Smoke <run> …" (made-up values, https://files.rbb.test links), REPLACES
   the organization's Impact page and Transparency drafts, briefly reopens
   an archived homepage (archiving it again), and archives everything it
   created or replaced at the end. It never publishes the
   website. Passwords are never printed. SCREENSHOTS=<dir> saves
   screenshots. Exits 1 on any failure. */
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
  console.error("Needs Playwright: npx -y -p playwright -p axe-core node scripts/smoke-impact-transparency.mjs");
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
/* …and the same through the API, for records the smoke only needs approved. */
const approveApi = async (page, path) => {
  const v = (await apiCall(page, path)).body.data;
  const submitted = (await apiCall(page, `${path}/submit`, { method: "POST", body: JSON.stringify({ revision: v.revision }) })).body.data;
  return apiCall(page, `${path}/approve`, { method: "POST", body: JSON.stringify({ revision: submitted.revision }) });
};
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
const created = { figures: [], documents: [] };
let ownerPage = null;
const tab = (page, name) => page.getByRole("tab", { name, exact: true });
const blockRow = (page, label) => page.getByRole("list", { name: "Impact page sections" }).locator("li").filter({ hasText: label }).first();
const rows = async (page) => page.getByRole("list", { name: "Impact page sections" }).locator(":scope > li").evaluateAll((els) => els.map((e) => e.querySelector("[data-select] span")?.firstChild?.textContent));
const addBlock = async (page, label) => {
  await page.getByRole("button", { name: "Add section" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add a section" });
  await dialog.waitFor();
  await dialog.getByRole("button", { name: new RegExp(`^${label}`) }).click();
  await dialog.waitFor({ state: "hidden" });
};
const isCurrent = async (page, id) => (await page.locator(`a[data-nav-item="${id}"]`).getAttribute("aria-current")) === "page";
const focusedOrderedId = (page) => page.evaluate(() => document.activeElement?.closest("[data-ordered-id]")?.getAttribute("data-ordered-id"));

try {
  const { page } = await signIn(owner);
  ownerPage = page;

  /* ================= Impact figures ================= */
  await page.locator('a[data-nav-item="impact-figures"]').click();
  await page.getByRole("heading", { level: 1, name: "Impact figures" }).waitFor();
  check("figures: in the sidebar and current (only it)", (await isCurrent(page, "impact-figures")) && !(await isCurrent(page, "impact")));
  await axe(page, "Impact figures list");
  await page.getByRole("button", { name: "New figure" }).first().click();
  await page.getByRole("heading", { level: 1, name: "New figure" }).waitFor();
  await field(page, "What it counts").fill(`Smoke ${run} things counted`);
  check("figure: the key follows the label", (await field(page, "Key").inputValue()) === `smoke-${run}-things`);
  await page.getByRole("button", { name: "Create figure" }).click();
  check("figure: the API names the missing value", await visibleSoon(page.getByText("is required").first()));
  await field(page, "Value").fill("10+");
  await axe(page, "figure editor");
  await page.getByRole("button", { name: "Create figure" }).click();
  await page.waitForURL(/\/impact\/figures\/[0-9a-f-]{36}$/, { timeout: 10_000 });
  const firstFigure = page.url().split("/").pop();
  created.figures.push(firstFigure);
  const stored = (await apiCall(page, `/api/v1/metrics/${firstFigure}`)).body.data.record;
  check("figure: a draft, awaiting verification", stored.status === "draft" && stored.verification === "pending-review" && stored.value === "10+");
  check("owner: submits and approves a figure", await approveUi(page));
  for (const [slug, value] of [["second", "25"], ["third", "200+"]]) {
    const r = (await apiCall(page, "/api/v1/metrics", { method: "POST", body: JSON.stringify({ slug: `smoke-${run}-${slug}`, value, label: T(`${slug} figure`) }) })).body.data;
    created.figures.push(r.record.id);
  }
  await page.goto(`${base}/impact/figures`);
  const figureList = page.getByRole("list", { name: "Impact figures, in order" });
  await figureList.waitFor();
  const keys = async () => figureList.locator(":scope > li").evaluateAll((els) => els.map((e) => e.getAttribute("data-ordered-id")));
  check("figures: in order", JSON.stringify(await keys()) === JSON.stringify(created.figures), JSON.stringify(await keys()));
  const up = figureList.locator(`[data-ordered-id="${created.figures[2]}"]`).getByRole("button", { name: /up$/ });
  await up.focus();
  await page.keyboard.press("Enter");
  check("figures: moved up by keyboard and saved", await visibleSoon(toast(page, "moved up")));
  await page.waitForTimeout(200);
  check("figures: the new order", JSON.stringify(await keys()) === JSON.stringify([created.figures[0], created.figures[2], created.figures[1]]));
  check("figures: focus follows the moved figure", (await focusedOrderedId(page)) === created.figures[2]);
  const second = (await apiCall(page, `/api/v1/metrics/${created.figures[1]}`)).body.data;
  await apiCall(page, `/api/v1/metrics/${created.figures[1]}`, { method: "PATCH", body: JSON.stringify({ revision: second.revision, changes: { value: "26" } }) });
  await figureList.locator(`[data-ordered-id="${created.figures[2]}"]`).getByRole("button", { name: /down$/ }).click();
  check("figures: a stale order is refused", await visibleSoon(page.getByRole("alert").filter({ hasText: "changed elsewhere" })));
  await page.getByRole("button", { name: "Reload latest" }).click();
  check("figures: reload shows the other change", await visibleSoon(figureList.getByText(`26 — ${T("second figure")}`)));
  await shot(page, "figures-list");

  /* ================= Impact page ================= */
  const existing = (await apiCall(page, "/api/v1/impact")).body.data;
  if (existing.record) {
    // Start from an empty draft: archive whatever is there, then reopen it emptied.
    if (existing.record.status !== "archived") await apiCall(page, "/api/v1/impact", { method: "DELETE" });
    const archivedNow = (await apiCall(page, "/api/v1/impact")).body.data;
    await apiCall(page, "/api/v1/impact", { method: "PATCH", body: JSON.stringify({ revision: archivedNow.revision, changes: { sections: [], status: "draft", seo: null } }) });
  }
  await page.locator('a[data-nav-item="impact"]').click();
  await page.getByRole("heading", { level: 1, name: "Impact page" }).waitFor();
  check("impact page: in the sidebar and current (only it)", (await isCurrent(page, "impact")) && !(await isCurrent(page, "impact-figures")));
  check("impact page: an empty draft says so", await visibleSoon(page.getByText("No sections yet")));
  await axe(page, "Impact page editor (empty)");
  await page.getByRole("button", { name: "Add section" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add a section" });
  await dialog.waitFor();
  const options = await dialog.locator("button strong").allInnerTexts();
  check("add: exactly /impact's chapters, by name", JSON.stringify(options) === JSON.stringify(["Page introduction", "Impact at a glance", "Impact across our work", "Two posters", "Evidence and measurement", "Stories of change", "Reports and transparency", "Closing call to action"]), JSON.stringify(options));
  await axe(page, "Impact add-section dialog");
  await page.keyboard.press("Escape");
  for (const label of ["Impact at a glance", "Two posters", "Evidence and measurement", "Page introduction"]) await addBlock(page, label);
  check("add: the introduction goes first", JSON.stringify(await rows(page)) === JSON.stringify(["Page introduction", "Impact at a glance", "Two posters", "Evidence and measurement"]), JSON.stringify(await rows(page)));
  const saveButton = page.getByRole("button", { name: /^(Save|Create Impact page)$/ });
  await saveButton.click();
  check("validation: refused with a summary", await visibleSoon(page.getByRole("alert").filter({ hasText: /need[s]? attention/ })));

  await blockRow(page, "Page introduction").locator("[data-select]").click();
  await field(page, "Kicker").fill("Our impact");
  await field(page, "Page title").fill(T("Impact"));
  await field(page, "Highlight").fill("Impact");
  await field(page, "Opening line").fill("A smoke opening line.");
  await blockRow(page, "Impact at a glance").locator("[data-select]").click();
  await field(page, "Heading").fill("Smoke at a glance.");
  const figures = group(page, "Figures");
  await figures.waitFor();
  check("stats: figures are chosen from the impact figures", (await figures.getByRole("checkbox").count()) >= 3);
  await figures.getByRole("checkbox", { name: new RegExp(`^10\\+ — Smoke ${run}`) }).check();
  await figures.getByRole("checkbox", { name: new RegExp(`^200\\+ — `) }).first().check();
  await axe(page, "stats form with the figures picker");
  await blockRow(page, "Two posters").locator("[data-select]").click();
  for (const [poster, heading, href] of [["First poster", "Smoke approach.", "/impact/our-approach"], ["Second poster", "Smoke work.", "/work"]]) {
    const g = group(page, poster);
    await g.getByRole("textbox", { name: "Heading", exact: true }).fill(heading);
    await g.getByRole("textbox", { name: "Text", exact: true }).fill("A smoke poster line.");
    await g.getByRole("group", { name: "Button" }).getByRole("textbox", { name: "Button text" }).fill("Explore");
    await g.getByRole("group", { name: "Button" }).getByRole("textbox", { name: "Link" }).fill(href);
  }
  await axe(page, "posters form");
  await blockRow(page, "Evidence and measurement").locator("[data-select]").click();
  await field(page, "Heading").fill("Smoke evidence");
  await page.getByRole("button", { name: "Add a line" }).click();
  await field(page, "Line 1").fill("A smoke line.");
  await saveButton.click();
  check("impact page: saved as a draft", await visibleSoon(toast(page, existing.record ? "Saved" : "Impact page created")));
  const page1 = (await apiCall(page, "/api/v1/impact")).body.data.record;
  const stats = page1.sections.find((s) => s.type === "stats");
  check("stored: typed chapters, figures named by key", page1.status === "draft" && JSON.stringify(page1.sections.map((s) => s.type)) === JSON.stringify(["intro", "stats", "teasers", "measurement"]) && stats.data.metricIds[0] === `smoke-${run}-things` && stats.data.metricIds.length === 2 && !JSON.stringify(stats).includes('"value"'), JSON.stringify(stats));
  await shot(page, "impact-editor");

  // Keyboard reorder, preview, conflict.
  const moveUp = blockRow(page, "Evidence and measurement").getByRole("button", { name: "Move “Evidence and measurement” up" });
  await moveUp.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  check("reorder: moved up by keyboard", (await rows(page)).indexOf("Evidence and measurement") === 2, JSON.stringify(await rows(page)));
  check("reorder: focus follows", (await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))) === "Move “Evidence and measurement” up");
  await tab(page, "Preview").click();
  check("preview: admin-only", await visibleSoon(page.getByText("Draft preview — only here, in the admin")));
  await axe(page, "Impact preview");
  await page.getByRole("button", { name: "Discard" }).click();
  const other = await signIn(owner);
  const fresh = (await apiCall(other.page, "/api/v1/impact")).body.data;
  await apiCall(other.page, "/api/v1/impact", { method: "PATCH", body: JSON.stringify({ revision: fresh.revision, changes: { seo: { title: `Changed elsewhere ${run}` } } }) });
  await other.context.close();
  await blockRow(page, "Two posters").getByRole("button", { name: "Hide “Two posters”" }).click();
  await saveButton.click();
  check("conflict: the Impact page message", await visibleSoon(page.getByRole("alert").filter({ hasText: "These Impact page changes are out of date. Reload the latest version before saving." })));
  await page.getByRole("button", { name: "Reload latest" }).click();
  await tab(page, "SEO and publishing").click();
  check("conflict: reload shows the other change", (await field(page, "SEO title").inputValue()) === `Changed elsewhere ${run}`);
  // Review: approved as a whole. It names a figure that is still a draft: figures are checked at
  // the website publish (M11), so the publish panel lists it as a blocker until it is approved.
  check("owner: submits and approves the Impact page", await approveUi(page));
  const blockers = page.getByTestId("publish-blockers");
  check("publish panel: the draft figure blocks the publish", await visibleSoon(blockers.getByText(`smoke-${run}-third`).first()));
  check("publish panel: Publish waits for it", await page.getByTestId("publish-panel").getByRole("button", { name: "Publish changes" }).isDisabled());
  await approveApi(page, `/api/v1/metrics/${created.figures[2]}`);
  await page.reload();
  await page.getByTestId("publish-panel").waitFor();
  check("publish panel: once approved, nothing blocks it", (await blockers.count()) === 0);

  /* ================= Homepage: the same figures ================= */
  await page.goto(`${base}/homepage`);
  await page.getByRole("heading", { level: 1, name: "Homepage" }).waitFor();
  // An archived homepage is read-only: reopen it as a draft for this check (archived again below).
  const home = (await apiCall(page, "/api/v1/homepage")).body.data;
  const homeWasArchived = home.record?.status === "archived";
  if (homeWasArchived) await apiCall(page, "/api/v1/homepage", { method: "PATCH", body: JSON.stringify({ revision: home.revision, changes: { status: "draft" } }) });
  await page.goto(`${base}/homepage`);
  await page.getByRole("heading", { level: 1, name: "Homepage" }).waitFor();
  // Open the homepage's figures block if it has one; otherwise add one (and discard it).
  const homeFigures = page.getByRole("list", { name: "Homepage sections" }).locator("li").filter({ hasText: "Impact figures" }).first();
  const hasFigures = await homeFigures.isVisible().catch(() => false);
  if (hasFigures) await homeFigures.locator("[data-select]").click();
  else {
    await page.getByRole("button", { name: "Add section" }).first().click();
    await page.getByRole("dialog", { name: "Add a section" }).getByRole("button", { name: /^Impact figures/ }).click();
  }
  check("homepage: its figures block chooses from the same impact figures", await visibleSoon(group(page, "Figures").getByRole("checkbox", { name: new RegExp(`^10\\+ — Smoke ${run}`) })));
  if (!hasFigures) await page.getByRole("button", { name: "Discard" }).click();
  if (homeWasArchived) await apiCall(page, "/api/v1/homepage", { method: "DELETE" });

  /* ================= Transparency ================= */
  const t0 = (await apiCall(page, "/api/v1/transparency")).body.data;
  if (t0.record && t0.record.status !== "archived") await apiCall(page, "/api/v1/transparency", { method: "DELETE" });
  const tNow = (await apiCall(page, "/api/v1/transparency")).body.data;
  if (tNow.record) await apiCall(page, "/api/v1/transparency", { method: "PATCH", body: JSON.stringify({ revision: tNow.revision, changes: { status: "draft" } }) });
  await page.locator('a[data-nav-item="transparency"]').click();
  await page.getByRole("heading", { level: 1, name: "Transparency" }).waitFor();
  check("transparency: in the sidebar and current", await isCurrent(page, "transparency"));
  await axe(page, "Transparency editor");
  await field(page, "Heading").fill(T("transparency"));
  await field(page, "Opening line").fill("A smoke opening line.");
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "Add a share" }).click();
  if ((await field(page, "What it is").count()) > 2) for (let n = await field(page, "What it is").count(); n > 2; n--) await page.getByRole("button", { name: `Remove Share ${n}` }).click();
  await field(page, "What it is").nth(0).fill("Smoke A");
  await field(page, "What it is").nth(1).fill("Smoke B");
  await page.getByRole("spinbutton", { name: "Share of the total (%)" }).nth(0).fill("60");
  await page.getByRole("spinbutton", { name: "Share of the total (%)" }).nth(1).fill("30");
  check("shares: the running total says what is wrong", await visibleSoon(page.getByText("The shares add up to 90% — they must add up to 100%.")));
  const tSave = page.getByRole("button", { name: /^(Save|Create transparency)$/ });
  await tSave.click();
  check("shares: refused by the API, at the field", await visibleSoon(page.getByText("the shares must add up to 100% (they add up to 90%)")));
  await page.getByRole("spinbutton", { name: "Share of the total (%)" }).nth(1).fill("40");
  await page.getByRole("checkbox", { name: "Include governance" }).check();
  await field(page, "Passage").fill("A smoke governance passage.");
  await field(page, "Paragraphs").fill("A smoke reporting paragraph.\n\nA second one.");
  await axe(page, "Transparency editor (filled)");
  await tSave.click();
  check("transparency: saved as a draft", await visibleSoon(toast(page, /^(Saved|Transparency created)$/)));
  const tStored = (await apiCall(page, "/api/v1/transparency")).body.data;
  check("stored: the overview, governance and paragraphs", tStored.record.status === "draft" && tStored.record.financialOverview.items.map((i) => i.percentage).join() === "60,40" && tStored.record.governance.intro === "A smoke governance passage." && tStored.record.accountability.length === 2, JSON.stringify(tStored.record));
  await field(page, "Heading").fill("A local edit.");
  const other2 = await signIn(owner);
  await apiCall(other2.page, "/api/v1/transparency", { method: "PATCH", body: JSON.stringify({ revision: tStored.revision, changes: { heading: T("changed elsewhere") } }) });
  await other2.context.close();
  await tSave.click();
  check("conflict: the transparency message", await visibleSoon(page.getByRole("alert").filter({ hasText: "These transparency changes are out of date." })));
  await page.getByRole("button", { name: "Reload latest" }).click();
  check("conflict: reload shows the other change", await page.waitForFunction((v) => document.querySelector("input[maxlength='160']")?.value === v, T("changed elsewhere"), { timeout: 6000 }).then(() => true, () => false));
  check("owner: submits and approves transparency", (await approveUi(page)) && (await apiCall(page, "/api/v1/transparency")).body.data.record.status === "approved");
  await shot(page, "transparency-editor");

  /* ================= Documents ================= */
  await page.getByRole("button", { name: "Documents" }).click();
  await page.getByRole("heading", { level: 1, name: "Transparency documents" }).waitFor();
  await axe(page, "documents list");
  await page.getByRole("button", { name: "New document" }).first().click();
  await page.getByRole("heading", { level: 1, name: "New document" }).waitFor();
  await field(page, "Title").fill(T("annual report"));
  await page.getByRole("spinbutton", { name: "Year" }).fill("2025");
  await field(page, "Type").fill("PDF");
  await field(page, "Link to the file").fill("http://files.rbb.test/smoke.pdf");
  await axe(page, "document editor");
  await page.getByRole("button", { name: "Create document" }).click();
  check("document: an insecure link is refused", await visibleSoon(page.getByText("must be an https:// URL")));
  await field(page, "Link to the file").fill(`https://files.rbb.test/smoke-${run}.pdf`);
  await page.getByRole("button", { name: "Create document" }).click();
  await page.waitForURL(/\/transparency\/documents\/[0-9a-f-]{36}$/, { timeout: 10_000 });
  created.documents.push(page.url().split("/").pop());
  for (const n of [2, 3]) {
    const r = (await apiCall(page, "/api/v1/reports", { method: "POST", body: JSON.stringify({ category: "annualReport", title: T(`annual report ${n}`), fileUrl: `https://files.rbb.test/smoke-${run}-${n}.pdf` }) })).body.data;
    created.documents.push(r.record.id);
  }
  await page.goto(`${base}/transparency/documents`);
  const reports = page.getByRole("list", { name: "Annual reports, in order" });
  await reports.waitFor();
  const docIds = async () => reports.locator(":scope > li").evaluateAll((els) => els.map((e) => e.getAttribute("data-ordered-id")));
  const docUp = reports.locator(`[data-ordered-id="${created.documents[2]}"]`).getByRole("button", { name: /up$/ });
  await docUp.focus();
  await page.keyboard.press("Enter");
  check("documents: moved up by keyboard and saved", await visibleSoon(toast(page, "moved up")));
  await page.waitForTimeout(200);
  check("documents: the new order", JSON.stringify(await docIds()) === JSON.stringify([created.documents[0], created.documents[2], created.documents[1]]), JSON.stringify(await docIds()));
  check("documents: focus follows", (await focusedOrderedId(page)) === created.documents[2]);
  await shot(page, "documents-list");

  /* ================= Editors ================= */
  if (editor.email && editor.password) {
    const ed = await signIn(editor);
    const m = await apiCall(ed.page, "/api/v1/metrics", { method: "POST", body: JSON.stringify({ slug: `smoke-${run}-editor`, value: "1", label: T("editor figure") }) });
    check("editor: can add a figure (draft)", m.status === 201 && m.body.data.record.status === "draft");
    if (m.status === 201) created.figures.push(m.body.data.record.id);
    check("editor: a save never publishes a figure (400)", (await apiCall(ed.page, `/api/v1/metrics/${m.body.data.record.id}`, { method: "PATCH", body: JSON.stringify({ revision: m.body.data.revision, changes: { status: "published" } }) })).status === 400);
    check("editor: cannot approve a figure (403)", (await apiCall(ed.page, `/api/v1/metrics/${m.body.data.record.id}/approve`, { method: "POST", body: JSON.stringify({ revision: m.body.data.revision }) })).status === 403);
    const imp = (await apiCall(ed.page, "/api/v1/impact")).body.data;
    const impEdit = await apiCall(ed.page, "/api/v1/impact", { method: "PATCH", body: JSON.stringify({ revision: imp.revision, changes: { seo: { title: T("editor") } } }) });
    check("editor: can edit the approved Impact page (back to draft); cannot approve it", impEdit.status === 200 && impEdit.body.data.record.status === "draft" && (await apiCall(ed.page, "/api/v1/impact/approve", { method: "POST", body: JSON.stringify({ revision: imp.revision + 1 }) })).status === 403);
    const tr = (await apiCall(ed.page, "/api/v1/transparency")).body.data;
    check("editor: a save never publishes transparency (400); approval is an owner's (403)", (await apiCall(ed.page, "/api/v1/transparency", { method: "PATCH", body: JSON.stringify({ revision: tr.revision, changes: { status: "published" } }) })).status === 400 && (await apiCall(ed.page, "/api/v1/transparency/approve", { method: "POST", body: JSON.stringify({ revision: tr.revision }) })).status === 403);
    const d = await apiCall(ed.page, "/api/v1/reports", { method: "POST", body: JSON.stringify({ category: "governance", title: T("editor document"), fileUrl: "https://files.rbb.test/e.pdf", status: "published" }) });
    check("editor: cannot create a published document (400: drafts only)", d.status === 400);
    check("editor: can reorder documents", (await apiCall(ed.page, "/api/v1/reports/order", { method: "POST", body: JSON.stringify({ items: (await apiCall(ed.page, "/api/v1/reports?pageSize=100")).body.data.filter((v) => v.record.status !== "archived").sort((a, b) => a.record.order - b.record.order).map((v) => ({ id: v.record.id, revision: v.revision })) }) })).status === 200);
    for (const path of [`/impact/figures/${created.figures[2]}`, "/transparency", `/transparency/documents/${created.documents[0]}`]) {
      await ed.page.goto(`${base}${path}`);
      await ed.page.getByTestId("workflow").waitFor();
      check(`editor UI ${path.replace(/[0-9a-f-]{36}/, ":id")}: no status choice, no Approve`, (await ed.page.getByLabel("Status").count()) === 0 && (await ed.page.getByRole("button", { name: "Approve", exact: true }).count()) === 0);
    }
    await ed.page.goto(`${base}/transparency`);
    check("editor: sees the owner-only message", await visibleSoon(ed.page.getByText("Only an owner can publish website changes.").first()));
    await ed.context.close();
  }

  // Archive a figure and a document from their editors.
  for (const [path, kind] of [[`/impact/figures/${created.figures[1]}`, "figure"], [`/transparency/documents/${created.documents[1]}`, "document"]]) {
    await page.goto(`${base}${path}`);
    await page.getByRole("button", { name: "Archive" }).click();
    const archiveDialog = page.getByRole("dialog", { name: `Archive this ${kind}?` });
    await archiveDialog.waitFor();
    await archiveDialog.getByRole("button", { name: "Archive", exact: true }).click();
    check(`${kind}: archived`, await visibleSoon(page.getByText(`This ${kind} is archived`)));
  }

  /* ================= Responsive ================= */
  for (const width of [375, 768, 1024, 1440]) {
    const m = await signIn(owner, { width, height: 900 });
    const paths = ["/impact", "/impact/figures", `/impact/figures/${firstFigure}`, "/transparency", "/transparency/documents", `/transparency/documents/${created.documents[0]}`];
    for (const path of paths) {
      await m.page.goto(`${base}${path}`);
      await m.page.waitForTimeout(700);
      check(`${width}px ${path.replace(/[0-9a-f-]{36}/, ":id")}: no horizontal page scroll`, await m.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    }
    if (width === 375) {
      await m.page.goto(`${base}/impact/figures`);
      await m.page.getByRole("heading", { level: 1, name: "Impact figures" }).waitFor();
      check("375px: figure reorder controls reachable", await m.page.getByRole("button", { name: /^Move “.*” down$/ }).first().isVisible());
      await axe(m.page, "figures list at 375px");
      await m.page.goto(`${base}/transparency`);
      await m.page.getByRole("heading", { level: 1, name: "Transparency" }).waitFor();
      await axe(m.page, "Transparency editor at 375px");
      await m.page.goto(`${base}/transparency/documents`);
      await m.page.getByRole("heading", { level: 1, name: "Transparency documents" }).waitFor();
      await axe(m.page, "documents list at 375px");
      await m.page.goto(`${base}/impact`);
      await m.page.getByRole("heading", { level: 1, name: "Impact page" }).waitFor();
      await axe(m.page, "Impact page editor at 375px");
      await shot(m.page, "impact-mobile");
    }
    await m.context.close();
  }

  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
} catch (error) {
  check("flow completed", false, error.message.split("\n")[0]);
} finally {
  if (ownerPage) {
    let archived = 0;
    for (const id of created.figures) if ((await apiCall(ownerPage, `/api/v1/metrics/${id}`, { method: "DELETE" }).catch(() => ({}))).status === 200) archived++;
    for (const id of created.documents) if ((await apiCall(ownerPage, `/api/v1/reports/${id}`, { method: "DELETE" }).catch(() => ({}))).status === 200) archived++;
    for (const path of ["/api/v1/impact", "/api/v1/transparency"]) {
      const v = (await apiCall(ownerPage, path).catch(() => ({}))).body?.data;
      if (v?.record && v.record.status !== "archived" && (await apiCall(ownerPage, path, { method: "DELETE" })).status === 200) archived++;
    }
    console.log(`(cleanup: archived ${archived} record(s) created or replaced by this run)`);
  }
  await browser.close();
}

for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.ok || !r.detail ? "" : `  [${r.detail}]`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
