/* Browser smoke test of Projects and Stories (M12) and their pickers,
   against a running admin and API (with working media storage — the local
   fake R2 is fine):

     ADMIN_URL=http://localhost:5174 \
     ADMIN_SMOKE_EMAIL=<owner> ADMIN_SMOKE_PASSWORD=… \
     ADMIN_SMOKE_EDITOR_EMAIL=<editor> ADMIN_SMOKE_EDITOR_PASSWORD=… \
       npx -y -p playwright -p axe-core node scripts/smoke-projects-stories.mjs

   LOCAL or test data only: it creates a program, projects and stories
   named "Smoke <run> …" (no real people, places or figures), marks some
   published, and archives everything it created at the end. It never
   publishes the website. Passwords are never printed. SCREENSHOTS=<dir>
   saves screenshots. Exits 1 on any failure. */
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
  console.error("Needs Playwright: npx -y -p playwright -p axe-core node scripts/smoke-projects-stories.mjs");
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
/* M48: while a step makes a request fail on purpose, the browser's own
   "Failed to load resource" line is expected, not an error. */
let simulating = false;
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
  page.on("console", (m) => m.type() === "error" && !simulating && !/status of (401|400|403|409)/.test(m.text()) && consoleErrors.push(m.text()));
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
const created = { programs: [], projects: [], stories: [] };
let ownerPage = null;
const isCurrent = async (page, id) => (await page.locator(`a[data-nav-item="${id}"]`).getAttribute("aria-current")) === "page";
const focusedOrderedId = (page) => page.evaluate(() => document.activeElement?.closest("[data-ordered-id]")?.getAttribute("data-ordered-id"));
const richBody = [{ type: "paragraph", children: [{ type: "text", text: "A smoke paragraph." }] }];

