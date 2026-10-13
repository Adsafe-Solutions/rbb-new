import { test } from "node:test";
import assert from "node:assert/strict";
import type { ApiError } from "../src/errors.ts";
import { AuditService } from "../src/modules/audit/audit.ts";
import { permissionsFor } from "../src/modules/auth/permissions.ts";
import { FORMS_OFF, loadFormsConfig, type FormsConfig } from "../src/modules/forms/config.ts";
import type { EmailTransport, OutgoingEmail } from "../src/modules/forms/email.ts";
import { FormService } from "../src/modules/forms/service.ts";
import type { StoredSubmission } from "../src/modules/submissions/repository.ts";
import { SubmissionService, cursorOf } from "../src/modules/submissions/service.ts";
import type { AuthContext } from "../src/modules/auth/types.ts";
import { clock, memoryAuditStore, memoryAuthStores, memoryData, silentLog } from "./auth/memory.ts";
import { memorySubmissionStore } from "./submissions/memory.ts";

/* Form submissions (2026-10-13): Contact, Volunteer and Partner are STORED
   for owners to read in the admin, and emailed when email is configured.
   Test data only; no real email is ever sent. */

const VISITOR = { name: "Asha Visitor", email: "asha.visitor@example.org", message: "I would like to help with the reading club." };
const facts = (clientIp = "198.51.100.7") => ({ requestId: "req-sub-0001", clientIp, idempotencyKey: "abcdef12-3456" });
const body = (formId: string, fields: Record<string, unknown> = VISITOR, extra: Record<string, unknown> = {}) => ({ formId, fields, website: "", elapsedMs: 5000, antiSpamToken: null, ...extra });
const failure = async (p: Promise<unknown>) => (await p.then(() => assert.fail("expected a refusal"), (e) => e)) as ApiError;
const ADMIN_FACTS = { requestId: "req-admin-1", clientIp: "203.0.113.9", userAgent: "node-test" };

function member(role: "OWNER" | "EDITOR", orgId = "org-a"): AuthContext {
  const id = role === "OWNER" ? "00000000-0000-4000-8000-0000000000a1" : "00000000-0000-4000-8000-0000000000e1";
  return {
    user: { id, orgId, email: `${role.toLowerCase()}@test.example`, emailNormalized: `${role.toLowerCase()}@test.example`, name: role, passwordHash: null, status: "active", createdAt: "", updatedAt: "", revision: 1 },
    membership: { id: `m-${id}`, orgId, userId: id, role, status: "active", createdAt: "", updatedAt: "", revision: 1 },
    organization: { id: orgId },
    permissions: permissionsFor(role),
    session: { id: "s", orgId, userId: id, tokenHash: "x", createdAt: "", expiresAt: "", lastSeenAt: "", revokedAt: null },
  } as unknown as AuthContext;
}
const owner = member("OWNER");
const editor = member("EDITOR");

function world(config: FormsConfig = FORMS_OFF, options: { transport?: EmailTransport; failInsert?: boolean } = {}) {
  const data = memoryData();
  const rows: StoredSubmission[] = [];
  const time = clock();
  const audit = new AuditService(memoryAuditStore(data, "org-a"), { orgId: "org-a", secret: "test-only-auth-secret-0123456789abcdef", log: silentLog, now: time.now });
  const store = memorySubmissionStore(rows, "org-a", { failInsert: options.failInsert });
  const sent: OutgoingEmail[] = [];
  const forms = new FormService(memoryAuthStores(data, "org-a").throttle, audit, {
    orgId: "org-a",
    config,
    secret: "test-only-auth-secret-0123456789abcdef",
    transport: options.transport ?? (async (e) => (sent.push(e), { ok: true, id: "fake" })),
    log: silentLog,
    now: time.now,
    capture: (e) => sent.push(e),
    submissions: store,
  });
  const submissions = new SubmissionService(store, audit, { now: time.now });
  const outcomes = () => data.audit.filter((e) => e.action === "forms.submission").map((e) => e.metadata.outcome);
  return { data, rows, time, forms, submissions, sent, outcomes };
}

