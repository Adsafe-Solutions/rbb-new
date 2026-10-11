import { test } from "node:test";
import assert from "node:assert/strict";
import { PublishedSnapshot, Report } from "@rbb/content-schema";
import { ApiError } from "../src/errors.ts";
import { settingsRecord } from "./fixtures/settings.ts";
import { FACTS, member } from "./media/memory.ts";
import { harness, sharedData } from "./settings/memory.ts";
import { approve, approvePage, createApproved } from "./support/workflow.ts";

/* Transparency and its documents (M11): a typed single record and an
   ordered collection, owner-only publishing, and both in the snapshot.
   Test data only: no real figures, no real files. */

const owner = member("org-a", "OWNER");
const editor = member("org-a", "EDITOR");
const rejects = async (promise: Promise<unknown>, code: string, pathPart?: string) =>
  assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError, String(error));
    assert.equal(error.code, code, error.message);
    if (pathPart) assert.ok(error.details?.some((d) => d.path.includes(pathPart) || d.message.includes(pathPart)), JSON.stringify(error.details));
    return true;
  });
const overview = (items = [{ id: "a", label: "Test A", percentage: 70 }, { id: "b", label: "Test B", percentage: 30 }]) => ({ year: 2026, verification: "pending-review", items });
const parts = (o: Record<string, unknown> = {}) => ({ heading: "Test transparency", intro: "A test intro.", financialOverview: overview(), accountability: ["A test paragraph."], ...o });
const doc = (o: Record<string, unknown> = {}) => ({ category: "annualReport", title: "Test report", fileUrl: "https://files.rbb.test/report.pdf", ...o });

test("transparency: one typed record; shares add up to 100; parts only; owner-only publishing; part-level audit", async () => {
  const data = sharedData();
  const h = harness("org-a", data);
  await rejects(h.transparency.create(editor, parts({ status: "published" }), FACTS), "VALIDATION_ERROR", "draft");
  await rejects(h.transparency.create(editor, parts({ financialOverview: overview([{ id: "a", label: "A", percentage: 70 }, { id: "b", label: "B", percentage: 20 }]) }), FACTS), "VALIDATION_ERROR", "100");
  await rejects(h.transparency.create(editor, parts({ sections: [] }), FACTS), "VALIDATION_ERROR", "sections");
  await rejects(h.transparency.create(editor, parts({ seo: { title: "T" } }), FACTS), "VALIDATION_ERROR", "seo");
  await rejects(h.transparency.create(editor, parts({ intro: "<p>x</p>" }), FACTS), "VALIDATION_ERROR", "intro");
  await rejects(h.transparency.create(editor, parts({ governance: { sections: [] } }), FACTS), "VALIDATION_ERROR", "governance");
  const created = await h.transparency.create(editor, parts(), FACTS);
  await rejects(h.transparency.create(editor, parts(), FACTS), "CONFLICT");
  assert.equal(created.record!.status, "draft");
  const edited = await h.transparency.update(editor, { revision: created.revision, changes: { financialOverview: overview([{ id: "a", label: "Test A", percentage: 60 }, { id: "b", label: "Test B", percentage: 40 }]), governance: { intro: "A test passage." } } }, FACTS);
  assert.deepEqual(h.audit.at(-1)!.metadata.fields, ["financialOverview.items", "governance"]);
  assert.ok(!JSON.stringify(h.audit).includes("Test A"), "no wording in the audit");
  const cleared = await h.transparency.update(editor, { revision: edited.revision, changes: { governance: null } }, FACTS);
  assert.equal(cleared.record!.governance, undefined, "null clears an optional part");
  await rejects(h.transparency.update(editor, { revision: edited.revision, changes: { heading: "Stale" } }, FACTS), "CONFLICT");
  await rejects(h.transparency.update(editor, { revision: cleared.revision, changes: { status: "published" } }, FACTS), "VALIDATION_ERROR", "status");
  const submitted = await h.transparency.act(editor, "submit", { revision: cleared.revision }, FACTS);
  await rejects(h.transparency.act(editor, "approve", { revision: submitted.revision }, FACTS), "FORBIDDEN");
  const published = await h.transparency.act(owner, "approve", { revision: submitted.revision }, FACTS);
  assert.equal(published.record!.status, "approved");
  assert.equal((await h.transparency.archive(editor, FACTS)).record!.status, "archived");
  assert.equal(h.audit.filter((e) => e.action === "transparency.archived").length, 1);
  await rejects(harness("org-b", data).transparency.get(owner), "FORBIDDEN");
});

