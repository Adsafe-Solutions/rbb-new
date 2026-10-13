import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

/* D35 (2026-10-13): the four unused legacy giving pages are retired.
   /giving, /gifts and /giving/major-giving forward to Donate (/appeals);
   /giving/zakat gets the not-found page (Donate would imply Zakat-specific
   giving). Read as text: the route modules load the site's content. */

const web = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, web), "utf8");

test("the three general giving addresses forward to Donate; Zakat is not forwarded", () => {
  const routes = read("src/config/routes.js");
  for (const from of ["/giving", "/gifts", "/giving/major-giving"]) assert.match(routes, new RegExp(`"${from}": "/appeals",`), from);
  assert.ok(!/"\/giving\/zakat":/.test(routes), "no redirect for /giving/zakat");
  assert.ok(!routes.includes("LEGACY_PATHS"), "no legacy route list");
});

test("no page, route, content or component of the retired pages remains", () => {
  for (const path of ["src/pages/Giving", "src/pages/Gifts", "src/pages/Zakat", "src/content/giving.js", "src/content/gifts.js", "src/content/zakat.js", "src/components/DonationAction", "src/components/BannerHero"])
    assert.ok(!existsSync(new URL(path, web)), path);
  const app = read("src/App.jsx");
  assert.ok(!/pages\/(Giving|Gifts|Zakat)\//.test(app) && !app.includes("LEGACY_PAGES"));
  assert.ok(!read("src/entry-server.jsx").includes("LEGACY_PATHS"));
  assert.ok(!/"\/giving|"\/gifts/.test(read("src/content/site.js")) && !/"\/giving|"\/gifts/.test(read("src/content/seo.js")));
});

test("Donate, appeals and the Givebutter checkout are untouched by the retirement", () => {
  for (const path of ["src/pages/Appeals/Appeals.jsx", "src/components/DonationExperience/DonationExperience.jsx", "src/integrations/donations/DonationCheckout.jsx"]) assert.ok(existsSync(new URL(path, web)), path);
  assert.match(read("src/content/donation.js"), /givingMethods: \[\]/, "the Appeals page's giving methods stay");
});

test("D11: the rejected Listen → Partner → Act → Sustain framework is gone from the content", () => {
  for (const path of ["src/content/impact.js", "src/content/homepage.js", "src/content/index.js"]) {
    const text = read(path);
    assert.ok(!text.includes("approachSteps") && !/proposedFramework\s*:/.test(text), path);
  }
  assert.ok(!/"Listen", "Partner", "Act", "Sustain"/.test(read("src/content/impact.js")));
});
