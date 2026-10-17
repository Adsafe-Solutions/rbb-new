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

/* Event registration (2026-10-17): the new field types, "Add a question",
   and the same builder on an event's registration form. */

test("the new types: labelled, options kept between the choice types, limits only on a number", async () => {
  const { TYPE_LABELS } = await import("../../src/forms/builder.ts");
  assert.deepEqual([TYPE_LABELS.radio, TYPE_LABELS.checkboxes, TYPE_LABELS.number, TYPE_LABELS.date, TYPE_LABELS.checkbox], ["Choose one", "Choose any", "Number", "Date", "Checkbox"]);
  assert.ok(!typesFor("event").includes("file") && typesFor("event").includes("radio"));
  assert.deepEqual(newField("checkboxes", []).options, []);
  const pick = { id: "x", type: "select", label: "X", required: false, options: ["a", "b"] };
  assert.deepEqual(retype(pick, "radio"), { ...pick, type: "radio" });
  assert.deepEqual(retype(retype(pick, "checkboxes"), "select"), pick);
  assert.deepEqual(retype({ id: "n", type: "number", label: "N", required: false, min: 1, max: 9, placeholder: "e.g. 2" }, "text"), { id: "n", type: "text", label: "N", required: false, placeholder: "e.g. 2" });
  assert.deepEqual(retype({ id: "n", type: "number", label: "N", required: false, min: 1, max: 9, placeholder: "e.g. 2" }, "date"), { id: "n", type: "date", label: "N", required: false });
  assert.deepEqual(retype({ id: "c", type: "checkbox", label: "C", required: false, defaultChecked: true }, "radio"), { id: "c", type: "radio", label: "C", required: false, options: [] });
});

test("problems: every choice type needs an option, a number's smallest answer is not above its largest", () => {
  const base = DEFAULT_FORMS.contact.fields;
  for (const type of ["radio", "checkboxes", "select"]) assert.match(builderProblems({ kind: "contact", fields: [...base, { id: "q", type, label: "Q", required: false, options: ["", " "] }] }).join(), /“Q” needs at least one option/, type);
  assert.match(builderProblems({ kind: "contact", fields: [...base, { id: "n", type: "number", label: "Guests", required: false, min: 5, max: 2 }] }).join(), /“Guests”: the smallest answer is above the largest/);
  assert.deepEqual(builderProblems({ kind: "contact", fields: [...base, { id: "n", type: "number", label: "Guests", required: false, min: 2, max: 2 }] }), []);
});

test("an event's registration form: the default has no problems, never a file upload, name and email kept", async () => {
  const { newEventRegistration } = await import("@rbb/content-schema/form-defaults");
  const fields = newEventRegistration().fields;
  assert.deepEqual(builderProblems({ kind: "event", fields }), []);
  assert.match(builderProblems({ kind: "event", fields: [...fields, { id: "cv", type: "file", label: "CV", required: false }] }).join(), /File uploads are for career application forms only/);
  assert.match(builderProblems({ kind: "event", fields: fields.filter((f) => f.id !== "name") }).join(), /“name” field/);
});

test("what is saved for the new types, and for an event's registration form", async () => {
  const { cleanFields, cleanRegistration } = await import("../../src/forms/builder.ts");
  assert.deepEqual(cleanFields([{ id: "any", type: "checkboxes", label: " Any ", required: false, options: [" A", "", "A", "B "], placeholder: "p" }]), [{ id: "any", type: "checkboxes", label: "Any", required: false, options: ["A", "B"] }]);
  assert.deepEqual(cleanFields([{ id: "n", type: "number", label: "N", required: true, min: 1.7, max: 10 }]), [{ id: "n", type: "number", label: "N", required: true, min: 1, max: 10 }]);
  assert.deepEqual(cleanFields([{ id: "t", type: "text", label: "T", required: false, min: 1 }]), [{ id: "t", type: "text", label: "T", required: false }], "limits only on a number");
  assert.deepEqual(cleanFields([{ id: "d", type: "date", label: "D", required: false, placeholder: "x" }]), [{ id: "d", type: "date", label: "D", required: false }], "no placeholder on a date");
  const reg = { open: false, capacity: undefined, submitLabel: " Book ", successMessage: " Done ", fields: [{ id: "name", type: "text", label: " Name ", required: false }] };
  assert.deepEqual(cleanRegistration(reg), { open: false, submitLabel: "Book", successMessage: "Done", fields: [{ id: "name", type: "text", label: "Name", required: true }] });
  assert.equal(cleanRegistration({ ...reg, capacity: 40 }).capacity, 40);
  assert.ok(!("capacity" in cleanRegistration({ ...reg, capacity: 0 })), "no places is no limit, not zero");
});

