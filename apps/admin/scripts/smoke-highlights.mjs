/* Browser smoke test of the Highlights editor (M23), against a running
   admin and an API with media storage (the test-only fake R2 is enough):

     ADMIN_URL=http://localhost:5174 \
     ADMIN_SMOKE_EMAIL=<owner> ADMIN_SMOKE_PASSWORD=… \
     ADMIN_SMOKE_EDITOR_EMAIL=<editor> ADMIN_SMOKE_EDITOR_PASSWORD=… \
       npx -y -p playwright -p axe-core node scripts/smoke-highlights.mjs

   LOCAL or TEST data only: it uploads one test image, creates two
   "Smoke <run> …" appeals, writes the organization's Highlights and
   archives them and the appeals at the end; it changes the story
   circles' display setting and puts it back. When the organization's
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
  console.error("Needs Playwright: npx -y -p playwright -p axe-core node scripts/smoke-highlights.mjs");
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
const getStrip = async (p) => (await apiCall(p, "/api/v1/story-strip")).body.data;
const saveButton = (p) => p.getByRole("button", { name: /^(Save|Create Highlights)$/ });
const select = (p, i) => p.getByRole("combobox", { name: `Appeal for circle ${i}` });
let ownerPage = null;
let restoreEngagement = null;
const appealIds = [];
try {
  const { page: p } = await signIn(owner);
  ownerPage = p;
  let v = await getStrip(p);
  if (v.record && v.record.status !== "archived") { await apiCall(p, "/api/v1/story-strip", { method: "DELETE" }); v = await getStrip(p); }
  if (v.record) await apiCall(p, "/api/v1/story-strip", { method: "PATCH", body: JSON.stringify({ revision: v.revision, changes: { status: "draft", appealIds: [] } }) });
  const settings = (await apiCall(p, "/api/v1/settings")).body?.data;
  if (settings) restoreEngagement = settings.settings.engagement;
  const png = readFileSync(new URL("../../api/test/fixtures/media/sample.png", import.meta.url)).toString("base64");
  const image = await p.evaluate(async ({ b64, name }) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const post = (u, body) => fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) }).then((r) => r.json());
    const i = (await post("/api/v1/media/upload-intents", { filename: name, mimeType: "image/png", size: bytes.length })).data;
    await fetch(i.uploadUrl, { method: "PUT", headers: i.uploadHeaders, body: bytes });
    return (await post(`/api/v1/media/${i.mediaId}/complete`)).data;
  }, { b64: png, name: `smoke-${run}-appeal.png` });
  await apiCall(p, `/api/v1/media/${image.id}`, { method: "PATCH", body: JSON.stringify({ version: image.version, alt: "A smoke test photo" }) });
  const createAppeal = async (title, highlight) => (await apiCall(p, "/api/v1/appeals", { method: "POST", body: JSON.stringify({ kind: "campaign", title, summary: "A smoke summary.", imageId: image.id, ...(highlight && { highlight }) }) })).body.data.record;
  const approveAppeal = async (id) => {
    for (const action of ["submit", "approve"]) {
      const cur = (await apiCall(p, `/api/v1/appeals/${id}`)).body.data;
      await apiCall(p, `/api/v1/appeals/${id}/${action}`, { method: "POST", body: JSON.stringify({ revision: cur.revision }) });
    }
  };
  const appealA = await createAppeal(T("appeal A"), { label: T("short A") });
  const appealB = await createAppeal(T("appeal B"));
  appealIds.push(appealA.id, appealB.id);
  await approveAppeal(appealA.id);

  await p.locator('a[data-nav-item="highlights"]').click();
  await p.getByRole("heading", { level: 1, name: "Highlights" }).waitFor();
  check("highlights: in the Engagement sidebar, available and current", (await p.locator('a[data-nav-item="highlights"]').getAttribute("aria-current")) === "page");
  check("empty: no circles chosen yet", await visibleSoon(p.getByTestId("strip-empty")));
  await axe(p, "Highlights (empty)");

  await p.getByRole("button", { name: "Add a circle" }).click();
  await saveButton(p).click();
  check("validation: an empty circle says why", await visibleSoon(p.getByText("Choose an appeal for this circle, or remove it.")));
  await select(p, 1).selectOption(appealA.id);
  check("a circle says what it will read (the appeal's own short label)", await visibleSoon(p.getByText(`The circle reads “${T("short A")}”`)));
  await p.getByRole("button", { name: "Add a circle" }).click();
  await select(p, 2).selectOption(appealB.id);
  check("a chosen appeal that is not approved is named", (await visibleSoon(p.getByTestId("strip-not-ready"))) && (await p.getByTestId("strip-not-ready").innerText()).includes(T("appeal B")));
  await axe(p, "Highlights (filled)");
  await saveButton(p).click();
  check("saved as a draft", await visibleSoon(toast(p, /^(Saved|Highlights created)$/)));
  let stored = (await getStrip(p)).record;
  check("stored: the appeals by id, in order", stored?.status === "draft" && JSON.stringify(stored.appealIds) === JSON.stringify([appealA.id, appealB.id]), JSON.stringify(stored));

  await p.getByRole("button", { name: "Submit for review" }).click();
  check("submit: refused while an appeal is not approved", await visibleSoon(p.getByText("not approved yet").first()));

  const up = p.getByRole("button", { name: "Move Circle 2 up" });
  await up.focus();
  await p.keyboard.press("Enter");
  await p.waitForTimeout(150);
  const focused = await p.evaluate(() => ({ label: document.activeElement?.getAttribute("aria-label"), visible: document.activeElement?.matches(":focus-visible") }));
  check("reorder: moved by keyboard; focus stays, visibly", (await select(p, 1).inputValue()) === appealB.id && focused.label === "Move Circle 1 down" && focused.visible, JSON.stringify(focused));
  await saveButton(p).click();
  const reordered = await visibleSoon(toast(p, "Saved"));
  check("reorder: saved", reordered && JSON.stringify((await getStrip(p)).record.appealIds) === JSON.stringify([appealB.id, appealA.id]));

  if (restoreEngagement) {
    const box = p.getByRole("checkbox", { name: "Show the story circles" });
    const wanted = !(await box.isChecked());
    await box.setChecked(wanted);
    await p.getByRole("button", { name: "Save display setting" }).click();
    check("display: the switch is saved to the settings; nothing else changed", (await visibleSoon(toast(p, "Display setting saved"))) && (await apiCall(p, "/api/v1/settings")).body.data.settings.engagement.storyStrip.enabled === wanted && JSON.stringify((await apiCall(p, "/api/v1/settings")).body.data.settings.engagement.popup) === JSON.stringify(restoreEngagement.popup));
  }

  await p.getByRole("button", { name: "Remove Circle 2" }).click();
  const other = await signIn(owner);
  stored = await getStrip(other.page);
  await apiCall(other.page, "/api/v1/story-strip", { method: "PATCH", body: JSON.stringify({ revision: stored.revision, changes: { appealIds: [appealA.id, appealB.id] } }) });
  await other.context.close();
  await saveButton(p).click();
  check("conflict: the Highlights message", await visibleSoon(p.getByRole("alert").filter({ hasText: "Highlights were changed elsewhere" })));
  await p.getByRole("button", { name: "Reload latest" }).click();
  check("conflict: reload shows the other change", await p.waitForFunction((id) => document.querySelector("select")?.value === id, appealA.id, { timeout: 6000 }).then(() => true, () => false));

  await approveAppeal(appealB.id);
  await p.reload();
  await p.getByRole("heading", { level: 1, name: "Highlights" }).waitFor();
  check("owner: submits and approves Highlights once both appeals are approved", (await approveUi(p)) && (await getStrip(p)).record.status === "approved");

  const status = (await apiCall(p, "/api/v1/publish/status")).body?.data;
  if (status?.settingsReady) {
    const published = await apiCall(p, "/api/v1/publish", { method: "POST", body: JSON.stringify({}) });
    const snapshot = (await apiCall(p, "/api/v1/public/snapshot")).body?.data;
    check("publish: the snapshot carries the strip in its order, with both appeals published", published.status === 200 && JSON.stringify(snapshot.content.storyStrip.appealIds) === JSON.stringify([appealA.id, appealB.id]) && [appealA.id, appealB.id].every((id) => snapshot.content.appeals.some((a) => a.id === id)), `${published.status}`);
    const live = await getStrip(p);
    await apiCall(p, "/api/v1/story-strip", { method: "PATCH", body: JSON.stringify({ revision: live.revision, changes: { appealIds: [appealB.id] } }) });
    check("publish: a pending edit leaves the live strip as it was", JSON.stringify((await apiCall(p, "/api/v1/public/snapshot")).body.data.content.storyStrip.appealIds) === JSON.stringify([appealA.id, appealB.id]));
  } else check("publish: skipped — the organization has no settings", true);

  if (editor.email && editor.password) {
    const ed = await signIn(editor);
    const b = await getStrip(ed.page);
    check("editor: cannot approve (403)", (await apiCall(ed.page, "/api/v1/story-strip/approve", { method: "POST", body: JSON.stringify({ revision: b.revision }) })).status === 403);
    await ed.page.goto(`${base}/highlights`);
    await ed.page.getByTestId("workflow").waitFor();
    check("editor UI: no Approve; the display setting is owners'", (await ed.page.getByRole("button", { name: "Approve", exact: true }).count()) === 0 && (await ed.page.getByRole("checkbox", { name: "Show the story circles" }).isDisabled()) && (await visibleSoon(ed.page.getByText("Only an owner can change this."))));
    await ed.context.close();
  }

  await p.goto(`${base}/highlights`);
  await p.getByRole("heading", { level: 1, name: "Highlights" }).waitFor();
  await p.getByRole("button", { name: "Archive" }).click();
  const dialog = p.getByRole("dialog", { name: "Archive Highlights?" });
  await dialog.waitFor();
  check("archive dialog: focus moves into it", await p.evaluate(() => Boolean(document.activeElement?.closest('dialog, [role="dialog"]'))));
  await axe(p, "archive dialog");
  await dialog.getByRole("button", { name: "Archive", exact: true }).click();
  check("archived", await visibleSoon(p.getByText("Highlights are archived")));

  await p.route("**/api/v1/story-strip", (route) => route.abort());
  await p.goto(`${base}/highlights`);
  check("error state: says it could not load, with Try again", await visibleSoon(p.getByText("Highlights could not be loaded")));
  await p.unroute("**/api/v1/story-strip");

  for (const width of [375, 768, 1024, 1440]) {
    const m = await signIn(owner, { width, height: 900 });
    await m.page.goto(`${base}/highlights`);
    await m.page.getByRole("heading", { level: 1 }).waitFor();
    await m.page.waitForTimeout(400);
    check(`${width}px /highlights: no horizontal page scroll`, await m.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    if (width === 375) await axe(m.page, "/highlights at 375px");
    await m.context.close();
  }
  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
} catch (error) {
  check("flow completed", false, error.message.split("\n")[0]);
  if (ownerPage) await shot(ownerPage, "failure").catch(() => {});
} finally {
  if (ownerPage) {
    const v = (await apiCall(ownerPage, "/api/v1/story-strip").catch(() => ({}))).body?.data;
    if (v?.record && v.record.status !== "archived") await apiCall(ownerPage, "/api/v1/story-strip", { method: "DELETE" });
    for (const id of appealIds) await apiCall(ownerPage, `/api/v1/appeals/${id}`, { method: "DELETE" });
    if (restoreEngagement) {
      const s = (await apiCall(ownerPage, "/api/v1/settings")).body?.data;
      if (s) await apiCall(ownerPage, "/api/v1/settings", { method: "PATCH", body: JSON.stringify({ revision: s.revision, changes: { engagement: restoreEngagement } }) });
    }
    console.log("(cleanup: Highlights and the smoke's appeals archived; the display setting restored)");
  }
  await browser.close();
}

for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.ok || !r.detail ? "" : `  [${r.detail}]`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
