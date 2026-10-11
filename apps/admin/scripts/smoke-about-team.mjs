/* Browser smoke test of the About page editor and the Team (M9), against
   a running admin and API (with working media storage — the local fake R2
   is fine):

     ADMIN_URL=http://localhost:5174 \
     ADMIN_SMOKE_EMAIL=<owner> ADMIN_SMOKE_PASSWORD=… \
     ADMIN_SMOKE_EDITOR_EMAIL=<editor> ADMIN_SMOKE_EDITOR_PASSWORD=… \
       npx -y -p playwright -p axe-core node scripts/smoke-about-team.mjs

   LOCAL or test data only: it REPLACES the organization's About page
   draft, creates team members named "Smoke <run> …" (roles, not people),
   and archives the About page and every member it created at the end. It
   never publishes the website. Passwords are never printed.
   SCREENSHOTS=<dir> saves screenshots. Exits 1 on any failure. */
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
  console.error("Needs Playwright: npx -y -p playwright -p axe-core node scripts/smoke-content.mjs");
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

const created = [];
let ownerPage = null;
const tab = (page, name) => page.getByRole("tab", { name, exact: true });
const group = (page, name) => page.getByRole("group", { name });
const blockRow = (page, label) => page.getByRole("list", { name: "About page sections" }).locator("li").filter({ hasText: label }).first();
const addBlock = async (page, label) => {
  await page.getByRole("button", { name: "Add section" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add a section" });
  await dialog.waitFor();
  await dialog.getByRole("button", { name: new RegExp(`^${label}`) }).click();
  await dialog.waitFor({ state: "hidden" });
};
const saveButton = (page) => page.getByRole("button", { name: /^(Save|Create About page|Create team member)$/ });
const rows = async (page) => page.getByRole("list", { name: "About page sections" }).locator(":scope > li").evaluateAll((els) => els.map((e) => e.querySelector("[data-select] span")?.firstChild?.textContent));

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
  }, { b64: png, name: `smoke-${run}-portrait.png` });
  const existing = (await apiCall(page, "/api/v1/about")).body.data;
  if (existing.record) await apiCall(page, "/api/v1/about", { method: "PATCH", body: JSON.stringify({ revision: existing.revision, changes: { sections: [], status: "draft", seo: null } }) });

  /* ================= About ================= */
  await page.locator('a[data-nav-item="about"]').click();
  await page.getByRole("heading", { level: 1, name: "About page" }).waitFor();
  check("about: in the sidebar and current", (await page.locator('a[data-nav-item="about"]').getAttribute("aria-current")) === "page");
  check("about: an empty draft says so", await visibleSoon(page.getByText("No sections yet")));
  await axe(page, "About editor (empty)");
  await page.getByRole("button", { name: "Add section" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add a section" });
  await dialog.waitFor();
  const options = await dialog.locator("button strong").allInnerTexts();
  check("add: exactly the About page's chapters, by name", JSON.stringify(options) === JSON.stringify(["Page introduction", "Who we are", "Mission and vision", "Values", "How we work", "Transparency and governance", "Closing call to action"]), JSON.stringify(options));
  await axe(page, "About add-section dialog");
  await page.keyboard.press("Escape");
  for (const label of ["Who we are", "Mission and vision", "Values", "How we work", "Transparency and governance", "Closing call to action", "Page introduction"]) await addBlock(page, label);
  check("add: the introduction goes first, the rest in order", JSON.stringify(await rows(page)) === JSON.stringify(["Page introduction", "Who we are", "Mission and vision", "Values", "How we work", "Transparency and governance", "Closing call to action"]), JSON.stringify(await rows(page)));
  await page.getByRole("button", { name: "Add section" }).first().click();
  check("add: a chapter cannot be added twice", (await page.getByRole("dialog", { name: "Add a section" }).getByRole("button", { name: /^Values/ }).getAttribute("aria-disabled")) === "true");
  await page.keyboard.press("Escape");

  await saveButton(page).click();
  check("validation: refused with a summary", await visibleSoon(page.getByRole("alert").filter({ hasText: /need[s]? attention/ })));
  check("validation: chapters are marked", (await page.getByText("Needs attention").count()) >= 4);

  await blockRow(page, "Page introduction").locator("[data-select]").click();
  await field(page, "Page title").fill(T("about"));
  await field(page, "Opening line").fill("A smoke opening line.");
  await axe(page, "page introduction form");
  await blockRow(page, "Who we are").locator("[data-select]").click();
  await field(page, "Heading").fill("Smoke who we are.");
  await field(page, "Paragraphs").fill("A smoke statement.\n\nA second smoke paragraph.");
  await blockRow(page, "Mission and vision").locator("[data-select]").click();
  await field(page, "Heading").fill("Smoke mission and vision");
  await field(page, "Mission statement").fill("A smoke mission.");
  await field(page, "Vision statement").fill("A smoke vision.");
  await blockRow(page, "Values").locator("[data-select]").click();
  await field(page, "Heading").fill("Smoke values");
  await field(page, "Value").fill("A smoke value");
  await page.getByRole("button", { name: "Add value" }).click();
  await field(page, "Value").last().fill("Another smoke value");
  await axe(page, "values form");
  await blockRow(page, "How we work").locator("[data-select]").click();
  await field(page, "Heading").fill("Smoke how we work.");
  await blockRow(page, "Transparency and governance").locator("[data-select]").click();
  check("transparency: placed, not edited here", await visibleSoon(page.getByText("This block places that chapter on the page.")));
  await blockRow(page, "Closing call to action").locator("[data-select]").click();
  await field(page, "Heading").fill("Smoke closing ask.");
  await group(page, "Main button").getByRole("textbox", { name: "Button text" }).fill("Get Involved");
  await group(page, "Main button").getByRole("textbox", { name: "Link" }).fill("/get-involved");
  await saveButton(page).click();
  check("about: saved as a draft", await visibleSoon(toast(page, existing.record ? "Saved" : "About page created")));
  const stored = (await apiCall(page, "/api/v1/about")).body.data.record;
  check("stored: typed chapters in order", stored.status === "draft" && JSON.stringify(stored.sections.map((s) => s.type)) === JSON.stringify(["pageHero", "statement", "missionVision", "numberedCards", "approach", "transparency", "cta"]));
  await shot(page, "about-editor");

  // Hide, keyboard reorder, preview, discard.
  await blockRow(page, "Mission and vision").getByRole("button", { name: "Hide “Mission and vision”" }).click();
  const up = blockRow(page, "Values").getByRole("button", { name: "Move “Values” up" });
  await up.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  check("reorder: moved up by keyboard", (await rows(page)).indexOf("Values") === 2, JSON.stringify(await rows(page)));
  check("reorder: focus follows", (await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))) === "Move “Values” up");
  check("reorder: the introduction stays first", await blockRow(page, "Who we are").getByRole("button", { name: /up$/ }).isDisabled());
  await tab(page, "Preview").click();
  const preview = page.getByRole("list", { name: "About page draft, top to bottom" });
  check("preview: enabled chapters only, admin-only", (await preview.locator(":scope > li").count()) === 6 && (await page.getByText("Draft preview — only here, in the admin").isVisible()) && !(await preview.innerText()).includes("Smoke mission"));
  await axe(page, "About preview");
  await page.getByRole("button", { name: "Discard" }).click();
  check("discard: back to the saved order", (await rows(page)).indexOf("Values") === 3);

  // Conflict.
  await blockRow(page, "Values").getByRole("button", { name: "Hide “Values”" }).click();
  const other = await signIn(owner);
  const fresh = (await apiCall(other.page, "/api/v1/about")).body.data;
  await apiCall(other.page, "/api/v1/about", { method: "PATCH", body: JSON.stringify({ revision: fresh.revision, changes: { seo: { title: `Changed elsewhere ${run}` } } }) });
  await other.context.close();
  await saveButton(page).click();
  check("conflict: the About page message", await visibleSoon(page.getByRole("alert").filter({ hasText: "These About page changes are out of date. Reload the latest version before saving." })));
  await page.getByRole("button", { name: "Reload latest" }).click();
  await tab(page, "SEO and publishing").click();
  check("conflict: reload shows the other change", (await field(page, "SEO title").inputValue()) === `Changed elsewhere ${run}`);
  await axe(page, "About SEO and publishing");
  check("owner: submits and approves the About page as a whole", await approveUi(page));

  /* ================= Team ================= */
  await page.locator('a[data-nav-item="team"]').click();
  await page.getByRole("heading", { level: 1, name: "Team" }).waitFor();
  check("team: in the sidebar and current", (await page.locator('a[data-nav-item="team"]').getAttribute("aria-current")) === "page");
  await axe(page, "Team list");
  await page.getByRole("button", { name: "New team member" }).first().click();
  await page.getByRole("heading", { level: 1, name: "New team member" }).waitFor();
  await field(page, "Role").fill("A smoke area");
  await page.getByRole("button", { name: "Create team member" }).click();
  check("member: the API names the missing field", await visibleSoon(page.getByText("is required").first()));
  await field(page, "Name").fill(T("first role"));
  check("member: the address follows the name", (await field(page, "Web address").inputValue()) === `smoke-${run}-first-role`);
  await field(page, "Short bio").fill("A smoke card line.");
  await page.getByRole("checkbox", { name: "Give them a profile page" }).click();
  await field(page, "Biography").fill("A smoke biography paragraph.");
  await group(page, "Photograph").getByRole("button", { name: "Choose image" }).click();
  await page.getByRole("dialog", { name: "Choose: Photograph" }).locator(`[data-media-id="${imageId}"]`).click();
  await page.getByRole("button", { name: "Add social account" }).click();
  await field(page, "Name").last().fill("LinkedIn");
  await field(page, "Address").fill("http://insecure.rbb.test");
  await axe(page, "team member editor");
  await page.getByRole("button", { name: "Create team member" }).click();
  check("member: an insecure social link is refused", await visibleSoon(page.getByText("must be an https:// URL")));
  await field(page, "Address").fill("https://social.rbb.test/smoke");
  await page.getByRole("button", { name: "Create team member" }).click();
  await page.waitForURL(/\/team\/[0-9a-f-]{36}$/, { timeout: 10_000 });
  const firstId = page.url().split("/").pop();
  created.push(firstId);
  check("member: created as a draft", (await apiCall(page, `/api/v1/team/${firstId}`)).body.data.record.status === "draft");
  await shot(page, "team-editor");
  for (const name of ["second role", "third role"]) {
    const r = (await apiCall(page, "/api/v1/team", { method: "POST", body: JSON.stringify({ name: T(name), role: "A smoke area", group: "team" }) })).body.data;
    created.push(r.record.id);
  }

  // Reorder by keyboard on the list.
  await page.goto(`${base}/team`);
  const list = page.getByRole("list", { name: "Team members, in order" });
  await list.waitFor();
  const names = async () => list.locator(":scope > li").evaluateAll((els) => els.map((e) => e.querySelector("button span")?.firstChild?.textContent).filter((n) => n?.includes("Smoke")));
  check("team list: in order", JSON.stringify(await names()) === JSON.stringify([T("first role"), T("second role"), T("third role")]), JSON.stringify(await names()));
  const moveUp = list.locator(`[data-member-id="${created[2]}"]`).getByRole("button", { name: /up$/ });
  await moveUp.focus();
  await page.keyboard.press("Enter");
  check("team: moved up and saved", await visibleSoon(toast(page, "moved up")));
  await page.waitForTimeout(200);
  check("team: the new order", JSON.stringify(await names()) === JSON.stringify([T("first role"), T("third role"), T("second role")]), JSON.stringify(await names()));
  check("team: focus follows the moved member", (await page.evaluate(() => document.activeElement?.closest("[data-member-id]")?.getAttribute("data-member-id"))) === created[2]);
  // A stale list is refused, not overwritten.
  const second = (await apiCall(page, `/api/v1/team/${created[1]}`)).body.data;
  await apiCall(page, `/api/v1/team/${created[1]}`, { method: "PATCH", body: JSON.stringify({ revision: second.revision, changes: { role: "Edited elsewhere" } }) });
  await list.locator(`[data-member-id="${created[2]}"]`).getByRole("button", { name: /down$/ }).click();
  check("team: a stale order is refused", await visibleSoon(page.getByRole("alert").filter({ hasText: "changed elsewhere" })));
  await page.getByRole("button", { name: "Reload latest" }).click();
  check("team: reload shows the other change", await visibleSoon(list.getByText("Edited elsewhere")));
  await shot(page, "team-list");

  /* ================= Editors ================= */
  if (editor.email && editor.password) {
    const ed = await signIn(editor);
    const a = (await apiCall(ed.page, "/api/v1/about")).body.data;
    const aboutEdit = await apiCall(ed.page, "/api/v1/about", { method: "PATCH", body: JSON.stringify({ revision: a.revision, changes: { seo: { title: T("editor") } } }) });
    check("editor: an edit to the approved About page returns it to draft", aboutEdit.status === 200 && aboutEdit.body.data.record.status === "draft");
    check("editor: a save never publishes the About page (400)", (await apiCall(ed.page, "/api/v1/about", { method: "PATCH", body: JSON.stringify({ revision: a.revision + 1, changes: { status: "published" } }) })).status === 400);
    check("editor: may submit it", (await apiCall(ed.page, "/api/v1/about/submit", { method: "POST", body: JSON.stringify({ revision: a.revision + 1 }) })).status === 200);
    check("editor: cannot approve the About page (403)", (await apiCall(ed.page, "/api/v1/about/approve", { method: "POST", body: JSON.stringify({ revision: a.revision + 2 }) })).status === 403);
    const m = await apiCall(ed.page, "/api/v1/team", { method: "POST", body: JSON.stringify({ name: T("editor role"), role: "R", group: "team" }) });
    check("editor: can add a team member (draft)", m.status === 201 && m.body.data.record.status === "draft");
    if (m.status === 201) created.push(m.body.data.record.id);
    check("editor: a save never publishes a team member (400)", (await apiCall(ed.page, `/api/v1/team/${m.body.data.record.id}`, { method: "PATCH", body: JSON.stringify({ revision: m.body.data.revision, changes: { status: "published" } }) })).status === 400);
    check("editor: cannot approve a team member (403)", (await apiCall(ed.page, `/api/v1/team/${m.body.data.record.id}/approve`, { method: "POST", body: JSON.stringify({ revision: m.body.data.revision }) })).status === 403);
    await ed.page.goto(`${base}/team/${m.body.data.record.id}`);
    check("editor UI: a member's draft offers Submit for review", await visibleSoon(ed.page.getByRole("button", { name: "Submit for review" })));
    check("editor UI: no status choice, no Approve for a member", (await ed.page.getByLabel("Status").count()) === 0 && (await ed.page.getByRole("button", { name: "Approve", exact: true }).count()) === 0);
    await ed.page.goto(`${base}/about`);
    check("editor UI: the submitted About page offers Withdraw, never Approve", (await visibleSoon(ed.page.getByRole("button", { name: "Withdraw from review" }))) && (await ed.page.getByRole("button", { name: "Approve", exact: true }).count()) === 0);
    await ed.page.getByRole("button", { name: "Withdraw from review" }).click();
    check("editor UI: withdraws the About page", await visibleSoon(toast(ed.page, "Withdrawn from review")));
    check("editor: sees the owner-only message", await visibleSoon(ed.page.getByText("Only an owner can publish website changes.").first()));
    await ed.context.close();
  }

  // Archive a member from their editor.
  await page.goto(`${base}/team/${created[1]}`);
  await page.getByRole("button", { name: "Archive" }).click();
  const archiveDialog = page.getByRole("dialog", { name: "Archive this team member?" });
  await archiveDialog.waitFor();
  await archiveDialog.getByRole("button", { name: "Archive", exact: true }).click();
  check("member: archived", await visibleSoon(page.getByText("This team member is archived")));

  /* ================= Responsive ================= */
  for (const width of [375, 768, 1024, 1440]) {
    const m = await signIn(owner, { width, height: 900 });
    for (const path of ["/about", "/team", `/team/${firstId}`]) {
      await m.page.goto(`${base}${path}`);
      await m.page.waitForTimeout(700);
      check(`${width}px ${path.replace(firstId, ":id")}: no horizontal page scroll`, await m.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    }
    if (width === 375) {
      await m.page.goto(`${base}/team`);
      await m.page.getByRole("heading", { level: 1, name: "Team" }).waitFor();
      check("375px: team reorder controls reachable", await m.page.getByRole("button", { name: /^Move “.*” down$/ }).first().isVisible());
      await axe(m.page, "Team list at 375px");
      await m.page.goto(`${base}/about`);
      await m.page.getByRole("heading", { level: 1, name: "About page" }).waitFor();
      await axe(m.page, "About editor at 375px");
      await shot(m.page, "about-mobile");
    }
    await m.context.close();
  }

  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
} catch (error) {
  check("flow completed", false, error.message.split("\n")[0]);
} finally {
  if (ownerPage) {
    let archived = 0;
    const a = (await apiCall(ownerPage, "/api/v1/about").catch(() => ({}))).body?.data;
    const page = a?.record && a.record.status !== "archived" && (await apiCall(ownerPage, "/api/v1/about", { method: "DELETE" })).status === 200;
    for (const id of created) if ((await apiCall(ownerPage, `/api/v1/team/${id}`, { method: "DELETE" }).catch(() => ({}))).status === 200) archived++;
    console.log(`(cleanup: ${page ? "archived the About page; " : ""}archived ${archived} team member(s) created by this run)`);
  }
  await browser.close();
}

for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.ok || !r.detail ? "" : `  [${r.detail}]`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
