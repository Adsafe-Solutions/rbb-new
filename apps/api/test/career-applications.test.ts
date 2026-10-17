import { test } from "node:test";
import assert from "node:assert/strict";
import { FormDefinition, newCareerForm } from "@rbb/content-schema";
import type { ApiError } from "../src/errors.ts";
import { AuditService } from "../src/modules/audit/audit.ts";
import { liveForms } from "../src/modules/form-definitions/service.ts";
import { loadFormsConfig } from "../src/modules/forms/config.ts";
import { FormService } from "../src/modules/forms/service.ts";
import { clock, memoryAuditStore, memoryAuthStores, memoryData, silentLog } from "./auth/memory.ts";
import { memorySubmissionStore } from "./submissions/memory.ts";

/* Career applications after review (2026-10-17): every open role on the
   PUBLISHED Careers page takes applications — through its saved form, or
   the standard one when no form was saved — and applications have their
   own, tighter rate limit (3 per client and role per window by default).
   The website draws the same standard form: apps/web
   scripts/test/career-forms.test.mjs keeps the two equal. */

const ROLES = [{ id: "sr-software-engineer", title: "Sr. Software Engineer" }, { id: "field-coordinator", title: "Field Coordinator" }, { title: "A role saved before ids" }];
const saved = FormDefinition.parse({ ...newCareerForm("sr-software-engineer", "Sr. Software Engineer"), heading: "Apply — engineering", orgId: "org-a" });
const store = { get: async (id: string) => (id === saved.id ? saved : null) };
const forms = liveForms(store, "org-a", async () => ROLES);

test("a role's saved form is used; a published role without one gets the standard application form, named for it", async () => {
  assert.equal((await forms.live("career-sr-software-engineer"))?.heading, "Apply — engineering");
  const standard = await forms.live("career-field-coordinator");
  assert.deepEqual(standard, { ...newCareerForm("field-coordinator", "Field Coordinator"), orgId: "org-a" });
  assert.equal(standard?.heading, "Apply for Field Coordinator");
});

test("no standard form for a role the published Careers page does not list, nor for any other form", async () => {
  assert.equal(await forms.live("career-retired-role"), null);
  assert.equal(await forms.live("contact"), null, "built-in forms keep their own schema");
  const before = liveForms({ get: async () => null }, "org-a", async () => []);
  assert.equal(await before.live("career-field-coordinator"), null, "nothing published yet");
});

test("career applications are limited to 3 per client and role per window; other forms keep their own limit", async () => {
  const data = memoryData();
  const time = clock();
  const audit = new AuditService(memoryAuditStore(data, "org-a"), { orgId: "org-a", secret: "test-only-auth-secret-0123456789abcdef", log: silentLog, now: time.now });
  const config = loadFormsConfig({ EMAIL_MODE: "test", EMAIL_TO_CONTACT: "contact-inbox@rbb.example" });
  assert.deepEqual([config.careersRateLimit.max, config.rateLimit.max], [3, 5]);
  const service = new FormService(memoryAuthStores(data, "org-a").throttle, audit, {
    orgId: "org-a",
    config,
    secret: "test-only-auth-secret-0123456789abcdef",
    transport: async () => ({ ok: true, id: "fake" }),
    log: silentLog,
    now: time.now,
    capture: () => {},
    submissions: memorySubmissionStore([], "org-a"),
    definitions: forms,
  });
  const facts = { requestId: "req-career-1", clientIp: "198.51.100.30", idempotencyKey: null };
  // No CV attached: refused as invalid — every attempt still counts against the limit.
  const apply = (formId: string) => service.submit(formId, { formId, fields: { name: "Asha", email: "asha@example.org" }, website: "", elapsedMs: 5000, antiSpamToken: null }, facts).then(() => "ok", (e: ApiError) => e.code);
  for (let i = 0; i < 3; i += 1) assert.equal(await apply("career-field-coordinator"), "UNPROCESSABLE_CONTENT");
  assert.equal(await apply("career-field-coordinator"), "RATE_LIMITED");
  // Another role counts separately.
  assert.equal(await apply("career-sr-software-engineer"), "UNPROCESSABLE_CONTENT");
  // A later window starts again.
  time.advance(600_000);
  assert.equal(await apply("career-field-coordinator"), "UNPROCESSABLE_CONTENT");

  assert.equal(loadFormsConfig({ FORMS_CAREERS_RATE_LIMIT_MAX: "6" }).careersRateLimit.max, 6);
  assert.match(loadFormsConfig({ FORMS_CAREERS_RATE_LIMIT_MAX: "lots" }).problems.join(" "), /FORMS_CAREERS_RATE_LIMIT_MAX/);
});
