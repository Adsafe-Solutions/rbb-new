/* Browser smoke test of the admin shell and design system, against a
   running DEV admin (the /design-system preview exists only in dev) and
   the API behind it:

     ADMIN_URL=http://localhost:5174 ADMIN_SMOKE_EMAIL=… ADMIN_SMOKE_PASSWORD=… \
       npx -y -p playwright -p axe-core node scripts/smoke-ui.mjs

   Use an account in a LOCAL or test database; the password is never
   printed. Checks the three shell layouts (desktop, tablet rail, mobile
   drawer), keyboard behaviour (skip link, menu, dialog, tabs, tooltip),
   token contrast, reduced motion, no horizontal page scroll, fonts, and —
   when axe-core is available — an automated accessibility scan.
   SCREENSHOTS=<dir> saves a screenshot per layout. Exits 1 on any failure. */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { pathToFileURL } from "node:url";

/* Resolve a package from this directory or from an `npx -p` install. */
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
  console.error("Needs Playwright: npx -y -p playwright -p axe-core node scripts/smoke-ui.mjs");
  process.exit(1);
}
const playwright = await import(pathToFileURL(playwrightPath).href).then((m) => (m.chromium ? m : m.default));
const axePath = resolveFromPath("axe-core/axe.min.js");
const axeSource = axePath ? readFileSync(axePath, "utf8") : null;

const base = process.env.ADMIN_URL ?? "http://localhost:5174";
const email = process.env.ADMIN_SMOKE_EMAIL;
const password = process.env.ADMIN_SMOKE_PASSWORD;
const shots = process.env.SCREENSHOTS;
if (!email || !password) {
  console.error("Set ADMIN_SMOKE_EMAIL and ADMIN_SMOKE_PASSWORD (a local/test account).");
  process.exit(1);
}

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail });
const browser = await playwright.chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && !/401/.test(m.text()) && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(e.message));

const box = (selector) => page.locator(selector).first().boundingBox();
const focused = () => page.evaluate(() => ({ tag: document.activeElement?.tagName, text: document.activeElement?.textContent?.trim(), label: document.activeElement?.getAttribute("aria-label"), role: document.activeElement?.getAttribute("role") }));
const noHorizontalScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const visibleSoon = (locator, timeout = 2000) => locator.waitFor({ state: "visible", timeout }).then(() => true, () => false);
const shot = async (name) => shots && page.screenshot({ path: join(shots, `${name}.png`) });

