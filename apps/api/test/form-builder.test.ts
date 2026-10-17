import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_FORMS, PublishedSnapshot, newCareerForm, type Careers, type FormDefinition } from "@rbb/content-schema";
import type { ApiError } from "../src/errors.ts";
import { AuditService } from "../src/modules/audit/audit.ts";
import { FORMS_OFF, loadFormsConfig } from "../src/modules/forms/config.ts";
import { validateAgainstDefinition } from "../src/modules/forms/definition.ts";
import { FormService } from "../src/modules/forms/service.ts";
import { FormUploadService, safeFileName, sniffDocument, type FormUpload, type FormUploadStore } from "../src/modules/forms/uploads.ts";
import { FormDefinitionService } from "../src/modules/form-definitions/service.ts";
import { SubmissionService } from "../src/modules/submissions/service.ts";
import type { StoredSubmission } from "../src/modules/submissions/repository.ts";
import type { OutgoingEmail } from "../src/modules/forms/email.ts";
import { memoryAuditStore, memoryAuthStores, memoryData, silentLog, clock } from "./auth/memory.ts";
import { settingsRecord } from "./fixtures/settings.ts";
import { FACTS, MemoryStorage, member } from "./media/memory.ts";
import { harness, memoryFormDefinitionStore, sharedData } from "./settings/memory.ts";
import { memorySubmissionStore } from "./submissions/memory.ts";

/* The form builder (2026-10-13): forms saved in the admin are live at once
   (a forms-only publish), submissions are checked against the saved form,
   and career forms take PDF/Word attachments stored privately. Test data
   only; no real email is ever sent. */

const owner = member("org-a", "OWNER");
const editor = member("org-a", "EDITOR");
const failure = async (p: Promise<unknown>) => (await p.then(() => assert.fail("expected a refusal"), (e) => e)) as ApiError;
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25]);
const DOCX = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
const careers = (roles: { id?: string; title: string }[]): { record: Careers } => ({ record: { id: "careers", orgId: "org-a", schemaVersion: 1, status: "published", title: "Careers", intro: "Intro.", opportunities: { heading: "Open", empty: "None.", roles }, closing: { heading: "C.", primary: { label: "Go", href: "/contact" } } } as Careers });
const edit = (d: { title: string; heading: string; intro?: string; submitLabel: string; successMessage: string; errorMessage: string; fields: unknown[] }) => ({ title: d.title, heading: d.heading, ...(d.intro && { intro: d.intro }), submitLabel: d.submitLabel, successMessage: d.successMessage, errorMessage: d.errorMessage, fields: d.fields });

function memoryUploads(rows: FormUpload[]): FormUploadStore {
  return {
    insert: async (u) => void rows.push(structuredClone(u)),
    get: async (id) => structuredClone(rows.find((u) => u.id === id) ?? null),
    claim: async (ids, by) => {
      const found = rows.filter((u) => ids.includes(u.id) && !u.usedBy);
      if (found.length !== ids.length) return false;
      for (const u of found) u.usedBy = by;
      return true;
    },
    listUnclaimedBefore: async (before, limit) => rows.filter((u) => !u.usedBy && u.createdAt < before).slice(0, limit),
    remove: async (id) => void rows.splice(rows.findIndex((u) => u.id === id), 1),
  };
}

