/* Browser smoke test of scheduled publishing (M15), against a running
   admin and API: an owner schedules an approved story (refused for a past
   time and for a time the clocks skip), sees it queued — never as
   published — in the editor and the publish panel, unschedules it and
   publishes it now; an editor sees the schedule and no scheduling
   controls; the homepage is scheduled as a whole page; the dialog works
   from the keyboard, passes axe, and fits at 375px.

     ADMIN_URL=http://localhost:5174 \
     ADMIN_SMOKE_EMAIL=<owner> ADMIN_SMOKE_PASSWORD=… \
     ADMIN_SMOKE_EDITOR_EMAIL=<editor> ADMIN_SMOKE_EDITOR_PASSWORD=… \
       npx -y -p playwright -p axe-core node scripts/smoke-schedule.mjs

   LOCAL or test data only: it creates a "Smoke <run> …" story, PUBLISHES
   THE WEBSITE, and archives the story (publishing again) at the end. It
   never waits for a scheduled time (the API's tests and the end-to-end
   proof run the scheduler). Passwords are never printed. Exits 1 on any
   failure. */
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
  console.error("Needs Playwright: npx -y -p playwright -p axe-core node scripts/smoke-schedule.mjs");
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

let ownerPage = null;
let storyId = null;
const body = [{ type: "paragraph", children: [{ type: "text", text: "A smoke paragraph." }] }];
const ZONE = "Asia/Kolkata";
/* A wall-clock date and time `ms` from now in `zone` (minute precision). */
const wall = (ms, zone = ZONE) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(Date.now() + ms)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
};
const publicHas = async (page, title) => page.evaluate(async (t) => JSON.stringify((await (await fetch("/api/v1/public/snapshot")).json()).data ?? {}).includes(t), title);
const fill = async (dialog, { date, time }, zone) => {
  await dialog.locator('input[type="date"]').fill(date);
  await dialog.locator('input[type="time"]').fill(time);
  if (zone) await dialog.getByLabel("Time zone").selectOption(zone);
};
const DAY = 86_400_000;

