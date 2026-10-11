/* Browser smoke test of the editorial workflow (M14), against a running
   admin and API — the editor's and the owner's flows end to end on a
   story, and the public snapshot at every step:

     ADMIN_URL=http://localhost:5174 \
     ADMIN_SMOKE_EMAIL=<owner> ADMIN_SMOKE_PASSWORD=… \
     ADMIN_SMOKE_EDITOR_EMAIL=<editor> ADMIN_SMOKE_EDITOR_PASSWORD=… \
       npx -y -p playwright -p axe-core node scripts/smoke-workflow.mjs

   LOCAL or test data only: it creates a "Smoke <run> …" story and
   PUBLISHES THE WEBSITE (twice) — never run it against a real
   organization. It archives the story and publishes again at the end, so
   the snapshot no longer carries it. Passwords are never printed.
   SCREENSHOTS=<dir> saves screenshots. Exits 1 on any failure. */
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
  console.error("Needs Playwright: npx -y -p playwright -p axe-core node scripts/smoke-workflow.mjs");
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

let ownerPage = null;
let storyId = null;
const body = [{ type: "paragraph", children: [{ type: "text", text: "A smoke paragraph." }] }];
/* What the website build would read. */
const publicStory = async (page) => {
  const r = await page.evaluate(() => fetch("/api/v1/public/snapshot").then((x) => (x.ok ? x.json() : null)));
  return r?.data?.content?.stories?.find((s) => s.title.startsWith(`Smoke ${run}`)) ?? null;
};
const publish = async (page) => {
  const panel = page.getByTestId("publish-panel");
  await panel.getByRole("button", { name: "Publish changes" }).click();
  const dialog = page.getByRole("dialog", { name: "Publish changes?" });
  await dialog.waitFor();
  return { dialog, confirm: () => dialog.getByRole("button", { name: "Publish", exact: true }).click() };
};

