/* Browser smoke test of Site Settings and publishing, against a running
   admin and API (with working media storage — the local fake R2 is fine):

     ADMIN_URL=http://localhost:5174 \
     ADMIN_SMOKE_EMAIL=<owner> ADMIN_SMOKE_PASSWORD=… \
     ADMIN_SMOKE_EDITOR_EMAIL=<editor> ADMIN_SMOKE_EDITOR_PASSWORD=… \
       npx -y -p playwright -p axe-core node scripts/smoke-settings.mjs

   LOCAL or test data only: it edits and PUBLISHES settings. Every value it
   writes is a clearly marked test value, and at the end it restores the
   settings it found and publishes them again (so the public snapshot is
   back to the original content, one version later). Passwords are never
   printed. SCREENSHOTS=<dir> saves screenshots. Exits 1 on any failure. */
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
  console.error("Needs Playwright: npx -y -p playwright -p axe-core node scripts/smoke-settings.mjs");
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

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail });
const browser = await playwright.chromium.launch();
const consoleErrors = [];
const watch = (page) => {
  page.on("console", (m) => m.type() === "error" && !/status of (401|400|403|409)/.test(m.text()) && consoleErrors.push(m.text()));
  page.on("pageerror", (e) => consoleErrors.push(e.message));
};
const visibleSoon = (locator, timeout = 5000) => locator.waitFor({ state: "visible", timeout }).then(() => true, () => false);
const toast = (page, text) => page.getByRole("region", { name: "Notifications" }).getByText(text).first();
const shot = async (page, name) => shots && page.screenshot({ path: join(shots, `${name}.png`), fullPage: true });

async function axe(page, name) {
  if (!axeSource) return;
  // Scan the settled page: mid-fade text would be measured semi-transparent.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"), null, { timeout: 5000 }).catch(() => {});
  await page.evaluate(axeSource);
  const violations = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ["violations"] })).violations.map((v) => `${v.id} (${v.impact}): ${v.nodes[0]?.target?.join(" ")}`));
  check(`axe: no violations — ${name}`, violations.length === 0, violations.join(" | "));
}

async function signIn(who, viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  watch(page);
  await page.goto(`${base}/login`);
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(who.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByTestId("user-role").waitFor();
  return { context, page };
}
async function openSettings(page) {
  await page.goto(`${base}/settings`);
  await page.getByRole("heading", { level: 1, name: "Settings" }).waitFor();
  await page.getByTestId("publish-panel").waitFor();
}
/* Same-origin API calls from the signed-in page (the browser adds the
   session cookie and Origin itself). */
const apiCall = (page, path, init = {}) =>
  page.evaluate(
    async ({ path, init }) => {
      const res = await fetch(path, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...init });
      return { status: res.status, body: await res.json().catch(() => null) };
    },
    { path, init }
  );

