/* Browser smoke test of the Homepage editor (M8) and the owner-only
   publishing rule for every content editor, against a running admin and
   API (with working media storage — the local fake R2 is fine):

     ADMIN_URL=http://localhost:5174 \
     ADMIN_SMOKE_EMAIL=<owner> ADMIN_SMOKE_PASSWORD=… \
     ADMIN_SMOKE_EDITOR_EMAIL=<editor> ADMIN_SMOKE_EDITOR_PASSWORD=… \
       npx -y -p playwright -p axe-core node scripts/smoke-homepage.mjs

   LOCAL or test data only: it REPLACES the organization's homepage draft,
   publishes the website once as the owner (to prove the homepage reaches
   the snapshot), and archives the homepage and every record it created at
   the end. Passwords are never printed. SCREENSHOTS=<dir> saves
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
  console.error("Needs Playwright: npx -y -p playwright -p axe-core node scripts/smoke-content.mjs");
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

const created = { posts: [], events: [], appeals: [] };
let ownerPage = null;
const tab = (page, name) => page.getByRole("tab", { name, exact: true });
const group = (page, name) => page.getByRole("group", { name });
const blockRow = (page, label) => page.getByRole("list", { name: "Homepage sections" }).locator("li").filter({ hasText: label }).first();
const addBlock = async (page, label) => {
  await page.getByRole("button", { name: "Add section" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add a section" });
  await dialog.waitFor();
  await dialog.getByRole("button", { name: new RegExp(`^${label}`) }).click();
  await dialog.waitFor({ state: "hidden" });
};
const pickImage = async (page, label, imageId) => {
  await group(page, label).getByRole("button", { name: "Choose image" }).click();
  await page.getByRole("dialog", { name: `Choose: ${label}` }).locator(`[data-media-id="${imageId}"]`).click();
};
const saveButton = (page) => page.getByRole("button", { name: /^(Save|Create homepage)$/ });

try {
  const { page } = await signIn(owner);
  ownerPage = page;
  const rich = [{ type: "paragraph", children: [{ type: "text", text: "x" }] }];

  // A ready image, and records to reference (drafts at first).
  const png = readFileSync(new URL("../../api/test/fixtures/media/sample.png", import.meta.url)).toString("base64");
  const imageId = await page.evaluate(async ({ b64, name }) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const post = (u, body) => fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) }).then((r) => r.json());
    const i = (await post("/api/v1/media/upload-intents", { filename: name, mimeType: "image/png", size: bytes.length })).data;
    await fetch(i.uploadUrl, { method: "PUT", headers: i.uploadHeaders, body: bytes });
    await post(`/api/v1/media/${i.mediaId}/complete`);
    return i.mediaId;
  }, { b64: png, name: `smoke-${run}-image.png` });
  const post = (await apiCall(page, "/api/v1/posts", { method: "POST", body: JSON.stringify({ type: "news", title: T("homepage news"), body: rich, imageId }) })).body.data.record;
  created.posts.push(post.id);

  // Start from an empty draft (the homepage is one per organization).
  const existing = (await apiCall(page, "/api/v1/homepage")).body.data;
  if (existing.record) await apiCall(page, "/api/v1/homepage", { method: "PATCH", body: JSON.stringify({ revision: existing.revision, changes: { sections: [], status: "draft", seo: null } }) });

  /* ---------- Load, empty, add ---------- */
  await page.locator('a[data-nav-item="homepage"]').click();
  await page.getByRole("heading", { level: 1, name: "Homepage" }).waitFor();
  check("homepage: in the sidebar and current", (await page.locator('a[data-nav-item="homepage"]').getAttribute("aria-current")) === "page");
  check("homepage: an empty draft says so", await visibleSoon(page.getByText("No sections yet")));
  await axe(page, "homepage editor (empty)");
  await page.getByRole("button", { name: "Add section" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add a section" });
  await dialog.waitFor();
  check("add: only the registry's blocks, by name", (await dialog.getByRole("button").filter({ hasText: /Hero slideshow|Impact figures|Featured posts|Featured events|Appeals|Questions/ }).count()) >= 6 && !(await dialog.innerText()).includes("postList"));
  await axe(page, "add-section dialog");
  await page.keyboard.press("Escape");
  await addBlock(page, "Text and photograph");
  await addBlock(page, "Hero slideshow");
  await addBlock(page, "Questions");
  await addBlock(page, "Featured posts");
  const rows = async () => page.getByRole("list", { name: "Homepage sections" }).locator(":scope > li").evaluateAll((els) => els.map((e) => e.querySelector("[data-select] span")?.firstChild?.textContent));
  check("add: the hero goes first, the rest in order", JSON.stringify(await rows()) === JSON.stringify(["Hero slideshow", "Text and photograph", "Questions", "Featured posts"]), JSON.stringify(await rows()));
  await page.getByRole("button", { name: "Add section" }).first().click();
  check("add: a single block cannot be added twice", (await page.getByRole("dialog", { name: "Add a section" }).getByRole("button", { name: /^Hero slideshow/ }).getAttribute("aria-disabled")) === "true");
  await page.keyboard.press("Escape");

  /* ---------- Validation from the API ---------- */
  await saveButton(page).click();
  check("validation: refused with a summary", await visibleSoon(page.getByRole("alert").filter({ hasText: /need[s]? attention/ })));
  check("validation: blocks are marked", (await page.getByText("Needs attention").count()) >= 3);
  check("validation: the first invalid block opens with its field errors", await visibleSoon(page.getByRole("tabpanel").getByText(/Too small|must|required|at least/i).first()));

  /* ---------- Edit each block ---------- */
  await blockRow(page, "Hero slideshow").locator("[data-select]").click();
  await field(page, "Headline line 1").fill("A smoke headline.");
  await group(page, "Slide button").getByRole("textbox", { name: "Button text" }).fill("Explore");
  await group(page, "Slide button").getByRole("textbox", { name: "Link" }).fill("/work");
  await pickImage(page, "Slide 1 photograph", imageId);
  await pickImage(page, "Slide 1 inset photograph", imageId);
  await group(page, "Second button (every slide)").getByRole("textbox", { name: "Button text" }).fill("Get involved");
  await group(page, "Second button (every slide)").getByRole("textbox", { name: "Link" }).fill("/get-involved");
  await axe(page, "hero block editor");

  await blockRow(page, "Text and photograph").locator("[data-select]").click();
  await field(page, "Heading").fill(T("who we are"));
  await field(page, "Paragraphs").fill("First smoke paragraph.\n\nSecond smoke paragraph.");
  await pickImage(page, "Photograph", imageId);

  await blockRow(page, "Questions").locator("[data-select]").click();
  await field(page, "Heading").fill("Smoke questions");
  await field(page, "Question").fill("A smoke question?");
  await field(page, "Answer").fill("A smoke answer.");

  await blockRow(page, "Featured posts").locator("[data-select]").click();
  await field(page, "Heading").fill("Smoke news");
  const picker = page.getByRole("list", { name: "Posts" });
  await picker.waitFor();
  check("references: the post picker lists real posts with their status", (await picker.innerText()).includes(post.title) && (await picker.innerText()).includes("draft"));
  await picker.getByRole("checkbox", { name: new RegExp(post.title) }).check();
  await axe(page, "reference picker");
  check("unsaved state shown", await page.getByText("Unsaved changes").isVisible());
  await saveButton(page).click();
  check("homepage: saved as a draft", await visibleSoon(toast(page, existing.record ? "Saved" : "Homepage created")));
  const saved = (await apiCall(page, "/api/v1/homepage")).body.data;
  check("stored: typed blocks in order, references by id", saved.record.status === "draft" && JSON.stringify(saved.record.sections.map((s) => s.type)) === JSON.stringify(["hero", "imageText", "faq", "postList"]) && saved.record.sections[3].data.postIds[0] === post.id);
  await shot(page, "homepage-editor");

  /* ---------- Hide, reorder by keyboard, discard ---------- */
  await blockRow(page, "Questions").getByRole("button", { name: "Hide “Questions”" }).click();
  check("hide: marked hidden, still in the list", await visibleSoon(blockRow(page, "Questions").getByText("Hidden")));
  const down = blockRow(page, "Text and photograph").getByRole("button", { name: "Move “Text and photograph” down" });
  await down.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  check("reorder: moved down by keyboard", JSON.stringify(await rows()) === JSON.stringify(["Hero slideshow", "Questions", "Text and photograph", "Featured posts"]), JSON.stringify(await rows()));
  check("reorder: focus follows the moved block", (await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))) === "Move “Text and photograph” down");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  check("reorder: again, still focused", JSON.stringify(await rows()) === JSON.stringify(["Hero slideshow", "Questions", "Featured posts", "Text and photograph"]));
  check("reorder: the hero cannot leave the top", await blockRow(page, "Hero slideshow").getByRole("button", { name: /down$/ }).isDisabled());
  await tab(page, "Preview").click();
  const preview = page.getByRole("list", { name: "Homepage draft, top to bottom" });
  check("preview: enabled blocks only, in order, marked admin-only", (await preview.locator(":scope > li").count()) === 3 && (await page.getByText("Draft preview — only here, in the admin").isVisible()) && !(await preview.innerText()).includes("Smoke questions"));
  await axe(page, "draft preview");
  await page.getByRole("button", { name: "Discard" }).click();
  check("discard: back to the saved order and visibility", JSON.stringify(await rows()) === JSON.stringify(["Hero slideshow", "Text and photograph", "Questions", "Featured posts"]) && (await blockRow(page, "Questions").getByText("Hidden").count()) === 0);

  // Keyboard on the tabs.
  await tab(page, "Edit section").focus();
  await page.keyboard.press("ArrowRight");
  check("tabs: arrow keys move between tabs", (await tab(page, "Preview").getAttribute("aria-selected")) === "true");

  /* ---------- Revision conflict ---------- */
  await blockRow(page, "Questions").getByRole("button", { name: "Hide “Questions”" }).click();
  const other = await signIn(owner);
  const fresh = (await apiCall(other.page, "/api/v1/homepage")).body.data;
  await apiCall(other.page, "/api/v1/homepage", { method: "PATCH", body: JSON.stringify({ revision: fresh.revision, changes: { seo: { title: `Changed elsewhere ${run}` } } }) });
  await other.context.close();
  await saveButton(page).click();
  check("conflict: the homepage message", await visibleSoon(page.getByRole("alert").filter({ hasText: "These homepage changes are out of date. Reload the latest version before saving." })));
  await page.getByRole("button", { name: "Reload latest" }).click();
  await tab(page, "SEO and publishing").click();
  check("conflict: reload shows the other change", (await field(page, "SEO title").inputValue()) === `Changed elsewhere ${run}`);

  /* ---------- Review (M14): references must be approved; owner only ---------- */
  check("conflict: reloading dropped the unsaved hide", (await blockRow(page, "Questions").getByText("Hidden").count()) === 0);
  await blockRow(page, "Questions").getByRole("button", { name: "Hide “Questions”" }).click();
  await saveButton(page).click();
  await visibleSoon(toast(page, "Saved"));
  await page.getByRole("button", { name: "Submit for review" }).click();
  check("review: the whole homepage is submitted", await visibleSoon(toast(page, "Submitted for review")));
  check("review: the badge says it needs review", await visibleSoon(page.getByTestId("workflow").getByText("Needs review", { exact: true })));
  check("review: a submitted homepage is locked (no Add section)", (await page.getByRole("button", { name: "Add section" }).count()) === 0);
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  const approveDialog = page.getByRole("dialog", { name: "Approve this homepage?" });
  check("review: approving asks first", await visibleSoon(approveDialog));
  await axe(page, "approve dialog");
  await approveDialog.getByRole("button", { name: "Approve", exact: true }).click();
  check("review: a draft post cannot go live through the homepage", await visibleSoon(page.getByRole("alert").filter({ hasText: /need[s]? attention|can't be approved/ })));
  check("review: the block says why", await visibleSoon(page.getByText("refers to a post that is draft, not approved")));
  await apiCall(page, `/api/v1/posts/${post.id}/submit`, { method: "POST", body: JSON.stringify({ revision: 1 }) });
  await apiCall(page, `/api/v1/posts/${post.id}/approve`, { method: "POST", body: JSON.stringify({ revision: 2 }) });
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await approveDialog.getByRole("button", { name: "Approve", exact: true }).click();
  check("review: approved once the post is", await visibleSoon(toast(page, "Approved")));
  check("review: approved is not yet live", await visibleSoon(page.getByTestId("workflow").getByText("Approved", { exact: true })));
  check("publish panel: the approved homepage is listed", await visibleSoon(page.getByTestId("publish-panel").getByRole("list", { name: /^Now — approved/ }).getByRole("listitem").filter({ hasText: "Homepage: Homepage" })));
  check("publish panel: the homepage is a change to publish", await visibleSoon(page.getByTestId("publish-panel").getByText(/Homepage/).first()));
  await page.getByTestId("publish-panel").getByRole("button", { name: "Publish changes" }).click();
  const confirm = page.getByRole("dialog").filter({ hasText: /Publish/ });
  await confirm.waitFor();
  await confirm.getByRole("button", { name: /^Publish/ }).last().click();
  check("owner publishes the website", await visibleSoon(toast(page, "Published version")));
  const live = await page.evaluate(() => fetch("/api/v1/public/snapshot").then((r) => r.json()));
  check("snapshot: the published homepage's enabled blocks only", JSON.stringify(live.data.content.homepage?.sections.map((s) => s.type)) === JSON.stringify(["hero", "imageText", "postList"]), JSON.stringify(live.data.content.homepage?.sections.map((s) => s.type)));
  await shot(page, "homepage-published");

  /* ---------- Editors: drafts yes, publishing never ---------- */
  if (editor.email && editor.password) {
    const ed = await signIn(editor);
    await ed.page.goto(`${base}/homepage`);
    await ed.page.getByRole("heading", { level: 1, name: "Homepage" }).waitFor();
    check("editor: sees the owner-only message", await visibleSoon(ed.page.getByText("Only an owner can publish website changes.").first()));
    check("editor: no Publish action", (await ed.page.getByRole("button", { name: "Publish changes" }).count()) === 0);
    const h = (await apiCall(ed.page, "/api/v1/homepage")).body.data;
    const edit = await apiCall(ed.page, "/api/v1/homepage", { method: "PATCH", body: JSON.stringify({ revision: h.revision, changes: { seo: { title: T("editor's title") } } }) });
    check("editor: may edit the published homepage — a draft; the live version stays", edit.status === 200 && edit.body.data.record.status === "draft" && edit.body.data.live === true);
    check("editor: a save never publishes (400)", (await apiCall(ed.page, "/api/v1/homepage", { method: "PATCH", body: JSON.stringify({ revision: h.revision + 1, changes: { status: "published" } }) })).status === 400);
    const sub = await apiCall(ed.page, "/api/v1/homepage/submit", { method: "POST", body: JSON.stringify({ revision: h.revision + 1 }) });
    check("editor: may submit the homepage", sub.status === 200);
    check("editor: the API refuses their approval (403)", (await apiCall(ed.page, "/api/v1/homepage/approve", { method: "POST", body: JSON.stringify({ revision: h.revision + 2 }) })).status === 403);
    await ed.page.reload();
    check("editor: sees Withdraw, never Approve", (await visibleSoon(ed.page.getByRole("button", { name: "Withdraw from review" }))) && (await ed.page.getByRole("button", { name: "Approve", exact: true }).count()) === 0);
    check("editor: the website still shows the published version", await visibleSoon(ed.page.getByText("Published · changes pending approval").first()));
    await ed.page.getByRole("button", { name: "Withdraw from review" }).click();
    check("editor: withdraws it", await visibleSoon(toast(ed.page, "Withdrawn from review")));

    // The M7 correction, through the API and the UI, for every editor.
    const mk = async (path, body) => (await apiCall(ed.page, path, { method: "POST", body: JSON.stringify(body) }));
    const p = await mk("/api/v1/posts", { type: "news", title: T("editor post"), body: rich, status: "published" });
    const e = await mk("/api/v1/events", { title: T("editor event"), summary: "S.", about: rich, date: "2026-11-14", startTime: "6:30 PM", timezone: "Europe/London", venue: "Hall", address: "1 Street", imageId, status: "published" });
    const a = await mk("/api/v1/appeals", { kind: "campaign", title: T("editor appeal"), summary: "S.", imageId, status: "published" });
    check("editor cannot create Posts as published (400: drafts only)", p.status === 400);
    check("editor cannot create Events as published (400)", e.status === 400);
    check("editor cannot create Appeals as published (400)", a.status === 400);
    const dp = (await apiCall(ed.page, "/api/v1/donation-page")).body.data;
    const dpRes = dp.record
      ? await apiCall(ed.page, "/api/v1/donation-page", { method: "PATCH", body: JSON.stringify({ revision: dp.revision, changes: { status: "published" } }) })
      : await apiCall(ed.page, "/api/v1/donation-page", { method: "PATCH", body: JSON.stringify({ revision: 0, changes: { hero: { title: T("page"), description: "D.", imageId }, donation: { designation: "where-needed-most" }, status: "published" } }) });
    check("editor cannot publish the Donation Page by saving (400)", dpRes.status === 400, `${dpRes.status}`);
    const draftPost = (await mk("/api/v1/posts", { type: "news", title: T("editor draft"), body: rich })).body.data.record;
    created.posts.push(draftPost.id);
    for (const path of [`/posts/${draftPost.id}`, "/events/new", "/appeals/new", "/donation-page"]) {
      await ed.page.goto(`${base}${path}`);
      await ed.page.getByRole("heading", { level: 2, name: "Publishing" }).waitFor({ timeout: 8000 }).catch(() => {});
      check(`editor UI ${path}: no status choice, no Approve`, (await ed.page.getByLabel("Status").count()) === 0 && (await ed.page.getByRole("button", { name: "Approve", exact: true }).count()) === 0);
    }
    check("editor UI: their draft offers Submit for review", await (async () => {
      await ed.page.goto(`${base}/posts/${draftPost.id}`);
      return visibleSoon(ed.page.getByRole("button", { name: "Submit for review" }));
    })());
    await ed.context.close();
  }

  /* ---------- Responsive ---------- */
  for (const width of [375, 768, 1024, 1440]) {
    const m = await signIn(owner, { width, height: 900 });
    await m.page.goto(`${base}/homepage`);
    await m.page.getByRole("heading", { level: 1, name: "Homepage" }).waitFor();
    await m.page.waitForTimeout(600);
    check(`${width}px: no horizontal page scroll`, await m.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    check(`${width}px: the block controls are reachable`, await m.page.getByRole("button", { name: /^Move “Text and photograph” (up|down)$/ }).first().isVisible());
    if (width === 375) {
      await shot(m.page, "homepage-mobile");
      await axe(m.page, "homepage editor at 375px");
    }
    await m.context.close();
  }

  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
} catch (error) {
  check("flow completed", false, error.message.split("\n")[0]);
} finally {
  if (ownerPage) {
    let archived = 0;
    const h = (await apiCall(ownerPage, "/api/v1/homepage").catch(() => ({}))).body?.data;
    const home = h?.record && h.record.status !== "archived" && (await apiCall(ownerPage, "/api/v1/homepage", { method: "DELETE" })).status === 200;
    for (const [base, ids] of Object.entries(created))
      for (const id of ids) if ((await apiCall(ownerPage, `/api/v1/${base}/${id}`, { method: "DELETE" }).catch(() => ({}))).status === 200) archived++;
    console.log(`(cleanup: ${home ? "archived the homepage; " : ""}archived ${archived} record(s) created by this run)`);
  }
  await browser.close();
}

for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.ok || !r.detail ? "" : `  [${r.detail}]`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
