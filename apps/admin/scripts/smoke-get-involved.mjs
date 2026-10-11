/* Browser smoke test of the Get Involved list and editors (M20), against
   a running admin and API:

     ADMIN_URL=http://localhost:5174 \
     ADMIN_SMOKE_EMAIL=<owner> ADMIN_SMOKE_PASSWORD=… \
     ADMIN_SMOKE_EDITOR_EMAIL=<editor> ADMIN_SMOKE_EDITOR_PASSWORD=… \
       npx -y -p playwright -p axe-core node scripts/smoke-get-involved.mjs

   LOCAL or TEST data only: it writes "Smoke <run> …" wording into the
   organization's Get Involved hub, Volunteer and Partner pages, and
   archives them at the end. When the organization's settings exist it
   publishes the website ONCE (a test database's test organization: the
   API must have no deploy hook) to prove the published pages are in the
   snapshot and a pending edit is not. Passwords are never printed.
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
  console.error("Needs Playwright: npx -y -p playwright -p axe-core node scripts/smoke-get-involved.mjs");
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
const page = async (p, id) => (await apiCall(p, `/api/v1/get-involved/${id}`)).body.data;
/* Back to an empty draft (a previous run archived it), through the API. */
async function fresh(p, id) {
  let v = await page(p, id);
  if (v.record && v.record.status !== "archived") {
    await apiCall(p, `/api/v1/get-involved/${id}`, { method: "DELETE" });
    v = await page(p, id);
  }
  const clear = id === "hub" ? { heading: null, intro: null, ways: null, choose: null, why: null, closing: null } : { shortDescription: null, hubNote: null, sections: [], faq: null, seo: null };
  if (v.record) await apiCall(p, `/api/v1/get-involved/${id}`, { method: "PATCH", body: JSON.stringify({ revision: v.revision, changes: { status: "draft", ...clear } }) });
  return v.record !== null;
}
const saveButton = (p) => p.getByRole("button", { name: /^(Save|Create (Get Involved|Volunteer|Partner With Us) page)$/ });
const approveUi = async (page) => {
  await page.getByRole("button", { name: "Submit for review" }).click();
  await visibleSoon(toast(page, "Submitted for review"));
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /^Approve this/ });
  await dialog.waitFor();
  await dialog.getByRole("button", { name: "Approve", exact: true }).click();
  return visibleSoon(toast(page, "Approved"));
};