try {
  const { page } = await signIn(owner);
  ownerPage = page;
  // An image with alt text, and one without (the media library's own steps).
  const png = readFileSync(new URL("../../api/test/fixtures/media/sample.png", import.meta.url)).toString("base64");
  const upload = (name, alt) =>
    page.evaluate(async ({ b64, name, alt }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const send = (u, method, body) => fetch(u, { method, headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) }).then((r) => r.json());
      const i = (await send("/api/v1/media/upload-intents", "POST", { filename: name, mimeType: "image/png", size: bytes.length })).data;
      await fetch(i.uploadUrl, { method: "PUT", headers: i.uploadHeaders, body: bytes });
      const done = (await send(`/api/v1/media/${i.mediaId}/complete`, "POST")).data;
      if (alt) await send(`/api/v1/media/${i.mediaId}`, "PATCH", { version: done.version, alt });
      return i.mediaId;
    }, { b64: png, name, alt });
  const described = await upload(`smoke-${run}-described.png`, "A smoke test image");
  const bare = await upload(`smoke-${run}-bare.png`, "");
  const program = (await apiCall(page, "/api/v1/programs", { method: "POST", body: JSON.stringify({ title: T("program"), slug: `smoke-${run}-program`, icon: "education", description: "A smoke line." }) })).body.data;
  created.programs.push(program.record.id);
  await approveApi(page, `/api/v1/programs/${program.record.id}`);
  const programSlug = program.record.slug;

  /* ================= Projects ================= */
  await page.locator('a[data-nav-item="projects"]').click();
  await page.getByRole("heading", { level: 1, name: "Projects" }).waitFor();
  check("projects: in the sidebar and current", await isCurrent(page, "projects"));
  await axe(page, "Projects list");
  await page.getByRole("button", { name: "New project" }).first().click();
  await page.getByRole("heading", { level: 1, name: "New project" }).waitFor();
  await field(page, "Title").fill(T("first project"));
  check("project: the address follows the title", (await page.getByLabel("Public address").innerText()) === `/work/projects/smoke-${run}-first-project`);
  const programPicker = page.getByLabel("Program area");
  /* The list arrives after the form: wait for it rather than count at once. */
  check("project: the program is chosen from this organization's programs", await programPicker.locator(`option[value="${programSlug}"]`).waitFor({ state: "attached", timeout: 6000 }).then(() => true, () => false));
  await programPicker.selectOption(programSlug);
  await page.getByRole("button", { name: "Create project" }).click();
  check("project: the API names the missing description", await visibleSoon(page.getByText("is required").first()));
  await field(page, "Description").fill("A smoke description line.");
  await page.getByRole("group", { name: "Photograph", exact: true }).getByRole("button", { name: "Choose image" }).click();
  await page.getByRole("dialog", { name: "Choose: Photograph" }).locator(`[data-media-id="${bare}"]`).click();
  await page.getByRole("button", { name: "Add a focus" }).click();
  await field(page, "Focus 1").fill("A smoke focus.");
  await axe(page, "project editor (program picker, media picker)");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/, { timeout: 10_000 });
  const firstProject = page.url().split("/").pop();
  created.projects.push(firstProject);
  const stored = (await apiCall(page, `/api/v1/projects/${firstProject}`)).body.data.record;
  check("project: a draft in its program", stored.status === "draft" && stored.programId === programSlug && stored.activities[0] === "A smoke focus.");
  /* M48: once created, the address is the record's own — a title edit no
     longer rewrites it. */
  await field(page, "Title").fill(T("first project renamed"));
  check("project: after creating it, the address no longer follows the title", (await page.getByLabel("Public address").innerText()) === `/work/projects/smoke-${run}-first-project`);
  await field(page, "Title").fill(T("first project"));
  /* M48: an error on a later paragraph is shown at its field. */
  /* Ticking it replaces the box with the field, so a click, not check(). */
  await page.getByRole("checkbox", { name: "Write “The challenge”" }).click();
  await page.getByRole("textbox", { name: "The challenge" }).fill("A smoke paragraph.\n\nA second one.\n\n ");
  await page.getByRole("button", { name: /^Save$/ }).click();
  check("project: an error on paragraph 3 is shown at its field", await visibleSoon(page.getByText("Paragraph 3: must not be empty")));
  await page.getByRole("textbox", { name: "The challenge" }).fill("");
  await page.getByRole("button", { name: "Submit for review" }).click();
  check("project: submitting an undescribed photograph is refused", await visibleSoon(page.getByText("no alt text").first()));
  await page.getByRole("group", { name: "Photograph", exact: true }).getByRole("button", { name: "Change" }).click();
  await page.getByRole("dialog", { name: "Choose: Photograph" }).locator(`[data-media-id="${described}"]`).click();
  await page.getByRole("button", { name: /^Save$/ }).click();
  await visibleSoon(toast(page, "Saved"));
  check("owner: submits and approves the project", await approveUi(page));
  for (const name of ["second", "third"]) {
    const r = (await apiCall(page, "/api/v1/projects", { method: "POST", body: JSON.stringify({ title: T(`${name} project`), programId: programSlug, description: "A smoke line." }) })).body.data;
    created.projects.push(r.record.id);
  }
  await page.goto(`${base}/projects`);
  const list = page.getByRole("list", { name: "Projects, in order" });
  await list.waitFor();
  const order = async () => list.locator(":scope > li").evaluateAll((els) => els.map((e) => e.getAttribute("data-ordered-id")));
  const up = list.locator(`[data-ordered-id="${created.projects[2]}"]`).getByRole("button", { name: /up$/ });
  await up.focus();
  await page.keyboard.press("Enter");
  check("projects: moved up by keyboard and saved", await visibleSoon(toast(page, "moved up")));
  await page.waitForTimeout(200);
  check("projects: the new order", JSON.stringify(await order()) === JSON.stringify([created.projects[0], created.projects[2], created.projects[1]]), JSON.stringify(await order()));
  check("projects: focus follows the moved project", (await focusedOrderedId(page)) === created.projects[2]);
  const second = (await apiCall(page, `/api/v1/projects/${created.projects[1]}`)).body.data;
  await apiCall(page, `/api/v1/projects/${created.projects[1]}`, { method: "PATCH", body: JSON.stringify({ revision: second.revision, changes: { title: T("edited elsewhere") } }) });
  await list.locator(`[data-ordered-id="${created.projects[2]}"]`).getByRole("button", { name: /down$/ }).click();
  check("projects: a stale order is refused", await visibleSoon(page.getByRole("alert").filter({ hasText: "changed elsewhere" })));
  await page.getByRole("button", { name: "Reload latest" }).click();
  check("projects: reload shows the other change", await visibleSoon(list.getByText(T("edited elsewhere"))));
  await shot(page, "projects-list");

  /* ================= Stories ================= */
  const other = (await apiCall(page, "/api/v1/stories", { method: "POST", body: JSON.stringify({ title: T("other story"), category: "impact", body: richBody }) })).body.data;
  created.stories.push(other.record.id);
  await approveApi(page, `/api/v1/stories/${other.record.id}`);
  await page.locator('a[data-nav-item="stories"]').click();
  await page.getByRole("heading", { level: 1, name: "Stories" }).waitFor();
  check("stories: in the sidebar and current", await isCurrent(page, "stories"));
  await axe(page, "Stories list");
  await page.getByRole("button", { name: "New story" }).first().click();
  await page.getByRole("heading", { level: 1, name: "New story" }).waitFor();
  await field(page, "Title").fill(T("first story"));
  check("story: the address follows the title", (await page.getByLabel("Public address").innerText()) === `/stories/smoke-${run}-first-story`);
  await page.getByRole("button", { name: "Create story" }).click();
  check("story: the body is required", await visibleSoon(page.getByRole("group", { name: "Story" }).getByText("is required")));
  await page.getByLabel("Type of story").selectOption("community");
  await page.getByRole("textbox", { name: /^Block 1 .* text$/ }).fill("A smoke story paragraph with **emphasis**.");
  await field(page, "Excerpt").fill("A smoke excerpt.");
  await page.getByRole("group", { name: "Image", exact: true }).getByRole("button", { name: "Choose image" }).click();
  await page.getByRole("dialog", { name: "Choose: Image" }).locator(`[data-media-id="${described}"]`).click();
  await page.getByRole("button", { name: "Add a gallery image" }).click();
  await page.getByRole("group", { name: "Gallery image 1", exact: true }).getByRole("button", { name: "Choose image" }).click();
  await page.getByRole("dialog", { name: "Choose: Gallery image 1" }).locator(`[data-media-id="${described}"]`).click();
  check("story: the program picker lists this organization's programs", (await page.getByLabel("Program area").locator(`option[value="${programSlug}"]`).count()) === 1);
  await page.getByLabel("Program area").selectOption(programSlug);
  const projectPicker = page.getByLabel("Project", { exact: true });
  check("story: the project picker lists this organization's projects", (await projectPicker.locator(`option[value="smoke-${run}-first-project"]`).count()) === 1);
  await projectPicker.selectOption(`smoke-${run}-first-project`);
  await group(page, "Related stories").getByRole("checkbox", { name: new RegExp(T("other story")) }).check();
  await axe(page, "story editor (rich text, pickers, media)");
  await page.getByRole("button", { name: "Create story" }).click();
  await page.waitForURL(/\/stories\/[0-9a-f-]{36}$/, { timeout: 10_000 });
  const firstStory = page.url().split("/").pop();
  created.stories.push(firstStory);
  await field(page, "Title").fill(T("first story renamed"));
  check("story: after creating it, the address no longer follows the title", (await page.getByLabel("Public address").innerText()) === `/stories/smoke-${run}-first-story`);
  await field(page, "Title").fill(T("first story"));
  const s = (await apiCall(page, `/api/v1/stories/${firstStory}`)).body.data.record;
  check("stored: a story post, its relationships by key and id, rich text", s.type === "story" && s.category === "community" && s.programId === programSlug && s.projectId === `smoke-${run}-first-project` && s.relatedPostIds[0] === other.record.id && s.galleryIds[0] === described && JSON.stringify(s.body).includes('"bold"'), JSON.stringify(s));
  // Conflict, then publish.
  await field(page, "Excerpt").fill("A local edit.");
  const other2 = await signIn(owner);
  const fresh = (await apiCall(other2.page, `/api/v1/stories/${firstStory}`)).body.data;
  await apiCall(other2.page, `/api/v1/stories/${firstStory}`, { method: "PATCH", body: JSON.stringify({ revision: fresh.revision, changes: { title: T("renamed elsewhere") } }) });
  await other2.context.close();
  await page.getByRole("button", { name: /^Save$/ }).click();
  check("conflict: the editor says so", await visibleSoon(page.getByRole("alert").filter({ hasText: "changed elsewhere" })));
  await page.getByRole("button", { name: "Reload latest" }).click();
  check("conflict: reload shows the other change", await page.waitForFunction((v) => document.querySelector("input[maxlength='160']")?.value === v, T("renamed elsewhere"), { timeout: 6000 }).then(() => true, () => false));
  check("owner: submits and approves the story", (await approveUi(page)) && (await apiCall(page, `/api/v1/stories/${firstStory}`)).body.data.record.status === "approved");
  await shot(page, "story-editor");
  await page.goto(`${base}/posts`);
  await page.getByRole("heading", { level: 1, name: "Posts" }).waitFor();
  await page.waitForTimeout(500);
  check("posts: stories are not listed among news and blog posts", (await page.locator("[data-content-id]").filter({ hasText: T("renamed elsewhere") }).count()) === 0);

  /* ================= M48: loads, pickers, errors, list archive ================= */
  // A late reply to an earlier load (React's development double load) never overwrites what was typed since.
  const recordUrl = new RegExp(`/api/v1/stories/${firstStory}$`);
  let loads = 0;
  await page.route(recordUrl, async (route) => {
    if (route.request().method() !== "GET" || ++loads > 1) return route.continue();
    const response = await route.fetch();
    await new Promise((r) => setTimeout(r, 2500));
    await route.fulfill({ response });
  });
  await page.goto(`${base}/stories/${firstStory}`);
  const typed = "Typed while an earlier load was on its way.";
  await field(page, "Excerpt").fill(typed);
  await page.waitForTimeout(3000);
  check("stale load: a late reply never overwrites what was typed", loads >= 2 && (await field(page, "Excerpt").inputValue()) === typed, `loads: ${loads}`);
  await page.unroute(recordUrl);
  await page.getByRole("button", { name: "Discard" }).click();

  // An editor that could not be loaded offers to try again.
  simulating = true;
  await page.route(recordUrl, (route) => (route.request().method() === "GET" ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "UNAVAILABLE", message: "Smoke: unavailable." } }) }) : route.continue()));
  await page.goto(`${base}/stories/${firstStory}`);
  check("editor: a failed load says so", await visibleSoon(page.getByRole("heading", { name: "The story could not be loaded" })));
  await page.unroute(recordUrl);
  await page.getByRole("button", { name: "Try again" }).click();
  check("editor: Try again loads the story", await visibleSoon(page.getByTestId("workflow")));

  // A picker whose list could not be loaded says so — never the empty-CMS box — and tries again.
  const lists = /\/api\/v1\/(programs|stories)\?/;
  await page.route(lists, (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "UNAVAILABLE", message: "Smoke: unavailable." } }) }));
  await page.goto(`${base}/stories/${firstStory}`);
  const programsFailed = page.getByRole("alert").filter({ hasText: "programs could not be loaded" });
  const storiesFailed = page.getByRole("alert").filter({ hasText: "stories could not be loaded" });
  check("pickers: a failed list says so", (await visibleSoon(programsFailed)) && (await visibleSoon(storiesFailed)));
  check("pickers: a failed list is not offered as 'nothing managed here yet'", (await page.getByText("are managed here yet").count()) === 0);
  await page.unroute(lists);
  simulating = false;
  await programsFailed.getByRole("button", { name: "Try again" }).click();
  await storiesFailed.getByRole("button", { name: "Try again" }).click();
  check("pickers: Try again loads the list and keeps the chosen program", (await visibleSoon(page.getByLabel("Program area"))) && (await page.getByLabel("Program area").inputValue()) === programSlug);
  check("pickers: Try again loads the related stories, the chosen one still checked", await group(page, "Related stories").getByRole("checkbox", { name: new RegExp(T("other story")) }).isChecked().catch(() => false));

  // A related story the API refuses is named at its own checkbox.
  const pending = (await apiCall(page, "/api/v1/stories", { method: "POST", body: JSON.stringify({ title: T("pending story"), category: "field", body: richBody }) })).body.data;
  created.stories.push(pending.record.id);
  const naming = (await apiCall(page, "/api/v1/stories", { method: "POST", body: JSON.stringify({ title: T("naming story"), category: "field", body: richBody, relatedPostIds: [pending.record.id] }) })).body.data;
  created.stories.push(naming.record.id);
  await apiCall(page, `/api/v1/stories/${naming.record.id}/submit`, { method: "POST", body: JSON.stringify({ revision: naming.revision }) });
  await page.goto(`${base}/stories/${naming.record.id}`);
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  const approveDialog = page.getByRole("dialog", { name: /^Approve this/ });
  await approveDialog.waitFor();
  await approveDialog.getByRole("button", { name: "Approve", exact: true }).click();
  const pendingBox = group(page, "Related stories").getByRole("checkbox", { name: new RegExp(T("pending story")) });
  /* The API's words for it — not the picker's own "Chosen but not approved yet" note. */
  check("related stories: the refused story's error is at its checkbox", (await visibleSoon(group(page, "Related stories").getByText("approve it first"))) && (await pendingBox.getAttribute("aria-invalid")) === "true");
  check("related stories: its checkbox is described by the error", await pendingBox.evaluate((el) => document.getElementById(el.getAttribute("aria-describedby") ?? "")?.textContent?.includes("approve it first") ?? false));

  // Archiving from the Stories list is confirmed, and a refusal says why.
  await page.goto(`${base}/stories`);
  await page.getByLabel("Search by title").fill(T("pending story"));
  const pendingRow = page.locator(`[data-content-id="${pending.record.id}"]`);
  await pendingRow.waitFor();
  const archiveFromRow = async () => {
    await pendingRow.getByRole("button", { name: /^Actions for/ }).click();
    await page.getByRole("menuitem", { name: "Archive" }).click();
    const dialog = page.getByRole("dialog", { name: "Archive this story?" });
    return (await visibleSoon(dialog)) && dialog;
  };
  let dialog = await archiveFromRow();
  check("stories list: Archive asks first", Boolean(dialog));
  if (dialog) await dialog.getByRole("button", { name: "Cancel" }).click();
  check("stories list: Cancel archives nothing", (await apiCall(page, `/api/v1/stories/${pending.record.id}`)).body.data.record.status === "draft");
  const archiveUrl = new RegExp(`/api/v1/stories/${pending.record.id}$`);
  await page.route(archiveUrl, (route) => (route.request().method() === "DELETE" ? route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: { code: "FORBIDDEN", message: "Smoke: archiving is not allowed here." } }) }) : route.continue()));
  dialog = await archiveFromRow();
  if (dialog) await dialog.getByRole("button", { name: "Archive", exact: true }).click();
  check("stories list: a refused archive says why", await visibleSoon(toast(page, "Smoke: archiving is not allowed here.")));
  await page.unroute(archiveUrl);
  dialog = await archiveFromRow();
  if (dialog) await dialog.getByRole("button", { name: "Archive", exact: true }).click();
  check("stories list: confirmed, it is archived", (await visibleSoon(toast(page, `“${T("pending story")}” archived`))) && (await apiCall(page, `/api/v1/stories/${pending.record.id}`)).body.data.record.status === "archived");

  /* ================= Impact: the same stories and programs ================= */
  const imp = (await apiCall(page, "/api/v1/impact")).body.data;
  const impWasArchived = imp.record?.status === "archived";
  if (impWasArchived) await apiCall(page, "/api/v1/impact", { method: "PATCH", body: JSON.stringify({ revision: imp.revision, changes: { status: "draft" } }) });
  await page.goto(`${base}/impact`);
  await page.getByRole("heading", { level: 1, name: "Impact page" }).waitFor();
  const impactRow = (label) => page.getByRole("list", { name: "Impact page sections" }).locator("li").filter({ hasText: label }).first();
  const hasStories = await impactRow("Stories of change").isVisible().catch(() => false);
  if (hasStories) await impactRow("Stories of change").locator("[data-select]").click();
  else {
    await page.getByRole("button", { name: "Add section" }).first().click();
    await page.getByRole("dialog", { name: "Add a section" }).getByRole("button", { name: /^Stories of change/ }).click();
  }
  check("impact: its stories are chosen from Stories", await visibleSoon(group(page, "Stories").getByRole("checkbox", { name: new RegExp(T("renamed elsewhere")) })));
  await axe(page, "Impact stories picker");
  if (!hasStories) await page.getByRole("button", { name: "Discard" }).click();
  if (impWasArchived) await apiCall(page, "/api/v1/impact", { method: "DELETE" });

  /* ================= Editors ================= */
  if (editor.email && editor.password) {
    const ed = await signIn(editor);
    const st = await apiCall(ed.page, "/api/v1/stories", { method: "POST", body: JSON.stringify({ title: T("editor story"), category: "field", body: richBody }) });
    check("editor: can add a story (draft)", st.status === 201 && st.body.data.record.status === "draft");
    if (st.status === 201) created.stories.push(st.body.data.record.id);
    check("editor: a save never publishes a story (400)", (await apiCall(ed.page, `/api/v1/stories/${st.body.data.record.id}`, { method: "PATCH", body: JSON.stringify({ revision: st.body.data.revision, changes: { status: "published" } }) })).status === 400);
    check("editor: cannot approve a story (403)", (await apiCall(ed.page, `/api/v1/stories/${st.body.data.record.id}/approve`, { method: "POST", body: JSON.stringify({ revision: st.body.data.revision }) })).status === 403);
    const pr = await apiCall(ed.page, "/api/v1/projects", { method: "POST", body: JSON.stringify({ title: T("editor project"), programId: programSlug, description: "D.", status: "published" }) });
    check("editor: cannot create a published project (400: drafts only)", pr.status === 400);
    check("editor: can reorder projects", (await apiCall(ed.page, "/api/v1/projects/order", { method: "POST", body: JSON.stringify({ items: (await apiCall(ed.page, "/api/v1/projects?pageSize=100")).body.data.filter((v) => v.record.status !== "archived").sort((a, b) => a.record.order - b.record.order).map((v) => ({ id: v.record.id, revision: v.revision })) }) })).status === 200);
    for (const path of [`/projects/${created.projects[1]}`, `/stories/${st.body.data.record.id}`]) {
      await ed.page.goto(`${base}${path}`);
      await ed.page.getByTestId("workflow").waitFor();
      check(`editor UI ${path.replace(/[0-9a-f-]{36}/, ":id")}: Submit for review, no status choice, no Approve`, (await ed.page.getByRole("button", { name: "Submit for review" }).isVisible()) && (await ed.page.getByLabel("Status").count()) === 0 && (await ed.page.getByRole("button", { name: "Approve", exact: true }).count()) === 0);
    }
    await ed.context.close();
  }

  // Archive from the editors.
  for (const [path, kind] of [[`/projects/${created.projects[1]}`, "project"], [`/stories/${created.stories[0]}`, "story"]]) {
    await page.goto(`${base}${path}`);
    await page.getByRole("button", { name: "Archive" }).click();
    const dialog = page.getByRole("dialog", { name: `Archive this ${kind}?` });
    await dialog.waitFor();
    await dialog.getByRole("button", { name: "Archive", exact: true }).click();
    check(`${kind}: archived`, await visibleSoon(page.getByText(`This ${kind} is archived`)));
  }

  /* ================= Responsive ================= */
  for (const width of [375, 768, 1024, 1440]) {
    const m = await signIn(owner, { width, height: 900 });
    for (const path of ["/projects", `/projects/${firstProject}`, "/stories", `/stories/${firstStory}`, "/stories/new"]) {
      await m.page.goto(`${base}${path}`);
      await m.page.waitForTimeout(700);
      check(`${width}px ${path.replace(/[0-9a-f-]{36}/, ":id")}: no horizontal page scroll`, await m.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    }
    if (width === 375) {
      await m.page.goto(`${base}/projects`);
      await m.page.getByRole("heading", { level: 1, name: "Projects" }).waitFor();
      check("375px: project reorder controls reachable", await m.page.getByRole("button", { name: /^Move “.*” down$/ }).first().isVisible());
      await axe(m.page, "Projects list at 375px");
      await m.page.goto(`${base}/stories/${firstStory}`);
      await m.page.getByTestId("workflow").waitFor();
      await axe(m.page, "story editor at 375px");
      await m.page.goto(`${base}/projects/${firstProject}`);
      await m.page.getByTestId("workflow").waitFor();
      await axe(m.page, "project editor at 375px");
      await shot(m.page, "project-mobile");
    }
    await m.context.close();
  }

  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
} catch (error) {
  check("flow completed", false, error.message.split("\n")[0]);
  if (ownerPage) await shot(ownerPage, "failure").catch(() => {});
} finally {
  if (ownerPage) {
    let archived = 0;
    for (const id of created.stories) if ((await apiCall(ownerPage, `/api/v1/stories/${id}`, { method: "DELETE" }).catch(() => ({}))).status === 200) archived++;
    for (const id of created.projects) if ((await apiCall(ownerPage, `/api/v1/projects/${id}`, { method: "DELETE" }).catch(() => ({}))).status === 200) archived++;
    for (const id of created.programs) if ((await apiCall(ownerPage, `/api/v1/programs/${id}`, { method: "DELETE" }).catch(() => ({}))).status === 200) archived++;
    console.log(`(cleanup: archived ${archived} record(s) created by this run)`);
  }
  await browser.close();
}

for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.ok || !r.detail ? "" : `  [${r.detail}]`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