test("documents: https links only, by category; one reorder event; owner-only publishing; isolation", async () => {
  const data = sharedData();
  const h = harness("org-a", data);
  const a = await h.reports.create(editor, doc(), FACTS);
  const b = await h.reports.create(editor, doc({ title: "Test statement", category: "financial", year: 2025, type: "PDF" }), FACTS);
  assert.deepEqual([a.record.order, b.record.order, a.record.status], [0, 1, "draft"]);
  assert.ok(Report.safeParse(b.record).success);
  for (const [name, input, path] of [
    ["http", doc({ title: "X1", fileUrl: "http://files.rbb.test/x.pdf" }), "fileUrl"],
    ["site path", doc({ title: "X2", fileUrl: "/files/x.pdf" }), "fileUrl"],
    ["javascript", doc({ title: "X3", fileUrl: "javascript:alert(1)" }), "fileUrl"],
    ["unknown category", doc({ title: "X4", category: "audit" }), "category"],
    ["a media id", doc({ title: "X5", mediaId: "m1" }), "mediaId"],
    ["no link", { category: "annualReport", title: "X6" }, "fileUrl"],
  ] as const)
    await rejects(h.reports.create(editor, input, FACTS), "VALIDATION_ERROR", path).catch((e) => assert.fail(`${name}: ${e}`));
  await h.reports.reorder(editor, { items: [b, a].map((v) => ({ id: v.record.id, revision: v.revision })) }, FACTS);
  assert.deepEqual(h.audit.filter((e) => e.action === "report.reordered").map((e) => e.metadata), [{ moved: 2, total: 2 }]);
  await rejects(h.reports.reorder(editor, { items: [a, b].map((v) => ({ id: v.record.id, revision: v.revision })) }, FACTS), "CONFLICT");
  const fresh = await h.reports.get(owner, a.record.id);
  await rejects(h.reports.update(editor, a.record.id, { revision: fresh.revision, changes: { status: "published" } }, FACTS), "VALIDATION_ERROR", "status");
  await rejects(h.reports.act(editor, a.record.id, "approve", { revision: fresh.revision }, FACTS), "FORBIDDEN");
  await approve(h.reports, owner, a.record.id, FACTS);
  assert.equal((await h.reports.archive(editor, b.record.id, FACTS)).record.status, "archived");
  await rejects(harness("org-b", data).reports.get(member("org-b", "OWNER"), a.record.id), "NOT_FOUND");
});

test("snapshot: transparency only while published; documents once one is published, published only", async () => {
  const data = sharedData();
  const h = harness("org-a", data);
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  await h.transparency.create(owner, parts(), FACTS);
  await h.reports.create(owner, doc({ title: "Draft document never public" }), FACTS);
  await h.publishing.publish(owner, FACTS);
  let snapshot = (await h.publishing.publicSnapshot())!;
  assert.equal(snapshot.content.transparency, undefined, "a draft record: the website keeps its own");
  assert.equal(snapshot.content.reports, undefined, "draft documents only: nothing listed");
  await approvePage(h.transparency, owner, FACTS);
  await createApproved(h.reports, owner, doc({ title: "Test report 2025", year: 2025 }), FACTS);
  const gone = await createApproved(h.reports, owner, doc({ title: "Archived document never public" }), FACTS);
  await h.reports.archive(owner, gone.record.id, FACTS);
  await h.publishing.publish(owner, FACTS);
  snapshot = (await h.publishing.publicSnapshot())!;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.equal(snapshot.content.transparency!.heading, "Test transparency");
  assert.deepEqual(snapshot.content.reports!.map((r) => r.title), ["Test report 2025"]);
  assert.ok(!JSON.stringify(snapshot).includes("never public"));
  assert.deepEqual((await h.publishing.status(owner)).changedSections, []);
});
