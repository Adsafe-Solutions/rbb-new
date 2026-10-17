import { test } from "node:test";
import assert from "node:assert/strict";
import { COUNTRY_NAMES, validateSubmission } from "@rbb/forms";
import { DEFAULT_FORMS, FormDefinition } from "@rbb/content-schema";
import { COUNTRIES } from "@rbb/content-schema/countries";
import { validateAgainstDefinition } from "../src/modules/forms/definition.ts";
import { notification } from "../src/modules/forms/templates.ts";

/* Country (2026-10-17, RBB's request): the Volunteer form asks where the
   person is — a required choice from ONE shared list of country names,
   which the browser, the website server and the API all read
   (@rbb/forms COUNTRY_NAMES), and which a form saved in the admin can
   carry too (field type "country"). */

const body = (fields: Record<string, unknown>) => ({ formId: "volunteer", fields: { name: "Asha", email: "asha@example.org", message: "Weekends.", ...fields }, website: "", elapsedMs: 5000, antiSpamToken: null });

test("one country list: the forms' names are the content contract's, in order", () => {
  assert.deepEqual([...COUNTRY_NAMES], COUNTRIES.map((c) => c.name));
  assert.equal(new Set(COUNTRY_NAMES).size, COUNTRY_NAMES.length);
});

test("the built-in Volunteer form requires a country from the list", () => {
  assert.deepEqual(validateSubmission(body({})), { ok: false, status: 422, error: "invalid", fields: { country: "required" } });
  assert.deepEqual(validateSubmission(body({ country: "Narnia" })), { ok: false, status: 422, error: "invalid", fields: { country: "invalid" } });
  const ok = validateSubmission(body({ country: "India" }));
  assert.equal(ok.ok, true);
  assert.equal((ok as { data: Record<string, unknown> }).data.country, "India");
});

test("a form saved in the admin with a country field: one of the list's names, required when it says so", () => {
  const form = FormDefinition.parse({ ...DEFAULT_FORMS.volunteer, orgId: "org-a" });
  assert.equal(form.fields.find((f) => f.id === "country")?.type, "country", "the admin's starting point keeps the country");
  const check = (country: unknown) => validateAgainstDefinition(form, body({ country }));
  assert.deepEqual(check(undefined), { ok: false, status: 422, fields: { country: "required" } });
  assert.deepEqual(check("Atlantis"), { ok: false, status: 422, fields: { country: "invalid" } });
  const ok = check("Côte d'Ivoire");
  assert.equal(ok.ok && ok.data.country, "Côte d'Ivoire");
});

test("RBB's Volunteer email shows the country", () => {
  const email = notification("volunteer", { name: "Asha", email: "asha@example.org", message: "Weekends.", country: "India" }, { reference: "RBB-TEST", submittedAt: "2026-10-17 10:00" });
  assert.match(email.text, /^Country: India$/m);
  assert.match(email.html, />Country<\/td><td[^>]*>India<\/td>/);
});