async function world(roles = [{ id: "programme-officer", title: "Programme Officer" }]) {
  const data = sharedData();
  const h = harness("org-a", data);
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  await h.publishing.publish(owner, FACTS);
  const definitions = memoryFormDefinitionStore(data.formDefinitions, "org-a");
  const audit = new AuditService(memoryAuditStore(data.base, "org-a"), { orgId: "org-a", secret: "test-only-auth-secret-0123456789abcdef", log: silentLog });
  const builder = new FormDefinitionService(definitions, { careers: { get: async () => careers(roles) }, publisher: h.publishing, audit, orgId: "org-a" });
  const storage = new MemoryStorage();
  const uploadRows: FormUpload[] = [];
  const time = clock();
  const throttle = memoryAuthStores(memoryData(), "org-a").throttle;
  const uploads = new FormUploadService(memoryUploads(uploadRows), storage, throttle, { orgId: "org-a", env: "production", secret: "test-only-auth-secret-0123456789abcdef", log: silentLog, now: time.now });
  const submissionRows: StoredSubmission[] = [];
  const submissionStore = memorySubmissionStore(submissionRows, "org-a");
  const sent: OutgoingEmail[] = [];
  const forms = (config = FORMS_OFF) =>
    new FormService(throttle, audit, { orgId: "org-a", config, secret: "test-only-auth-secret-0123456789abcdef", transport: async (e) => (sent.push(e), { ok: true, id: "x" }), log: silentLog, now: time.now, capture: (e) => sent.push(e), submissions: submissionStore, definitions: { live: (id) => definitions.get(id) }, uploads });
  const submissions = new SubmissionService(submissionStore, audit, { storage, titles: async () => Object.fromEntries((await definitions.list()).map((d) => [d.id, d.title])) });
  return { data, h, builder, definitions, uploads, uploadRows, storage, forms, submissions, submissionRows, sent, time };
}
const visit = (formId: string, fields: Record<string, unknown>, ip = "198.51.100.40") => [formId, { formId, fields, website: "", elapsedMs: 6000, antiSpamToken: null }, { requestId: "req-1", clientIp: ip, idempotencyKey: "abcdef12-0001" }] as const;

test("builder: owners list the four built-in forms (unsaved) and the Careers roles; editors are refused", async () => {
  const w = await world();
  const list = await w.builder.list(owner);
  assert.deepEqual(list.forms.map((f) => [f.definition.id, f.saved]), [["contact", false], ["volunteer", false], ["partner", false], ["fundraise", false]]);
  assert.deepEqual(list.roles, [{ id: "programme-officer", title: "Programme Officer", formId: "career-programme-officer", hasForm: false }]);
  assert.equal((await failure(w.builder.list(editor))).code, "FORBIDDEN");
  const fresh = await w.builder.get(owner, "career-programme-officer");
  assert.equal(fresh.saved, false);
  assert.ok(fresh.definition.fields.some((f) => f.type === "file"));
  assert.equal((await failure(w.builder.get(owner, "career-unknown-role"))).code, "NOT_FOUND");
});

test("saving a form puts it live at once: a new version with only content.forms changed, nothing else published", async () => {
  const w = await world();
  const before = (await w.h.publishing.publicSnapshot())!;
  const contact = DEFAULT_FORMS.contact;
  const result = await w.builder.save(owner, "contact", edit({ ...contact, heading: "Write to us", fields: [...contact.fields, { id: "phone", type: "tel", label: "Phone", required: false }] }), FACTS);
  assert.equal(result.publishedVersion, before.version + 1);
  const after = (await w.h.publishing.publicSnapshot())!;
  assert.equal(after.content.forms!.length, 1);
  assert.equal(after.content.forms![0]!.heading, "Write to us");
  assert.deepEqual({ ...after.content, forms: undefined }, { ...before.content, forms: undefined }, "nothing else changed");
  assert.deepEqual(after.settings, before.settings);
  assert.ok(PublishedSnapshot.safeParse(after).success);
  assert.equal((await w.h.publishing.status(owner)).hasUnpublishedChanges, false, "a form is never a change for an owner to publish");
  // Reset: the built-in form again, live at once.
  const reset = await w.builder.remove(owner, "contact", FACTS);
  assert.equal(reset.publishedVersion, after.version + 1);
  assert.equal((await w.h.publishing.publicSnapshot())!.content.forms, undefined);
});

test("saving refuses a form without its name and email, a file field outside career forms, and a role that is not open", async () => {
  const w = await world();
  const c = DEFAULT_FORMS.contact;
  for (const fields of [c.fields.filter((f) => f.id !== "email"), [...c.fields, { id: "cv", type: "file", label: "CV", required: false }], [...c.fields, { id: "topic", type: "text", label: "Again", required: false }], [...c.fields, { id: "pick", type: "select", label: "Pick", required: false }]])
    assert.equal((await failure(w.builder.save(owner, "contact", edit({ ...c, fields }), FACTS))).code, "VALIDATION_ERROR", JSON.stringify(fields.at(-1)));
  assert.equal((await failure(w.builder.save(owner, "career-not-a-role", edit(newCareerForm("not-a-role", "X")), FACTS))).code, "VALIDATION_ERROR");
  assert.equal((await failure(w.builder.save(editor, "contact", edit(c), FACTS))).code, "FORBIDDEN");
});

