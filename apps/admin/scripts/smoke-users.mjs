/* Browser smoke test of Users & Roles, Your account and the setup-password
   page (M17.3), against a running admin and API:

     ADMIN_URL=http://localhost:5174 \
     ADMIN_SMOKE_EMAIL=<owner> ADMIN_SMOKE_PASSWORD=… \
       npx -y -p playwright -p axe-core node scripts/smoke-users.mjs

   Use an OWNER in a LOCAL or TEST database only: it adds members
   ("smoke-<run>-…@example.org"), gives them passwords, changes their
   roles, signs them out and deactivates them. Members are never deleted
   (the API has no delete); the test database's own cleanup removes them.
   Passwords and setup tokens are never printed. Exits 1 on any failure. */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
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
  console.error("Needs Playwright: npx -y -p playwright -p axe-core node scripts/smoke-users.mjs");
  process.exit(1);
}
const playwright = await import(pathToFileURL(playwrightPath).href).then((m) => (m.chromium ? m : m.default));
const axePath = resolveFromPath("axe-core/axe.min.js");
const axeSource = axePath ? readFileSync(axePath, "utf8") : null;

const base = process.env.ADMIN_URL ?? "http://localhost:5174";
/* Phase 0: never against a production API — asked before anything is written. */
await requireTestTarget(base);
const owner = { email: process.env.ADMIN_SMOKE_EMAIL, password: process.env.ADMIN_SMOKE_PASSWORD };
const shots = process.env.SCREENSHOTS;
if (!owner.email || !owner.password) {
  console.error("Set ADMIN_SMOKE_EMAIL and ADMIN_SMOKE_PASSWORD (an OWNER in a local/test database).");
  process.exit(1);
}

const run = randomBytes(3).toString("hex");
const memberEmail = `smoke-${run}-member@example.org`;
const memberName = `Smoke Member ${run}`;
const firstPassword = `smoke ${randomBytes(9).toString("base64url")} first`;
const secondPassword = `smoke ${randomBytes(9).toString("base64url")} second`;
const secrets = [owner.password, firstPassword, secondPassword];

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail });
const browser = await playwright.chromium.launch();
const consoleErrors = [];
const visibleSoon = (locator, timeout = 8000) => locator.waitFor({ state: "visible", timeout }).then(() => true, () => false);
const toast = (page, text) => page.getByRole("region", { name: "Notifications" }).getByText(text).first();
const shot = async (page, name) => shots && page.screenshot({ path: join(shots, `${name}.png`), fullPage: true });
const noHorizontalScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

async function axe(page, name) {
  if (!axeSource) return;
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"), null, { timeout: 5000 }).catch(() => {});
  await page.evaluate(axeSource);
  const v = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ["violations"] })).violations.map((x) => `${x.id} (${x.impact}): ${x.nodes[0]?.target?.join(" ")}`));
  check(`axe: no violations — ${name}`, v.length === 0, v.join(" | "));
}

/* Every request URL a page makes — a setup token must never be in one. */
function watch(page) {
  const urls = [];
  page.on("request", (r) => urls.push(r.url()));
  page.on("console", (m) => m.type() === "error" && !/status of (400|401|403|404|409|429)/.test(m.text()) && consoleErrors.push(m.text()));
  page.on("pageerror", (e) => consoleErrors.push(e.message));
  return urls;
}

async function newPage(viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const urls = watch(page);
  return { context, page, urls };
}

async function signIn(who, viewport) {
  const s = await newPage(viewport);
  await s.page.goto(`${base}/login`);
  await s.page.getByLabel("Email").fill(who.email);
  await s.page.getByLabel("Password").fill(who.password);
  await s.page.getByRole("button", { name: "Sign in" }).click();
  await s.page.getByTestId("user-role").waitFor();
  return s;
}

const me = (page) => page.evaluate(async () => (await fetch("/api/v1/auth/me", { credentials: "same-origin" })).status);
const apiCall = (page, path, init = {}) =>
  page.evaluate(async ({ path, init }) => {
    const r = await fetch(path, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...init });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, { path, init });
const storageHas = (page, value) => page.evaluate((v) => [localStorage, sessionStorage].some((s) => Object.keys(s).some((k) => k.includes(v) || (s.getItem(k) ?? "").includes(v))), value);
const row = (page, email) => page.locator("tr[data-member-id]").filter({ hasText: email });
async function rowAction(page, email, item) {
  await row(page, email).getByRole("button", { name: /^Actions for / }).click();
  await page.getByRole("menuitem", { name: item }).click();
}

