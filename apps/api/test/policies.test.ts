import { test } from "node:test";
import assert from "node:assert/strict";
import { PublishedSnapshot, instantToZonedTime } from "@rbb/content-schema";
import { ApiError } from "../src/errors.ts";
import { secretProblems } from "../src/modules/publishing/service.ts";
import { settingsRecord } from "./fixtures/settings.ts";
import { FACTS, member } from "./media/memory.ts";
import { harness, sharedData } from "./settings/memory.ts";
import { approvePage } from "./support/workflow.ts";

/* Policies (M19): three fixed typed pages per organization — lifecycle,
   revisions, approval completeness, contacts from the settings, structure-
   only audit, and each in the snapshot only while published. Test data
   only: no wording here is, or resembles, legal text. */

const owner = member("org-a", "OWNER");
const editor = member("org-a", "EDITOR");
const HOUR = 3_600_000;

const rejects = async (promise: Promise<unknown>, code: string, pathPart?: string) =>
  assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError, String(error));
    assert.equal(error.code, code, error.message);
    if (pathPart) assert.ok(error.details?.some((d) => d.path.includes(pathPart) || d.message.includes(pathPart)), JSON.stringify(error.details));
    return true;
  });

const section = (id = "test-section", o: Record<string, unknown> = {}) => ({ id, heading: `Heading ${id}`, body: [`Test paragraph ${id}.`], ...o });
const complete = (o: Record<string, unknown> = {}) => ({ effectiveDate: "2026-09-01", lastUpdated: "2026-09-15", intro: ["Test intro."], sections: [section()], ...o });

const site = async (methods: unknown[] = [{ id: "test-mail", type: "email", label: "Test mailbox", value: "mailbox@example.org" }]) => {
  const data = sharedData();
  const h = harness("org-a", data);
  await h.settings.importInitial({ ...settingsRecord("org-a"), contact: { methods } }, { id: null, name: "Settings import" });
  return { data, h };
};

test("policies: three fixed records — an empty draft, its id and route fixed, no HTML or unknown parts", async () => {
  const { h } = await site();
  const list = await h.policyDirectory.list(editor);
  assert.deepEqual(list.policies.map((p) => [p.id, p.route, p.view.record]), [["privacy", "/privacy", null], ["terms", "/terms", null], ["donation", "/donation-policy", null]]);
  assert.deepEqual(list.contactMethods.map((m) => m.id), ["test-mail"]);

  // Revision 0 creates — with the site's title and links only, no wording.
  const created = await h.policies.privacy.update(editor, { revision: 0, changes: {} }, FACTS);
  assert.deepEqual([created.record!.id, created.record!.status, created.record!.title, created.record!.intro, created.record!.sections, created.record!.relatedPolicies], ["privacy", "draft", "Privacy Policy", [], [], ["terms", "donation"]]);
  assert.equal(created.record!.effectiveDate, undefined, "no date is invented");
  await rejects(h.policies.privacy.create(editor, {}, FACTS), "CONFLICT");

  for (const [name, changes, part] of [
    ["the id", { id: "terms" }, "id"],
    ["a route", { route: "/elsewhere" }, "route"],
    ["HTML", { intro: ["<p>x</p>"] }, "intro"],
    ["HTML in a section", { sections: [section("a", { body: ["<script>x</script>"] })] }, "sections"],
    ["rich text", { sections: [section("a", { body: [{ type: "paragraph" }] })] }, "sections"],
    ["a release marker", { releaseMarker: "Sample" }, "releaseMarker"],
    ["an impossible date", { effectiveDate: "2026-02-30" }, "effectiveDate"],
    ["a duplicate section id", { sections: [section("a"), section("a")] }, "sections"],
    ["an unknown related policy", { relatedPolicies: ["cookies"] }, "relatedPolicies"],
    ["itself as related", { relatedPolicies: ["privacy"] }, "relatedPolicies"],
    ["a typed-in contact", { contactReference: "someone@example.org" }, "contactReference"],
    ["a contact not in the settings", { contactReference: "missing-method" }, "contactReference"],
  ] as const)
    await rejects(h.policies.privacy.update(editor, { revision: created.revision, changes }, FACTS), "VALIDATION_ERROR", part).catch((e) => assert.fail(`${name}: ${e.message}`));
  // The terms policy's own record is separate: privacy's draft did not create it.
  assert.equal((await h.policies.terms.get(editor)).record, null);
});