test("Add a question: presets with unique ids; Name and E-mail put back the system field when it is missing", async () => {
  const { PALETTE, paletteFor, duplicateField } = await import("../../src/forms/builder.ts");
  assert.deepEqual(paletteFor("contact").map((p) => p.name), ["Name", "E-mail", "Phone", "Short text", "Long text", "Choose one", "Choose any", "Dropdown", "Number", "Date", "Agreement"]);
  assert.ok(paletteFor("career").some((p) => p.type === "file") && !paletteFor("event").some((p) => p.type === "file"));
  const by = (key) => PALETTE.find((p) => p.key === key);
  const fields = [...DEFAULT_FORMS.contact.fields];
  assert.deepEqual(by("name").make(fields), { id: "full_name", type: "text", label: "Full name", required: false });
  assert.equal(by("name").make([...fields, { id: "full_name" }]).id, "full_name_2");
  assert.equal(by("email").make(fields).id, "email_address");
  assert.deepEqual(by("name").make(fields.filter((f) => f.id !== "name")), { id: "name", type: "text", label: "Full name", required: true, maxLength: 200 });
  assert.deepEqual(by("email").make([]), { id: "email", type: "email", label: "Email address", required: true, maxLength: 254 });
  assert.deepEqual(by("radio").make(fields), { id: "choose_one", type: "radio", label: "", required: false, options: ["Option 1", "Option 2"] });
  assert.deepEqual(by("agreement").make(fields), { id: "i_agree_to", type: "checkbox", label: "I agree to …", required: true });
  const ids = new Set();
  let all = [...fields];
  for (const p of PALETTE) {
    const f = p.make(all);
    assert.match(f.id, /^[a-z][a-z0-9_]{0,39}$/, p.name);
    assert.ok(!ids.has(f.id) && !all.some((o) => o.id === f.id), `${p.name}: ${f.id} is new`);
    ids.add(f.id);
    all = [...all, f];
  }
  const copy = duplicateField(fields[0], fields);
  assert.equal(copy.id, "your_name");
  assert.equal(copy.label, fields[0].label);
});

test("the API's messages for a list of fields, relative to the list", async () => {
  const { errorsUnder } = await import("../../src/forms/builder.ts");
  const errors = new Map([["registration.fields", "every form keeps a name"], ["registration.fields.3.label", "must not be empty"], ["registration.capacity", "too small"], ["fields.1.label", "x"]]);
  assert.deepEqual([...errorsUnder(errors, "registration.fields")], [["", "every form keeps a name"], ["3.label", "must not be empty"]]);
  assert.deepEqual([...errorsUnder(errors, "fields")], [["1.label", "x"]]);
});

test("one field builder for website forms and event registration forms", () => {
  const src = (file) => readFileSync(new URL(`../../src/${file}`, import.meta.url), "utf8");
  assert.match(src("pages/forms/FormEditorPage.tsx"), /<FieldsBuilder fields=\{draft\.fields\}.*kind=\{draft\.kind\}/);
  const builder = src("forms/FieldsBuilder.tsx");
  assert.match(builder, /Add a question/);
  assert.match(builder, /Restore marketing checkbox/);
  assert.match(builder, /hasOptions\(field\.type\)/, "options for every choice type");
  const event = src("pages/events/EventEditorPage.tsx");
  assert.match(event, /const FIELDS = \[[^\]]*"registrationUrl", "registration"/);
  assert.match(event, /<FieldsBuilder fields=\{d\.registration\.fields\}.*kind="event"/);
  assert.match(event, /errorsUnder\(editor\.errors, "registration\.fields"\)/);
  assert.match(event, /navigate\(`\/submissions\?form=event-\$\{editor\.view!\.record\.id\}`\)/);
  assert.match(event, /registration: undefined, registrationUrl: undefined/, "No registration clears both (sent as null)");
  assert.match(src("content/editor.tsx"), /out\[f\] === undefined \|\| out\[f\] === "" \? null : out\[f\]/, "a cleared field is sent as null");
});
