import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_FORMS, FormDefinition, PublishedSnapshot, newCareerForm } from "../index.ts";
import * as fx from "../test/fixtures.ts";

/* Website forms saved in the admin (2026-10-13). Test data only. */

const issues = (value: unknown) => {
  const r = FormDefinition.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};
const org = fx.settings().orgId;

test("the built-in defaults and a new career form are valid definitions", () => {
  for (const d of Object.values(DEFAULT_FORMS)) assert.deepEqual(issues({ ...d, orgId: org }), [], d.id);
  assert.deepEqual(issues({ ...newCareerForm("programme-officer", "Programme Officer"), orgId: org }), []);
});

test("a definition keeps name and email, matches its kind, uses files only on career forms, and lists dropdown options", () => {
  const c = { ...DEFAULT_FORMS.contact, orgId: org };
  for (const [name, value] of [
    ["no email", { ...c, fields: c.fields.filter((f) => f.id !== "email") }],
    ["optional name", { ...c, fields: c.fields.map((f) => (f.id === "name" ? { ...f, required: false } : f)) }],
    ["id not its kind", { ...c, id: "volunteer" }],
    ["a role on a built-in form", { ...c, roleId: "x" }],
    ["file on contact", { ...c, fields: [...c.fields, { id: "cv", type: "file", label: "CV", required: false }] }],
    ["dropdown without options", { ...c, fields: [...c.fields, { id: "pick", type: "select", label: "Pick", required: false }] }],
    ["options on text", { ...c, fields: [...c.fields, { id: "t", type: "text", label: "T", required: false, options: ["a"] }] }],
    ["duplicate field id", { ...c, fields: [...c.fields, { id: "topic", type: "text", label: "Again", required: false }] }],
    ["HTML label", { ...c, fields: [...c.fields, { id: "t", type: "text", label: "<b>x</b>", required: false }] }],
    ["too long", { ...c, fields: [...c.fields, { id: "t", type: "text", label: "T", required: false, maxLength: 900 }] }],
    ["four files", { ...newCareerForm("r", "R"), orgId: org, fields: [...newCareerForm("r", "R").fields, ...[1, 2, 3].map((i) => ({ id: `f${i}`, type: "file", label: "F", required: false }))] }],
    ["career id without its role", { ...newCareerForm("r", "R"), orgId: org, id: "career-other" }],
    ["a recipient (never public)", { ...c, recipient: "x@example.org" }],
  ] as const)
    assert.ok(issues(value).length > 0, name);
});

test("snapshot: content.forms of this organization, each form once", () => {
  const snapshot = (forms: unknown[]) => ({ version: 1, schemaVersion: 1, generatedAt: "2026-10-13T10:00:00.000Z", organization: { id: org }, settings: { ...fx.settings(), status: "published" }, media: {}, content: { forms } });
  const c = { ...DEFAULT_FORMS.contact, orgId: org };
  assert.ok(PublishedSnapshot.safeParse(snapshot([c])).success);
  assert.ok(!PublishedSnapshot.safeParse(snapshot([c, c])).success, "twice");
  assert.ok(!PublishedSnapshot.safeParse(snapshot([{ ...c, orgId: "other" }])).success, "other org");
});
