/* Browser smoke test of the Policies list and editor (M19), against a
   running admin and API:

     ADMIN_URL=http://localhost:5174 \
     ADMIN_SMOKE_EMAIL=<owner> ADMIN_SMOKE_PASSWORD=… \
     ADMIN_SMOKE_EDITOR_EMAIL=<editor> ADMIN_SMOKE_EDITOR_PASSWORD=… \
       npx -y -p playwright -p axe-core node scripts/smoke-policies.mjs

   LOCAL or TEST data only: it writes "Smoke <run> …" wording — never
   policy text — into the organization's Privacy Policy and Terms of Use,
   and archives both at the end. When the organization's settings exist
   it publishes the website ONCE (a test database's test organization:
   the API must have no deploy hook) to prove the published policy is in
   the snapshot and a pending edit is not. Passwords are never printed.
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
  console.error("Needs Playwright: npx -y -p playwright -p axe-core node scripts/smoke-policies.mjs");
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
const policy = async (page, id) => (await apiCall(page, `/api/v1/policies/${id}`)).body.data;
/* Back to an empty draft (a previous run archived it), through the API. */
async function fresh(page, id) {
  let v = await policy(page, id);
  if (v.record && v.record.status !== "archived") {
    await apiCall(page, `/api/v1/policies/${id}`, { method: "DELETE" });
    v = await policy(page, id);
  }
  if (v.record) await apiCall(page, `/api/v1/policies/${id}`, { method: "PATCH", body: JSON.stringify({ revision: v.revision, changes: { status: "draft", effectiveDate: null, lastUpdated: null, intro: [], sections: [], contactReference: null, seo: null } }) });
  return v.record !== null;
}
const saveButton = (page) => page.getByRole("button", { name: /^(Save|Create Privacy Policy|Create Terms of Use)$/ });
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
  const { page } = await signIn(owner);
  ownerPage = page;
  const existed = { privacy: await fresh(page, "privacy"), terms: await fresh(page, "terms") };

  /* ================= The list ================= */
  await page.locator('a[data-nav-item="policies"]').click();
  await page.getByRole("heading", { level: 1, name: "Policies" }).waitFor();
  check("policies: in the Content sidebar and current", (await page.locator('a[data-nav-item="policies"]').getAttribute("aria-current")) === "page");
  const rows = page.locator("[data-policy-id]");
  await rows.first().waitFor();
  check("list: exactly three rows, in order", JSON.stringify(await rows.evaluateAll((r) => r.map((x) => x.getAttribute("data-policy-id")))) === JSON.stringify(["privacy", "terms", "donation"]));
  check("list: each with its fixed address", (await page.getByTestId("policies-table").innerText()).includes("/privacy") && (await page.getByTestId("policies-table").innerText()).includes("/donation-policy"));
  const headers = (await page.getByRole("columnheader").allInnerTexts()).map((h) => h.trim());
  check("list: status, website, schedule and effective-date columns", ["Policy", "Status", "On the website", "Scheduled", "Effective date"].every((h) => headers.includes(h)), headers.join("|"));
  if (!existed.privacy) check("list: a policy never saved says Not started", (await rows.first().innerText()).includes("Not started"));
  await axe(page, "Policies list");
  await shot(page, "policies-list");

  /* ================= An empty policy ================= */
  await page.getByRole("button", { name: /(Start|Edit) the Privacy Policy/ }).click();
  await page.getByRole("heading", { level: 1, name: "Privacy Policy" }).waitFor();
  check("editor: an empty policy says RBB must provide the approved text", await visibleSoon(page.getByTestId("policy-empty")));
  check("editor: the address is fixed — no id or route field", (await page.getByText("Address: /privacy — fixed.").count()) === 1 && (await page.getByRole("textbox", { name: /route|address|^id$/i }).count()) === 0);
  check("editor: nothing is written for you", (await field(page, "Introduction").inputValue()) === "" && (await page.getByRole("textbox", { name: "Heading" }).count()) === 0);
  await axe(page, "Policy editor (empty)");
  await saveButton(page).click();
  check("editor: an empty draft saves", await visibleSoon(toast(page, /^(Saved|Privacy Policy created)$/)));
  check("editor: says what approval still needs", await visibleSoon(page.getByTestId("policy-gaps")));

  /* ================= Validation before saving ================= */
  await page.getByRole("button", { name: "Add a section" }).click();
  await saveButton(page).click();
  check("validation: refused with a summary", await visibleSoon(page.getByRole("alert").filter({ hasText: "Some fields need attention" })));
  check("validation: the section says why", await visibleSoon(page.getByText("A heading is required.").first()));

  /* ================= Writing it ================= */
  await page.getByLabel("Effective date").fill("2026-09-01");
  await page.getByLabel("Last updated").fill("2026-09-15");
  await field(page, "Introduction").fill(`${T("intro one")}\n\n${T("intro two")}`);
  await page.getByRole("textbox", { name: "Heading" }).nth(0).fill(T("Section One"));
  check("sections: a new section's anchor follows its heading", (await page.getByRole("textbox", { name: "Anchor" }).nth(0).inputValue()) === `smoke-${run}-section-one`);
  await page.getByRole("textbox", { name: "Paragraphs" }).nth(0).fill(`${T("para A")}\n\n${T("para B")}`);
  await page.getByRole("textbox", { name: "Bullet list" }).nth(0).fill(`${T("item 1")}\n${T("item 2")}`);
  await page.getByRole("button", { name: "Add a section" }).click();
  await page.getByRole("textbox", { name: "Heading" }).nth(1).fill(T("Section Two"));
  await page.getByRole("textbox", { name: "Paragraphs" }).nth(1).fill(T("para C"));
  const contact = page.getByLabel("Contact for questions");
  const contactOptions = await contact.locator("option").count();
  if (contactOptions > 1) await contact.selectOption({ index: 1 });
  check("contact: chosen from the settings' methods (or none there to choose)", contactOptions > 1 || (await page.getByText("There are no contact methods in Settings yet").count()) === 1);
  await page.getByRole("checkbox", { name: "Donation Policy" }).uncheck();
  await field(page, "SEO description").fill(T("description"));
  await axe(page, "Policy editor (filled)");
  await saveButton(page).click();
  check("editor: saved", await visibleSoon(toast(page, "Saved")));
  let stored = await policy(page, "privacy");
  const r = stored.record;
  check(
    "stored: dates, intro, sections with stable anchors and items, related, SEO",
    r.status === "draft" && r.effectiveDate === "2026-09-01" && r.lastUpdated === "2026-09-15" && r.intro.length === 2 && JSON.stringify(r.sections.map((s) => s.id)) === JSON.stringify([`smoke-${run}-section-one`, `smoke-${run}-section-two`]) && r.sections[0].items.length === 2 && r.sections[1].items === undefined && JSON.stringify(r.relatedPolicies) === JSON.stringify(["terms"]) && r.seo.description === T("description") && (contactOptions > 1 ? Boolean(r.contactReference) : r.contactReference === undefined),
    JSON.stringify(r)
  );
  await shot(page, "policy-editor");

  // A saved section keeps its anchor when its heading is reworded.
  await page.getByRole("textbox", { name: "Heading" }).nth(0).fill(T("Section One reworded"));
  check("sections: a saved anchor stays when the heading changes", (await page.getByRole("textbox", { name: "Anchor" }).nth(0).inputValue()) === `smoke-${run}-section-one`);
  await page.getByRole("button", { name: "Discard" }).click();

  // Reorder by keyboard: focus follows the moved section.
  const up = page.getByRole("button", { name: /^Move Section 2 .* up$/ });
  await up.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  check("sections: moved up by keyboard", (await page.getByRole("textbox", { name: "Heading" }).nth(0).inputValue()) === T("Section Two"));
  check("sections: focus follows the moved section (to the top: its Move down)", /^Move Section 1 .* down$/.test((await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))) ?? ""));
  await saveButton(page).click();
  check("sections: saved in the new order", (await visibleSoon(toast(page, "Saved"))) && (await policy(page, "privacy")).record.sections[0].id === `smoke-${run}-section-two`);

  /* ================= Conflict ================= */
  await field(page, "Title").fill(T("local title"));
  const other = await signIn(owner);
  stored = await policy(other.page, "privacy");
  await apiCall(other.page, "/api/v1/policies/privacy", { method: "PATCH", body: JSON.stringify({ revision: stored.revision, changes: { title: T("changed elsewhere") } }) });
  await other.context.close();
  await saveButton(page).click();
  check("conflict: the policy's message", await visibleSoon(page.getByRole("alert").filter({ hasText: "This policy was changed elsewhere" })));
  await page.getByRole("button", { name: "Reload latest" }).click();
  check("conflict: reload shows the other change", await page.waitForFunction((v) => document.querySelector("input[maxlength='120']")?.value === v, T("changed elsewhere"), { timeout: 6000 }).then(() => true, () => false));

  /* ================= Approval: incomplete, then complete ================= */
  const terms = await policy(page, "terms");
  await apiCall(page, "/api/v1/policies/terms", { method: "PATCH", body: JSON.stringify({ revision: terms.revision, changes: { sections: [{ id: "smoke", heading: T("terms heading"), body: [T("terms para")] }] } }) });
  await page.goto(`${base}/policies/terms`);
  await page.getByRole("heading", { level: 1, name: "Terms of Use" }).waitFor();
  check("approval: the gaps are named before submitting", (await page.getByTestId("policy-gaps").innerText()).includes("an effective date and a last-updated date"));
  await page.getByRole("button", { name: "Submit for review" }).click();
  await visibleSoon(toast(page, "Submitted for review"));
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  const approveDialog = page.getByRole("dialog", { name: /^Approve this/ });
  await approveDialog.waitFor();
  await approveDialog.getByRole("button", { name: "Approve", exact: true }).click();
  check("approval: refused without the dates", await visibleSoon(page.getByRole("alert").filter({ hasText: "Some fields need attention first." })));
  check("approval: the date fields say why", await visibleSoon(page.getByText("an effective date is required before approval")));
  await page.goto(`${base}/policies/privacy`);
  await page.getByRole("heading", { level: 1, name: "Privacy Policy" }).waitFor();
  check("owner: submits and approves the complete Privacy Policy", (await approveUi(page)) && (await policy(page, "privacy")).record.status === "approved");

  /* ================= Publishing (test organization only) ================= */
  const status = (await apiCall(page, "/api/v1/publish/status")).body?.data;
  if (status?.settingsReady) {
    const published = await apiCall(page, "/api/v1/publish", { method: "POST", body: JSON.stringify({}) });
    const snapshot = (await apiCall(page, "/api/v1/public/snapshot")).body?.data;
    check("publish: the approved policy is in the snapshot, published, nothing else", published.status === 200 && JSON.stringify(snapshot?.content?.policies?.map((p) => [p.id, p.status])) === JSON.stringify([["privacy", "published"]]), `${published.status} ${JSON.stringify(snapshot?.content?.policies?.map((p) => p.id))}`);
    await page.goto(`${base}/policies`);
    await page.locator("[data-policy-id]").first().waitFor();
    check("list: the published policy shows as on the website", (await page.locator('[data-policy-id="privacy"] [data-live]').getAttribute("data-live")) === "yes");
    const v = await policy(page, "privacy");
    await apiCall(page, "/api/v1/policies/privacy", { method: "PATCH", body: JSON.stringify({ revision: v.revision, changes: { intro: [T("pending edit")] } }) });
    const again = (await apiCall(page, "/api/v1/public/snapshot")).body?.data;
    check("publish: a pending edit leaves the live policy as it was", !JSON.stringify(again).includes(T("pending edit")) && again.content.policies[0].intro.length === 2);
  } else check("publish: skipped — the organization has no settings", true);

  /* ================= Editors ================= */
  if (editor.email && editor.password) {
    const ed = await signIn(editor);
    const p = await policy(ed.page, "privacy");
    check("editor: cannot approve (403)", (await apiCall(ed.page, "/api/v1/policies/privacy/approve", { method: "POST", body: JSON.stringify({ revision: p.revision }) })).status === 403);
    check("editor: a save never publishes (400)", (await apiCall(ed.page, "/api/v1/policies/privacy", { method: "PATCH", body: JSON.stringify({ revision: p.revision, changes: { status: "published" } }) })).status === 400);
    await ed.page.goto(`${base}/policies/privacy`);
    await ed.page.getByTestId("workflow").waitFor();
    check("editor UI: no Approve button", (await ed.page.getByRole("button", { name: "Approve", exact: true }).count()) === 0);
    await ed.context.close();
  }

  /* ================= Unknown policy, error and loading states ================= */
  await page.goto(`${base}/policies/cookies`);
  check("unknown id: there is no such policy", await visibleSoon(page.getByRole("heading", { name: "There is no such policy" })));
  await page.route("**/api/v1/policies", (route) => route.abort());
  await page.goto(`${base}/policies`);
  check("error state: the list says it could not load, with Try again", (await visibleSoon(page.getByText("The policies could not be loaded"))) && (await page.getByRole("button", { name: "Try again" }).isVisible()));
  await page.unroute("**/api/v1/policies");
  let release;
  const held = new Promise((r) => (release = r));
  await page.route("**/api/v1/policies", async (route) => {
    await held;
    await route.continue();
  });
  await page.getByRole("button", { name: "Try again" }).click();
  check("loading state: the table is busy while it loads", (await page.getByTestId("policies-table").getAttribute("aria-busy")) === "true");
  release();
  check("loading state: then the rows", await visibleSoon(page.locator('[data-policy-id="privacy"]')));
  await page.unroute("**/api/v1/policies");

  /* ================= Archive ================= */
  await page.goto(`${base}/policies/terms`);
  await page.getByRole("heading", { level: 1, name: "Terms of Use" }).waitFor();
  await page.getByRole("button", { name: "Archive" }).click();
  const dialog = page.getByRole("dialog", { name: "Archive the Terms of Use?" });
  await dialog.waitFor();
  check("dialog: focus moves into it", await page.evaluate(() => Boolean(document.activeElement?.closest('dialog, [role="dialog"]'))));
  await axe(page, "archive dialog");
  await dialog.getByRole("button", { name: "Archive", exact: true }).click();
  check("terms: archived", await visibleSoon(page.getByText("This Terms of Use is archived")));

  /* ================= Responsive ================= */
  for (const width of [375, 768, 1024, 1440]) {
    const m = await signIn(owner, { width, height: 900 });
    for (const path of ["/policies", "/policies/privacy"]) {
      await m.page.goto(`${base}${path}`);
      await m.page.getByRole("heading", { level: 1 }).waitFor();
      await m.page.waitForTimeout(400);
      check(`${width}px ${path}: no horizontal page scroll`, await m.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      if (width === 375) await axe(m.page, `${path} at 375px`);
    }
    if (width === 375) await shot(m.page, "policy-mobile");
    await m.context.close();
  }

  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
} catch (error) {
  check("flow completed", false, error.message.split("\n")[0]);
  if (ownerPage) await shot(ownerPage, "failure").catch(() => {});
} finally {
  if (ownerPage) {
    const archived = [];
    for (const id of ["privacy", "terms"]) {
      const v = (await apiCall(ownerPage, `/api/v1/policies/${id}`).catch(() => ({}))).body?.data;
      if (v?.record && v.record.status !== "archived" && (await apiCall(ownerPage, `/api/v1/policies/${id}`, { method: "DELETE" })).status === 200) archived.push(id);
    }
    console.log(`(cleanup: ${archived.length ? `archived ${archived.join(", ")}` : "the smoke's policies are archived"})`);
  }
  await browser.close();
}

for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.ok || !r.detail ? "" : `  [${r.detail}]`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
