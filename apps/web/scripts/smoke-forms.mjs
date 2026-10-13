/* Browser smoke test of the public forms end to end (M18): the website
   (Vite dev server or a build) posting to the API's
   POST /api/v1/forms/:formId, with the API in EMAIL_MODE=test — so
   nothing is ever sent — on the DEDICATED TEST DATABASE.

     WEB_URL=http://localhost:5173 \
     MONGODB_TEST_URI=… MONGODB_TEST_DB=risingbeyondborders_test SMOKE_ORG=test-org \
       npx -y -p playwright -p axe-core node scripts/smoke-forms.mjs

   The site must be built/served with VITE_FORM_ENDPOINT_{CONTACT,
   VOLUNTEER,PARTNER} pointing at the API (same-origin /api/v1/forms/<id>
   through the dev proxy), VITE_FORM_ENDPOINT_TRAVEL unset, and the API with
   EMAIL_MODE=test, EMAIL_TO_<FORM> for those forms, ORGANIZATION_ID equal
   to SMOKE_ORG, and FORMS_RATE_LIMIT_MAX=2.

   The audit trail (read-only, SMOKE_ORG only) is how it proves what the
   API did: every delivery in test mode, bots discarded. It prints
   outcomes only — never what was typed. Its records are the test
   organization's; the test database's own cleanup removes them. */
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
  console.error("Needs Playwright: npx -y -p playwright -p axe-core node scripts/smoke-forms.mjs");
  process.exit(1);
}
const playwright = await import(pathToFileURL(playwrightPath).href).then((m) => (m.chromium ? m : m.default));
const axePath = resolveFromPath("axe-core/axe.min.js");
const axeSource = axePath ? readFileSync(axePath, "utf8") : null;

const base = process.env.WEB_URL ?? "http://localhost:5173";
/* Phase 0: the forms post through this site to an API, which must be on a
   test database — asked before anything is sent (SMOKE_API_URL when the
   site has no /api/v1 proxy). */
await requireTestTarget(base);
const uri = process.env.MONGODB_TEST_URI;
const dbName = process.env.MONGODB_TEST_DB;
const org = process.env.SMOKE_ORG ?? "test-org";
if (!uri || !dbName || !/_test$/.test(dbName)) {
  console.error("Set MONGODB_TEST_URI and MONGODB_TEST_DB (a database ending in _test) — the smoke reads the test organization's audit trail.");
  process.exit(1);
}
// The MongoDB driver from the API's dependencies (read-only use).
const { MongoClient } = createRequire(new URL("../../api/package.json", import.meta.url).pathname)("mongodb");
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
await client.connect();
const audit = client.db(dbName).collection("audit_logs");
const outcomes = async () =>
  (await audit.find({ orgId: org, action: "forms.submission" }).sort({ createdAt: 1 }).toArray()).map((e) => ({ form: e.resourceId, outcome: e.metadata?.outcome, mode: e.metadata?.mode }));

const VISITOR = { name: "Smoke Visitor", email: "smoke.visitor@example.org", organization: "Smoke Trust", message: "A smoke-test message — please ignore." };
const typed = Object.values(VISITOR);

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail });
const browser = await playwright.chromium.launch();
const consoleErrors = [];
const requests = [];
const visibleSoon = (locator, timeout = 15_000) => locator.waitFor({ state: "visible", timeout }).then(() => true, () => false);
const noHorizontalScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

async function axe(page, selector, name) {
  if (!axeSource) return;
  await page.evaluate(axeSource);
  const v = await page.evaluate(async (sel) => {
    const el = document.querySelector(sel);
    if (!el) return ["form not found"];
    const r = await window.axe.run(el, { resultTypes: ["violations"] });
    return r.violations.filter((x) => x.impact === "serious" || x.impact === "critical").map((x) => `${x.id} (${x.impact}): ${x.nodes[0]?.target?.join(" ")}`);
  }, selector);
  check(`axe: no serious/critical violations — ${name}`, v.length === 0, v.join(" | "));
}

async function open(path, viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on("console", (m) => m.type() === "error" && !/status of (400|403|404|422|429|503)/.test(m.text()) && consoleErrors.push(m.text()));
  page.on("pageerror", (e) => consoleErrors.push(e.message));
  page.on("request", (r) => requests.push({ url: r.url(), method: r.method() }));
  await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
  return { context, page };
}

async function fill(form, { organization = false } = {}) {
  await form.getByLabel(/Your name/).fill(VISITOR.name);
  await form.getByLabel(/Email address/).fill(VISITOR.email);
  if (organization) await form.getByLabel(/Organi[sz]ation/).fill(VISITOR.organization).catch(() => {});
  await form.locator("textarea").fill(VISITOR.message);
}
const submit = (form) => form.locator('button[type="submit"]').click();
const success = (page) => page.getByText("Thank you — your message has been sent to Rising Beyond Borders.");

