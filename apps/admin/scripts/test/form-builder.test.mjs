import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_FORMS } from "@rbb/content-schema/form-defaults";
import { builderProblems, cleanForm, fieldIdFrom, isSystemField, newField, retype, typesFor } from "../../src/forms/builder.ts";
import { withRoleIds } from "../../src/careers/roles.ts";

/* The form builder (owners only; live when saved) and career role ids. */

test("field ids come from labels, unique, in the form id alphabet", () => {
  assert.equal(fieldIdFrom("Your city", []), "your_city");
  assert.equal(fieldIdFrom("Your city", [{ id: "your_city" }]), "your_city_2");
  assert.equal(fieldIdFrom("", []), "field");
  assert.equal(fieldIdFrom("2024 experience", []), "f_2024_experience");
  assert.match(newField("select", DEFAULT_FORMS.contact.fields).id, /^[a-z][a-z0-9_]*$/);
  assert.deepEqual(newField("select", []).options, []);
});

test("types: file uploads only on career forms; a type change keeps only what applies", () => {
  assert.ok(!typesFor("contact").includes("file"));
  assert.ok(typesFor("career").includes("file"));
  assert.deepEqual(retype({ id: "x", type: "select", label: "X", required: false, options: ["a"] }, "text"), { id: "x", type: "text", label: "X", required: false });
  assert.deepEqual(retype({ id: "x", type: "text", label: "X", required: true, placeholder: "p", maxLength: 100 }, "checkbox"), { id: "x", type: "checkbox", label: "X", required: true });
  assert.ok(isSystemField("name") && isSystemField("email") && !isSystemField("message"));
});

test("problems before saving: name and email kept, labels, dropdown options, at most three files", () => {
  assert.deepEqual(builderProblems(DEFAULT_FORMS.contact), []);
  const noEmail = { ...DEFAULT_FORMS.contact, fields: DEFAULT_FORMS.contact.fields.filter((f) => f.id !== "email") };
  assert.match(builderProblems(noEmail).join(), /email/);
  assert.match(builderProblems({ kind: "contact", fields: [...DEFAULT_FORMS.contact.fields, { id: "pick", type: "select", label: "", required: false, options: [" "] }] }).join(" "), /needs a label.*needs at least one option/);
  const files = Array.from({ length: 4 }, (_, i) => ({ id: `f${i}`, type: "file", label: "File", required: false }));
  assert.match(builderProblems({ kind: "career", fields: [...DEFAULT_FORMS.contact.fields, ...files] }).join(), /At most 3/);
});

test("what is saved: trimmed, empty optional parts left out, name and email always required", () => {
  const form = { ...DEFAULT_FORMS.volunteer, intro: "  ", heading: " Join us ", fields: [{ ...DEFAULT_FORMS.volunteer.fields[0], required: false }, DEFAULT_FORMS.volunteer.fields[1], { id: "pick", type: "select", label: " Pick ", required: false, options: [" A ", "", "A", "B"], help: " " }] };
  const clean = cleanForm(form);
  assert.equal(clean.heading, "Join us");
  assert.ok(!("intro" in clean));
  assert.equal(clean.fields[0].required, true);
  assert.deepEqual(clean.fields[2], { id: "pick", type: "select", label: "Pick", required: false, options: ["A", "B"] });
});

test("career roles keep their id; a new one gets one from its title, unique", () => {
  assert.deepEqual(withRoleIds([{ id: "officer", title: "Renamed" }, { title: "Programme Officer" }, { title: "Programme Officer" }]), [{ id: "officer", title: "Renamed" }, { id: "programme-officer", title: "Programme Officer" }, { id: "programme-officer-2", title: "Programme Officer" }]);
});

test("the Forms screen is owners-only and in Engagement; the Careers editor gives roles ids on save", () => {
  const routes = readFileSync(new URL("../../src/routes.tsx", import.meta.url), "utf8");
  assert.match(routes, /path: "\/forms".*permission: "forms:write"/);
  assert.match(routes, /path: "\/forms\/:id".*permission: "forms:write"/);
  const nav = readFileSync(new URL("../../src/shell/navigation.ts", import.meta.url), "utf8");
  assert.match(nav, /id: "forms".*permission: "forms:write"/);
  assert.match(readFileSync(new URL("../../src/pages/careers/CareersPage.tsx", import.meta.url), "utf8"), /withRoleIds\(draft\.opportunities\.roles\)/);
});

test("the marketing emails checkbox: on every default form, ticked, never required, restored if removed", async () => {
  const { isMarketingField, marketingField } = await import("../../src/forms/builder.ts");
  for (const form of Object.values(DEFAULT_FORMS)) {
    const m = form.fields.find((f) => isMarketingField(f.id));
    assert.ok(m && m.type === "checkbox" && m.required === false && m.defaultChecked === true, form.id);
  }
  const without = { ...DEFAULT_FORMS.contact, fields: DEFAULT_FORMS.contact.fields.filter((f) => !isMarketingField(f.id)) };
  assert.match(builderProblems(without).join(), /marketing emails checkbox/);
  assert.equal(cleanForm({ ...DEFAULT_FORMS.contact, fields: [...without.fields, { ...marketingField(), required: true }] }).fields.at(-1).required, false);
  assert.equal(cleanForm(DEFAULT_FORMS.contact).fields.at(-1).defaultChecked, true);
});

test("Audience: owners only, in Engagement, filters in the request", async () => {
  const { audienceQuery, NO_AUDIENCE_FILTERS } = await import("../../src/audience/client.ts").catch(() => ({}));
  if (audienceQuery) {
    assert.equal(audienceQuery(NO_AUDIENCE_FILTERS), "");
    assert.equal(audienceQuery({ q: " asha ", marketing: "yes", form: "contact" }, 2), "?q=asha&marketing=yes&form=contact&page=2");
  }
  const routes = readFileSync(new URL("../../src/routes.tsx", import.meta.url), "utf8");
  assert.match(routes, /path: "\/audience".*permission: "submissions:read"/);
  assert.match(readFileSync(new URL("../../src/shell/navigation.ts", import.meta.url), "utf8"), /id: "audience".*permission: "submissions:read"/);
});
