import { z } from "zod";
import { IsoDateTime, OrgId, Slug, text } from "../common/primitives.ts";
import { BUILT_IN_FORM_IDS, DEFAULT_MAX_LENGTH, FORM_FIELD_TYPES, MARKETING_FIELD_ID, MAX_FILE_FIELDS } from "./defaults.ts";

/* A website form as edited in the admin (owners only; live when saved —
   owner decision, 2026-10-13): Contact Us, Volunteer, Partner With Us, and
   one application form per open role on the Careers page.

   A form is its words (heading, intro, button, messages) and its ordered
   fields. Every form keeps a `name` (text) and an `email` (email) field,
   required, so a submission can be answered. Dropdowns list their
   options; file fields (career forms only) take a PDF or Word document. */

export const FormFieldId = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, "must be lowercase letters, digits or _ (starting with a letter)");
export const FormId = z.string().regex(/^(contact|volunteer|partner|career-[a-z0-9]+(?:-[a-z0-9]+)*)$/, "must be contact, volunteer, partner or career-<role>");

export const FormField = z
  .strictObject({
    id: FormFieldId,
    type: z.enum(FORM_FIELD_TYPES),
    label: text(120),
    help: text(300).optional(),
    placeholder: text(120).optional(),
    required: z.boolean(),
    options: z.array(text(80)).min(1).max(30).optional(),
    maxLength: z.int().min(1).max(5000).optional(),
    defaultChecked: z.boolean().optional(),
  })
  .superRefine((f, ctx) => {
    if (f.type === "select" && !f.options) ctx.addIssue({ code: "custom", path: ["options"], message: "a dropdown needs at least one option" });
    if (f.type !== "select" && f.options) ctx.addIssue({ code: "custom", path: ["options"], message: "only a dropdown has options" });
    if (f.options && new Set(f.options).size !== f.options.length) ctx.addIssue({ code: "custom", path: ["options"], message: "each option once" });
    const limit = DEFAULT_MAX_LENGTH[f.type];
    if (f.maxLength !== undefined && (limit === undefined || f.maxLength > limit)) ctx.addIssue({ code: "custom", path: ["maxLength"], message: limit ? `at most ${limit}` : "this field type has no length" });
    if ((f.type === "checkbox" || f.type === "file" || f.type === "select") && f.placeholder) ctx.addIssue({ code: "custom", path: ["placeholder"], message: "this field type has no placeholder" });
    if (f.defaultChecked !== undefined && f.type !== "checkbox") ctx.addIssue({ code: "custom", path: ["defaultChecked"], message: "only a checkbox starts ticked" });
  });
export type FormField = z.infer<typeof FormField>;

export const FormDefinition = z
  .strictObject({
    id: FormId,
    orgId: OrgId,
    kind: z.enum([...BUILT_IN_FORM_IDS, "career"]),
    /* Career forms: the Careers page role it belongs to. */
    roleId: Slug.optional(),
    /* The form's name in the admin and in submissions. */
    title: text(120),
    heading: text(160),
    intro: text(600).optional(),
    submitLabel: text(40),
    successMessage: text(300),
    errorMessage: text(300),
    fields: z.array(FormField).min(2).max(25),
    updatedAt: IsoDateTime.optional(),
  })
  .superRefine((d, ctx) => {
    if (d.kind === "career" ? d.id !== `career-${d.roleId}` : d.id !== d.kind) ctx.addIssue({ code: "custom", path: ["id"], message: "does not match the form's kind (and role)" });
    if (d.kind !== "career" && d.roleId !== undefined) ctx.addIssue({ code: "custom", path: ["roleId"], message: "only a career form has a role" });
    const ids = new Set<string>();
    d.fields.forEach((f, i) => {
      if (ids.has(f.id)) ctx.addIssue({ code: "custom", path: ["fields", i, "id"], message: `"${f.id}" is used twice` });
      ids.add(f.id);
      if (f.type === "file" && d.kind !== "career") ctx.addIssue({ code: "custom", path: ["fields", i, "type"], message: "file uploads are for career forms only" });
    });
    const byId = new Map(d.fields.map((f) => [f.id, f]));
    for (const [id, type] of [["name", "text"], ["email", "email"]] as const) {
      const f = byId.get(id);
      if (!f || f.type !== type || !f.required) ctx.addIssue({ code: "custom", path: ["fields"], message: `every form keeps a required "${id}" field (${type})` });
    }
    const marketing = byId.get(MARKETING_FIELD_ID);
    if (!marketing || marketing.type !== "checkbox" || marketing.required) ctx.addIssue({ code: "custom", path: ["fields"], message: `every form keeps the optional "${MARKETING_FIELD_ID}" checkbox (news and updates by email)` });
    if (d.fields.filter((f) => f.type === "file").length > MAX_FILE_FIELDS) ctx.addIssue({ code: "custom", path: ["fields"], message: `at most ${MAX_FILE_FIELDS} file uploads` });
  });
export type FormDefinition = z.infer<typeof FormDefinition>;