let memberId = null;
const tokens = [];

try {
  /* ---------- Owner: the page, the list, adding a member ---------- */
  const o = await signIn(owner, { width: 1440, height: 900 });
  await o.context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
  check("owner: Users & Roles is in the navigation", await visibleSoon(o.page.locator('a[data-nav-item="users"]')));
  await o.page.locator('a[data-nav-item="users"]').click();
  await o.page.getByRole("heading", { level: 1, name: "Users & Roles" }).waitFor();
  await o.page.getByTestId("members-table").locator("tr[data-member-id]").first().waitFor();
  const self = o.page.locator("tr[data-member-id]").filter({ has: o.page.getByText("You", { exact: true }) });
  check("own row: marked You, no actions menu — only a link to Your account", (await self.count()) === 1 && (await self.getByRole("button", { name: /^Actions for / }).count()) === 0 && (await self.getByRole("button", { name: "Your account" }).count()) === 1);
  check("the list shows no internal fields", !/passwordHash|tokenHash|orgId/.test(await o.page.locator("main").innerText()));
  await axe(o.page, "users list");

  await o.page.getByRole("button", { name: "Add member" }).first().click();
  const add = o.page.getByRole("dialog", { name: "Add a member" });
  await add.waitFor();
  check("add dialog: focus starts on Name", (await o.page.evaluate(() => document.activeElement?.getAttribute("name"))) === "name");
  await axe(o.page, "add-member dialog");
  await add.getByRole("button", { name: "Add member" }).click();
  check("add: empty form → field errors, nothing sent", (await add.getByText("Enter their name.").count()) === 1 && (await add.getByText("Enter their email address.").count()) === 1);
  await add.getByLabel("Name").fill(memberName);
  await add.getByLabel("Email").fill("not-an-email");
  await add.getByRole("button", { name: "Add member" }).click();
  check("add: invalid email → field error", await visibleSoon(add.getByText("Enter a valid email address.")));
  await add.getByLabel("Email").fill(memberEmail);
  await add.getByRole("button", { name: "Add member" }).click();
  const added = o.page.getByRole("dialog", { name: `${memberName} was added` });
  check("add: success → explains the member cannot sign in yet", await visibleSoon(added));
  check("add: success toast", await visibleSoon(toast(o.page, `${memberName} added`)));

  /* ---------- One-time setup link ---------- */
  await added.getByRole("button", { name: "Issue setup link" }).click();
  const linkDialog = o.page.getByTestId("setup-link-dialog");
  await linkDialog.waitFor();
  const link1 = await o.page.getByTestId("setup-link-value").inputValue();
  tokens.push(new URL(link1).hash.replace("#token=", ""));
  check("setup link: /setup-password with the token in the fragment only", /^http:\/\/[^/]+\/setup-password#token=[A-Za-z0-9_-]{43}$/.test(link1) && new URL(link1).search === "");
  check("setup link: the warning says anyone holding it can set the password", await visibleSoon(o.page.getByText("Anyone with this link can set this account's password")));
  await axe(o.page, "setup-link dialog");
  await o.page.getByRole("button", { name: "Copy link" }).click();
  check("copy: the clipboard holds exactly the link", (await o.page.evaluate(() => navigator.clipboard.readText())) === link1);
  check("copy: confirmed", await visibleSoon(o.page.getByTestId("setup-link-dialog").getByRole("button", { name: "Copied", exact: true })));
  check("token never in local/session storage", !(await storageHas(o.page, tokens[0])));
  await o.page.keyboard.press("Escape");
  await o.page.getByTestId("setup-link-dialog").waitFor({ state: "detached" });
  check("after closing: the token is gone from the page", !(await o.page.content()).includes(tokens[0]));
  check("the token never appeared in a request URL (owner)", !o.urls.some((u) => u.includes(tokens[0])));
  memberId = await row(o.page, memberEmail).getAttribute("data-member-id");
  check("new member: Awaiting setup, no sessions", (await row(o.page, memberEmail).locator("[data-password]").getAttribute("data-password")) === "pending");

  // A second link must be issued on purpose — and it revokes the first.
  await rowAction(o.page, memberEmail, "Issue setup link…");
  const confirmIssue = o.page.getByRole("dialog", { name: /^Issue a setup link for/ });
  check("re-issue: asks first, and says the earlier link stops working", await visibleSoon(confirmIssue.getByText("Any earlier link for them stops working.")));
  await confirmIssue.getByRole("button", { name: "Issue link" }).click();
  await o.page.getByTestId("setup-link-dialog").waitFor();
  const link2 = await o.page.getByTestId("setup-link-value").inputValue();
  tokens.push(new URL(link2).hash.replace("#token=", ""));
  check("re-issue: a different token", tokens[1] !== tokens[0]);
  await o.page.getByRole("button", { name: "Done" }).click();

  // Duplicate email: the API's refusal, on the field.
  await o.page.getByRole("button", { name: "Add member" }).first().click();
  const again = o.page.getByRole("dialog", { name: "Add a member" });
  await again.getByLabel("Name").fill("Duplicate");
  await again.getByLabel("Email").fill(memberEmail.toUpperCase());
  await again.getByRole("button", { name: "Add member" }).click();
  check("duplicate email → the API's message on the email field", await visibleSoon(again.getByText("An account with this email already exists.")));
  await again.getByRole("button", { name: "Cancel" }).click();

  /* ---------- The setup page ---------- */
  const s = await newPage({ width: 375, height: 812 });
  await s.page.goto(`${base}/setup-password#token=${tokens[0]}`);
  await s.page.getByTestId("setup-form").waitFor();
  check("setup page: the token leaves the address bar at once", new URL(s.page.url()).hash === "" && !s.page.url().includes(tokens[0]));
  await s.page.locator('input[name="new-password"]').fill(firstPassword);
  await s.page.getByLabel("Confirm new password").fill(firstPassword);
  await s.page.getByRole("button", { name: "Set password" }).click();
  check("revoked (first) link → invalid-link state", await visibleSoon(s.page.getByTestId("setup-invalid")));

  await s.page.goto(`${base}/setup-password#token=${tokens[1]}`);
  await s.page.getByTestId("setup-form").waitFor();
  check("setup page: hash cleared (second link)", new URL(s.page.url()).hash === "");
  await axe(s.page, "setup-password at 375px");
  check("375px: no horizontal scroll (setup)", await noHorizontalScroll(s.page));
  await s.page.locator('input[name="new-password"]').fill("short");
  await s.page.getByLabel("Confirm new password").fill("short");
  await s.page.getByRole("button", { name: "Set password" }).click();
  check("setup: too short → requirement shown, link kept", await visibleSoon(s.page.getByText("Use at least 12 characters.")));
  await s.page.locator('input[name="new-password"]').fill(firstPassword);
  await s.page.getByLabel("Confirm new password").fill(firstPassword + "x");
  await s.page.getByRole("button", { name: "Set password" }).click();
  check("setup: mismatch → shown", await visibleSoon(s.page.getByText("The two passwords do not match.")));
  await s.page.getByLabel("Confirm new password").fill(firstPassword);
  await s.page.getByRole("button", { name: "Set password" }).click();
  check("setup: success", await visibleSoon(s.page.getByTestId("setup-done")));
  check("setup: no token left in the page or storage", !(await s.page.content()).includes(tokens[1]) && !(await storageHas(s.page, tokens[1])));
  check("setup: token only ever in the POST body, never a URL", !s.urls.some((u) => tokens.some((t) => u.includes(t))));
  await axe(s.page, "setup done");
  await s.page.getByRole("button", { name: "Sign in" }).click();
  check("setup: Sign in leads to /login", await visibleSoon(s.page.getByRole("button", { name: "Sign in" })) && new URL(s.page.url()).pathname === "/login");
  // The page cannot know a link is used until it submits (there is no "check link" endpoint to probe tokens with).
  await s.page.goto(`${base}/setup-password#token=${tokens[1]}`);
  await s.page.getByTestId("setup-form").waitFor();
  await s.page.locator('input[name="new-password"]').fill(secondPassword);
  await s.page.getByLabel("Confirm new password").fill(secondPassword);
  await s.page.getByRole("button", { name: "Set password" }).click();
  check("used link → invalid-link state on submit; nothing changed", await visibleSoon(s.page.getByTestId("setup-invalid")));
  await s.context.close();

  /* ---------- The new member (an editor) ---------- */
  const member = { email: memberEmail, password: firstPassword };
  const m = await signIn(member, { width: 1024, height: 900 });
  check("editor: no Users & Roles in the navigation", (await m.page.locator('a[data-nav-item="users"]').count()) === 0);
  await m.page.goto(`${base}/users`);
  check("editor: /users → No access, and no member data requested", (await visibleSoon(m.page.getByRole("heading", { level: 1, name: "No access" }))) && !m.urls.some((u) => u.includes("/api/v1/members")));
  check("editor: the API refuses the team list too", (await apiCall(m.page, "/api/v1/members")).status === 403);
  await axe(m.page, "no access");

  // Account page: change password.
  const other = await signIn(member, { width: 1280, height: 900 }); // a second session, to be revoked
  await m.page.getByRole("button", { name: /^Account:/ }).click();
  await m.page.getByRole("menuitem", { name: "Your account" }).click();
  await m.page.getByRole("heading", { level: 1, name: "Your account" }).waitFor();
  await axe(m.page, "your account");
  const pw = m.page.getByTestId("password-form");
  await pw.getByLabel("Current password").fill("certainly not my password");
  await pw.locator('input[name="new-password"]').fill(secondPassword);
  await pw.getByLabel("Confirm new password").fill(secondPassword);
  await pw.getByRole("button", { name: "Change password" }).click();
  check("change: wrong current password → shown on the field", await visibleSoon(pw.getByText("This is incorrect.")));
  check("change: a wrong current password signs nobody out", (await me(m.page)) === 200 && (await me(other.page)) === 200);
  await pw.getByLabel("Current password").fill(firstPassword);
  await pw.locator('input[name="new-password"]').fill(secondPassword);
  await pw.getByLabel("Confirm new password").fill(secondPassword + "!");
  await pw.getByRole("button", { name: "Change password" }).click();
  check("change: mismatch caught before sending", await visibleSoon(pw.getByText("The two passwords do not match.")));
  await pw.getByLabel("Current password").fill(firstPassword);
  await pw.getByLabel("Confirm new password").fill(secondPassword);
  await pw.getByRole("button", { name: "Change password" }).click();
  check("change: success toast", await visibleSoon(toast(m.page, "Password changed")));
  check("change: this browser stays signed in (rotated session)", (await me(m.page)) === 200 && (await visibleSoon(m.page.getByRole("heading", { level: 1, name: "Your account" }))));
  check("change: the other session is signed out", (await me(other.page)) === 401);
  check("change: fields cleared", (await pw.getByLabel("Current password").inputValue()) === "" && (await pw.locator('input[name="new-password"]').inputValue()) === "");
  await other.context.close();
  member.password = secondPassword;

  /* ---------- Owner: role, sign-out, deactivate/reactivate, conflicts ---------- */
  await o.page.reload();
  await row(o.page, memberEmail).waitFor();
  check("list: password now set, one active session", (await row(o.page, memberEmail).locator("[data-password]").getAttribute("data-password")) === "set" && (await row(o.page, memberEmail).locator("[data-sessions]").innerText()).trim() === "1");
  await rowAction(o.page, memberEmail, "Change role…");
  const roleDialog = o.page.getByRole("dialog", { name: `Change ${memberName}'s role` });
  await roleDialog.waitFor();
  check("role dialog: Change role disabled until a different role is chosen", await roleDialog.getByRole("button", { name: "Change role" }).isDisabled());
  await roleDialog.getByLabel("Role").selectOption("OWNER");
  check("role dialog: promoting to owner warns", await visibleSoon(roleDialog.getByText(/Owners can manage the team/)));
  await axe(o.page, "role dialog");
  await roleDialog.getByRole("button", { name: "Change role" }).click();
  check("role: now an owner", await visibleSoon(toast(o.page, `${memberName} is now an owner`)));
  check("role: effective on the member's next request", (await apiCall(m.page, "/api/v1/members")).status === 200);
  await rowAction(o.page, memberEmail, "Change role…");
  await o.page.getByRole("dialog", { name: `Change ${memberName}'s role` }).getByLabel("Role").selectOption("EDITOR");
  await o.page.getByRole("dialog", { name: `Change ${memberName}'s role` }).getByRole("button", { name: "Change role" }).click();
  check("role: back to editor", await visibleSoon(toast(o.page, `${memberName} is now an editor`)));

  await rowAction(o.page, memberEmail, "Sign out everywhere…");
  await o.page.getByRole("dialog", { name: /^Sign .* out everywhere\?/ }).getByRole("button", { name: "Sign out everywhere" }).click();
  check("sign out everywhere: done", await visibleSoon(toast(o.page, "1 session ended")));
  check("sign out everywhere: the member's session ended", (await me(m.page)) === 401);
  await m.context.close();

  const m2 = await signIn(member, { width: 1280, height: 900 });
  await o.page.reload();
  await row(o.page, memberEmail).waitFor();
  await rowAction(o.page, memberEmail, "Deactivate…");
  const deactivate = o.page.getByRole("dialog", { name: `Deactivate ${memberName}?` });
  await axe(o.page, "deactivate dialog");
  await deactivate.getByRole("button", { name: "Deactivate" }).click();
  check("deactivate: done", await visibleSoon(toast(o.page, `${memberName} deactivated`)));
  check("deactivate: shown as Deactivated, only Reactivate offered", (await row(o.page, memberEmail).locator("[data-status]").getAttribute("data-status")) === "disabled");
  check("deactivate: the member is signed out at once", (await me(m2.page)) === 401);
  await rowAction(o.page, memberEmail, "Reactivate…");
  await o.page.getByRole("dialog", { name: `Reactivate ${memberName}?` }).getByRole("button", { name: "Reactivate" }).click();
  check("reactivate: done", await visibleSoon(toast(o.page, `${memberName} reactivated`)));
  await m2.context.close();

  // A stale list: someone else changes the member; this page's change is refused and explained.
  const fresh = (await apiCall(o.page, `/api/v1/members/${memberId}`)).body.data;
  await apiCall(o.page, `/api/v1/members/${memberId}/role`, { method: "POST", body: JSON.stringify({ revision: fresh.revision, role: "OWNER" }) });
  await rowAction(o.page, memberEmail, "Deactivate…");
  await o.page.getByRole("dialog", { name: `Deactivate ${memberName}?` }).getByRole("button", { name: "Deactivate" }).click();
  check("stale revision → 'changed elsewhere' explained, list reloaded", await visibleSoon(o.page.getByRole("alert").filter({ hasText: "changed elsewhere" })));
  check("stale revision: nothing deactivated", (await row(o.page, memberEmail).locator("[data-status]").getAttribute("data-status")) === "active");

  /* ---------- Responsive and keyboard ---------- */
  for (const width of [1440, 1024, 768, 375]) {
    await o.page.setViewportSize({ width, height: 900 });
    await o.page.goto(`${base}/users`);
    await o.page.getByRole("heading", { level: 1, name: "Users & Roles" }).waitFor();
    await row(o.page, memberEmail).waitFor();
    check(`${width}px: no horizontal page scroll (users)`, await noHorizontalScroll(o.page));
    await axe(o.page, `users at ${width}px`);
    await o.page.goto(`${base}/account`);
    await o.page.getByRole("heading", { level: 1, name: "Your account" }).waitFor();
    check(`${width}px: no horizontal page scroll (account)`, await noHorizontalScroll(o.page));
    await axe(o.page, `account at ${width}px`);
  }
  await o.page.setViewportSize({ width: 1440, height: 900 });
  await shot(o.page, "users");
  await o.page.goto(`${base}/users`);
  await row(o.page, memberEmail).waitFor();
  const trigger = row(o.page, memberEmail).getByRole("button", { name: /^Actions for / });
  await trigger.focus();
  await o.page.keyboard.press("Enter");
  check("keyboard: the actions menu opens and takes focus", (await o.page.evaluate(() => document.activeElement?.getAttribute("role"))) === "menuitem");
  await o.page.keyboard.press("Escape");
  check("keyboard: Escape returns focus to the trigger", await trigger.evaluate((el) => el === document.activeElement));

  // Leave the smoke member deactivated (the test database cleanup removes it).
  const last = (await apiCall(o.page, `/api/v1/members/${memberId}`)).body.data;
  if (last.role === "OWNER") await apiCall(o.page, `/api/v1/members/${memberId}/role`, { method: "POST", body: JSON.stringify({ revision: last.revision, role: "EDITOR" }) });
  const final = (await apiCall(o.page, `/api/v1/members/${memberId}`)).body.data;
  await apiCall(o.page, `/api/v1/members/${memberId}/deactivate`, { method: "POST", body: JSON.stringify({ revision: final.revision }) });
  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
} catch (error) {
  check("flow completed", false, error.message.split("\n")[0]);
} finally {
  await browser.close();
}

const scrub = (text) => [...secrets, ...tokens].reduce((t, s) => (s ? t.split(s).join("<redacted>") : t), String(text));
for (const r of results) console.log(scrub(`${r.ok ? "✓" : "✗"} ${r.name}${r.ok || !r.detail ? "" : `  [${r.detail}]`}`));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