test("stored: with email off, Contact, Volunteer and Partner are taken and kept — fields only, no IP or user agent", async () => {
  const w = world();
  const { reference } = await w.forms.submit("contact", body("contact", { ...VISITOR, topic: "volunteer" }), facts());
  await w.forms.submit("volunteer", body("volunteer"), facts("198.51.100.8"));
  await w.forms.submit("partner", body("partner", { ...VISITOR, organization: "A Test Company" }), facts("198.51.100.9"));
  assert.equal(w.rows.length, 3);
  const contact = w.rows.find((r) => r.formId === "contact")!;
  assert.equal(contact.reference, reference);
  assert.equal(contact.status, "new");
  assert.deepEqual(contact.fields, { name: VISITOR.name, email: VISITOR.email, message: VISITOR.message, topic: "volunteer" });
  assert.ok(!JSON.stringify(w.rows).includes("198.51.100"), "no IP address stored");
  assert.deepEqual(w.outcomes(), ["stored", "stored", "stored"]);
  assert.equal(w.sent.length, 0, "email is off: nothing sent");
  const auditText = JSON.stringify(w.data.audit);
  for (const secret of [VISITOR.name, VISITOR.email, "reading club"]) assert.ok(!auditText.includes(secret), "the audit trail carries no visitor data");
});

test("not stored: bots, invalid input, and forms that are not Contact, Volunteer or Partner", async () => {
  const w = world();
  await w.forms.submit("contact", body("contact", VISITOR, { website: "https://spam.example" }), facts());
  await w.forms.submit("contact", body("contact", VISITOR, { elapsedMs: 10 }), facts("198.51.100.20"));
  assert.equal((await failure(w.forms.submit("contact", body("contact", { name: "", email: "x", message: "" }), facts("198.51.100.21")))).status, 422);
  for (const id of ["fundraise", "travel", "newsletter"]) assert.equal((await failure(w.forms.submit(id, body(id), facts("198.51.100.22")))).status, 503, id);
  assert.equal(w.rows.length, 0);
});

test("stored and emailed: with email configured both happen; if the email fails the submission is still received", async () => {
  const config = loadFormsConfig({ EMAIL_MODE: "test", EMAIL_TO_CONTACT: "contact-inbox@rbb.example" });
  const w = world(config);
  await w.forms.submit("contact", body("contact"), facts());
  assert.equal(w.rows.length, 1);
  assert.equal(w.sent.length, 1, "the notification was rendered");
  assert.deepEqual(w.outcomes(), ["stored_and_delivered"]);

  const live = loadFormsConfig({ EMAIL_MODE: "live", EMAIL_API_KEY: "re_test_only_key_0123456789", EMAIL_FROM: "RBB <forms@rbb.example>", EMAIL_TO_CONTACT: "contact-inbox@rbb.example" });
  const failing = world(live, { transport: async () => ({ ok: false, category: "unavailable" }) as never });
  const { reference } = await failing.forms.submit("contact", body("contact"), facts());
  assert.ok(reference);
  assert.equal(failing.rows.length, 1, "kept although the email failed");
  assert.deepEqual(failing.outcomes(), ["stored_email_failed"]);
});

test("a submission that cannot be stored is refused (503), so the visitor tries again", async () => {
  const w = world(FORMS_OFF, { failInsert: true });
  assert.equal((await failure(w.forms.submit("contact", body("contact"), facts()))).status, 503);
});

