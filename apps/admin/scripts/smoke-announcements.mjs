/* Browser smoke test of the announcement bar editor (M21), against a
   running admin and API:

     ADMIN_URL=http://localhost:5174 \
     ADMIN_SMOKE_EMAIL=<owner> ADMIN_SMOKE_PASSWORD=… \
     ADMIN_SMOKE_EDITOR_EMAIL=<editor> ADMIN_SMOKE_EDITOR_PASSWORD=… \
       npx -y -p playwright -p axe-core node scripts/smoke-announcements.mjs

   LOCAL or TEST data only: it writes "Smoke <run> …" messages into the
   organization's announcement bar and archives it at the end; it changes
   the bar's display settings and puts them back. When the organization's
   settings exist it publishes the website ONCE (a test database's test
   organization: the API must have no deploy hook). Passwords are never printed.
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
  console.error("Needs Playwright: npx -y -p playwright -p axe-core node scripts/smoke-announcements.mjs");
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
const field = (page, name) => page.getByRole("textbox", { name, exact: true });

async function axe(page, name) {
  if (!axeSource) return;
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"), null, { timeout: 5000 }).catch(() => {});
  await page.evaluate(axeSource);
  const v = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ["violations"] })).violations.map((x) => `${x.id} (${x.impact}): ${x.nodes[0]?.target?.join(" ")}`));
  check(`axe: no violations — ${name}`, v.length === 0, v.join(" | "));
}
async function signIn(who, viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on("console", (m) => m.type() === "error" && !/status of (401|400|403|409)|net::ERR_FAILED/.test(m.text()) && consoleErrors.push(m.text()));
  page.on("pageerror", (e) => consoleErrors.push(e.message));
  await page.goto(`${base}/login`);
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(who.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByTestId("user-role").waitFor();
  return { context, page };
}
const apiCall = (page, path, init = {}) =>
  page.evaluate(
    async ({ path, init }) => {
      const r = await fetch(path, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...init });
      return { status: r.status, body: await r.json().catch(() => null) };
    },
    { path, init }
  );
const approveUi = async (page) => {
  await page.getByRole("button", { name: "Submit for review" }).click();
  await visibleSoon(toast(page, "Submitted for review"));
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /^Approve this/ });
  await dialog.waitFor();
  await dialog.getByRole("button", { name: "Approve", exact: true }).click();
  return visibleSoon(toast(page, "Approved"));
};
const getBar = async (p) => (await apiCall(p, "/api/v1/announcement-bar")).body.data;
const saveButton = (p) => p.getByRole("button", { name: /^(Save|Create announcement bar)$/ });
let ownerPage = null;
let restoreDisplay = null;
try {
  const { page: p } = await signIn(owner);
  ownerPage = p;
  let v = await getBar(p);
  if (v.record && v.record.status !== "archived") { await apiCall(p, "/api/v1/announcement-bar", { method: "DELETE" }); v = await getBar(p); }
  if (v.record) await apiCall(p, "/api/v1/announcement-bar", { method: "PATCH", body: JSON.stringify({ revision: v.revision, changes: { status: "draft", items: [] } }) });
  const settings = (await apiCall(p, "/api/v1/settings")).body?.data;
  if (settings) restoreDisplay = settings.settings.engagement;

  await p.locator('a[data-nav-item="announcements"]').click();
  await p.getByRole("heading", { level: 1, name: "Announcement bar" }).waitFor();
  check("announcements: in the Engagement sidebar, available and current", (await p.locator('a[data-nav-item="announcements"]').getAttribute("aria-current")) === "page");
  check("empty: says the website keeps its own messages", await visibleSoon(p.getByTestId("bar-empty")));
  await axe(p, "announcement bar (empty)");

  await p.getByRole("button", { name: "Add a message" }).click();
  await p.getByRole("button", { name: "Add a message" }).click();
  await field(p, "Message 2").fill(T("second"));
  await p.getByRole("checkbox", { name: "Add a link" }).nth(1).check();
  await field(p, "Link text").fill("See events");
  await field(p, "Page").fill("https://elsewhere.test/x");
  await saveButton(p).click();
  check("validation: refused with a summary", await visibleSoon(p.getByRole("alert").filter({ hasText: "Some fields need attention" })));
  check("validation: an empty message says why", await visibleSoon(p.getByText("A message is required.")));
  check("validation: a link must be a page of this site", await visibleSoon(p.getByText("A page of this site, like /appeals or /media/events.")));
  await field(p, "Message 1").fill(T("first"));
  await field(p, "Page").fill("/media/events");
  await axe(p, "announcement bar (filled)");
  await saveButton(p).click();
  check("saved", await visibleSoon(toast(p, /^(Saved|Announcement bar created)$/)));
  let stored = (await getBar(p)).record;
  check("stored: the messages in order, the link to a site path, generated ids", JSON.stringify(stored.items.map((i) => i.text)) === JSON.stringify([T("first"), T("second")]) && stored.items[1].link.href === "/media/events" && stored.items.every((i) => /^m-/.test(i.id)), JSON.stringify(stored.items));

  const up = p.getByRole("button", { name: "Move Message 2 up" });
  await up.focus();
  await p.keyboard.press("Enter");
  await p.waitForTimeout(150);
  const focused = await p.evaluate(() => ({ label: document.activeElement?.getAttribute("aria-label"), visible: document.activeElement?.matches(":focus-visible") }));
  check("reorder: moved by keyboard; focus stays, visibly", (await field(p, "Message 1").inputValue()) === T("second") && focused.label === "Move Message 1 down" && focused.visible, JSON.stringify(focused));
  await saveButton(p).click();
  check("reorder: saved", (await visibleSoon(toast(p, "Saved"))) && (await getBar(p)).record.items[0].text === T("second"));

  if (restoreDisplay) {
    await p.getByRole("checkbox", { name: "Show the announcement bar" }).uncheck();
    await p.getByRole("spinbutton", { name: "Seconds per message" }).fill("8");
    await p.getByRole("button", { name: "Save display settings" }).click();
    check("display: saved to the settings", await visibleSoon(toast(p, "Display settings saved")));
    const eng = (await apiCall(p, "/api/v1/settings")).body.data.settings.engagement;
    check("display: the settings hold the switch and the interval; nothing else changed", eng.announcementBar.enabled === false && eng.announcementBar.intervalMs === 8000 && JSON.stringify(eng.popup) === JSON.stringify(restoreDisplay.popup), JSON.stringify(eng));
    await p.getByRole("spinbutton", { name: "Seconds per message" }).fill("40");
    check("display: an interval outside 2–30 s is refused before saving", (await visibleSoon(p.getByText("Between 2 and 30 seconds."))) && (await p.getByRole("button", { name: "Save display settings" }).isDisabled()));
    await p.getByRole("spinbutton", { name: "Seconds per message" }).fill("8");
  }

  await field(p, "Message 1").fill(T("local"));
  const other = await signIn(owner);
  stored = await getBar(other.page);
  await apiCall(other.page, "/api/v1/announcement-bar", { method: "PATCH", body: JSON.stringify({ revision: stored.revision, changes: { items: [{ ...stored.record.items[0], text: T("changed elsewhere") }, stored.record.items[1]] } }) });
  await other.context.close();
  await saveButton(p).click();
  check("conflict: the bar's message", await visibleSoon(p.getByRole("alert").filter({ hasText: "The announcement bar was changed elsewhere" })));
  await p.getByRole("button", { name: "Reload latest" }).click();
  check("conflict: reload shows the other change", await p.waitForFunction((t) => [...document.querySelectorAll("input")].some((i) => i.value === t), T("changed elsewhere"), { timeout: 6000 }).then(() => true, () => false));
  check("owner: submits and approves the bar", (await approveUi(p)) && (await getBar(p)).record.status === "approved");

  const status = (await apiCall(p, "/api/v1/publish/status")).body?.data;
  if (status?.settingsReady) {
    const published = await apiCall(p, "/api/v1/publish", { method: "POST", body: JSON.stringify({}) });
    const snapshot = (await apiCall(p, "/api/v1/public/snapshot")).body?.data;
    check("publish: the snapshot carries the bar's messages in order, and the display settings", published.status === 200 && JSON.stringify(snapshot.content.announcementBar.items.map((i) => i.text)) === JSON.stringify([T("changed elsewhere"), T("first")]) && snapshot.settings.engagement.announcementBar.intervalMs === 8000, `${published.status}`);
    const live = await getBar(p);
    await apiCall(p, "/api/v1/announcement-bar", { method: "PATCH", body: JSON.stringify({ revision: live.revision, changes: { items: [{ id: "m-pending", text: T("pending edit") }] } }) });
    check("publish: a pending edit leaves the live messages as they were", !JSON.stringify((await apiCall(p, "/api/v1/public/snapshot")).body.data).includes(T("pending edit")));
  } else check("publish: skipped — the organization has no settings", true);

  if (editor.email && editor.password) {
    const ed = await signIn(editor);
    const b = await getBar(ed.page);
    check("editor: cannot approve (403)", (await apiCall(ed.page, "/api/v1/announcement-bar/approve", { method: "POST", body: JSON.stringify({ revision: b.revision }) })).status === 403);
    await ed.page.goto(`${base}/announcements`);
    await ed.page.getByTestId("workflow").waitFor();
    check("editor UI: no Approve; display settings are owners'", (await ed.page.getByRole("button", { name: "Approve", exact: true }).count()) === 0 && (await ed.page.getByRole("checkbox", { name: "Show the announcement bar" }).isDisabled()) && (await visibleSoon(ed.page.getByText("Only an owner can change these."))));
    await ed.context.close();
  }

  await p.goto(`${base}/announcements`);
  await p.getByRole("heading", { level: 1, name: "Announcement bar" }).waitFor();
  await p.getByRole("button", { name: "Archive" }).click();
  const dialog = p.getByRole("dialog", { name: "Archive the announcement bar?" });
  await dialog.waitFor();
  check("archive dialog: focus moves into it", await p.evaluate(() => Boolean(document.activeElement?.closest('dialog, [role="dialog"]'))));
  await axe(p, "archive dialog");
  await dialog.getByRole("button", { name: "Archive", exact: true }).click();
  check("archived", await visibleSoon(p.getByText("The announcement bar is archived")));

  await p.route("**/api/v1/announcement-bar", (route) => route.abort());
  await p.goto(`${base}/announcements`);
  check("error state: says it could not load, with Try again", await visibleSoon(p.getByText("The announcement bar could not be loaded")));
  await p.unroute("**/api/v1/announcement-bar");

  for (const width of [375, 768, 1024, 1440]) {
    const m = await signIn(owner, { width, height: 900 });
    await m.page.goto(`${base}/announcements`);
    await m.page.getByRole("heading", { level: 1 }).waitFor();
    await m.page.waitForTimeout(400);
    check(`${width}px /announcements: no horizontal page scroll`, await m.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    if (width === 375) await axe(m.page, "/announcements at 375px");
    await m.context.close();
  }
  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
} catch (error) {
  check("flow completed", false, error.message.split("\n")[0]);
  if (ownerPage) await shot(ownerPage, "failure").catch(() => {});
} finally {
  if (ownerPage) {
    const v = (await apiCall(ownerPage, "/api/v1/announcement-bar").catch(() => ({}))).body?.data;
    if (v?.record && v.record.status !== "archived") await apiCall(ownerPage, "/api/v1/announcement-bar", { method: "DELETE" });
    if (restoreDisplay) {
      const s = (await apiCall(ownerPage, "/api/v1/settings")).body?.data;
      if (s) await apiCall(ownerPage, "/api/v1/settings", { method: "PATCH", body: JSON.stringify({ revision: s.revision, changes: { engagement: restoreDisplay } }) });
    }
    console.log("(cleanup: the bar is archived; display settings restored)");
  }
  await browser.close();
}

for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.ok || !r.detail ? "" : `  [${r.detail}]`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
