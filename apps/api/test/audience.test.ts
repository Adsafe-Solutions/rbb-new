import { test } from "node:test";
import assert from "node:assert/strict";
import type { ApiError } from "../src/errors.ts";
import { AuditService } from "../src/modules/audit/audit.ts";
import { AudienceService } from "../src/modules/audience/service.ts";
import { FORMS_OFF } from "../src/modules/forms/config.ts";
import { FormService } from "../src/modules/forms/service.ts";
import type { StoredSubmission } from "../src/modules/submissions/repository.ts";
import { clock, memoryAuditStore, memoryAuthStores, memoryData, silentLog } from "./auth/memory.ts";
import { FACTS, member } from "./media/memory.ts";
import { memorySubmissionStore } from "./submissions/memory.ts";

/* Admin → Audience (2026-10-13): every unique person across the forms,
   by email, with their latest marketing emails choice. Test data only. */

const owner = member("org-a", "OWNER");
const editor = member("org-a", "EDITOR");
const failure = async (p: Promise<unknown>) => (await p.then(() => assert.fail("expected a refusal"), (e) => e)) as ApiError;

function world() {
  const data = memoryData();
  const rows: StoredSubmission[] = [];
  const time = clock();
  const audit = new AuditService(memoryAuditStore(data, "org-a"), { orgId: "org-a", secret: "test-only-auth-secret-0123456789abcdef", log: silentLog, now: time.now });
  const store = memorySubmissionStore(rows, "org-a");
  const forms = new FormService(memoryAuthStores(data, "org-a").throttle, audit, { orgId: "org-a", config: FORMS_OFF, secret: "test-only-auth-secret-0123456789abcdef", transport: async () => ({ ok: true, id: "x" }), log: silentLog, now: time.now, submissions: store });
  let ip = 10;
  const send = async (formId: string, fields: Record<string, unknown>) => {
    await forms.submit(formId, { formId, fields, website: "", elapsedMs: 6000, antiSpamToken: null }, { requestId: "r", clientIp: `198.51.100.${ip++}`, idempotencyKey: null });
    time.advance(60_000);
  };
  return { data, rows, send, audience: new AudienceService(store, audit) };
}
const MSG = "A test message.";

test("the marketing emails checkbox is kept with each submission as Yes or No (and absent when not sent)", async () => {
  const w = world();
  await w.send("contact", { name: "A", email: "a@test.example", message: MSG, marketing: true });
  await w.send("volunteer", { name: "B", email: "b@test.example", message: MSG, marketing: false });
  await w.send("partner", { name: "C", email: "c@test.example", message: MSG });
  assert.deepEqual(w.rows.map((r) => r.fields.marketing ?? null), ["Yes", "No", null]);
});

test("one row per person by email (case ignored): forms used, count, first and last contact, the LATEST marketing choice", async () => {
  const w = world();
  await w.send("contact", { name: "Asha", email: "Asha@Test.example", message: MSG, marketing: true });
  await w.send("volunteer", { name: "Asha V.", email: "asha@test.example", message: MSG, marketing: false });
  await w.send("partner", { name: "Ben", email: "ben@test.example", message: MSG, marketing: true });
  const page = await w.audience.list(owner, {});
  assert.equal(page.total, 2);
  assert.equal(page.optedIn, 1);
  assert.deepEqual(page.items.map((p) => [p.email, p.name, p.forms, p.submissions, p.marketing]), [
    ["ben@test.example", "Ben", ["partner"], 1, "Yes"],
    ["asha@test.example", "Asha V.", ["contact", "volunteer"], 2, "No"],
  ]);
  assert.ok(page.items[1]!.firstAt < page.items[1]!.lastAt);
  assert.deepEqual((await w.audience.list(owner, { marketing: "yes" })).items.map((p) => p.email), ["ben@test.example"]);
  assert.deepEqual((await w.audience.list(owner, { form: "contact" })).items.map((p) => p.email), ["asha@test.example"]);
  assert.deepEqual((await w.audience.list(owner, { q: "BEN" })).items.map((p) => p.email), ["ben@test.example"]);
  assert.equal((await failure(w.audience.list(editor, {}))).code, "FORBIDDEN");
  assert.equal((await failure(w.audience.list(owner, { marketing: "maybe" }))).code, "VALIDATION_ERROR");
});

test("newsletter subscribers are in the audience as opted in, without a name; filterable by the Newsletter form", async () => {
  const w = world();
  await w.send("newsletter", { email: "reader@test.example", consent: true });
  await w.send("contact", { name: "Asha", email: "asha@test.example", message: MSG, marketing: false });
  await w.send("newsletter", { email: "Asha@Test.example", consent: true });
  const page = await w.audience.list(owner, {});
  assert.deepEqual(page.items.map((p) => [p.email, p.name, p.forms, p.marketing]), [
    ["Asha@Test.example", "Asha", ["contact", "newsletter"], "Yes"],
    ["reader@test.example", "", ["newsletter"], "Yes"],
  ]);
  assert.equal(page.optedIn, 2);
  assert.deepEqual((await w.audience.list(owner, { form: "newsletter" })).items.map((p) => p.email), ["Asha@Test.example", "reader@test.example"]);
});

test("CSV export: quoted, formula-safe, audited by row count only", async () => {
  const w = world();
  await w.send("contact", { name: "=HYPERLINK(\"x\")", email: "a@test.example", message: MSG, marketing: true });
  const csv = await w.audience.exportCsv(owner, {}, FACTS);
  const [header, row] = csv.trim().split("\r\n");
  assert.equal(header, '"Email","Name","Marketing emails","Marketing choice made","Forms","Submissions","First contact","Last contact"');
  assert.match(row!, /^"a@test\.example","'=HYPERLINK\(""x""\)","Yes",/);
  const entry = w.data.audit.find((e) => e.action === "audience.exported")!;
  assert.deepEqual(entry.metadata, { rows: 1 });
  assert.equal((await failure(w.audience.exportCsv(editor, {}, FACTS))).code, "FORBIDDEN");
});