try {
  if (!editor.email || !editor.password) throw new Error("Set ADMIN_SMOKE_EDITOR_EMAIL and ADMIN_SMOKE_EDITOR_PASSWORD (an EDITOR).");
  const { page } = await signIn(owner);
  ownerPage = page;

  /* ---------- 1. Published content ---------- */
  const created = (await apiCall(page, "/api/v1/stories", { method: "POST", body: JSON.stringify({ title: T("original story"), category: "field", body }) })).body.data;
  storyId = created.record.id;
  const at = `/api/v1/stories/${storyId}`;
  const sub = (await apiCall(page, `${at}/submit`, { method: "POST", body: JSON.stringify({ revision: created.revision }) })).body.data;
  await apiCall(page, `${at}/approve`, { method: "POST", body: JSON.stringify({ revision: sub.revision }) });
  check("setup: the website publish takes the approved story", (await apiCall(page, "/api/v1/publish", { method: "POST" })).status === 200);
  check("1. published: the public snapshot carries it", (await publicStory(page))?.title === T("original story"));

  /* ---------- 2–5. The editor edits and submits; the public is unchanged ---------- */
  const ed = await signIn(editor);
  await ed.page.goto(`${base}/stories/${storyId}`);
  await ed.page.getByTestId("workflow").waitFor();
  check("editor: the story reads Published", await visibleSoon(ed.page.getByTestId("workflow").getByText("Published", { exact: true })));
  await field(ed.page, "Title").fill(T("edited story"));
  check("editor: the published version itself offers no review action", (await ed.page.getByTestId("workflow").getByRole("button").count()) === 0);
  await ed.page.getByRole("button", { name: "Save", exact: true }).click();
  await visibleSoon(toast(ed.page, "Saved"));
  check("2. editor's edit: Published · changes pending approval", await visibleSoon(ed.page.getByTestId("workflow").getByText("Published · changes pending approval")));
  check("2. the explanation says the website keeps the published version", await visibleSoon(ed.page.getByTestId("workflow-explain").filter({ hasText: "website shows the last published version" })));
  check("3. public unchanged after the edit", (await publicStory(ed.page))?.title === T("original story"));
  await axe(ed.page, "editor: a published story with a pending edit");
  await ed.page.getByRole("button", { name: "Submit for review" }).click();
  check("4. editor submits it", await visibleSoon(toast(ed.page, "Submitted for review")));
  check("4. editor never sees Approve", (await ed.page.getByRole("button", { name: "Approve", exact: true }).count()) === 0);
  check("4. under review, the form is locked", await field(ed.page, "Title").isDisabled());
  check("5. public unchanged after submission", (await publicStory(ed.page))?.title === T("original story"));
  await shot(ed.page, "workflow-editor-submitted");

  /* ---------- 6–8. The owner reviews and rejects ---------- */
  await page.goto(`${base}/stories`);
  await page.getByRole("heading", { level: 1, name: "Stories" }).waitFor();
  await page.getByLabel("Status").selectOption("submitted");
  const row = page.locator(`[data-content-id="${storyId}"]`);
  check("6. owner: Needs review filter finds it", await visibleSoon(row));
  check("6. owner: the list shows the live version with changes pending", (await row.innerText()).includes("Published · changes pending approval"));
  check("6. publish panel: it waits for review", await visibleSoon(page.getByTestId("publish-panel").getByRole("list", { name: /^Waiting for review/ }).getByText(T("edited story"))));
  await page.goto(`${base}/stories/${storyId}`);
  await page.getByTestId("workflow").waitFor();
  check("6. owner: Approve and Return to draft are offered", (await page.getByRole("button", { name: "Approve", exact: true }).isVisible()) && (await page.getByRole("button", { name: "Return to draft" }).isVisible()));
  await page.getByRole("button", { name: "Return to draft" }).click();
  const reject = page.getByRole("dialog", { name: "Return this story to draft?" });
  check("7. returning to draft asks first", await visibleSoon(reject));
  check("7. the dialog says the website keeps the published version", (await reject.innerText()).includes("keeps showing the last published version"));
  check("7. Cancel has focus", (await page.evaluate(() => document.activeElement?.textContent?.trim())) === "Cancel");
  await axe(page, "return to draft dialog");
  await reject.getByRole("button", { name: "Return to draft" }).click();
  check("7. owner rejects it", await visibleSoon(toast(page, "Returned to draft")));
  check("8. public unchanged after rejection", (await publicStory(page))?.title === T("original story"));

  /* ---------- 9–11. Resubmitted; approved; still not public ---------- */
  await ed.page.reload();
  await field(ed.page, "Title").fill(T("revised story"));
  check("9. unsaved edits hold the review back", (await ed.page.getByRole("button", { name: "Submit for review" }).isDisabled()) && (await ed.page.getByText("Save your changes first").isVisible()));
  await ed.page.getByRole("button", { name: "Save", exact: true }).click();
  await visibleSoon(toast(ed.page, "Saved"));
  await ed.page.getByRole("button", { name: "Submit for review" }).click();
  check("9. editor resubmits", await visibleSoon(toast(ed.page, "Submitted for review")));
  // A stale tab: the owner's second window still shows the rejected draft.
  const stale = await signIn(owner);
  await page.reload();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  const approve = page.getByRole("dialog", { name: "Approve this story?" });
  check("10. approving asks first", await visibleSoon(approve));
  await axe(page, "approve dialog");
  await approve.getByRole("button", { name: "Approve", exact: true }).click();
  check("10. owner approves it", await visibleSoon(toast(page, "Approved")));
  check("10. Published · changes approved", await visibleSoon(page.getByTestId("workflow").getByText("Published · changes approved")));
  check("11. approved is not public until the website publish", (await publicStory(page))?.title === T("original story"));

  /* ---------- 15. Stale attempts are refused ---------- */
  await stale.page.goto(`${base}/stories/${storyId}`);
  await stale.page.getByTestId("workflow").waitFor();
  const r = (await apiCall(stale.page, `${at}/approve`, { method: "POST", body: JSON.stringify({ revision: (await apiCall(stale.page, at)).body.data.revision - 1 }) })).status;
  check("15. a stale approval is a 409", r === 409);
  check("15. a stale edit is a 409", (await apiCall(stale.page, at, { method: "PATCH", body: JSON.stringify({ revision: 1, changes: { title: T("stale") } }) })).status === 409);
  const reviewed = (await apiCall(stale.page, "/api/v1/publish/status")).body.data;
  await stale.context.close();

  /* ---------- 12–14. The owner publishes; the new version replaces the old ---------- */
  await page.goto(`${base}/stories`);
  await page.getByRole("heading", { level: 1, name: "Stories" }).waitFor();
  check("12. publish panel: the approved revision is listed", await visibleSoon(page.getByTestId("publish-panel").getByRole("list", { name: /^Now — approved/ }).getByText(T("revised story"))));
  const { dialog, confirm } = await publish(page);
  check("12. the confirmation names the approved content", (await dialog.innerText()).includes(T("revised story")));
  await axe(page, "publish confirmation");
  await confirm();
  check("12. owner publishes the website", await visibleSoon(toast(page, "Published version")));
  check("13. the new version is public", (await publicStory(page))?.title === T("revised story"));
  check("14. replaced, not added: one version of the story in the snapshot", await page.evaluate(async (prefix) => (await (await fetch("/api/v1/public/snapshot")).json()).data.content.stories.filter((s) => s.title.startsWith(prefix)).length === 1, `Smoke ${run}`));
  const st = (await apiCall(page, at)).body.data;
  check("13. the story reads Published again", st.record.status === "published" && st.live === true);
  check("15. a publish from a stale review is a 409", (await apiCall(page, "/api/v1/publish", { method: "POST", body: JSON.stringify({ changesKey: reviewed.changesKey }) })).status === 409);
  await shot(page, "workflow-published");
  await ed.context.close();

  /* ---------- 375px ---------- */
  const m = await signIn(owner, { width: 375, height: 812 });
  for (const path of ["/stories", `/stories/${storyId}`]) {
    await m.page.goto(`${base}${path}`);
    await m.page.waitForTimeout(700);
    check(`375px ${path.replace(/[0-9a-f-]{36}/, ":id")}: no horizontal page scroll`, await m.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  }
  check("375px: the workflow state is visible", await visibleSoon(m.page.getByTestId("workflow")));
  await axe(m.page, "story editor at 375px");
  await shot(m.page, "workflow-mobile");
  await m.context.close();

  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
} catch (error) {
  check("flow completed", false, error.message.split("\n")[0]);
  if (ownerPage) await shot(ownerPage, "failure").catch(() => {});
} finally {
  if (ownerPage && storyId) {
    // Archive the story and publish once more: the snapshot no longer carries it.
    await apiCall(ownerPage, `/api/v1/stories/${storyId}`, { method: "DELETE" }).catch(() => {});
    const res = await apiCall(ownerPage, "/api/v1/publish", { method: "POST" }).catch(() => ({}));
    console.log(`(cleanup: archived the smoke story; publish ${res.status})`);
  }
  await browser.close();
}

for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.ok || !r.detail ? "" : `  [${r.detail}]`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