test("policies: revisions — a stale save is a 409; the audit names parts, never wording", async () => {
  const { h } = await site();
  const created = await h.policies.terms.update(editor, { revision: 0, changes: { intro: ["Secret-looking intro wording"] } }, FACTS);
  const edited = await h.policies.terms.update(editor, { revision: created.revision, changes: { sections: [section("one", { items: ["Item wording never audited"] })], contactReference: "test-mail", seo: { description: "Description wording." } } }, FACTS);
  await rejects(h.policies.terms.update(editor, { revision: created.revision, changes: { title: "Stale" } }, FACTS), "CONFLICT");
  await rejects(h.policies.terms.act(editor, "submit", { revision: created.revision }, FACTS), "CONFLICT");
  const entries = h.audit.filter((e) => e.resourceType === "policy");
  assert.deepEqual(entries.map((e) => [e.action, e.resourceId]), [["policy.created", "terms"], ["policy.updated", "terms"]]);
  assert.deepEqual(entries[1]!.metadata.fields, ["contactReference", "sections", "seo"]);
  const audited = JSON.stringify(h.audit);
  for (const words of ["Secret-looking", "Item wording", "Description wording", "Heading one", "mailbox@example.org"]) assert.ok(!audited.includes(words), `no wording in the audit: ${words}`);
  // Clearing an optional part.
  const cleared = await h.policies.terms.update(editor, { revision: edited.revision, changes: { contactReference: null } }, FACTS);
  assert.equal(cleared.record!.contactReference, undefined);
});

test("policies: approval needs both dates and a section; owners approve; contacts are checked again", async () => {
  const { h } = await site();
  let v = await h.policies.donation.update(editor, { revision: 0, changes: { sections: [section()] } }, FACTS);
  v = await h.policies.donation.act(editor, "submit", { revision: v.revision }, FACTS);
  await rejects(h.policies.donation.act(editor, "approve", { revision: v.revision }, FACTS), "FORBIDDEN");
  await rejects(h.policies.donation.act(owner, "approve", { revision: v.revision }, FACTS), "VALIDATION_ERROR", "effectiveDate");
  await rejects(h.policies.donation.act(owner, "approve", { revision: v.revision }, FACTS), "VALIDATION_ERROR", "lastUpdated");
  v = await h.policies.donation.act(owner, "reject", { revision: v.revision }, FACTS);
  v = await h.policies.donation.update(editor, { revision: v.revision, changes: { effectiveDate: "2026-09-01", lastUpdated: "2026-09-15", sections: [] } }, FACTS);
  v = await h.policies.donation.act(editor, "submit", { revision: v.revision }, FACTS);
  await rejects(h.policies.donation.act(owner, "approve", { revision: v.revision }, FACTS), "VALIDATION_ERROR", "sections");
  v = await h.policies.donation.act(editor, "withdraw", { revision: v.revision }, FACTS);
  // A save never approves.
  await rejects(h.policies.donation.update(owner, { revision: v.revision, changes: { status: "approved" } }, FACTS), "VALIDATION_ERROR", "status");
  v = await h.policies.donation.update(editor, { revision: v.revision, changes: { sections: [section()], contactReference: "test-mail" } }, FACTS);
  // The contact left the settings after it was chosen: submitting (and approving) says so.
  const settings = await h.settings.get(owner);
  const cut = await h.settings.update(owner, { revision: settings!.revision, changes: { contact: { methods: [] } } }, FACTS);
  await rejects(h.policies.donation.act(editor, "submit", { revision: v.revision }, FACTS), "VALIDATION_ERROR", "contactReference");
  await h.settings.update(owner, { revision: cut.revision, changes: { contact: { methods: [{ id: "test-mail", type: "email", label: "Test mailbox", value: "mailbox@example.org" }] } } }, FACTS);
  v = await approvePage(h.policies.donation, owner, FACTS);
  assert.equal(v.record!.status, "approved");
});