let original = null;
let ownerPage = null;
try {
  const ownerSession = await signIn(owner);
  ownerPage = ownerSession.page;
  const page = ownerPage;
  original = (await apiCall(page, "/api/v1/settings")).body?.data;
  if (!original) throw new Error("No settings in this database — run the settings import first.");

  // Navigation and layout.
  const nav = page.locator('a[data-nav-item="settings"]');
  check("sidebar: Settings is a link", (await nav.count()) === 1);
  await nav.click();
  await page.getByRole("heading", { level: 1, name: "Settings" }).waitFor();
  await page.getByTestId("publish-panel").waitFor();
  check("sidebar: Settings is current", (await nav.getAttribute("aria-current")) === "page");
  const tabs = await page.getByRole("tab").allInnerTexts();
  check("sections: General, Branding, Contact, Social, SEO, Analytics, Donations", JSON.stringify(tabs.map((t) => t.trim())) === JSON.stringify(["General", "Branding", "Contact", "Social", "SEO", "Analytics", "Donations"]), tabs.join(","));
  check("no demo/sample/coming-soon wording", !/\b(demo|sample|coming soon)\b/i.test(await page.locator("main").innerText()));
  await page.getByRole("tab", { name: "General" }).focus();
  await page.keyboard.press("ArrowRight");
  check("tabs: arrow keys move between sections", (await page.getByRole("tab", { name: "Branding" }).getAttribute("aria-selected")) === "true");
  await page.getByRole("tab", { name: "General" }).click();
  await shot(page, "settings-owner");
  await axe(page, "settings (owner)");

  // Unsaved state and discard.
  const summary = page.getByLabel("Summary");
  await summary.fill("SMOKE TEST summary — not real content.");
  check("unsaved: the save bar says so", await page.getByText("Unsaved changes in General").isVisible());
  check("unsaved: the section is marked", (await page.getByRole("tab", { name: /General/ }).innerText()).includes("•"));
  check("unsaved: publishing waits for a save", await page.getByText("Save your changes before publishing.").isVisible());
  await page.getByRole("button", { name: "Discard" }).click();
  check("discard: restores the saved value", (await summary.inputValue()) === original.settings.general.summary);

  // Validation from the API, shown at the field.
  await page.getByRole("tab", { name: "Social" }).click();
  await page.getByLabel("Instagram").fill("http://insecure.example/account");
  await page.getByRole("button", { name: "Save changes" }).click();
  const invalid = page.getByRole("alert").filter({ hasText: "Some settings need attention" });
  check("invalid: refused with a summary", await visibleSoon(invalid));
  check("invalid: the field shows why", await visibleSoon(page.getByText("must be an https:// URL")));
  await page.getByRole("button", { name: "Discard" }).click();

  // A real save: contact method + summary, then a media reference.
  await page.getByRole("tab", { name: "Contact" }).click();
  await page.getByRole("button", { name: "Add contact method" }).click();
  const method = page.getByTestId("contact-method").last();
  await method.getByLabel("Label").fill("Smoke test inbox");
  await method.getByLabel("Email address").fill("smoke-test@example.org");
  await page.getByRole("tab", { name: "General" }).click();
  await summary.fill("SMOKE TEST summary — not real content.");
  check("unsaved: two sections listed", await page.getByText(/Unsaved changes in General, Contact|Unsaved changes in Contact, General/).isVisible());
  await page.getByRole("button", { name: "Save changes" }).click();
  check("save: confirmed", await visibleSoon(toast(page, "Settings saved")));
  check("save: everything saved", await visibleSoon(page.getByText(/^All changes saved/)));
  check("publish panel: unpublished changes, naming the sections", await visibleSoon(page.getByText(/Changed since then: .*General/)) && (await page.getByTestId("publish-state").innerText()).includes("Unpublished changes"));

  // Branding through the media picker (an image uploaded for this test).
  const png = readFileSync(new URL("../../api/test/fixtures/media/sample.png", import.meta.url)).toString("base64");
  const uploaded = await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const post = (path, body) => fetch(path, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) }).then((r) => r.json());
    const intent = (await post("/api/v1/media/upload-intents", { filename: "smoke-settings-logo.png", mimeType: "image/png", size: bytes.length })).data;
    const put = await fetch(intent.uploadUrl, { method: "PUT", headers: intent.uploadHeaders, body: bytes });
    const done = await post(`/api/v1/media/${intent.mediaId}/complete`);
    return { id: intent.mediaId, put: put.status, status: done.data?.status };
  }, png);
  check("setup: a ready test image exists", uploaded.status === "ready", JSON.stringify(uploaded));
  await page.getByRole("tab", { name: "Branding" }).click();
  await page.getByRole("group", { name: "Logo" }).getByRole("button", { name: "Choose image" }).click();
  const picker = page.getByRole("dialog", { name: "Choose: Logo" });
  await picker.waitFor();
  await axe(page, "media picker");
  await picker.locator(`[data-media-id="${uploaded.id}"]`).click();
  check("picker: the chosen image is shown", await visibleSoon(page.getByRole("group", { name: "Logo" }).getByText("smoke-settings-logo.png")));
  await page.getByRole("button", { name: "Save changes" }).click();
  await visibleSoon(page.getByText(/^All changes saved/));

  // A conflict: another session saves first.
  const other = await signIn(owner);
  await openSettings(other.page);
  await other.page.getByLabel("Full name").fill(`${original.settings.general.name} (smoke edit elsewhere)`);
  await other.page.getByRole("button", { name: "Save changes" }).click();
  await visibleSoon(toast(other.page, "Settings saved"));
  await other.context.close();
  await page.getByRole("tab", { name: "General" }).click();
  await page.getByLabel("Short name").fill(`${original.settings.general.shortName}X`);
  await page.getByRole("button", { name: "Save changes" }).click();
  const conflict = page.getByRole("alert").filter({ hasText: "These settings were changed elsewhere. Reload the latest version before saving." });
  check("conflict: an older save is refused, not overwritten", await visibleSoon(conflict));
  await page.getByRole("button", { name: "Reload latest version" }).click();
  await page.getByRole("tab", { name: "General" }).click();
  check("conflict: reload shows the other session's change", (await page.getByLabel("Full name").inputValue()).includes("(smoke edit elsewhere)"));

  // Publish.
  const before = (await apiCall(page, "/api/v1/publish/status")).body.data;
  await page.getByRole("button", { name: "Publish changes" }).click();
  const dialog = page.getByRole("dialog", { name: "Publish changes?" });
  await dialog.waitFor();
  check("publish: concise confirmation", (await dialog.innerText()).includes("The saved settings and the approved content will become the public version of the website."));
  check("publish: Cancel has focus first", (await page.evaluate(() => document.activeElement?.textContent?.trim())) === "Cancel");
  await axe(page, "publish confirmation");
  await dialog.getByRole("button", { name: "Publish", exact: true }).click();
  const expected = (before.active?.version ?? 0) + 1;
  check("publish: confirmed with the new version", await visibleSoon(toast(page, `Published version ${expected}`), 10_000));
  check("publish: panel shows it live and up to date", await visibleSoon(page.getByText(`Live: version ${expected}`)) && (await page.getByTestId("publish-state").innerText()).includes("Up to date"));
  const snapshot = (await apiCall(page, "/api/v1/public/snapshot")).body?.data;
  check("public snapshot: carries the published values", snapshot?.version === expected && snapshot.settings.contact.methods.some((m) => m.value === "smoke-test@example.org") && snapshot.settings.branding.logoId === uploaded.id);
  check("public snapshot: the logo resolves to its public URL", Boolean(snapshot?.media?.[uploaded.id]?.url));
  await shot(page, "settings-published");

  // Editor: read-only, cannot publish — enforced by the API too.
  if (editor.email && editor.password) {
    const ed = await signIn(editor);
    await openSettings(ed.page);
    check("editor: told they can view only", await ed.page.getByText("You can view these settings. Owners can change and publish them.").isVisible());
    check("editor: fields are read-only", await ed.page.getByLabel("Summary").isDisabled());
    check("editor: no save bar", (await ed.page.getByRole("button", { name: "Save changes" }).count()) === 0);
    check("editor: cannot publish", (await ed.page.getByRole("button", { name: "Publish changes" }).count()) === 0 && (await ed.page.getByText("Only an owner can publish website changes.").isVisible()));
    const view = (await apiCall(ed.page, "/api/v1/settings")).body.data;
    const patch = await apiCall(ed.page, "/api/v1/settings", { method: "PATCH", body: JSON.stringify({ revision: view.revision, changes: { general: view.settings.general } }) });
    const publish = await apiCall(ed.page, "/api/v1/publish", { method: "POST" });
    check("editor: the API refuses their save (403) and publish (403)", patch.status === 403 && publish.status === 403, `${patch.status}/${publish.status}`);
    await shot(ed.page, "settings-editor");
    await axe(ed.page, "settings (editor)");
    await ed.context.close();
  }

  // Responsive.
  const mobile = await signIn(owner, { width: 375, height: 812 });
  await openSettings(mobile.page);
  check("mobile: no horizontal page scroll", await mobile.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await mobile.page.getByRole("tab", { name: "Contact" }).click();
  check("mobile: no horizontal page scroll (contact)", await mobile.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await shot(mobile.page, "settings-mobile");
  await mobile.context.close();

  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
} catch (error) {
  check("flow completed", false, error.message.split("\n")[0]);
} finally {
  // Put back what we found, then publish it, so the public snapshot is the
  // original content again (one version later).
  if (original && ownerPage) {
    try {
      const now = (await apiCall(ownerPage, "/api/v1/settings")).body.data;
      const restore = Object.fromEntries(["general", "contact", "social", "seo", "branding", "analytics", "donations"].map((k) => [k, original.settings[k]]));
      const saved = await apiCall(ownerPage, "/api/v1/settings", { method: "PATCH", body: JSON.stringify({ revision: now.revision, changes: restore }) });
      const status = (await apiCall(ownerPage, "/api/v1/publish/status")).body.data;
      const published = status.hasUnpublishedChanges ? await apiCall(ownerPage, "/api/v1/publish", { method: "POST" }) : { status: 200 };
      console.log(`(cleanup: settings restored ${saved.status === 200 ? "✓" : saved.status}, republished ${published.status === 200 ? "✓" : published.status})`);
    } catch (e) {
      console.log(`(cleanup failed: ${e.message.split("\n")[0]})`);
    }
  }
  await browser.close();
}

for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.ok || !r.detail ? "" : `  [${r.detail}]`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
