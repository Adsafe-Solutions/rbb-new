/* Browser smoke test of the popup editor (M22), against a running admin
   and an API with media storage (the test-only fake R2 is enough):

     ADMIN_URL=http://localhost:5174 \
     ADMIN_SMOKE_EMAIL=<owner> ADMIN_SMOKE_PASSWORD=… \
     ADMIN_SMOKE_EDITOR_EMAIL=<editor> ADMIN_SMOKE_EDITOR_PASSWORD=… \
       npx -y -p playwright -p axe-core node scripts/smoke-popups.mjs

   LOCAL or TEST data only: it uploads one test image, writes a
   "Smoke <run> …" popup and archives it at the end; it changes the
   popup's display setting and puts it back. When the organization's
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
  console.error("Needs Playwright: npx -y -p playwright -p axe-core node scripts/smoke-popups.mjs");
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
const getPopup = async (p) => (await apiCall(p, "/api/v1/popup")).body.data;
const saveButton = (p) => p.getByRole("button", { name: /^(Save|Create popup)$/ });
let ownerPage = null;
let restoreEngagement = null;
try {
  const { page: p } = await signIn(owner);
  ownerPage = p;
  let v = await getPopup(p);
  if (v.record && v.record.status !== "archived") { await apiCall(p, "/api/v1/popup", { method: "DELETE" }); v = await getPopup(p); }
  const settings = (await apiCall(p, "/api/v1/settings")).body?.data;
  if (settings) restoreEngagement = settings.settings.engagement;
  const png = readFileSync(new URL("../../api/test/fixtures/media/sample.png", import.meta.url)).toString("base64");
  const image = await p.evaluate(async ({ b64, name }) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const post = (u, body) => fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) }).then((r) => r.json());
    const i = (await post("/api/v1/media/upload-intents", { filename: name, mimeType: "image/png", size: bytes.length })).data;
    await fetch(i.uploadUrl, { method: "PUT", headers: i.uploadHeaders, body: bytes });
    return (await post(`/api/v1/media/${i.mediaId}/complete`)).data;
  }, { b64: png, name: `smoke-${run}-popup.png` });
  check("setup: a ready test image without alt text", image?.status === "ready" && image.alt === "", JSON.stringify(image));

  await p.locator('a[data-nav-item="popups"]').click();
  await p.getByRole("heading", { level: 1, name: "Popup" }).waitFor();
  check("popups: in the Engagement sidebar, available and current", (await p.locator('a[data-nav-item="popups"]').getAttribute("aria-current")) === "page");
  if (!v.record) check("empty: no popup yet; the website keeps its own", await visibleSoon(p.getByTestId("popup-empty")));
  await axe(p, "popup editor (empty)");

  await saveButton(p).click();
  check("validation: refused with a summary", await visibleSoon(p.getByRole("alert").filter({ hasText: "Some fields need attention" })));
  check("validation: each field says why", (await visibleSoon(p.getByText("A heading is required."))) && (await visibleSoon(p.getByText("Choose a photograph from the media library."))) && (await visibleSoon(p.getByText("The close-button text is required."))));
  await field(p, "Heading").fill(T("heading for the popup"));
  await field(p, "Highlighted words").fill("the popup");
  await field(p, "Line").fill(T("line"));
  await field(p, "Button text").fill(T("cta"));
  await field(p, "Page").fill("https://elsewhere.test/x");
  await field(p, "Close-button text").fill("Not now");
  await p.getByRole("group", { name: "Photograph" }).getByRole("button", { name: "Choose image" }).click();
  await p.getByRole("dialog", { name: "Choose: Photograph" }).locator(`[data-media-id="${image.id}"]`).click();
  await saveButton(p).click();
  check("validation: the call to action must be a page of this site", await visibleSoon(p.getByText("A page of this website, like /appeals. Never another site.").first()));
  await field(p, "Page").fill("/media/events");
  await axe(p, "popup editor (filled)");
  await saveButton(p).click();
  check("saved as a draft", await visibleSoon(toast(p, /^(Saved|Popup created)$/)));
  let stored = (await getPopup(p)).record;
  check("stored: the words, the photograph, the site path, and the site's current behaviour as settings", stored?.status === "draft" && stored.heading === T("heading for the popup") && stored.highlight === "the popup" && stored.imageId === image.id && stored.cta.href === "/media/events" && stored.delayMs === 6000 && stored.frequency === "session" && JSON.stringify(stored.excludePaths) === JSON.stringify(["/contact", "/privacy", "/terms", "/donation-policy"]) && /^popup-/.test(stored.key), JSON.stringify(stored));

  await p.getByRole("button", { name: "Submit for review" }).click();
  check("submit: refused while the photograph has no alt text", await visibleSoon(p.getByText("the photograph has no alt text").first()));
  await apiCall(p, `/api/v1/media/${image.id}`, { method: "PATCH", body: JSON.stringify({ version: image.version, alt: "Two people at a market stall" }) });

  const oldKey = await field(p, "Popup key").inputValue();
  await p.getByRole("button", { name: "Use a new key" }).click();
  const freshKey = await field(p, "Popup key").inputValue();
  await p.getByRole("spinbutton", { name: "Seconds after arrival" }).fill("3");
  await p.getByRole("combobox", { name: "How often" }).selectOption("once");
  await saveButton(p).click();
  const savedAgain = await visibleSoon(toast(p, "Saved"));
  stored = (await getPopup(p)).record;
  check("a new key, delay and frequency are saved", savedAgain && freshKey !== oldKey && stored.key === freshKey && stored.delayMs === 3000 && stored.frequency === "once", JSON.stringify([oldKey, freshKey, stored.key]));

  if (restoreEngagement) {
    const switchBox = p.getByRole("checkbox", { name: "Show the popup" });
    const wanted = !(await switchBox.isChecked());
    await switchBox.setChecked(wanted);
    await p.getByRole("button", { name: "Save display setting" }).click();
    check("display: the switch is saved to the settings; nothing else changed", (await visibleSoon(toast(p, "Display setting saved"))) && (await apiCall(p, "/api/v1/settings")).body.data.settings.engagement.popup.enabled === wanted && JSON.stringify((await apiCall(p, "/api/v1/settings")).body.data.settings.engagement.announcementBar) === JSON.stringify(restoreEngagement.announcementBar));
  }

  await field(p, "Line").fill(T("local"));
  const other = await signIn(owner);
  stored = await getPopup(other.page);
  await apiCall(other.page, "/api/v1/popup", { method: "PATCH", body: JSON.stringify({ revision: stored.revision, changes: { body: T("changed elsewhere") } }) });
  await other.context.close();
  await saveButton(p).click();
  check("conflict: the popup's message", await visibleSoon(p.getByRole("alert").filter({ hasText: "The popup was changed elsewhere" })));
  await p.getByRole("button", { name: "Reload latest" }).click();
  check("conflict: reload shows the other change", await p.waitForFunction((t) => [...document.querySelectorAll("textarea")].some((i) => i.value === t), T("changed elsewhere"), { timeout: 6000 }).then(() => true, () => false));
  check("owner: submits and approves the described popup", (await approveUi(p)) && (await getPopup(p)).record.status === "approved");

  const status = (await apiCall(p, "/api/v1/publish/status")).body?.data;
  if (status?.settingsReady) {
    const published = await apiCall(p, "/api/v1/publish", { method: "POST", body: JSON.stringify({}) });
    const snapshot = (await apiCall(p, "/api/v1/public/snapshot")).body?.data;
    check("publish: the snapshot carries the popup, its described photograph and the switch", published.status === 200 && snapshot.content.popup.key === freshKey && snapshot.media[image.id]?.alt === "Two people at a market stall" && snapshot.settings.engagement.popup.enabled === !restoreEngagement.popup.enabled, `${published.status}`);
    const live = await getPopup(p);
    await apiCall(p, "/api/v1/popup", { method: "PATCH", body: JSON.stringify({ revision: live.revision, changes: { body: T("pending edit") } }) });
    check("publish: a pending edit leaves the live popup as it was", !JSON.stringify((await apiCall(p, "/api/v1/public/snapshot")).body.data).includes(T("pending edit")));
  } else check("publish: skipped — the organization has no settings", true);

  if (editor.email && editor.password) {
    const ed = await signIn(editor);
    const b = await getPopup(ed.page);
    check("editor: cannot approve (403)", (await apiCall(ed.page, "/api/v1/popup/approve", { method: "POST", body: JSON.stringify({ revision: b.revision }) })).status === 403);
    await ed.page.goto(`${base}/popups`);
    await ed.page.getByTestId("workflow").waitFor();
    check("editor UI: no Approve; the display setting is owners'", (await ed.page.getByRole("button", { name: "Approve", exact: true }).count()) === 0 && (await ed.page.getByRole("checkbox", { name: "Show the popup" }).isDisabled()) && (await visibleSoon(ed.page.getByText("Only an owner can change this."))));
    await ed.context.close();
  }

  await p.goto(`${base}/popups`);
  await p.getByRole("heading", { level: 1, name: "Popup" }).waitFor();
  await p.getByRole("button", { name: "Archive" }).click();
  const dialog = p.getByRole("dialog", { name: "Archive the popup?" });
  await dialog.waitFor();
  check("archive dialog: focus moves into it", await p.evaluate(() => Boolean(document.activeElement?.closest('dialog, [role="dialog"]'))));
  await axe(p, "archive dialog");
  await dialog.getByRole("button", { name: "Archive", exact: true }).click();
  check("archived", await visibleSoon(p.getByText("The popup is archived")));

  await p.route("**/api/v1/popup", (route) => route.abort());
  await p.goto(`${base}/popups`);
  check("error state: says it could not load, with Try again", await visibleSoon(p.getByText("The popup could not be loaded")));
  await p.unroute("**/api/v1/popup");

  for (const width of [375, 768, 1024, 1440]) {
    const m = await signIn(owner, { width, height: 900 });
    await m.page.goto(`${base}/popups`);
    await m.page.getByRole("heading", { level: 1 }).waitFor();
    await m.page.waitForTimeout(400);
    check(`${width}px /popups: no horizontal page scroll`, await m.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    if (width === 375) await axe(m.page, "/popups at 375px");
    await m.context.close();
  }
  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
} catch (error) {
  check("flow completed", false, error.message.split("\n")[0]);
  if (ownerPage) await shot(ownerPage, "failure").catch(() => {});
} finally {
  if (ownerPage) {
    const v = (await apiCall(ownerPage, "/api/v1/popup").catch(() => ({}))).body?.data;
    if (v?.record && v.record.status !== "archived") await apiCall(ownerPage, "/api/v1/popup", { method: "DELETE" });
    if (restoreEngagement) {
      const s = (await apiCall(ownerPage, "/api/v1/settings")).body?.data;
      if (s) await apiCall(ownerPage, "/api/v1/settings", { method: "PATCH", body: JSON.stringify({ revision: s.revision, changes: { engagement: restoreEngagement } }) });
    }
    console.log("(cleanup: the popup is archived; the display setting restored)");
  }
  await browser.close();
}

for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.ok || !r.detail ? "" : `  [${r.detail}]`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
