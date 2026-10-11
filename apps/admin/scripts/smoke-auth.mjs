/* Browser smoke test of the admin's sign-in flow, against a running admin
   (and the API behind it):

     ADMIN_URL=http://localhost:5174 ADMIN_SMOKE_EMAIL=… ADMIN_SMOKE_PASSWORD=… \
       npx -y -p playwright node scripts/smoke-auth.mjs

   Use an account in a LOCAL or test database. The password is never
   printed. Checks: signed-out redirect, wrong password, sign-in, the
   cookie is HttpOnly and invisible to scripts, nothing in web storage,
   refresh keeps the session, sign-out, and the guard after sign-out.
   Exits 1 on any failure. */
import { createRequire } from "node:module";
import { delimiter, join } from "node:path";
import { pathToFileURL } from "node:url";
import { requireTestTarget } from "../../api/test/support/smoke-target.mjs";

const usable = (m) => (m?.chromium ? m : m?.default?.chromium ? m.default : null);
async function loadPlaywright() {
  try {
    const m = usable(await import("playwright"));
    if (m) return m;
  } catch {}
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (!dir.endsWith(join("node_modules", ".bin"))) continue;
    try {
      const m = usable(await import(pathToFileURL(createRequire(join(dir, "..", "noop.js")).resolve("playwright")).href));
      if (m) return m;
    } catch {}
  }
  return null;
}

const base = process.env.ADMIN_URL ?? "http://localhost:5174";
/* Phase 0: never against a production API — asked before anything is written. */
await requireTestTarget(base);
const email = process.env.ADMIN_SMOKE_EMAIL;
const password = process.env.ADMIN_SMOKE_PASSWORD;
if (!email || !password) {
  console.error("Set ADMIN_SMOKE_EMAIL and ADMIN_SMOKE_PASSWORD (a local/test account).");
  process.exit(1);
}
const playwright = await loadPlaywright();
if (!playwright) {
  console.error("Needs Playwright: npx -y -p playwright node scripts/smoke-auth.mjs");
  process.exit(1);
}

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });
const browser = await playwright.chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && !/401|429/.test(m.text()) && consoleErrors.push(m.text()));
const storage = () => page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length, cookie: document.cookie }));

try {
  await page.goto(`${base}/`);
  await page.waitForURL("**/login");
  check("signed out: / redirects to /login", page.url().endsWith("/login"));
  check("/login renders the form", await page.getByRole("button", { name: "Sign in" }).isVisible());

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("definitely the wrong password");
  await page.getByRole("button", { name: "Sign in" }).click();
  const alert = page.getByRole("alert");
  await alert.waitFor();
  check("wrong password shows a safe error", (await alert.textContent()) === "Email or password is incorrect.", await alert.textContent());

  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByTestId("user-role").waitFor();
  check("sign-in opens the shell", page.url() === `${base}/`);
  check("shell shows the member", (await page.getByTestId("user-email").textContent()) === email.trim(), "email shown");
  check("shell shows the role", ["Owner", "Editor"].includes(await page.getByTestId("user-role").textContent()));

  const cookies = await context.cookies();
  const session = cookies.find((c) => /session/.test(c.name));
  check("session cookie is set", Boolean(session));
  check("session cookie is HttpOnly", session?.httpOnly === true);
  check("session cookie is SameSite=Strict", session?.sameSite === "Strict");
  const web = await storage();
  check("no token in localStorage", web.local === 0, `${web.local} key(s)`);
  check("no token in sessionStorage", web.session === 0, `${web.session} key(s)`);
  check("session cookie invisible to scripts", !session || !web.cookie.includes(session.value));

  await page.reload();
  await page.getByTestId("user-role").waitFor();
  check("refresh keeps the session (cookie → /auth/me)", page.url() === `${base}/`);

  // Sign out lives in the account menu in the topbar.
  await page.getByRole("button", { name: /^Account:/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL("**/login");
  check("sign-out returns to /login", page.url().endsWith("/login"));
  check("sign-out cleared the cookie", !(await context.cookies()).some((c) => c.name === session?.name && c.value));
  await page.goto(`${base}/`);
  await page.waitForURL("**/login");
  check("after sign-out, / redirects to /login", page.url().endsWith("/login"));
  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
} catch (error) {
  check("flow completed", false, error.message);
} finally {
  await browser.close();
}

for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.ok || !r.detail ? "" : `  [${r.detail}]`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
