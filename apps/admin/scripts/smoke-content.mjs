/* Browser smoke test of Posts and Events, against a running admin and API
   (with working media storage — the local fake R2 is fine):

     ADMIN_URL=http://localhost:5174 \
     ADMIN_SMOKE_EMAIL=<owner> ADMIN_SMOKE_PASSWORD=… \
     ADMIN_SMOKE_EDITOR_EMAIL=<editor> ADMIN_SMOKE_EDITOR_PASSWORD=… \
       npx -y -p playwright -p axe-core node scripts/smoke-content.mjs

   LOCAL or test data only. Everything it creates is titled "Smoke <run> …"
   and is archived at the end (the CMS never destroys content); it never
   publishes the website. Passwords are never printed. SCREENSHOTS=<dir>
   saves screenshots. Exits 1 on any failure. */
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

const created = { posts: [], events: [] };
let ownerPage = null;
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

  /* ---------- Posts ---------- */
  await page.locator('a[data-nav-item="posts"]').click();
  await page.getByRole("heading", { level: 1, name: "Posts" }).waitFor();
  check("posts: in the sidebar and current", (await page.locator('a[data-nav-item="posts"]').getAttribute("aria-current")) === "page");
  await page.getByRole("button", { name: "New post" }).first().click();
  await page.getByRole("heading", { level: 1, name: "New post" }).waitFor();
  await axe(page, "new post editor");

  // Validation from the API (missing body).
  await field(page, "Title").fill(T("news item"));
  check("post: the address follows the title", (await field(page, "Web address").inputValue()) === `smoke-${run}-news-item`);
  await page.getByRole("button", { name: "Create post" }).click();
  check("post: invalid → refused with a summary", await visibleSoon(page.getByRole("alert").filter({ hasText: "Some fields need attention" })));
  check("post: the body field says why", await visibleSoon(page.getByRole("group", { name: "Body" }).getByText("is required")));

  // Rich text: a heading, formatted paragraph, a list; toolbar by keyboard.
  await page.getByLabel("Block 1 type").selectOption("heading2");
  await page.getByRole("textbox", { name: /^Block 1 .* text$/ }).fill("A smoke heading");
  await page.getByRole("button", { name: "Add paragraph" }).click();
  const para = page.getByRole("textbox", { name: /^Block 2 .* text$/ });
  await para.fill("Plain start important");
  await para.evaluate((el) => el.setSelectionRange(12, 21));
  await page.getByRole("button", { name: "Bold (block 2)" }).focus();
  await page.keyboard.press("Enter");
  check("rich text: Bold wraps the selection", (await para.inputValue()) === "Plain start **important**", await para.inputValue());
  await para.press("End");
  await para.type(" and [our work](/work).");
  await page.getByRole("button", { name: "Add list" }).click();
  await page.getByRole("textbox", { name: /^Block 3 .* text$/ }).fill("First point\nSecond point");
  await page.getByRole("button", { name: "Move block 3 up" }).click();
  check("rich text: blocks can be reordered", (await page.getByLabel("Block 2 type").inputValue()) === "bullet");
  await page.getByRole("button", { name: "Move block 2 down" }).click();
  // The editor moves focus to the moved block on the next frame.
  await page.waitForTimeout(150);
  check("rich text: focus follows the moved block", (await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "")).startsWith("Block 3"));
  await page.getByRole("textbox", { name: /^Block 2 .* text$/ }).press("End");
  await page.getByRole("textbox", { name: /^Block 2 .* text$/ }).type(" [bad](http://insecure.rbb.test)");
  check("rich text: an unsafe link is flagged before saving", await visibleSoon(page.getByText("These link addresses aren't allowed")));
  await page.getByRole("textbox", { name: /^Block 2 .* text$/ }).fill("Plain start **important** and [our work](/work).");

  await field(page, "Excerpt").fill("A smoke excerpt.");
  await page.getByRole("group", { name: "Image", exact: true }).getByRole("button", { name: "Choose image" }).click();
  const picker = page.getByRole("dialog", { name: "Choose: Image" });
  await picker.waitFor();
  await axe(page, "media picker");
  await picker.locator(`[data-media-id="${imageId}"]`).click();
  check("post: media picker chooses an image", await visibleSoon(page.getByRole("group", { name: "Image", exact: true }).getByText(`smoke-${run}-image.png`)));
  check("post: unsaved state shown", await page.getByText("Unsaved changes").isVisible());
  await page.getByRole("button", { name: "Create post" }).click();
  await page.waitForURL(/\/posts\/[0-9a-f-]{36}$/, { timeout: 10_000 });
  const postId = page.url().split("/").pop();
  created.posts.push(postId);
  check("post: created", await visibleSoon(toast(page, "Post created")));
  const stored = (await apiCall(page, `/api/v1/posts/${postId}`)).body.data.record;
  check(
    "post: stored as contract rich text (no HTML)",
    JSON.stringify(stored.body) ===
      JSON.stringify([
        { type: "heading", level: 2, children: [{ type: "text", text: "A smoke heading" }] },
        { type: "paragraph", children: [{ type: "text", text: "Plain start " }, { type: "text", text: "important", marks: ["bold"] }, { type: "text", text: " and " }, { type: "link", href: "/work", children: [{ type: "text", text: "our work" }] }, { type: "text", text: "." }] },
        { type: "list", style: "bullet", items: [[{ type: "text", text: "First point" }], [{ type: "text", text: "Second point" }]] },
      ]),
    JSON.stringify(stored.body)
  );
  check("post: a draft by default", stored.status === "draft");
  await shot(page, "post-editor");

  // Edit + save.
  await field(page, "Author").fill("Smoke Author");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  check("post: saved", await visibleSoon(toast(page, "Saved")));

  // A revision conflict: another session saves first.
  const other = await signIn(owner);
  await other.page.goto(`${base}/posts/${postId}`);
  await field(other.page, "Excerpt").waitFor();
  await field(other.page, "Excerpt").fill("Changed elsewhere.");
  await other.page.getByRole("button", { name: "Save", exact: true }).click();
  await visibleSoon(toast(other.page, "Saved"));
  await other.context.close();
  await field(page, "Author").fill("Smoke Author Two");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  check("post: a stale save is refused", await visibleSoon(page.getByRole("alert").filter({ hasText: "changed elsewhere" })));
  await page.getByRole("button", { name: "Reload latest" }).click();
  const reloaded = await page.waitForFunction(() => document.querySelector("textarea[maxlength='400']")?.value === "Changed elsewhere.", null, { timeout: 6000 }).then(() => true, () => false);
  check("post: reload shows the other change", reloaded, await field(page, "Excerpt").inputValue());

  // M14: submit and approve it (it goes live only at the next site publish); publish the
  // website; then change the address.
  check("post: approved by the owner", await approveUi(page));
  check("post: approved, not yet published", await visibleSoon(page.getByTestId("workflow").getByText("Approved", { exact: true })));
  check("post: the website publish takes it", (await apiCall(page, "/api/v1/publish", { method: "POST" })).status === 200);
  await page.reload();
  check("post: published after the website publish", await visibleSoon(page.getByTestId("workflow").getByText("Published", { exact: true })));
  await field(page, "Web address").fill(`smoke-${run}-moved`);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const slugDialog = page.getByRole("dialog", { name: "Change the address?" });
  check("post: changing a published address asks first", await visibleSoon(slugDialog));
  check("post: the safe choice has focus", (await page.evaluate(() => document.activeElement?.textContent?.trim())) === "Keep the address");
  await slugDialog.getByRole("button", { name: "Change address" }).click();
  check("post: address changed; the old one is kept on record", await visibleSoon(page.getByText(`Earlier addresses: smoke-${run}-news-item`)));
  check("post: the edit waits for approval; the live version stays", await visibleSoon(page.getByText("Published · changes pending approval").first()));

  // A second post for search/filter, then the list.
  const blog = (await apiCall(page, "/api/v1/posts", { method: "POST", body: JSON.stringify({ type: "blog", title: T("blog piece"), body: [{ type: "paragraph", children: [{ type: "text", text: "x" }] }] }) })).body.data;
  created.posts.push(blog.record.id);
  await page.goto(`${base}/posts`);
  await page.getByRole("heading", { level: 1, name: "Posts" }).waitFor();
  await page.getByLabel("Search by title").fill(`Smoke ${run}`);
  await page.waitForFunction((n) => document.querySelectorAll("[data-content-id]").length === n, 2, { timeout: 6000 }).catch(() => {});
  check("list: search finds this run's posts", (await page.locator("[data-content-id]").count()) === 2);
  await page.getByLabel("Type").selectOption("blog");
  await page.waitForTimeout(700);
  check("list: type filter", (await page.locator("[data-content-id]").count()) === 1 && (await page.locator("[data-content-id]").first().innerText()).includes("blog piece"));
  await page.getByLabel("Type").selectOption("");
  check("list: the published item with a pending edit says so", (await page.locator("[data-content-id]").filter({ hasText: "news item" }).innerText()).includes("Published · changes pending approval"));
  await page.getByLabel("Status").selectOption("approved");
  await page.waitForTimeout(700);
  check("list: status filter (Approved: none — the edit is a draft)", (await page.locator("[data-content-id]").count()) === 0);
  await page.getByLabel("Status").selectOption("draft");
  await page.waitForTimeout(700);
  check("list: status filter (Draft: both)", (await page.locator("[data-content-id]").count()) === 2);
  check("list: Needs review is a filter", (await page.getByLabel("Status").locator('option[value="submitted"]').innerText()) === "Needs review");
  await page.getByLabel("Status").selectOption("");
  await page.getByLabel("Sort").selectOption("title");
  await page.waitForTimeout(700);
  check("list: sort by title", (await page.locator("[data-content-id]").first().innerText()).includes("blog piece"));
  await shot(page, "posts-list");
  await axe(page, "posts list");

  // Archive from the editor, with confirmation; then reopen.
  await page.goto(`${base}/posts/${blog.record.id}`);
  await field(page, "Title").waitFor();
  await page.getByRole("button", { name: "Archive" }).click();
  const archiveDialog = page.getByRole("dialog", { name: "Archive this post?" });
  await archiveDialog.waitFor();
  check("archive: concise confirmation", (await archiveDialog.innerText()).includes("Archived content will no longer appear on the public website."));
  check("archive: Cancel has focus", (await page.evaluate(() => document.activeElement?.textContent?.trim())) === "Cancel");
  await axe(page, "archive confirmation");
  await archiveDialog.getByRole("button", { name: "Archive", exact: true }).click();
  check("archive: the post says it is archived", await visibleSoon(page.getByText("This post is archived")));
  await page.getByRole("button", { name: "Reopen as draft" }).click();
  check("archive: reopened as a draft", await visibleSoon(toast(page, "Reopened as a draft")));

  /* ---------- Events ---------- */
  await page.goto(`${base}/events`);
  await page.getByRole("heading", { level: 1, name: "Events" }).waitFor();
  await page.getByRole("button", { name: "New event" }).first().click();
  await page.getByRole("heading", { level: 1, name: "New event" }).waitFor();
  await field(page, "Title").fill(T("gathering"));
  await field(page, "Summary").fill("A smoke summary.");
  await page.locator('input[type="date"]').fill("2026-11-14");
  await page.getByLabel("Starts").fill("18:30");
  await page.getByLabel("Ends").fill("17:00");
  check("event: an end before the start is flagged at once", await visibleSoon(page.getByText("The end must be after the start.")));
  await page.getByLabel("Ends").fill("21:00");
  await page.getByLabel("Venue").fill("Smoke hall");
  await page.getByRole("textbox", { name: "Address", exact: true }).fill("1 Smoke Street");
  await page.getByRole("textbox", { name: /^Block 1 .* text$/ }).fill("About the smoke event.");
  await page.getByRole("group", { name: "Image", exact: true }).getByRole("button", { name: "Choose image" }).click();
  await page.getByRole("dialog", { name: "Choose: Image" }).locator(`[data-media-id="${imageId}"]`).click();
  await page.getByRole("button", { name: "Create event" }).click();
  check("event: a missing time zone is refused by the API", await visibleSoon(page.getByText("is required").first()));
  await page.getByLabel("Time zone").selectOption("Europe/London");
  await axe(page, "new event editor");
  await page.getByRole("button", { name: "Create event" }).click();
  await page.waitForURL(/\/events\/[0-9a-f-]{36}$/, { timeout: 10_000 });
  const eventId = page.url().split("/").pop();
  created.events.push(eventId);
  const ev = (await apiCall(page, `/api/v1/events/${eventId}`)).body.data.record;
  check("event: stored as written, with its zone", ev.date === "2026-11-14" && ev.startTime === "6:30 PM" && ev.endTime === "9:00 PM" && ev.timezone === "Europe/London", JSON.stringify([ev.date, ev.startTime, ev.endTime, ev.timezone]));
  await field(page, "Registration link").fill("http://insecure.example/register");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  check("event: an insecure registration link is refused", await visibleSoon(page.getByText("must be an https:// URL")));
  await field(page, "Registration link").fill("https://tickets.rbb.test/smoke");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  check("event: saved", await visibleSoon(toast(page, "Saved")));
  await shot(page, "event-editor");
  await page.goto(`${base}/events`);
  await page.getByLabel("Search by title").fill(`Smoke ${run}`);
  await page.waitForTimeout(800);
  const row = page.locator(`[data-content-id="${eventId}"]`);
  check("events list: date, time and zone", (await row.innerText()).includes("6:30 PM (Europe/London)"));
  await row.getByRole("button", { name: /^Actions for/ }).click();
  await page.getByRole("menuitem", { name: "Archive" }).click();
  check("events list: archive from the row menu", await visibleSoon(toast(page, "archived")));
  await axe(page, "events list");

  /* ---------- Editor role ---------- */
  if (editor.email && editor.password) {
    const ed = await signIn(editor);
    await ed.page.goto(`${base}/posts`);
    await ed.page.getByRole("heading", { level: 1, name: "Posts" }).waitFor();
    check("editor: can create posts", await ed.page.getByRole("button", { name: "New post" }).first().isVisible());
    check("editor: cannot publish the website", await visibleSoon(ed.page.getByText("Only an owner can publish website changes.")));
    const make = await apiCall(ed.page, "/api/v1/posts", { method: "POST", body: JSON.stringify({ type: "news", title: T("by editor"), body: [{ type: "paragraph", children: [{ type: "text", text: "x" }] }] }) });
    check("editor: the API accepts their content", make.status === 201);
    if (make.status === 201) created.posts.push(make.body.data.record.id);
    check("editor: the API refuses their publish (403)", (await apiCall(ed.page, "/api/v1/publish", { method: "POST" })).status === 403);
    if (make.status === 201) {
      // M14: editors submit and withdraw; they never approve.
      await ed.page.goto(`${base}/posts/${make.body.data.record.id}`);
      await ed.page.getByRole("button", { name: "Submit for review" }).click();
      check("editor: submits for review", await visibleSoon(toast(ed.page, "Submitted for review")));
      check("editor: no Approve button", !(await ed.page.getByRole("button", { name: "Approve", exact: true }).isVisible()));
      check("editor: a submitted post is locked", await ed.page.getByRole("textbox", { name: "Title", exact: true }).isDisabled());
      check("editor: the API refuses their approval (403)", (await apiCall(ed.page, `/api/v1/posts/${make.body.data.record.id}/approve`, { method: "POST", body: JSON.stringify({ revision: 2 }) })).status === 403);
      await ed.page.getByRole("button", { name: "Withdraw from review" }).click();
      check("editor: withdraws it", await visibleSoon(toast(ed.page, "Withdrawn from review")));
      await axe(ed.page, "editor's post (workflow)");
    }
    await ed.context.close();
  }

  /* ---------- Responsive ---------- */
  const m = await signIn(owner, { width: 375, height: 812 });
  for (const path of ["/posts", `/posts/${postId}`, "/events/new"]) {
    await m.page.goto(`${base}${path}`);
    await m.page.waitForTimeout(700);
    check(`mobile ${path}: no horizontal page scroll`, await m.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  }
  await shot(m.page, "event-editor-mobile");
  await m.context.close();

  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
} catch (error) {
  check("flow completed", false, error.message.split("\n")[0]);
} finally {
  if (ownerPage) {
    let archived = 0;
    for (const [base, ids] of Object.entries(created))
      for (const id of ids) if ((await apiCall(ownerPage, `/api/v1/${base}/${id}`, { method: "DELETE" }).catch(() => ({}))).status === 200) archived++;
    console.log(`(cleanup: archived ${archived} record(s) created by this run)`);
  }
  await browser.close();
}

for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.ok || !r.detail ? "" : `  [${r.detail}]`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