test("snapshot: a published policy only, in the fixed order; a pending edit keeps the live version; archive removes it", async () => {
  const { h } = await site();
  await h.publishing.publish(owner, FACTS);
  assert.equal((await h.publishing.publicSnapshot())!.content.policies, undefined, "no policy yet: the key is absent and the website keeps its own records");

  let terms = await h.policies.terms.update(editor, { revision: 0, changes: complete({ sections: [section("terms-a")] }) }, FACTS);
  const privacy = await h.policies.privacy.update(editor, { revision: 0, changes: complete({ contactReference: "test-mail" }) }, FACTS);
  await rejects(h.publishing.publish(owner, FACTS), "CONFLICT");
  assert.equal((await h.publishing.publicSnapshot())!.content.policies, undefined, "drafts are never published");

  await approvePage(h.policies.terms, owner, FACTS);
  await approvePage(h.policies.privacy, owner, FACTS);
  await h.publishing.publish(owner, FACTS);
  let snapshot = (await h.publishing.publicSnapshot())!;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.deepEqual(snapshot.content.policies!.map((p) => [p.id, p.status]), [["privacy", "published"], ["terms", "published"]], "fixed order, published only");
  assert.ok(snapshot.content.policies!.every((p) => p.publishedAt));
  const text = JSON.stringify(snapshot.content.policies);
  for (const leak of ["revision", "updatedBy", "createdAt", "updatedAt", "policyId"]) assert.ok(!text.includes(leak), `leaked: ${leak}`);
  assert.deepEqual(secretProblems(snapshot), []);
  assert.equal((await h.policies.terms.get(owner)).live, true);
  assert.equal((await h.policies.terms.get(owner)).record!.status, "published");

  // An edit waiting for review: the live version stays — exactly that revision.
  terms = await h.policies.terms.get(owner);
  const pending = await h.policies.terms.update(editor, { revision: terms.revision, changes: { sections: [section("terms-a", { body: ["Unapproved wording"] })] } }, FACTS);
  assert.equal(pending.record!.status, "draft");
  await rejects(h.publishing.publish(owner, FACTS), "CONFLICT");
  // Another policy's approval makes a publish: the pending edit still stays out.
  await h.policies.donation.update(editor, { revision: 0, changes: complete() }, FACTS);
  await approvePage(h.policies.donation, owner, FACTS);
  await h.publishing.publish(owner, FACTS);
  snapshot = (await h.publishing.publicSnapshot())!;
  assert.ok(!JSON.stringify(snapshot).includes("Unapproved wording"), "a pending edit is never published");
  assert.deepEqual(snapshot.content.policies!.find((p) => p.id === "terms")!.sections, [section("terms-a")], "the live version is the one published before");
  assert.deepEqual(snapshot.content.policies!.map((p) => p.id), ["privacy", "terms", "donation"]);

  await h.policies.donation.archive(owner, FACTS);
  await h.policies.terms.archive(owner, FACTS);
  await h.policies.privacy.archive(owner, FACTS);
  await h.publishing.publish(owner, FACTS);
  assert.equal((await h.publishing.publicSnapshot())!.content.policies, undefined, "archived: the website's own records return");
  assert.equal(privacy.record!.id, "privacy");
});

test("snapshot: a contact removed from the settings stops the publish with a clear problem", async () => {
  const { h } = await site();
  await h.policies.privacy.update(editor, { revision: 0, changes: complete({ contactReference: "test-mail" }) }, FACTS);
  await approvePage(h.policies.privacy, owner, FACTS);
  const settings = await h.settings.get(owner);
  await h.settings.update(owner, { revision: settings!.revision, changes: { contact: { methods: [] } } }, FACTS);
  const status = await h.publishing.status(owner);
  assert.ok(status.blockers.some((b) => b.includes("policies") && b.includes("contactReference")), JSON.stringify(status.blockers));
  await rejects(h.publishing.publish(owner, FACTS), "VALIDATION_ERROR", "contactReference");
});

test("scheduling: an approved policy joins the publish that falls due, as the other pages", async () => {
  const { h } = await site();
  await h.publishing.publish(owner, FACTS);
  await h.policies.donation.update(editor, { revision: 0, changes: complete() }, FACTS);
  const approved = await approvePage(h.policies.donation, owner, FACTS);
  await rejects(h.policies.donation.schedule(editor, { revision: approved.revision, localTime: instantToZonedTime(new Date(h.time.now().getTime() + HOUR).toISOString(), "UTC"), timeZone: "UTC" }, FACTS), "FORBIDDEN");
  const scheduled = await h.policies.donation.schedule(owner, { revision: approved.revision, localTime: instantToZonedTime(new Date(h.time.now().getTime() + HOUR).toISOString(), "UTC"), timeZone: "UTC" }, FACTS);
  assert.ok(scheduled.schedule);
  const review = (await h.publishing.status(owner)).review;
  assert.ok(review.scheduled.some((s) => s.section === "Donation Policy"), JSON.stringify(review));
  await rejects(h.publishing.publish(owner, FACTS), "CONFLICT");
  assert.equal((await h.publishing.publicSnapshot())!.content.policies, undefined, "not due yet: it is not part of a publish");
  h.time.advance(HOUR + 1);
  const run = await h.publishing.runScheduled(FACTS);
  assert.equal(run.outcome, "published", JSON.stringify(run));
  assert.deepEqual((await h.publishing.publicSnapshot())!.content.policies!.map((p) => p.id), ["donation"]);
  assert.ok(h.audit.some((e) => e.action === "policy.scheduled" && e.resourceId === "donation"));
});

test("policies: organizations stay apart", async () => {
  const { data, h } = await site();
  await h.policies.privacy.update(editor, { revision: 0, changes: { intro: ["Org A only."] } }, FACTS);
  const b = harness("org-b", data);
  await rejects(b.policies.privacy.get(owner), "FORBIDDEN");
  await rejects(b.policyDirectory.list(owner), "FORBIDDEN");
  assert.equal((await b.policies.privacy.get(member("org-b", "OWNER"))).record, null);
});