test("admin: owners list newest first, filter by form, status, dates and text, page by cursor, and see counts", async () => {
  const w = world();
  const seed = async (formId: string, fields: Record<string, unknown>, ip: string) => {
    await w.forms.submit(formId, body(formId, fields), facts(ip));
    w.time.advance(60_000);
  };
  await seed("contact", { ...VISITOR, name: "First Person" }, "198.51.100.30");
  await seed("volunteer", { ...VISITOR, name: "Second Person", email: "second@example.org" }, "198.51.100.31");
  await seed("partner", { ...VISITOR, name: "Third Person", organization: "Acme Test Ltd" }, "198.51.100.32");
  const all = await w.submissions.list(owner, {});
  assert.deepEqual(all.items.map((i) => i.name), ["Third Person", "Second Person", "First Person"]);
  assert.deepEqual(all.counts, { total: 3, new: 3, byForm: { contact: { total: 1, new: 1 }, volunteer: { total: 1, new: 1 }, partner: { total: 1, new: 1 } } });
  assert.equal(all.items[0]!.organization, "Acme Test Ltd");
  assert.equal(all.items[0]!.preview, VISITOR.message);
  assert.deepEqual((await w.submissions.list(owner, { form: "volunteer" })).items.map((i) => i.name), ["Second Person"]);
  assert.deepEqual((await w.submissions.list(owner, { q: "acme" })).items.map((i) => i.name), ["Third Person"], "search: organization, case ignored");
  assert.deepEqual((await w.submissions.list(owner, { q: "second@" })).items.map((i) => i.name), ["Second Person"], "search: email");
  const day = all.items[0]!.createdAt.slice(0, 10);
  assert.equal((await w.submissions.list(owner, { from: day, to: day })).items.length, 3);
  const first = await w.submissions.list(owner, { limit: "2" });
  assert.equal(first.items.length, 2);
  const second = await w.submissions.list(owner, { limit: "2", before: first.next! });
  assert.deepEqual(second.items.map((i) => i.name), ["First Person"]);
  assert.equal(second.next, null);
  assert.equal(cursorOf(first.items[1]!), first.next);
  for (const bad of [{ form: "fundraise" }, { status: "archived" }, { before: "not-a-cursor" }, { from: "2026-10-05", to: "2026-10-01" }, { limit: "500" }, { unknown: "x" }])
    assert.equal((await failure(w.submissions.list(owner, bad))).code, "VALIDATION_ERROR", JSON.stringify(bad));
});

test("admin: mark read and unread, delete for good — audited by id and form only; editors refused", async () => {
  const w = world();
  await w.forms.submit("contact", body("contact"), facts());
  const id = w.rows[0]!.id;
  assert.equal((await failure(w.submissions.list(editor, {}))).code, "FORBIDDEN");
  assert.equal((await failure(w.submissions.get(editor, id))).code, "FORBIDDEN");
  assert.equal((await failure(w.submissions.remove(editor, id, ADMIN_FACTS))).code, "FORBIDDEN");
  assert.equal((await w.submissions.get(owner, id)).fields.message, VISITOR.message);
  assert.equal((await w.submissions.setStatus(owner, id, { status: "read" }, ADMIN_FACTS)).status, "read");
  assert.equal((await w.submissions.list(owner, { status: "new" })).items.length, 0);
  assert.equal((await w.submissions.list(owner, {})).counts.new, 0);
  assert.equal((await w.submissions.setStatus(owner, id, { status: "new" }, ADMIN_FACTS)).status, "new");
  assert.equal((await failure(w.submissions.setStatus(owner, id, { status: "spam" }, ADMIN_FACTS))).code, "VALIDATION_ERROR");
  assert.deepEqual(await w.submissions.remove(owner, id, ADMIN_FACTS), { deleted: true });
  assert.equal(w.rows.length, 0);
  assert.equal((await failure(w.submissions.get(owner, id))).code, "NOT_FOUND");
  assert.equal((await failure(w.submissions.get(owner, "not-a-uuid"))).code, "NOT_FOUND");
  const changes = w.data.audit.filter((e) => e.action.startsWith("submissions."));
  assert.deepEqual(changes.map((e) => e.action), ["submissions.status_changed", "submissions.status_changed", "submissions.deleted"]);
  const text = JSON.stringify(changes);
  for (const secret of [VISITOR.name, VISITOR.email, "reading club"]) assert.ok(!text.includes(secret));
});

test("another organization's submissions are never seen", async () => {
  const w = world();
  await w.forms.submit("contact", body("contact"), facts());
  const other = new SubmissionService(memorySubmissionStore(w.rows, "org-b"), new AuditService(memoryAuditStore(w.data, "org-b"), { orgId: "org-b", secret: "test-only-auth-secret-0123456789abcdef", log: silentLog }));
  const ownerB = member("OWNER", "org-b");
  assert.equal((await other.list(ownerB, {})).items.length, 0);
  assert.equal((await failure(other.get(ownerB, w.rows[0]!.id))).code, "NOT_FOUND");
});