try {
  const start = (await outcomes()).length;

  /* ---------- /contact: Contact drawn; Newsletter in the footer only (no band) ---------- */
  const c = await open("/contact");
  const contact = c.page.locator('form[data-form="contact"]');
  check("contact: the form is drawn", await visibleSoon(contact));
  check("newsletter: drawn once, in the footer (the page's band stays off)", (await c.page.locator('form[data-form="newsletter"]').count()) === 1 && (await c.page.locator('footer form[data-form="newsletter"]').count()) === 1);
  check("1440px: no horizontal scroll (contact)", await noHorizontalScroll(c.page));
  await axe(c.page, 'form[data-form="contact"]', "contact form");

  await submit(contact);
  check("contact: an empty submit shows the problems, sends nothing", await visibleSoon(c.page.getByText("There is a problem")));
  await c.page.waitForTimeout(1600); // more than the minimum fill time
  await fill(contact);
  await submit(contact);
  check("contact: success message", await visibleSoon(success(c.page)));
  await axe(c.page, "main", "contact after success");
  check("contact: nothing typed is kept in storage", await c.page.evaluate((t) => ![localStorage, sessionStorage].some((s) => Object.keys(s).some((k) => t.some((v) => (s.getItem(k) ?? "").includes(v)))), typed));
  await c.context.close();

  /* ---------- A bot (honeypot) on Contact: the same success, nothing delivered ---------- */
  const bot = await open("/contact");
  const botForm = bot.page.locator('form[data-form="contact"]');
  await botForm.waitFor();
  await bot.page.waitForTimeout(1600);
  await fill(botForm);
  await bot.page.evaluate(() => {
    const trap = document.querySelector('form[data-form="contact"] input[name="website"]');
    trap.value = "https://spam.example";
  });
  await submit(botForm);
  check("bot: the visitor-facing answer is the normal success", await visibleSoon(success(bot.page)));
  await bot.context.close();

  /* ---------- Rate limit (FORMS_RATE_LIMIT_MAX=2): the 3rd Contact attempt from this client ---------- */
  const r = await open("/contact");
  const rForm = r.page.locator('form[data-form="contact"]');
  await rForm.waitFor();
  await r.page.waitForTimeout(1600);
  await fill(rForm);
  await submit(rForm);
  check("rate limit: the form says to wait and try again", await visibleSoon(r.page.getByText("There have been too many attempts to send this form.")));
  await r.context.close();

  /* ---------- Volunteer and Partner ---------- */
  for (const [formId, path, organization] of [["volunteer", "/get-involved/volunteer", false], ["partner", "/get-involved/partner", true]]) {
    const p = await open(path);
    const form = p.page.locator(`form[data-form="${formId}"]`);
    check(`${formId}: the form is drawn`, await visibleSoon(form));
    await axe(p.page, `form[data-form="${formId}"]`, `${formId} form`);
    await p.page.waitForTimeout(1600);
    await fill(form, { organization });
    await submit(form);
    check(`${formId}: success message`, await visibleSoon(success(p.page)));
    await p.context.close();
  }

  /* ---------- Travel: no endpoint configured → no form ---------- */
  const t = await open("/get-involved/travel");
  await t.page.locator("h1").first().waitFor();
  check("travel: no endpoint → the form is not drawn", (await t.page.locator('form[data-form="travel"]').count()) === 0);
  await t.context.close();

  /* ---------- Mobile ---------- */
  for (const path of ["/contact", "/get-involved/volunteer"]) {
    const m = await open(path, { width: 375, height: 812 });
    await m.page.locator("form[data-form]").first().waitFor();
    check(`375px: no horizontal scroll (${path})`, await noHorizontalScroll(m.page));
    await axe(m.page, "form[data-form]", `${path} form at 375px`);
    await m.context.close();
  }

  /* ---------- What the API did (its audit trail, this run only) ---------- */
  const mine = (await outcomes()).slice(start);
  const count = (form, outcome) => mine.filter((o) => o.form === form && o.outcome === outcome).length;
  check("API: contact delivered once, the bot discarded, the 3rd attempt rate-limited", count("contact", "delivered") === 1 && count("contact", "spam_discarded") === 1 && count("contact", "rate_limited") === 1, JSON.stringify(mine));
  check("API: volunteer and partner delivered", count("volunteer", "delivered") === 1 && count("partner", "delivered") === 1, JSON.stringify(mine));
  check("no real email: every delivery was in test mode", mine.length > 0 && mine.every((o) => o.mode === "test"), JSON.stringify(mine.map((o) => o.mode)));
  check("no newsletter or travel submission reached the API", !mine.some((o) => o.form === "newsletter" || o.form === "travel"));

  const posts = requests.filter((q) => q.method === "POST" && q.url.includes("/forms/"));
  check("forms post to the API (/api/v1/forms/<id>)", posts.length >= 5 && posts.every((q) => /\/api\/v1\/forms\/(contact|volunteer|partner)$/.test(new URL(q.url).pathname)), posts.map((q) => new URL(q.url).pathname).join(" "));
  check("nothing typed ever appears in a URL", !requests.some((q) => typed.some((v) => decodeURIComponent(q.url).includes(v))));
  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
} catch (error) {
  check("flow completed", false, error.message.split("\n")[0]);
} finally {
  await browser.close();
  await client.close();
}

for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.ok || !r.detail ? "" : `  [${r.detail}]`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