try {
  if (!editor.email || !editor.password) throw new Error("Set ADMIN_SMOKE_EDITOR_EMAIL and ADMIN_SMOKE_EDITOR_PASSWORD (an EDITOR).");
  const { page } = await signIn(owner);
  ownerPage = page;

  // An approved story (through the API: the workflow smoke covers the review UI).
  const created = (await apiCall(page, "/api/v1/stories", { method: "POST", body: JSON.stringify({ title: T("scheduled story"), category: "field", body }) })).body.data;
  storyId = created.record.id;
  const at = `/api/v1/stories/${storyId}`;
  const sub = (await apiCall(page, `${at}/submit`, { method: "POST", body: JSON.stringify({ revision: created.revision }) })).body.data;
  await apiCall(page, `${at}/approve`, { method: "POST", body: JSON.stringify({ revision: sub.revision }) });

  /* ---------- The owner's moves on an approved revision ---------- */
  await page.goto(`${base}/stories/${storyId}`);
  const workflow = page.getByTestId("workflow");
  await workflow.waitFor();
  for (const name of ["Publish now", "Schedule", "Return to draft"]) check(`owner: "${name}" is offered for an approved story`, await workflow.getByRole("button", { name, exact: true }).isVisible());
  await axe(page, "approved story (owner)");

  /* ---------- The schedule dialog: keyboard, refusals, explicit zone ---------- */
  await workflow.getByRole("button", { name: "Schedule", exact: true }).focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Schedule this story" });
  check("schedule dialog: opens from the keyboard", await visibleSoon(dialog));
  check("schedule dialog: the zone is chosen, never assumed", (await dialog.getByLabel("Time zone").inputValue()) === "");
  check("schedule dialog: Schedule waits for a date, a time and a zone", await dialog.getByRole("button", { name: "Schedule", exact: true }).isDisabled());
  await axe(page, "schedule dialog");
  await page.keyboard.press("Escape");
  check("schedule dialog: Escape closes it", !(await dialog.isVisible()));
  check("schedule dialog: focus returns to Schedule", (await page.evaluate(() => document.activeElement?.textContent?.trim())) === "Schedule");
  await workflow.getByRole("button", { name: "Schedule", exact: true }).click();
  await fill(dialog, wall(-DAY), ZONE);
  await dialog.getByRole("button", { name: "Schedule", exact: true }).click();
  check("refused: a past time", await visibleSoon(dialog.getByText("must be in the future")));
  await fill(dialog, { date: "2027-03-14", time: "02:30" }, "America/New_York");
  await dialog.getByRole("button", { name: "Schedule", exact: true }).click();
  check("refused: a time the clocks skip (daylight saving)", await visibleSoon(dialog.getByText(/the clocks skip it/)));
  const when = wall(2 * DAY);
  await fill(dialog, when, ZONE);
  check("schedule dialog: says the time is in the chosen zone", (await dialog.getByTestId("schedule-preview").innerText()).includes(`${when.date} at ${when.time}, ${ZONE} time`));
  await dialog.getByRole("button", { name: "Schedule", exact: true }).click();
  check("owner: schedules it", await visibleSoon(toast(page, "Scheduled")));
  const stored = (await apiCall(page, at)).body.data;
  const expected = new Intl.DateTimeFormat("en-US", { timeZone: ZONE, year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).formatToParts(new Date(stored.schedule.at)).reduce((o, p) => ({ ...o, [p.type]: p.value }), {});
  const label = `${expected.month} ${expected.day}, ${expected.year} · ${expected.hour}:${expected.minute} ${expected.dayPeriod} ${ZONE}`;
  check("stored: one UTC instant, the zone it was chosen in, still approved", stored.record.status === "approved" && stored.schedule.at.endsWith("Z") && stored.schedule.timeZone === ZONE);
  check("badge: Scheduled — not Published", (await workflow.getByText("Scheduled", { exact: true }).isVisible()) && (await workflow.getByText("Published", { exact: true }).count()) === 0);
  check(`editor shows "Scheduled for ${label}"`, (await page.getByTestId("workflow-schedule").innerText()).includes(label));
  check("owner: Unschedule offered; Publish now and Schedule are not", (await workflow.getByRole("button", { name: "Unschedule" }).isVisible()) && (await workflow.getByRole("button", { name: "Publish now" }).count()) === 0);
  check("public: a scheduled story is not published", !(await publicHas(page, T("scheduled story"))));
  await axe(page, "scheduled story (owner)");
  await shot(page, "schedule-scheduled");

  /* ---------- The publish panel: NOW / SCHEDULED / WAITING / BLOCKED ---------- */
  await page.goto(`${base}/stories`);
  const panel = page.getByTestId("publish-panel");
  await panel.waitFor();
  check("publish panel: SCHEDULED lists it, with its time and zone", await visibleSoon(panel.getByRole("list", { name: /^Scheduled/ }).getByText(`${T("scheduled story")} — ${label}`)));
  check("publish panel: NOW does not", (await panel.getByRole("list", { name: /^Now — approved/ }).getByText(T("scheduled story")).count()) === 0);
  check("list: the row says Scheduled", (await page.locator(`[data-content-id="${storyId}"]`).innerText()).includes("Scheduled"));
  await axe(page, "publish panel with a schedule");

  /* ---------- An editor sees it, and cannot change it ---------- */
  const ed = await signIn(editor);
  await ed.page.goto(`${base}/stories/${storyId}`);
  const edWorkflow = ed.page.getByTestId("workflow");
  await edWorkflow.waitFor();
  check("editor: sees Scheduled and when", (await edWorkflow.getByText("Scheduled", { exact: true }).isVisible()) && (await ed.page.getByTestId("workflow-schedule").innerText()).includes(label));
  check("editor: no Publish now, Schedule or Unschedule", (await edWorkflow.getByRole("button").count()) === 0);
  check("editor: told an owner scheduled it", await edWorkflow.getByText("An owner scheduled its publication.").isVisible());
  check("editor: the API refuses their schedule (403)", (await apiCall(ed.page, `${at}/unschedule`, { method: "POST", body: JSON.stringify({ revision: stored.revision }) })).status === 403);
  await ed.context.close();

  /* ---------- Unschedule, then Publish now ---------- */
  await page.goto(`${base}/stories/${storyId}`);
  await workflow.waitFor();
  await workflow.getByRole("button", { name: "Unschedule" }).click();
  const unschedule = page.getByRole("dialog", { name: "Unschedule this story?" });
  check("unschedule: asks first, naming the time", (await unschedule.innerText()).includes(label));
  await axe(page, "unschedule dialog");
  await unschedule.getByRole("button", { name: "Unschedule", exact: true }).click();
  check("owner: unschedules it — still approved", (await visibleSoon(toast(page, "Unscheduled"))) && (await apiCall(page, at)).body.data.record.status === "approved");
  await workflow.getByRole("button", { name: "Publish now" }).click();
  const publishDialog = page.getByRole("dialog", { name: "Publish the website now?" });
  await publishDialog.waitFor();
  check("publish now: says it publishes everything approved, and lists it", (await visibleSoon(publishDialog.getByText(T("scheduled story")))) && (await publishDialog.innerText()).includes("not only this"));
  await axe(page, "publish now dialog");
  await publishDialog.getByRole("button", { name: "Publish now" }).click();
  check("owner: publishes the website now", await visibleSoon(toast(page, "Published version")));
  check("public: published now", await publicHas(page, T("scheduled story")));
  check("the story reads Published", await visibleSoon(workflow.getByText("Published", { exact: true })));

  /* ---------- A single page: the homepage, scheduled as a whole ---------- */
  /* A simple, self-contained homepage revision (other smokes leave theirs naming archived records). */
  const faq = [{ id: "faq", type: "faq", enabled: true, version: 1, data: { heading: "Questions", items: [{ question: T("question?"), answer: "An answer." }] } }];
  let home = (await apiCall(page, "/api/v1/homepage")).body.data;
  if (home.record && home.record.status !== "archived") {
    await apiCall(page, "/api/v1/homepage", { method: "DELETE" });
    home = (await apiCall(page, "/api/v1/homepage")).body.data;
  }
  const reset = home.record
    ? await apiCall(page, "/api/v1/homepage", { method: "PATCH", body: JSON.stringify({ revision: home.revision, changes: { status: "draft", sections: faq, seo: null } }) })
    : await apiCall(page, "/api/v1/homepage", { method: "POST", body: JSON.stringify({ sections: faq }) });
  if (reset.body?.data?.record) {
    let v = reset.body.data;
    v = (await apiCall(page, "/api/v1/homepage/submit", { method: "POST", body: JSON.stringify({ revision: v.revision }) })).body.data;
    v = (await apiCall(page, "/api/v1/homepage/approve", { method: "POST", body: JSON.stringify({ revision: v.revision }) })).body.data;
    if (v?.record?.status === "approved") {
      await page.goto(`${base}/homepage`);
      const hw = page.getByTestId("workflow");
      await hw.waitFor();
      await hw.getByRole("button", { name: "Schedule", exact: true }).click();
      const hd = page.getByRole("dialog", { name: "Schedule this homepage" });
      await fill(hd, wall(3 * DAY, "America/Toronto"), "America/Toronto");
      await hd.getByRole("button", { name: "Schedule", exact: true }).click();
      check("homepage: scheduled as a whole page", (await visibleSoon(toast(page, "Scheduled"))) && (await page.getByTestId("workflow-schedule").innerText()).includes("America/Toronto"));
      await hw.getByRole("button", { name: "Unschedule" }).click();
      await page.getByRole("dialog", { name: "Unschedule this homepage?" }).getByRole("button", { name: "Unschedule", exact: true }).click();
      check("homepage: unscheduled", await visibleSoon(toast(page, "Unscheduled")));
      await apiCall(page, "/api/v1/homepage", { method: "DELETE" });
    } else check("homepage: could not be approved for the check", false, JSON.stringify(v?.record?.status));
  } else check("homepage: could not be prepared for the check", false, String(reset.status));

  /* ---------- 375px ---------- */
  const m = await signIn(owner, { width: 375, height: 812 });
  const second = (await apiCall(m.page, "/api/v1/stories", { method: "POST", body: JSON.stringify({ title: T("mobile story"), category: "field", body }) })).body.data;
  const s2 = (await apiCall(m.page, `/api/v1/stories/${second.record.id}/submit`, { method: "POST", body: JSON.stringify({ revision: second.revision }) })).body.data;
  await apiCall(m.page, `/api/v1/stories/${second.record.id}/approve`, { method: "POST", body: JSON.stringify({ revision: s2.revision }) });
  await m.page.goto(`${base}/stories/${second.record.id}`);
  await m.page.getByTestId("workflow").waitFor();
  await m.page.getByTestId("workflow").getByRole("button", { name: "Schedule", exact: true }).click();
  const md = m.page.getByRole("dialog", { name: "Schedule this story" });
  await md.waitFor();
  check("375px: the schedule dialog fits, no horizontal page scroll", await m.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await axe(m.page, "schedule dialog at 375px");
  await shot(m.page, "schedule-mobile");
  await m.page.keyboard.press("Escape");
  await apiCall(m.page, `/api/v1/stories/${second.record.id}`, { method: "DELETE" });
  await m.context.close();

  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
} catch (error) {
  check("flow completed", false, error.message.split("\n")[0]);
  if (ownerPage) await shot(ownerPage, "failure").catch(() => {});
} finally {
  if (ownerPage && storyId) {
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
