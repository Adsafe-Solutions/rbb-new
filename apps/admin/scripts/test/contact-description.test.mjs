import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SiteSettings } from "../../../../packages/content-schema/src/index.ts";
import { settings as settingsFixture } from "../../../../packages/content-schema/src/test/fixtures.ts";
import { overridesFrom } from "../../../web/scripts/snapshot-adapter.mjs";

/* Settings → Contact: each contact method's Description (#12). The field
   already existed in the contract and on the website's Contact page; the
   admin form had no input for it. Its data flow, end to end, without a
   database: form → save (the whole contact section) → contract → publish
   → web adapter → the Contact page's tile note. */

const form = readFileSync(new URL("../../src/pages/settings/sections.tsx", import.meta.url), "utf8");
const method = (o = {}) => ({ id: "general", type: "email", label: "General inquiries", value: "hello@rbb.test", ...o });

test("the form: a Description input per method — loads the saved value, edits the method, empty clears it, errors by path", () => {
  assert.match(form, /<FormField label="Description"[^>]*error=\{errorFor\(`methods\.\$\{i\}\.description`\)\}/);
  assert.match(form, /maxLength=\{300\} value=\{method\.description \?\? ""\}/, "the saved value is shown");
  assert.match(form, /setMethod\(i, \{ \.\.\.method, description: orUndefined\(e\.target\.value\) \}\)/, "an edit keeps the method's other fields; an empty box removes the description");
  assert.equal((form.match(/label="Description"/g) ?? []).length, 1, "one field, not a duplicate");
});

test("the contract the save is checked against: a description up to 300 characters, optional", () => {
  const base = settingsFixture();
  const ok = (methods) => SiteSettings.safeParse({ ...base, contact: { ...base.contact, methods } });
  assert.ok(ok([method()]).success, "without one");
  assert.ok(ok([method({ description: "For questions about volunteering." })]).success, "with one");
  const long = ok([method({ description: "x".repeat(301) })]);
  assert.ok(!long.success && long.error.issues.some((i) => i.path.join(".") === "contact.methods.0.description"), "over 300: refused, by path");
});

test("published: the website receives it on the method, and the Contact page draws it as the tile's note", () => {
  const snapshot = { version: 1, schemaVersion: 1, generatedAt: "2026-10-13T00:00:00.000Z", organization: { id: "rbb" }, media: {}, content: {}, settings: { general: { shortName: "RBB", name: "Rising Beyond Borders", summary: "A summary." }, contact: { methods: [method({ description: "For questions about volunteering." })] }, social: [], seo: { description: "A description." } } };
  const methods = overridesFrom(snapshot)["src/content/contact.js"].ORG_CONTACT.methods;
  assert.equal(methods[0].description, "For questions about volunteering.");
  const tiles = readFileSync(new URL("../../../web/src/components/ContactMethods/ContactMethods.jsx", import.meta.url), "utf8");
  assert.match(tiles, /note: method\.description/);
});