async function axe(name) {
  if (!axeSource) return;
  await page.evaluate(axeSource);
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, { resultTypes: ["violations"] });
    return result.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s) — ${v.nodes[0]?.target?.join(" ")}`);
  });
  check(`axe: no violations on ${name}`, violations.length === 0, violations.join(" | "));
}

try {
  // Sign in.
  await page.goto(`${base}/login`);
  await page.getByRole("heading", { level: 1 }).waitFor();
  await axe("sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByTestId("user-role").waitFor();
  await page.evaluate(() => document.fonts.ready);

  // Fonts and brand.
  const type = await page.evaluate(() => ({
    sans: getComputedStyle(document.body).fontFamily,
    sansLoaded: document.fonts.check("14px 'Geist Variable'"),
    monoLoaded: document.fonts.check("13px 'Geist Mono Variable'"),
    theme: document.documentElement.dataset.theme,
    primary: getComputedStyle(document.documentElement).getPropertyValue("--brand-primary").trim(),
    title: document.title,
  }));
  check("Geist Sans is the body font and loaded", type.sans.startsWith('"Geist Variable"') && type.sansLoaded, type.sans);
  check("Geist Mono loaded", type.monoLoaded);
  check("light theme applied from the theme config", type.theme === "light" && type.primary.toUpperCase() === "#10437C", `${type.theme} ${type.primary}`);
  check("document title uses the product name", type.title === "Dashboard · RBB Studio", type.title);

  // Desktop: expanded sidebar.
  const sidebar = await box("#admin-sidebar");
  check("desktop: sidebar expanded (240–256px)", sidebar && sidebar.width >= 240 && sidebar.width <= 256, `${sidebar?.width}px`);
  const topbar = await box("header");
  check("topbar height 56–64px", topbar && topbar.height >= 56 && topbar.height <= 64, `${topbar?.height}px`);
  check("Dashboard is the current nav item", (await page.locator('a[aria-current="page"]').getAttribute("data-nav-item")) === "dashboard");
  const planned = await page.locator("[data-planned]").count();
  const plannedLinks = await page.locator("a[data-planned]").count();
  check("future modules are shown but are not links", planned === 2 && plannedLinks === 0, `${planned} planned, ${plannedLinks} links`);
  for (const section of ["Main", "Content", "Engagement", "System"]) {
    check(`nav section "${section}" present`, await page.getByRole("heading", { level: 2, name: section, exact: true }).count());
  }
  check("no horizontal scroll (1440)", await noHorizontalScroll());
  await shot("desktop-dashboard");
  await axe("dashboard");

  // Skip link.
  await page.goto(`${base}/`);
  await page.getByTestId("user-role").waitFor();
  await page.keyboard.press("Tab");
  check("first Tab reaches the skip link", (await focused()).text === "Skip to content");
  await page.keyboard.press("Enter");
  check("skip link moves focus to the main content", (await page.evaluate(() => document.activeElement?.id)) === "main-content");

  // Placeholders: focusable, inert, explained.
  const search = page.getByRole("button", { name: "Search" });
  check("search placeholder is aria-disabled", (await search.getAttribute("aria-disabled")) === "true");
  await search.focus();
  await page.keyboard.press("Enter");
  check("placeholder does nothing when activated", new URL(page.url()).pathname === "/");
  const searchTip = page.getByRole("tooltip", { name: "Search is not available yet" });
  check("tooltip opens on keyboard focus", await visibleSoon(searchTip));
  await page.keyboard.press("Escape");
  check("Escape hides the tooltip", await searchTip.waitFor({ state: "hidden", timeout: 2000 }).then(() => true, () => false));

  // Collapse to the rail and back.
  const toggle = page.getByRole("button", { name: "Collapse sidebar" });
  await toggle.click();
  const rail = await box("#admin-sidebar");
  check("desktop: toggle collapses to the rail", rail && rail.width <= 64, `${rail?.width}px`);
  await page.locator('a[data-nav-item="dashboard"]').hover();
  // Rail tooltips repeat the link's own name, so they are aria-hidden: find them by text.
  check("rail: hovering an item shows its name", await visibleSoon(page.locator('[role="tooltip"]', { hasText: /^Dashboard$/ })));
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  check("desktop: toggle expands again", ((await box("#admin-sidebar"))?.width ?? 0) >= 240);

  // Account menu by keyboard.
  const account = page.getByRole("button", { name: /^Account:/ });
  await account.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu");
  await menu.waitFor();
  check("account menu opens from the keyboard", (await account.getAttribute("aria-expanded")) === "true");
  check("focus moves into the menu", (await focused()).role === "menuitem");
  await page.keyboard.press("Escape");
  check("Escape closes the menu", (await menu.count()) === 0);
  check("focus returns to the menu button", ((await focused()).text ?? "").includes("Account:"));

  // Tablet: rail by default, expandable.
  await page.setViewportSize({ width: 900, height: 1000 });
  await page.waitForTimeout(150);
  check("tablet: sidebar is a rail", ((await box("#admin-sidebar"))?.width ?? 999) <= 64);
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  check("tablet: toggle expands it", ((await box("#admin-sidebar"))?.width ?? 0) >= 240);
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  check("no horizontal scroll (900)", await noHorizontalScroll());
  await shot("tablet-dashboard");

  // Mobile: drawer.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(150);
  check("mobile: no persistent sidebar", (await page.locator("#admin-sidebar").count()) === 0);
  const opener = page.getByRole("button", { name: "Open navigation" });
  await opener.click();
  const drawer = page.getByRole("dialog", { name: "Navigation" });
  await drawer.waitFor();
  check("mobile: drawer opens as a modal dialog", await page.evaluate(() => document.querySelector("#admin-drawer")?.matches(":modal")));
  check("mobile: focus is inside the drawer", await page.evaluate(() => document.querySelector("#admin-drawer")?.contains(document.activeElement)));
  await shot("mobile-drawer");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  check("mobile: Escape closes the drawer", !(await drawer.isVisible()));
  check("mobile: focus returns to the menu button", (await focused()).label === "Open navigation");
  await opener.click();
  await page.locator('#admin-drawer a[data-nav-item="design-system"]').click();
  await page.getByRole("heading", { level: 1, name: "Design system" }).waitFor();
  check("mobile: following a link closes the drawer", !(await page.getByRole("dialog", { name: "Navigation" }).isVisible()));
  check("no horizontal scroll on the design system page (375)", await noHorizontalScroll());

  // Design-system route (desktop).
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${base}/design-system`);
  await page.getByRole("heading", { level: 1, name: "Design system" }).waitFor();
  check("design system: nav item is current", (await page.locator('a[aria-current="page"]').getAttribute("data-nav-item")) === "design-system");
  const contrast = await page.locator("[data-contrast-ok]").evaluateAll((rows) => ({ total: rows.length, failing: rows.filter((r) => r.dataset.contrastOk !== "true").map((r) => r.textContent) }));
  check("design system: every token contrast pair passes", contrast.total > 20 && contrast.failing.length === 0, `${contrast.total} pairs; failing: ${contrast.failing.join(" | ")}`);
  check("design system: all eight statuses have icon + word", (await page.locator("[data-status]").evaluateAll((els) => els.filter((e) => e.querySelector("svg") && e.textContent.trim()).length)) >= 8);

  // Tabs.
  const general = page.getByRole("tab", { name: "General" });
  await general.focus();
  await page.keyboard.press("ArrowRight");
  check("tabs: ArrowRight selects the next tab", (await page.getByRole("tab", { name: "Content" }).getAttribute("aria-selected")) === "true");
  await page.keyboard.press("End");
  check("tabs: End skips the disabled tab", (await page.getByRole("tab", { name: "Search", exact: true }).getAttribute("aria-selected")) === "true");
  await page.keyboard.press("ArrowRight");
  check("tabs: ArrowRight wraps to the first", (await general.getAttribute("aria-selected")) === "true");

  // Dialog.
  const openForm = page.getByRole("button", { name: "Open form dialog" });
  await openForm.click();
  const dialog = page.getByRole("dialog", { name: "Rename example" });
  await dialog.waitFor();
  check("dialog: focus starts in its field", (await page.evaluate(() => document.activeElement?.tagName)) === "INPUT");
  for (let i = 0; i < 6; i++) await page.keyboard.press("Tab");
  check("dialog: Tab stays inside the dialog", await page.evaluate(() => Boolean(document.activeElement?.closest("dialog[open]")) || document.activeElement === document.body));
  check("dialog: page behind does not scroll", (await page.evaluate(() => getComputedStyle(document.documentElement).overflow)) === "hidden");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  check("dialog: Escape closes it", !(await dialog.isVisible()));
  check("dialog: focus returns to the opener", (await focused()).text === "Open form dialog");

  // Menu: arrows, disabled items skipped, destructive opens confirmation.
  await page.getByRole("button", { name: "Actions", exact: true }).focus();
  await page.keyboard.press("ArrowDown");
  await page.getByRole("menu").waitFor();
  check("menu: ArrowDown on the trigger focuses the first item", (await focused()).text === "Edit");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  check("menu: disabled items are skipped", (await focused()).text === "Delete");
  await page.keyboard.press("Enter");
  const confirm = page.getByRole("dialog", { name: "Delete example?" });
  await confirm.waitFor();
  check("menu: Enter activates the item", await confirm.isVisible());
  check("confirmation: first focus is Cancel, not Delete", (await focused()).text === "Cancel");
  await page.keyboard.press("Enter");

  // Toast.
  await page.getByRole("button", { name: "Success", exact: true }).click();
  const toast = page.getByRole("region", { name: "Notifications" });
  await toast.getByText("Example saved").waitFor();
  check("toast: shown", await toast.isVisible());
  check("toast: announced through a live region", await page.evaluate(() => [...document.querySelectorAll('[aria-live="polite"]')].some((el) => el.textContent.includes("Example saved"))));
  await toast.getByRole("button", { name: /Dismiss notification/ }).click();
  check("toast: dismissible", (await toast.getByText("Example saved").count()) === 0);

  // Table states.
  await page.getByRole("switch", { name: "Loading" }).check();
  check("table: loading state marks the table busy", (await page.locator('table[aria-busy="true"]').count()) === 1);
  await page.getByRole("switch", { name: "Loading" }).uncheck();
  await page.getByRole("switch", { name: "Empty" }).check();
  check("table: empty state", await page.getByRole("heading", { name: "No items yet" }).isVisible());
  await page.getByRole("switch", { name: "Empty" }).uncheck();
  const wide = await page.getByRole("region", { name: "Wide example (scrolls horizontally)" }).evaluate((el) => ({ scrolls: el.scrollWidth > el.clientWidth, focusable: el.tabIndex === 0 }));
  check("table: wide tables scroll inside a focusable frame", wide.scrolls && wide.focusable);
  await shot("desktop-design-system");
  await axe("design system");

  // Dark theme switch (architecture only).
  await page.getByRole("switch", { name: "Dark theme" }).check();
  check("dark theme switches via [data-theme]", (await page.evaluate(() => document.documentElement.dataset.theme)) === "dark");
  await page.getByRole("switch", { name: "Dark theme" }).uncheck();

  // Reduced motion.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const duration = await page.evaluate(() => getComputedStyle(document.querySelector("button")).transitionDuration);
  check("reduced motion: transitions are off", duration.split(",").every((d) => parseFloat(d) < 0.001), duration);
  await page.emulateMedia({ reducedMotion: "no-preference" });

  // Unknown route.
  await page.goto(`${base}/no-such-page`);
  check("unknown path shows Page not found inside the shell", await visibleSoon(page.getByRole("heading", { level: 1, name: "Page not found" }), 5000));

  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
  if (!axeSource) console.log("(axe-core not found: accessibility scan skipped)");
} catch (error) {
  check("flow completed", false, error.message.split("\n")[0]);
} finally {
  await browser.close();
}

for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.ok || !r.detail ? "" : `  [${r.detail}]`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
