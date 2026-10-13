import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { countryMatches, regionId, takenElsewhere, toggleCountry, unknownCountries } from "../../src/impact/geography.ts";
import { COUNTRY_NAMES } from "@rbb/content-schema/countries";
import { idFrom } from "../../src/blocks/ids.ts";

/* #5 / #6 — the Impact page's Our Approach and Where We Work blocks in the
   admin: a form for each, and the region ids the geography form keeps. */

const editor = readFileSync(new URL("../../src/impact/BlockEditor.tsx", import.meta.url), "utf8");

test("region ids follow the name, unique among the block's other regions", () => {
  assert.equal(regionId("East Africa", []), "east-africa");
  assert.equal(regionId("  Région Côte  ", []), "region-cote");
  assert.equal(regionId("East Africa", [{ id: "east-africa" }]), "east-africa-2");
  assert.equal(regionId("East Africa", [{ id: "east-africa" }, { id: "east-africa-2" }]), "east-africa-3");
  assert.equal(regionId("", []), "region");
  assert.equal(regionId("شرق", [{ id: "region" }]), "region-2");
  assert.match(regionId("x".repeat(300) + " y", []), /^[a-z0-9]+(-[a-z0-9]+)*$/);
  assert.equal(idFrom("", [], "passage"), "passage", "How We Work passages fall back to their own word");
  assert.equal(idFrom("Where the work starts", [{ id: "where-the-work-starts" }], "passage"), "where-the-work-starts-2");
});

test("How We Work (#7): an editor in Content, its links in publish problems, its section label", () => {
  const read = (path) => readFileSync(new URL(`../../src/${path}`, import.meta.url), "utf8");
  assert.match(read("routes.tsx"), /path: "\/how-we-work"/);
  assert.match(read("shell/navigation.ts"), /id: "how-we-work".*status: "available", href: "\/how-we-work"/);
  assert.match(read("settings/publishProblems.ts"), /howWeWork: \{ label: "How We Work page", href: "\/how-we-work" \}/);
  assert.match(read("pages/settings/PublishPanel.tsx"), /howWeWork: "How We Work page"/);
  assert.match(read("howWeWork/client.ts"), /"\/api\/v1\/how-we-work"/);
});

test("both blocks have a form and starting data; no words are supplied for them", () => {
  for (const type of ["approach", "geography"]) {
    assert.match(editor, new RegExp(`^  ${type}: \\(\\{ data, set, err, disabled \\}\\) =>`, "m"), `${type} form`);
    assert.match(editor, new RegExp(`case "${type}":`), `${type} starting data`);
  }
  assert.match(editor, /case "approach":\s*return \{ principles: \[\] \};/);
  assert.match(editor, /case "geography":\s*return \{ regions: \[\], countries: \[\] \};/);
});

test("the Impact page's preview lists the sub-page blocks apart from its chapters", () => {
  const page = readFileSync(new URL("../../src/pages/impact/ImpactPage.tsx", import.meta.url), "utf8");
  assert.match(page, /elsewhere: new Set\(IMPACT_BLOCK_INFO\.filter\(\(b\) => b\.page\)/);
});

test("D14 country selector: every country is an option; nothing is selected until chosen", () => {
  assert.equal(countryMatches("").length, COUNTRY_NAMES.length, "an empty search lists the whole list");
  assert.deepEqual(countryMatches("cote"), ["Côte d'Ivoire"], "accents and case ignored");
  assert.ok(countryMatches("guinea").includes("Papua New Guinea") && countryMatches("guinea").includes("Equatorial Guinea"));
  assert.deepEqual(countryMatches("atlantis"), []);
  /* Selection kept in the list's order, whatever order it was ticked in. */
  assert.deepEqual(toggleCountry(["Peru"], "Kenya", true), ["Kenya", "Peru"]);
  assert.deepEqual(toggleCountry(["Kenya", "Peru"], "Kenya", false), ["Peru"]);
  assert.deepEqual(toggleCountry(["Kenya"], "Kenya", true), ["Kenya"], "never twice");
  assert.deepEqual(unknownCountries(["Kenya", "Country A"]), ["Country A"]);
});

test("D14: a country already placed elsewhere in the block is not offered again", () => {
  const geo = { regions: [{ name: "East", countries: ["Kenya"] }, { name: "", countries: ["Peru"] }], countries: ["Chile"] };
  assert.deepEqual([...takenElsewhere(geo, 0)], [["Peru", "region 2"], ["Chile", "the countries not in a region"]]);
  assert.deepEqual([...takenElsewhere(geo, "ungrouped")], [["Kenya", "region “East”"], ["Peru", "region 2"]]);
});

test("D14: the geography form uses the country selector, starts empty, and has no map", () => {
  assert.match(editor, /<CountryPicker label=\{`Countries in region \$\{i \+ 1\}`\}/);
  assert.match(editor, /<CountryPicker label="Countries not in a region"/);
  assert.match(editor, /case "geography":\s*return \{ regions: \[\], countries: \[\] \};/);
  assert.ok(!/\bmap\b.*(latitude|longitude|leaflet|mapbox)/i.test(editor), "no map");
});
