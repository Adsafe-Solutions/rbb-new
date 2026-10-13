import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/* Settings → General: the country selection. The same selector as Where
   We Work, saved as the settings' `countries` (never published). Read as
   source: the page is React. */

const read = (path) => readFileSync(new URL(`../../src/${path}`, import.meta.url), "utf8");

test("the General tab shows the country selector; no new tab or sidebar section", () => {
  const page = read("pages/settings/SettingsPage.tsx");
  assert.match(page, /type EditableKey = "general" \| "contact" \| "social" \| "seo";/, "the four tabs, unchanged");
  assert.match(page, /countries: "general"/, "countries are General's");
  assert.match(page, /<CountriesField\s/);
  assert.match(page, /value=\{draft\.countries \?\? \[\]\}/, "empty unless saved");
  const sections = read("pages/settings/sections.tsx");
  assert.match(sections, /import \{ CountryPicker \} from "\.\.\/\.\.\/impact\/CountryPicker";/, "the Where We Work selector, reused");
  assert.match(sections, /max=\{249\}/);
  assert.match(sections, /not published and the website does not show it/);
  assert.ok(!/Branding|Analytics|Donations|Features/.test(sections.replace(/\/\*[\s\S]*?\*\//g, "")), "no retired section returns");
});

test("the selector is a dropdown: a button that opens a searchable list, closed by Escape, a click outside or Done", () => {
  const picker = read("impact/CountryPicker.tsx");
  assert.match(picker, /aria-expanded=\{open\}/);
  assert.match(picker, /Select countries/);
  assert.match(picker, /e\.key === "Escape"/);
  assert.match(picker, /pointerdown/);
  assert.match(picker, /placeholder="Search countries"/);
});

test("saved through the settings API as `countries`", () => {
  assert.match(read("settings/client.ts"), /export type SectionKey = .*"countries"/);
});
