/* Browser smoke test of Appeals and the General Donation page, against a
   running admin and API (with working media storage — the local fake R2
   is fine):

     ADMIN_URL=http://localhost:5174 \
     ADMIN_SMOKE_EMAIL=<owner> ADMIN_SMOKE_PASSWORD=… \
     ADMIN_SMOKE_EDITOR_EMAIL=<editor> ADMIN_SMOKE_EDITOR_PASSWORD=… \
     SMOKE_GIVEBUTTER_CAMPAIGN_ID=<a campaign in the API's Givebutter account> \
     SMOKE_GIVEBUTTER_WIDGET_ID=<that campaign's Form widget> \
       npx -y -p playwright -p axe-core node scripts/smoke-appeals.mjs

   MEDIA_ROUTE=<public media base>=<where to fetch it> serves the media
   library's public host from elsewhere — e.g. the stand-in host a local
   API gives images (https://media.rbb.test/public) from the fake R2.

   The two Givebutter ids are public identifiers; the API checks the
   campaign with Givebutter (read-only) using ITS key — the browser never
   sees one. Without them, only the refusal paths are exercised.

   LOCAL or test data only. Appeals it creates are titled "Smoke <run> …"
   and archived at the end; the donation page (one per organization) is
   left as a DRAFT. It never publishes the website. Passwords are never
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
const [mediaFrom, mediaTo] = (process.env.MEDIA_ROUTE ?? "").split("=");
async function signIn(who, viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport });
  if (mediaFrom && mediaTo) await context.route(`${mediaFrom}/**`, async (route) => route.fulfill({ response: await route.fetch({ url: route.request().url().replace(mediaFrom, mediaTo) }) }));
  const page = await context.newPage();
  page.on("console", (m) => m.type() === "error" && !/status of (401|400|403|404|409)/.test(m.text()) && consoleErrors.push(m.text()));
  // A 404 is an error unless it is the deliberate unknown-campaign lookup.
  page.on("response", (r) => r.status() === 404 && !r.url().includes("/api/v1/integrations/donations/campaigns/") && consoleErrors.push(`404 ${r.url()}`));
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

const campaignId = process.env.SMOKE_GIVEBUTTER_CAMPAIGN_ID ?? "";
const widgetId = process.env.SMOKE_GIVEBUTTER_WIDGET_ID ?? "";
const created = [];
let ownerPage = null;
const checkoutPanel = (page) => page.getByRole("region", { name: "Donation configuration" });
try {
  const { page } = await signIn(owner);
  ownerPage = page;

  // A ready image for the pickers.
  const png = readFileSync(new URL("../../api/test/fixtures/media/sample.png", import.meta.url)).toString("base64");
  const imageId = await page.evaluate(async ({ b64, name }) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const post = (u, body) => fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) }).then((r) => r.json());
    const i = (await post("/api/v1/media/upload-intents", { filename: name, mimeType: "image/png", size: bytes.length })).data;
    await fetch(i.uploadUrl, { method: "PUT", headers: i.uploadHeaders, body: bytes });
    await post(`/api/v1/media/${i.mediaId}/complete`);
    return i.mediaId;
  }, { b64: png, name: `smoke-${run}-image.png` });
  const pick = async (group) => {
    await page.getByRole("group", { name: group, exact: true }).getByRole("button", { name: "Choose image" }).click();
    await page.getByRole("dialog", { name: `Choose: ${group}` }).locator(`[data-media-id="${imageId}"]`).click();
  };

  /* ---------- Appeals: create ---------- */
  await page.locator('a[data-nav-item="appeals"]').click();
  await page.getByRole("heading", { level: 1, name: "Appeals" }).waitFor();
  check("appeals: in the sidebar and current", (await page.locator('a[data-nav-item="appeals"]').getAttribute("aria-current")) === "page");
  await page.getByRole("button", { name: "New appeal" }).first().click();
  await page.getByRole("heading", { level: 1, name: "New appeal" }).waitFor();
  for (const name of ["Basic information", "Content", "Featured media", "Donation configuration", "SEO", "Publishing"])
    check(`appeal editor: "${name}" section`, await page.getByRole("region", { name, exact: true }).isVisible());
  await axe(page, "new appeal editor");

  await field(page, "Title").fill(T("flood response"));
  check("appeal: the address follows the title", (await field(page, "Web address").inputValue()) === `smoke-${run}-flood-response`);
  await page.getByRole("button", { name: "Create appeal" }).click();
  check("appeal: invalid → refused with a summary", await visibleSoon(page.getByRole("alert").filter({ hasText: "Some fields need attention" })));
  check("appeal: the required fields say why", await visibleSoon(page.getByText("is required").first()));

  await page.getByLabel("Kind").selectOption("campaign");
  check("appeal: the public address follows the kind", (await page.getByLabel("Public address").innerText()).startsWith("/appeals/campaigns/"));
  await field(page, "Summary").fill("A smoke summary.");
  await field(page, "“Why it matters” heading").fill("Why it matters");
  await page.getByRole("textbox", { name: /^Block 1 .* text$/ }).fill("Plain start **important** and [our work](/work).");
  await field(page, "“How your support helps” heading").fill("How your support helps");
  await page.getByRole("button", { name: "Add item" }).click();
  await field(page, "Item 1").fill("Smoke item");
  await pick("Featured image");
  check("appeal: unsaved state shown", await page.getByText("Unsaved changes").isVisible());
  await page.getByRole("button", { name: "Create appeal" }).click();
  await page.waitForURL(/\/appeals\/[0-9a-f-]{36}$/, { timeout: 10_000 });
  const appealId = page.url().split("/").pop();
  created.push(appealId);
  check("appeal: created", await visibleSoon(toast(page, "Appeal created")));
  const stored = (await apiCall(page, `/api/v1/appeals/${appealId}`)).body.data.record;
  check("appeal: a draft by default", stored.status === "draft");
  check(
    "appeal: content stored as contract blocks (rich text, cards — no HTML)",
    JSON.stringify(stored.sections.map((s) => [s.type, s.data.heading])) === JSON.stringify([["richText", "Why it matters"], ["numberedCards", "How your support helps"]]) &&
      JSON.stringify(stored.sections[0].data.content[0].children[1]) === JSON.stringify({ type: "text", text: "important", marks: ["bold"] }),
    JSON.stringify(stored.sections)
  );
  await shot(page, "appeal-editor");

  /* ---------- Appeals: Givebutter ---------- */
  const panel = checkoutPanel(page);
  const box = panel.getByRole("checkbox", { name: "Take donations with a Givebutter form on this page" });
  await box.focus();
  await page.keyboard.press("Space");
  check("checkout: toggled from the keyboard", await box.isChecked());
  await panel.getByRole("textbox", { name: "Campaign ID" }).fill("1");
  await panel.getByRole("button", { name: "Check with Givebutter" }).click();
  check("checkout: an unknown campaign is reported safely", await visibleSoon(panel.getByRole("alert").filter({ hasText: /no campaign with this ID|could not be reached/ }), 15_000));
  await panel.getByRole("textbox", { name: "Form widget ID" }).fill("<bad>");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  check("checkout: a malformed widget id is refused", await visibleSoon(panel.getByText("must be a Givebutter widget id")));
  await panel.getByRole("textbox", { name: "Form widget ID" }).fill("Smoke1");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  check("checkout: a draft may hold an unverified campaign", await visibleSoon(toast(page, "Saved")));
  // M14: the owner's approval asks Givebutter; an unverifiable campaign is refused, and nothing changes.
  await page.getByRole("button", { name: "Submit for review" }).click();
  await visibleSoon(toast(page, "Submitted for review"));
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.getByRole("dialog", { name: "Approve this appeal?" }).getByRole("button", { name: "Approve", exact: true }).click();
  check("checkout: approving with an unverifiable campaign is refused", await visibleSoon(panel.getByText(/is not a campaign in the connected Givebutter account|cannot be verified/), 15_000));
  check("checkout: still waiting for review", await visibleSoon(page.getByTestId("workflow").getByText("Needs review", { exact: true })));
  await page.getByRole("button", { name: "Return to draft" }).click();
  const returnDialog = page.getByRole("dialog", { name: "Return this appeal to draft?" });
  await returnDialog.waitFor();
  await axe(page, "return to draft dialog");
  await returnDialog.getByRole("button", { name: "Return to draft" }).click();
  check("review: returned to draft", await visibleSoon(toast(page, "Returned to draft")));
  if (campaignId && widgetId) {
    await panel.getByRole("textbox", { name: "Campaign ID" }).fill(campaignId);
    await panel.getByRole("textbox", { name: "Form widget ID" }).fill(widgetId);
    await panel.getByRole("button", { name: "Check with Givebutter" }).click();
    check("checkout: the real campaign is found (via the API)", await visibleSoon(panel.getByRole("status").filter({ hasText: "Active in Givebutter" }), 15_000));
    await panel.getByLabel("Default frequency").selectOption("monthly");
    await panel.getByRole("spinbutton", { name: "Default amount" }).fill("33");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    check("checkout: an amount the campaign does not offer is refused", await visibleSoon(panel.getByText("is not one of the amounts this campaign offers"), 15_000));
    await panel.getByRole("spinbutton", { name: "Default amount" }).fill("");
    await field(page, "SEO title").fill("Smoke SEO title");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await visibleSoon(toast(page, "Saved"), 15_000);
    check("appeal: approved with a verified Givebutter campaign", await approveUi(page));
    const saved = (await apiCall(page, `/api/v1/appeals/${appealId}`)).body.data.record;
    check("checkout: stored as typed public ids only", JSON.stringify(saved.donation.checkout) === JSON.stringify({ provider: "givebutter", campaignId, widgetId, widgetType: "form", defaultFrequency: "monthly" }), JSON.stringify(saved.donation));
  } else {
    check("checkout: live campaign checks skipped (no SMOKE_GIVEBUTTER_* ids)", true);
    await box.uncheck();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await visibleSoon(toast(page, "Saved"));
  }
  await axe(page, "appeal editor with checkout");

  /* ---------- Appeals: conflicts and addresses ---------- */
  const other = await signIn(owner);
  await other.page.goto(`${base}/appeals/${appealId}`);
  await field(other.page, "Summary").waitFor();
  await field(other.page, "Summary").fill("Changed elsewhere.");
  await other.page.getByRole("button", { name: "Save", exact: true }).click();
  await visibleSoon(toast(other.page, "Saved"));
  await other.context.close();
  await field(page, "SEO description").fill("A stale edit.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  check("appeal: a stale save is refused", await visibleSoon(page.getByRole("alert").filter({ hasText: "changed elsewhere" })));
  await page.getByRole("button", { name: "Reload latest" }).click();
  check("appeal: reload shows the other change", await page.waitForFunction(() => [...document.querySelectorAll("textarea")].some((t) => t.value === "Changed elsewhere."), null, { timeout: 6000 }).then(() => true, () => false));
  if (campaignId && widgetId) {
    await field(page, "Web address").fill(`smoke-${run}-moved`);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const slugDialog = page.getByRole("dialog", { name: "Change the address?" });
    check("appeal: changing a published address asks first", await visibleSoon(slugDialog));
    check("appeal: the safe choice has focus", (await page.evaluate(() => document.activeElement?.textContent?.trim())) === "Keep the address");
    await slugDialog.getByRole("button", { name: "Change address" }).click();
    check("appeal: the old address is kept on record", await visibleSoon(page.getByText(`Earlier addresses: smoke-${run}-flood-response`), 15_000));
  }

  /* ---------- Appeals: list ---------- */
  const second = (await apiCall(page, "/api/v1/appeals", { method: "POST", body: JSON.stringify({ kind: "emergency", title: T("draft appeal"), summary: "A draft.", imageId }) })).body.data;
  created.push(second.record.id);
  await page.goto(`${base}/appeals`);
  await page.getByRole("heading", { level: 1, name: "Appeals" }).waitFor();
  for (const name of ["Title", "Status", "Slug", "Givebutter campaign", "Updated", "Published"]) check(`list: "${name}" column`, await page.getByRole("columnheader", { name, exact: true }).isVisible());
  await page.getByLabel("Search by title").fill(`Smoke ${run}`);
  await page.waitForFunction((n) => document.querySelectorAll("[data-content-id]").length === n, 2, { timeout: 6000 }).catch(() => {});
  check("list: search finds this run's appeals", (await page.locator("[data-content-id]").count()) === 2);
  const firstRow = page.locator(`[data-content-id="${appealId}"]`);
  if (campaignId) check("list: shows the Givebutter campaign", (await firstRow.innerText()).includes(campaignId));
  await page.getByLabel("Status").selectOption("draft");
  await page.waitForTimeout(700);
  check("list: status filter", (await page.locator("[data-content-id]").count()) === (campaignId ? 1 : 2));
  await page.getByLabel("Status").selectOption("");
  await page.getByLabel("Sort").selectOption("title");
  await page.waitForTimeout(700);
  check("list: sort by title", (await page.locator("[data-content-id]").first().innerText()).includes("draft appeal"));
  await shot(page, "appeals-list");
  await axe(page, "appeals list");
  await page.locator(`[data-content-id="${second.record.id}"]`).getByRole("button", { name: /^Actions for/ }).click();
  await page.getByRole("menuitem", { name: "Archive" }).click();
  check("list: archive from the row menu", await visibleSoon(toast(page, "archived")));

  /* ---------- The general donation page ---------- */
  await page.locator('a[data-nav-item="donation-page"]').click();
  await page.getByRole("heading", { level: 1, name: "General donation page" }).waitFor();
  for (const name of ["Content", "Donation configuration", "SEO", "Publishing"]) check(`donation page: "${name}" section`, await page.getByRole("region", { name, exact: true }).isVisible());
  await axe(page, "donation page editor");
  const exists = (await apiCall(page, "/api/v1/donation-page")).body.data.record !== null;
  await field(page, "Title").fill("");
  await field(page, "Introduction").fill("A smoke introduction.");
  await page.getByRole("button", { name: exists ? "Save" : "Create page", exact: true }).click();
  check("donation page: validation shown", await visibleSoon(page.getByRole("alert").filter({ hasText: "Some fields need attention" })));
  await field(page, "Title").fill(T("donation page"));
  await field(page, "Introduction").fill("A smoke introduction.");
  if (!exists) await pick("Image");
  await field(page, "“Why it matters” heading").fill("Why give");
  await page.getByRole("textbox", { name: /^Block 1 .* text$/ }).fill("A *smoke* paragraph.");
  await field(page, "SEO description").fill("A smoke description.");
  await page.getByRole("button", { name: exists ? "Save" : "Create page", exact: true }).click();
  check("donation page: saved", await visibleSoon(toast(page, exists ? "Saved" : "Donation page created")));
  const dpanel = checkoutPanel(page);
  await dpanel.getByRole("checkbox", { name: "Take donations with a Givebutter form on this page" }).check();
  await dpanel.getByRole("textbox", { name: "Campaign ID" }).fill("1");
  await dpanel.getByRole("textbox", { name: "Form widget ID" }).fill("Smoke1");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await visibleSoon(toast(page, "Saved"));
  await page.getByRole("button", { name: "Submit for review" }).click();
  await visibleSoon(toast(page, "Submitted for review"));
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.getByRole("dialog", { name: "Approve this donation page?" }).getByRole("button", { name: "Approve", exact: true }).click();
  check("donation page: an unverifiable campaign blocks approval", await visibleSoon(dpanel.getByText(/is not a campaign in the connected Givebutter account|cannot be verified/), 15_000));
  await page.getByRole("button", { name: "Return to draft" }).click();
  await page.getByRole("dialog", { name: "Return this donation page to draft?" }).getByRole("button", { name: "Return to draft" }).click();
  check("donation page: returned to draft", await visibleSoon(toast(page, "Returned to draft")));
  if (campaignId && widgetId) {
    await dpanel.getByRole("textbox", { name: "Campaign ID" }).fill(campaignId);
    await dpanel.getByRole("textbox", { name: "Form widget ID" }).fill(widgetId);
    await field(page, "SEO title").fill(T("donate"));
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await visibleSoon(toast(page, "Saved"), 15_000);
    check("donation page: approved with a verified campaign", await approveUi(page));
    // Back to a draft for the conflict check below.
    await page.getByRole("button", { name: "Return to draft" }).click();
    await page.getByRole("dialog", { name: "Return this donation page to draft?" }).getByRole("button", { name: "Return to draft" }).click();
    await visibleSoon(toast(page, "Returned to draft"));
  }
  // Stale save → reload latest.
  const other2 = await signIn(owner);
  await other2.page.goto(`${base}/donation-page`);
  await field(other2.page, "Introduction").waitFor();
  await field(other2.page, "Introduction").fill("Changed elsewhere.");
  await other2.page.getByRole("button", { name: "Save", exact: true }).click();
  await visibleSoon(toast(other2.page, "Saved"));
  await other2.context.close();
  await field(page, "SEO title").fill("Stale");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  check("donation page: a stale save is refused", await visibleSoon(page.getByRole("alert").filter({ hasText: "changed elsewhere" })));
  await page.getByRole("button", { name: "Reload latest" }).click();
  check("donation page: reload shows the other change", await page.waitForFunction(() => [...document.querySelectorAll("textarea")].some((t) => t.value === "Changed elsewhere."), null, { timeout: 6000 }).then(() => true, () => false));
  await shot(page, "donation-page-editor");
  check("donation page: owners see the Publish action", await page.getByTestId("publish-panel").getByRole("button", { name: /Publish/ }).isVisible().catch(() => false));

  /* ---------- Editor role ---------- */
  if (editor.email && editor.password) {
    const ed = await signIn(editor);
    await ed.page.goto(`${base}/appeals`);
    await ed.page.getByRole("heading", { level: 1, name: "Appeals" }).waitFor();
    check("editor: can create appeals", await ed.page.getByRole("button", { name: "New appeal" }).first().isVisible());
    check("editor: cannot publish the website", await visibleSoon(ed.page.getByText("Only an owner can publish website changes.")));
    const make = await apiCall(ed.page, "/api/v1/appeals", { method: "POST", body: JSON.stringify({ kind: "campaign", title: T("by editor"), summary: "x", imageId }) });
    check("editor: the API accepts their appeal", make.status === 201);
    if (make.status === 201) created.push(make.body.data.record.id);
    await ed.page.goto(`${base}/donation-page`);
    check("editor: can edit the donation page", await visibleSoon(ed.page.getByRole("button", { name: "Save", exact: true })));
    check("editor: the API refuses their publish (403)", (await apiCall(ed.page, "/api/v1/publish", { method: "POST" })).status === 403);
    await ed.context.close();
  }

  /* ---------- Responsive ---------- */
  const m = await signIn(owner, { width: 375, height: 812 });
  for (const path of ["/appeals", `/appeals/${appealId}`, "/appeals/new", "/donation-page"]) {
    await m.page.goto(`${base}${path}`);
    await m.page.waitForTimeout(800);
    check(`mobile ${path}: no horizontal page scroll`, await m.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  }
  await shot(m.page, "donation-page-mobile");
  await m.context.close();

  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
} catch (error) {
  check("flow completed", false, error.message.split("\n")[0]);
} finally {
  if (ownerPage) {
    let archived = 0;
    for (const id of created) if ((await apiCall(ownerPage, `/api/v1/appeals/${id}`, { method: "DELETE" }).catch(() => ({}))).status === 200) archived++;
    const dp = (await apiCall(ownerPage, "/api/v1/donation-page").catch(() => ({}))).body?.data;
    // Leave the donation page a draft (M14: withdraw or return it from review; reopen it if archived).
    const back = { submitted: "withdraw", approved: "reject" }[dp?.record?.status];
    if (back) await apiCall(ownerPage, `/api/v1/donation-page/${back}`, { method: "POST", body: JSON.stringify({ revision: dp.revision }) });
    if (dp?.record?.status === "archived") await apiCall(ownerPage, "/api/v1/donation-page", { method: "PATCH", body: JSON.stringify({ revision: dp.revision, changes: { status: "draft" } }) });
    console.log(`(cleanup: archived ${archived} appeal(s) created by this run; the donation page is a draft)`);
  }
  await browser.close();
}

for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.ok || !r.detail ? "" : `  [${r.detail}]`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