let ownerPage = null;
try {
  const { page: p } = await signIn(owner);
  ownerPage = p;
  const existed = { hub: await fresh(p, "hub"), volunteer: await fresh(p, "volunteer"), partner: await fresh(p, "partner") };

  /* ================= The list ================= */
  await p.locator('a[data-nav-item="get-involved"]').click();
  await p.getByRole("heading", { level: 1, name: "Get Involved" }).waitFor();
  check("get involved: in the Content sidebar and current", (await p.locator('a[data-nav-item="get-involved"]').getAttribute("aria-current")) === "page");
  const rows = p.locator("[data-page-id]");
  await rows.first().waitFor();
  check("list: exactly five rows, in order", JSON.stringify(await rows.evaluateAll((r) => r.map((x) => x.getAttribute("data-page-id")))) === JSON.stringify(["hub", "volunteer", "fellowship", "partner", "travel"]));
  const table = await p.getByTestId("get-involved-table").innerText();
  check("list: each with its fixed address", ["/get-involved", "/get-involved/volunteer", "/get-involved/fellowship", "/get-involved/partner", "/get-involved/travel"].every((r) => table.includes(r)));
  const headers = (await p.getByRole("columnheader").allInnerTexts()).map((h) => h.trim());
  check("list: page, status, website and schedule columns", ["Page", "Status", "On the website", "Scheduled"].every((h) => headers.includes(h)), headers.join("|"));
  if (!existed.volunteer) check("list: a page never saved says Not started", (await p.locator('[data-page-id="volunteer"]').innerText()).includes("Not started"));
  await axe(p, "Get Involved list");
  await shot(p, "gi-list");

  /* ================= An empty path ================= */
  await p.getByRole("button", { name: /(Start|Edit) the Volunteer page/ }).click();
  await p.getByRole("heading", { level: 1, name: "Volunteer page" }).waitFor();
  check("path: an empty page says its words must come from RBB", await visibleSoon(p.getByTestId("gi-empty")));
  check("path: title, route, icon, images and form are fixed — no field for them", (await p.getByText("Its title, button label, address, icon, images and form are the website's — fixed.").count()) === 1 && (await p.getByRole("textbox", { name: /^(title|route|address|icon|button label)$/i }).count()) === 0);
  check("path: nothing is written for you", (await p.getByRole("textbox", { name: "Short description" }).inputValue()) === "" && (await p.getByRole("textbox", { name: "Heading" }).count()) === 0);
  await axe(p, "Path editor (empty)");
  await saveButton(p).click();
  check("path: an empty draft saves", await visibleSoon(toast(p, /^(Saved|Volunteer page created)$/)));
  check("path: says what approval still needs", await visibleSoon(p.getByTestId("gi-gaps")));

  /* ================= Validation before saving ================= */
  await p.getByRole("button", { name: "Add a section" }).click();
  await p.getByRole("textbox", { name: "Anchor" }).nth(0).fill("inquiry");
  await saveButton(p).click();
  check("validation: refused with a summary", await visibleSoon(p.getByRole("alert").filter({ hasText: "Some fields need attention" })));
  check("validation: the reserved anchor says why", await visibleSoon(p.getByText("is used by the page's form").first()));
  check("validation: the empty heading says why", await visibleSoon(p.getByText("A heading is required.").first()));
  await p.getByRole("textbox", { name: "Anchor" }).nth(0).fill("");

  /* ================= Writing it ================= */
  await p.getByRole("textbox", { name: "Short description" }).fill(T("line"));
  await p.getByRole("textbox", { name: "Line on the Get Involved page" }).fill(T("note"));
  await p.getByRole("textbox", { name: "Heading" }).nth(0).fill(T("Section One"));
  check("sections: a new section's anchor follows its heading", (await p.getByRole("textbox", { name: "Anchor" }).nth(0).inputValue()) === `smoke-${run}-section-one`);
  await p.getByRole("textbox", { name: "Paragraphs" }).nth(0).fill(`${T("para A")}\n\n${T("para B")}`);
  await p.getByRole("textbox", { name: "Bullet list" }).nth(0).fill(`${T("item 1")}\n${T("item 2")}`);
  await p.getByRole("button", { name: "Add a section" }).click();
  await p.getByRole("textbox", { name: "Heading" }).nth(1).fill(T("Section Two"));
  await p.getByRole("textbox", { name: "Paragraphs" }).nth(1).fill(T("para C"));
  await p.getByRole("checkbox", { name: "Include questions and answers" }).check();
  await field(p, "Heading").last().fill(T("Questions"));
  await field(p, "Question 1").fill(T("question one?"));
  await field(p, "Answer 1").fill(T("answer one"));
  await field(p, "SEO description").fill(T("description"));
  await axe(p, "Path editor (filled)");
  await saveButton(p).click();
  check("path: saved", await visibleSoon(toast(p, "Saved")));
  let stored = await page(p, "volunteer");
  const r = stored.record;
  check(
    "stored: line, note, sections with stable anchors and items, FAQ, SEO — and no fixed identity",
    r.status === "draft" && r.shortDescription === T("line") && r.hubNote === T("note") && JSON.stringify(r.sections.map((s) => s.id)) === JSON.stringify([`smoke-${run}-section-one`, `smoke-${run}-section-two`]) && r.sections[0].body.length === 2 && r.sections[0].items.length === 2 && r.sections[1].items === undefined && r.faq.items.length === 1 && r.seo.description === T("description") && !("title" in r) && !("to" in r) && !("icon" in r),
    JSON.stringify(r)
  );
  await shot(p, "gi-path-editor");

  await p.getByRole("textbox", { name: "Heading" }).nth(0).fill(T("Section One reworded"));
  check("sections: a saved anchor stays when the heading changes", (await p.getByRole("textbox", { name: "Anchor" }).nth(0).inputValue()) === `smoke-${run}-section-one`);
  await p.getByRole("button", { name: "Discard" }).click();
  const up = p.getByRole("button", { name: /^Move Section 2 .* up$/ });
  await up.focus();
  await p.keyboard.press("Enter");
  await p.waitForTimeout(150);
  check("sections: moved up by keyboard", (await p.getByRole("textbox", { name: "Heading" }).nth(0).inputValue()) === T("Section Two"));
  const focused = await p.evaluate(() => ({ label: document.activeElement?.getAttribute("aria-label"), visible: document.activeElement?.matches(":focus-visible") }));
  check("sections: focus stays on the moved section, visibly", /^Move Section 1 .* down$/.test(focused.label ?? "") && focused.visible, JSON.stringify(focused));
  await saveButton(p).click();
  check("sections: saved in the new order", (await visibleSoon(toast(p, "Saved"))) && (await page(p, "volunteer")).record.sections[0].id === `smoke-${run}-section-two`);

  /* ================= Conflict ================= */
  await p.getByRole("textbox", { name: "Short description" }).fill(T("local line"));
  const other = await signIn(owner);
  stored = await page(other.page, "volunteer");
  await apiCall(other.page, "/api/v1/get-involved/volunteer", { method: "PATCH", body: JSON.stringify({ revision: stored.revision, changes: { shortDescription: T("changed elsewhere") } }) });
  await other.context.close();
  await saveButton(p).click();
  check("conflict: the page's message", await visibleSoon(p.getByRole("alert").filter({ hasText: "This page was changed elsewhere" })));
  await p.getByRole("button", { name: "Reload latest" }).click();
  check("conflict: reload shows the other change", await p.waitForFunction((v) => [...document.querySelectorAll("textarea")].some((t) => t.value === v), T("changed elsewhere"), { timeout: 6000 }).then(() => true, () => false));
  check("owner: submits and approves the Volunteer page", (await approveUi(p)) && (await page(p, "volunteer")).record.status === "approved");

  /* ================= Approval refused while incomplete ================= */
  const partner = await page(p, "partner");
  await apiCall(p, "/api/v1/get-involved/partner", { method: "PATCH", body: JSON.stringify({ revision: partner.revision, changes: { sections: [{ id: "smoke", heading: T("partner heading"), body: [T("partner para")] }] } }) });
  await p.goto(`${base}/get-involved/partner`);
  await p.getByRole("heading", { level: 1, name: "Partner With Us page" }).waitFor();
  check("approval: the gap is named before submitting", (await p.getByTestId("gi-gaps").innerText()).includes("a short description"));
  await p.getByRole("button", { name: "Submit for review" }).click();
  await visibleSoon(toast(p, "Submitted for review"));
  await p.getByRole("button", { name: "Approve", exact: true }).click();
  const approveDialog = p.getByRole("dialog", { name: /^Approve this/ });
  await approveDialog.waitFor();
  await approveDialog.getByRole("button", { name: "Approve", exact: true }).click();
  check("approval: refused without the short description", await visibleSoon(p.getByText("a short description is required before approval")));

  /* ================= The hub ================= */
  await p.goto(`${base}/get-involved/hub`);
  await p.getByRole("heading", { level: 1, name: "Get Involved page" }).waitFor();
  check("hub: an empty page says its words must come from RBB", await visibleSoon(p.getByTestId("gi-empty")));
  await field(p, "Heading").first().fill(T("hub heading"));
  await field(p, "Introduction").fill(T("hub intro"));
  await p.getByRole("checkbox", { name: "Use our own closing" }).check();
  await field(p, "Heading").last().fill(T("closing"));
  const main = p.getByRole("group", { name: "Main button" });
  const target = main.getByRole("combobox", { name: "Leads to" });
  const options = await target.locator("option").evaluateAll((o) => o.map((x) => x.value));
  check("hub: a button leads to one of the six sections — nothing else, no address field", JSON.stringify(options) === JSON.stringify(["", "appeals", "work", "impact", "contact", "get-involved", "about"]) && (await main.getByRole("textbox").count()) === 1, JSON.stringify(options));
  await saveButton(p).click();
  check("hub: a button without a target is refused before saving", await visibleSoon(p.getByText("Choose where the button leads.")));
  await main.getByRole("textbox", { name: "Button text" }).fill(T("contact us"));
  await target.selectOption("contact");
  await axe(p, "Hub editor (filled)");
  await saveButton(p).click();
  check("hub: saved", await visibleSoon(toast(p, /^(Saved|Get Involved page created)$/)));
  const hubRecord = (await page(p, "hub")).record;
  check("hub: stored with a target, never an address", hubRecord.closing.primary.target === "contact" && !JSON.stringify(hubRecord).includes("/contact") && hubRecord.why === undefined, JSON.stringify(hubRecord));
  check("owner: submits and approves the hub", (await approveUi(p)) && (await page(p, "hub")).record.status === "approved");
  await shot(p, "gi-hub-editor");

  /* ================= Publishing (test organization only) ================= */
  const status = (await apiCall(p, "/api/v1/publish/status")).body?.data;
  if (status?.settingsReady) {
    const published = await apiCall(p, "/api/v1/publish", { method: "POST", body: JSON.stringify({}) });
    const snapshot = (await apiCall(p, "/api/v1/public/snapshot")).body?.data;
    check("publish: the approved pages are in the snapshot, hub first, nothing else", published.status === 200 && JSON.stringify(snapshot?.content?.getInvolved?.map((x) => [x.id, x.status])) === JSON.stringify([["hub", "published"], ["volunteer", "published"]]), `${published.status} ${JSON.stringify(snapshot?.content?.getInvolved?.map((x) => x.id))}`);
    await p.goto(`${base}/get-involved`);
    await p.locator("[data-page-id]").first().waitFor();
    check("list: the published pages show as on the website", (await p.locator('[data-page-id="volunteer"] [data-live]').getAttribute("data-live")) === "yes" && (await p.locator('[data-page-id="hub"] [data-live]').getAttribute("data-live")) === "yes");
    const v = await page(p, "volunteer");
    await apiCall(p, "/api/v1/get-involved/volunteer", { method: "PATCH", body: JSON.stringify({ revision: v.revision, changes: { hubNote: T("pending edit") } }) });
    const again = (await apiCall(p, "/api/v1/public/snapshot")).body?.data;
    check("publish: a pending edit leaves the live page as it was", !JSON.stringify(again).includes(T("pending edit")) && again.content.getInvolved[1].hubNote === T("note"));
  } else check("publish: skipped — the organization has no settings", true);

  /* ================= Editors ================= */
  if (editor.email && editor.password) {
    const ed = await signIn(editor);
    const v = await page(ed.page, "volunteer");
    check("editor: cannot approve (403)", (await apiCall(ed.page, "/api/v1/get-involved/volunteer/approve", { method: "POST", body: JSON.stringify({ revision: v.revision }) })).status === 403);
    check("editor: a save never publishes (400)", (await apiCall(ed.page, "/api/v1/get-involved/volunteer", { method: "PATCH", body: JSON.stringify({ revision: v.revision, changes: { status: "published" } }) })).status === 400);
    check("editor: cannot schedule (403)", (await apiCall(ed.page, "/api/v1/get-involved/volunteer/schedule", { method: "POST", body: JSON.stringify({ revision: v.revision, localTime: "2030-01-01T10:00", timeZone: "UTC" }) })).status === 403);
    await ed.page.goto(`${base}/get-involved/volunteer`);
    await ed.page.getByTestId("workflow").waitFor();
    check("editor UI: no Approve button", (await ed.page.getByRole("button", { name: "Approve", exact: true }).count()) === 0);
    await ed.context.close();
  }

  /* ================= Unknown page, error and loading states ================= */
  await p.goto(`${base}/get-involved/fundraise`);
  check("unknown id: there is no such page", await visibleSoon(p.getByRole("heading", { name: "There is no such Get Involved page" })));
  await p.route("**/api/v1/get-involved", (route) => route.abort());
  await p.goto(`${base}/get-involved`);
  check("error state: the list says it could not load, with Try again", (await visibleSoon(p.getByText("The Get Involved pages could not be loaded"))) && (await p.getByRole("button", { name: "Try again" }).isVisible()));
  await p.unroute("**/api/v1/get-involved");
  let release;
  const held = new Promise((r) => (release = r));
  await p.route("**/api/v1/get-involved", async (route) => {
    await held;
    await route.continue();
  });
  await p.getByRole("button", { name: "Try again" }).click();
  check("loading state: the table is busy while it loads", (await p.getByTestId("get-involved-table").getAttribute("aria-busy")) === "true");
  release();
  check("loading state: then the rows", await visibleSoon(p.locator('[data-page-id="hub"]')));
  await p.unroute("**/api/v1/get-involved");
  await p.route("**/api/v1/get-involved/travel", (route) => route.abort());
  await p.goto(`${base}/get-involved/travel`);
  check("editor error state: says it could not load, with Try again", await visibleSoon(p.getByText("The Travel With Us page could not be loaded")));
  await p.unroute("**/api/v1/get-involved/travel");

  /* ================= Archive ================= */
  await p.goto(`${base}/get-involved/partner`);
  await p.getByRole("heading", { level: 1, name: "Partner With Us page" }).waitFor();
  await p.getByRole("button", { name: "Archive" }).click();
  const dialog = p.getByRole("dialog", { name: "Archive the Partner With Us page?" });
  await dialog.waitFor();
  check("dialog: focus moves into it", await p.evaluate(() => Boolean(document.activeElement?.closest('dialog, [role="dialog"]'))));
  await axe(p, "archive dialog");
  await dialog.getByRole("button", { name: "Archive", exact: true }).click();
  check("partner: archived", await visibleSoon(p.getByText("This Partner With Us page is archived")));

  /* ================= Responsive ================= */
  for (const width of [375, 768, 1024, 1440]) {
    const m = await signIn(owner, { width, height: 900 });
    for (const path of ["/get-involved", "/get-involved/hub", "/get-involved/volunteer"]) {
      await m.page.goto(`${base}${path}`);
      await m.page.getByRole("heading", { level: 1 }).waitFor();
      await m.page.waitForTimeout(400);
      check(`${width}px ${path}: no horizontal page scroll`, await m.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      if (width === 375) await axe(m.page, `${path} at 375px`);
    }
    if (width === 375) await shot(m.page, "gi-mobile");
    await m.context.close();
  }

  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
} catch (error) {
  check("flow completed", false, error.message.split("\n")[0]);
  if (ownerPage) await shot(ownerPage, "failure").catch(() => {});
} finally {
  if (ownerPage) {
    const archived = [];
    for (const id of ["hub", "volunteer", "partner"]) {
      const v = (await apiCall(ownerPage, `/api/v1/get-involved/${id}`).catch(() => ({}))).body?.data;
      if (v?.record && v.record.status !== "archived" && (await apiCall(ownerPage, `/api/v1/get-involved/${id}`, { method: "DELETE" })).status === 200) archived.push(id);
    }
    console.log(`(cleanup: ${archived.length ? `archived ${archived.join(", ")}` : "the smoke's pages are archived"})`);
  }
  await browser.close();
}

for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.ok || !r.detail ? "" : `  [${r.detail}]`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