test("a saved form is the form: submissions are checked against it (new fields, options, required)", async () => {
  const w = await world();
  const c = DEFAULT_FORMS.contact;
  await w.builder.save(owner, "contact", edit({ ...c, fields: [...c.fields, { id: "country", type: "select", label: "Country", required: true, options: ["Kenya", "Peru"] }] }), FACTS);
  const service = w.forms();
  const missing = await failure(service.submit(...visit("contact", { name: "A", email: "a@test.example", message: "Hello" })));
  assert.equal(missing.status, 422);
  assert.match(JSON.stringify(missing.details), /fields\.country/);
  assert.equal((await failure(service.submit(...visit("contact", { name: "A", email: "a@test.example", message: "Hello", country: "Atlantis" }, "198.51.100.41")))).status, 422);
  await service.submit(...visit("contact", { name: "A", email: "a@test.example", message: "Hello", country: "Peru", topic: "Donate" }, "198.51.100.42"));
  const stored = w.submissionRows.at(-1)!;
  assert.deepEqual(stored.fields, { name: "A", email: "a@test.example", topic: "Donate", message: "Hello", country: "Peru" });
  assert.equal(stored.labels!.country, "Country");
});

test("career application: the CV is uploaded privately, claimed once, listed with the submission, opened by a signed link, deleted with it", async () => {
  const w = await world();
  await w.builder.save(owner, "career-programme-officer", edit(newCareerForm("programme-officer", "Programme Officer")), FACTS);
  const definition = (await w.definitions.get("career-programme-officer"))!;
  const upload = await w.uploads.accept(definition, "cv", PDF, "My CV (final).pdf", "198.51.100.50");
  assert.equal(upload.name, "My CV (final).pdf");
  const object = w.uploadRows[0]!;
  assert.match(object.key, /^private\/forms\/org-a\/[0-9a-f-]{36}$/);
  assert.ok(w.storage.objects.has(object.key));
  const config = loadFormsConfig({ EMAIL_MODE: "test", EMAIL_TO_CAREERS: "careers@rbb.example" });
  await w.forms(config).submit(...visit("career-programme-officer", { name: "Asha Applicant", email: "asha@test.example", cv: upload.id, message: "I would love to." }, "198.51.100.51"));
  const stored = w.submissionRows.at(-1)!;
  assert.equal(stored.formTitle, "Application — Programme Officer");
  assert.equal(stored.attachments!.length, 1);
  assert.equal(w.uploadRows[0]!.usedBy, stored.id, "claimed by this submission");
  const email = w.sent.at(-1)!;
  assert.equal(email.to, "careers@rbb.example");
  assert.match(email.text, /My CV \(final\)\.pdf/);
  assert.ok(!email.text.includes(object.key), "the storage key is never emailed");
  // A second submission cannot reuse the same upload.
  assert.equal((await failure(w.forms(config).submit(...visit("career-programme-officer", { name: "B", email: "b@test.example", cv: upload.id }, "198.51.100.52")))).status, 422);
  // The admin view hides the key; the signed link names the file.
  const view = await w.submissions.get(owner, stored.id);
  assert.ok(!JSON.stringify(view).includes(object.key));
  const link = await w.submissions.attachmentLink(owner, stored.id, view.attachments![0]!.id, FACTS);
  assert.match(link.url, /^https:\/\/private\.storage\.test\/private\/forms\//);
  assert.equal(link.name, "My CV (final).pdf");
  assert.equal((await failure(w.submissions.attachmentLink(editor, stored.id, view.attachments![0]!.id, FACTS))).code, "FORBIDDEN");
  assert.equal((await w.submissions.list(owner, { form: "career-programme-officer" })).items[0]!.attachments, 1);
  await w.submissions.remove(owner, stored.id, FACTS);
  assert.ok(!w.storage.objects.has(object.key), "the CV is deleted with the submission");
});

test("uploads: only PDF and Word, at most 4 MB, only a form's file field, rate limited; unclaimed ones are cleaned up", async () => {
  const w = await world();
  await w.builder.save(owner, "career-programme-officer", edit(newCareerForm("programme-officer", "Programme Officer")), FACTS);
  const d = (await w.definitions.get("career-programme-officer"))!;
  assert.equal((await failure(w.uploads.accept(d, "cv", PNG, "photo.png", "198.51.100.60"))).code, "UNSUPPORTED_MEDIA_TYPE");
  assert.equal((await failure(w.uploads.accept(d, "cv", new Uint8Array(4 * 1024 * 1024 + 1), "big.pdf", "198.51.100.60"))).code, "PAYLOAD_TOO_LARGE");
  assert.equal((await failure(w.uploads.accept(d, "message", PDF, "x.pdf", "198.51.100.60"))).code, "NOT_FOUND");
  assert.equal((await failure(w.uploads.accept(null, "cv", PDF, "x.pdf", "198.51.100.60"))).code, "NOT_FOUND");
  const docx = await w.uploads.accept(d, "cv", DOCX, "../../etc/passwd.exe", "198.51.100.61");
  assert.equal(docx.name, "passwd.docx", "a safe name with the real type's extension");
  for (let i = 0; i < 9; i += 1) await w.uploads.accept(d, "cv", PDF, "cv.pdf", "198.51.100.62");
  await w.uploads.accept(d, "cv", PDF, "cv.pdf", "198.51.100.62");
  assert.equal((await failure(w.uploads.accept(d, "cv", PDF, "cv.pdf", "198.51.100.62"))).code, "RATE_LIMITED");
  w.time.advance(2 * 86_400_000);
  const removed = await w.uploads.cleanup();
  assert.ok(removed >= 11);
  assert.equal(w.storage.objects.size, 0);
});

test("the definition check: normalising, one line except long text, formats, ignoring fields the form no longer has", () => {
  const d = { ...DEFAULT_FORMS.contact, orgId: "org-a", fields: [...DEFAULT_FORMS.contact.fields, { id: "phone", type: "tel" as const, label: "Phone", required: false }, { id: "agree", type: "checkbox" as const, label: "I agree", required: true }] } as FormDefinition;
  const ok = validateAgainstDefinition(d, { formId: "contact", fields: { name: "  A\nB  ", email: "a@test.example", message: "Line 1\r\nLine 2  ", phone: "+44 20 7946 0000", agree: true, removed: "x" } });
  assert.deepEqual(ok, { ok: true, data: { name: "A B", email: "a@test.example", message: "Line 1\nLine 2", phone: "+44 20 7946 0000", agree: "Yes" }, files: {} });
  const bad = validateAgainstDefinition(d, { formId: "contact", fields: { name: "", email: "nope", message: "x".repeat(5001), phone: "call me", agree: false } });
  assert.deepEqual(bad, { ok: false, status: 422, fields: { name: "required", email: "format", message: "too-long", phone: "format", agree: "required" } });
  assert.deepEqual(validateAgainstDefinition(d, { formId: "contact", fields: { name: 1 } }), { ok: false, status: 400 });
  assert.equal(sniffDocument(PDF), "application/pdf");
  assert.equal(sniffDocument(PNG), null);
  assert.equal(safeFileName(null, "application/msword"), "document.doc");
});

test("a new save needs the marketing checkbox; a form saved before it existed still publishes", async () => {
  const w = await world();
  const c = DEFAULT_FORMS.contact;
  const without = c.fields.filter((f) => f.id !== "marketing");
  assert.equal((await failure(w.builder.save(owner, "contact", edit({ ...c, fields: without }), FACTS))).code, "VALIDATION_ERROR");
  // An older saved form (no marketing field) in the store: a forms-only publish and a full publish both still work.
  w.data.formDefinitions.push({ ...c, orgId: "org-a", fields: without, updatedAt: "2026-10-13T10:00:00.000Z" } as FormDefinition);
  const v = (await w.h.settings.get(owner))!;
  await w.h.settings.update(owner, { revision: v.revision, changes: { general: { ...v.settings.general, summary: "Changed." } } }, FACTS);
  await w.h.publishing.publish(owner, FACTS);
  assert.ok(PublishedSnapshot.safeParse((await w.h.publishing.publicSnapshot())!).success);
});
