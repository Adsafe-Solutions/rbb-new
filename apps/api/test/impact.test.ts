import { test } from "node:test";
import assert from "node:assert/strict";
import { Metric, PublishedSnapshot } from "@rbb/content-schema";
import { ApiError } from "../src/errors.ts";
import { secretProblems } from "../src/modules/publishing/service.ts";
import { settingsRecord } from "./fixtures/settings.ts";
import { FACTS, member } from "./media/memory.ts";
import { addMedia, harness, sharedData } from "./settings/memory.ts";
import { approve, approvePage, createApproved, updateApproved } from "./support/workflow.ts";

/* Impact figures and the Impact page (M11): an ordered collection and a
   block page, owner-only publishing, and both in the snapshot — figures
   named, never restated. Test data only: the figures are made up. */

const owner = member("org-a", "OWNER");
const editor = member("org-a", "EDITOR");
const rejects = async (promise: Promise<unknown>, code: string, pathPart?: string) =>
  assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError, String(error));
    assert.equal(error.code, code, error.message);
    if (pathPart) assert.ok(error.details?.some((d) => d.path.includes(pathPart) || d.message.includes(pathPart)), JSON.stringify(error.details));
    return true;
  });
const figure = (o: Record<string, unknown> = {}) => ({ slug: "test-figure", value: "10+", label: "Test things counted", ...o });
const block = (id: string, type: string, data: unknown, enabled = true) => ({ id, type, enabled, version: 1, data });
const intro = () => block("intro", "intro", { kicker: "Our impact", title: "Test Impact", highlight: "Impact", body: "A test line." });
const stats = (metricIds: string[]) => block("at-a-glance", "stats", { heading: "At a glance.", metricIds, source: "A test source." });

test("figures: keyed, at the end, pending until verified; the contract's fields only", async () => {
  const h = harness("org-a", sharedData());
  const a = await h.metrics.create(editor, figure(), FACTS);
  const b = await h.metrics.create(editor, figure({ slug: "second", value: "25", label: "Second things" }), FACTS);
  assert.deepEqual([a.record.order, b.record.order], [0, 1]);
  assert.equal(a.record.verification, "pending-review", "a new figure is unverified");
  assert.equal(a.record.status, "draft");
  assert.ok(Metric.safeParse(a.record).success);
  await rejects(h.metrics.create(editor, figure({ slug: undefined }), FACTS), "VALIDATION_ERROR", "slug");
  await rejects(h.metrics.create(editor, figure({ slug: "test-figure" }), FACTS), "VALIDATION_ERROR", "slug");
  await rejects(h.metrics.create(editor, figure({ slug: "x", icon: "people" }), FACTS), "VALIDATION_ERROR", "icon");
  await rejects(h.metrics.create(editor, figure({ slug: "x", order: 3 }), FACTS), "VALIDATION_ERROR", "order");
  await rejects(h.metrics.create(editor, figure({ slug: "x", verification: "audited" }), FACTS), "VALIDATION_ERROR", "verification");
  await rejects(h.metrics.create(editor, figure({ slug: "x", value: "x".repeat(17) }), FACTS), "VALIDATION_ERROR", "value");
  assert.ok(!JSON.stringify(h.audit).includes("Test things counted"), "no wording in the audit");
});

test("figures: one reorder event; a stale order changes nothing; owner-only publishing; isolation", async () => {
  const data = sharedData();
  const h = harness("org-a", data);
  const b = harness("org-b", data);
  const x = await h.metrics.create(owner, figure({ slug: "x" }), FACTS);
  const y = await h.metrics.create(owner, figure({ slug: "y" }), FACTS);
  await h.metrics.reorder(editor, { items: [y, x].map((v) => ({ id: v.record.id, revision: v.revision })) }, FACTS);
  assert.deepEqual(h.audit.filter((e) => e.action === "metric.reordered").map((e) => e.metadata), [{ moved: 2, total: 2 }]);
  await rejects(h.metrics.reorder(editor, { items: [x, y].map((v) => ({ id: v.record.id, revision: v.revision })) }, FACTS), "CONFLICT");
  assert.deepEqual((await h.metrics.list(owner, {})).items.map((v) => [v.record.slug, v.record.order]).sort(), [["x", 1], ["y", 0]], "unchanged");
  const fresh = await h.metrics.get(owner, x.record.id);
  await rejects(h.metrics.update(editor, x.record.id, { revision: fresh.revision, changes: { status: "published" } }, FACTS), "VALIDATION_ERROR", "status");
  const submitted = await h.metrics.act(editor, x.record.id, "submit", { revision: fresh.revision }, FACTS);
  await rejects(h.metrics.act(editor, x.record.id, "approve", { revision: submitted.revision }, FACTS), "FORBIDDEN");
  await h.metrics.act(owner, x.record.id, "withdraw", { revision: submitted.revision }, FACTS);
  await updateApproved(h.metrics, owner, x.record.id, { revision: submitted.revision + 1, changes: { verification: "verified" } }, FACTS);
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  await h.publishing.publish(owner, FACTS);
  const published = await h.metrics.get(owner, x.record.id);
  assert.equal(published.record.status, "published");
  await rejects(h.metrics.update(owner, x.record.id, { revision: published.revision, changes: { slug: "renamed" } }, FACTS), "CONFLICT", "slug");
  await rejects(h.metrics.update(editor, x.record.id, { revision: published.revision - 1, changes: { value: "11+" } }, FACTS), "CONFLICT");
  assert.equal((await h.metrics.archive(editor, x.record.id, FACTS)).record.status, "archived");
  assert.equal(h.audit.filter((e) => e.action === "metric.archived").length, 1);
  await rejects(b.metrics.get(member("org-b", "OWNER"), x.record.id), "NOT_FOUND");
  await rejects(h.metrics.get(member("org-b", "OWNER"), x.record.id), "FORBIDDEN");
});

test("impact page: /impact's chapters; unknown, HTML and marked blocks refused; owner-only publishing; revisions", async () => {
  const data = sharedData();
  const h = harness("org-a", data);
  const image = addMedia(data, "org-a", "ready", { alt: "A test image" });
  const theirs = addMedia(data, "org-b", "ready");
  await rejects(h.impact.create(editor, { sections: [intro()], status: "published" }, FACTS), "VALIDATION_ERROR", "draft");
  const created = await h.impact.create(editor, { sections: [intro(), stats(["test-figure"])] }, FACTS);
  assert.equal(created.record!.status, "draft");
  assert.deepEqual(h.audit.find((e) => e.action === "impact.created")!.metadata, { fields: ["sections", "status"], status: "draft", sections: 2 });
  for (const [name, sections, path] of [
    ["unknown block", [intro(), block("x", "carousel", {})], "type"],
    ["HTML", [intro(), block("x", "measurement", { heading: "H", items: [], html: "<b>x</b>" })], "html"],
    ["release marker", [intro(), block("x", "measurement", { heading: "H", items: [], releaseMarker: "sample" })], "releaseMarker"],
    ["intro not first", [stats(["a"]), intro()], "first"],
    ["restated figure", [intro(), block("s", "stats", { heading: "S", metricIds: ["a"], value: "120+" })], "value"],
  ] as const)
    await rejects(h.impact.update(editor, { revision: created.revision, changes: { sections } }, FACTS), "VALIDATION_ERROR", path).catch((e) => assert.fail(`${name}: ${e}`));
  await rejects(h.impact.update(editor, { revision: created.revision, changes: { seo: { ogImageId: theirs.id } } }, FACTS), "VALIDATION_ERROR", "media");
  const edited = await h.impact.update(editor, { revision: created.revision, changes: { seo: { title: "SEO", ogImageId: image.id } } }, FACTS);
  await rejects(h.impact.update(editor, { revision: created.revision, changes: { seo: null } }, FACTS), "CONFLICT");
  await rejects(h.impact.update(editor, { revision: edited.revision, changes: { status: "published" } }, FACTS), "VALIDATION_ERROR", "status");
  const submitted = await h.impact.act(editor, "submit", { revision: edited.revision }, FACTS);
  await rejects(h.impact.act(editor, "approve", { revision: submitted.revision }, FACTS), "FORBIDDEN");
  await rejects(h.impact.act(owner, "approve", { revision: edited.revision }, FACTS), "CONFLICT");
  const published = await h.impact.act(owner, "approve", { revision: submitted.revision }, FACTS);
  assert.equal(published.record!.status, "approved");
  const byEditor = await h.impact.update(editor, { revision: published.revision, changes: { sections: [intro(), stats(["test-figure", "second"])] } }, FACTS);
  assert.equal(byEditor.record!.status, "draft", "an editor's edit returns an approved page to draft");
  assert.deepEqual(h.audit.at(-1)!.metadata.fields, ["sections.at-a-glance.data.metricIds", "status"]);
  assert.equal((await h.impact.archive(editor, FACTS)).record!.status, "archived");
  await rejects(harness("org-b", data).impact.get(owner), "FORBIDDEN");
  assert.equal((await harness("org-b", data).impact.get(member("org-b", "OWNER"))).record, null, "another organization's page is its own");
});

test("snapshot: figures only once one is published; every stats block names a published figure; atomic", async () => {
  const data = sharedData();
  const h = harness("org-a", data);
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  // A CMS homepage naming the website's own figures, before the CMS manages any.
  await h.homepage.create(owner, { sections: [block("impact", "stats", { heading: "Figures", metricIds: ["test-figure", "second"] })] }, FACTS);
  await approvePage(h.homepage, owner, FACTS);
  await h.metrics.create(owner, figure(), FACTS);
  await h.publishing.publish(owner, FACTS);
  let snapshot = (await h.publishing.publicSnapshot())!;
  assert.equal(snapshot.content.metrics, undefined, "drafts only: the website keeps its own figures");

  // Publishing ONE figure makes the CMS the source: the homepage's "second" is then unpublished.
  const first = (await h.metrics.list(owner, {})).items[0]!;
  await approve(h.metrics, owner, first.record.id, FACTS);
  await rejects(h.publishing.publish(owner, FACTS), "VALIDATION_ERROR", 'figure "second"');
  assert.equal((await h.publishing.publicSnapshot())!.version, 1, "the live snapshot is untouched");
  const second = await createApproved(h.metrics, owner, figure({ slug: "second", value: "25", label: "Second things" }), FACTS);
  await h.metrics.create(owner, figure({ slug: "draft-figure", label: "Draft figure never public" }), FACTS);
  const gone = await createApproved(h.metrics, owner, figure({ slug: "gone", label: "Archived figure never public" }), FACTS);
  await h.metrics.archive(owner, gone.record.id, FACTS);
  const firstNow = await h.metrics.get(owner, first.record.id);
  await h.metrics.reorder(owner, { items: [second, firstNow].map((v) => ({ id: v.record.id, revision: v.revision })) }, FACTS);
  await h.impact.create(owner, { sections: [intro(), stats(["second"]), block("closing", "cta", { heading: "Go.", primary: { label: "Go", href: "/get-involved" } }, false)] }, FACTS);
  await approvePage(h.impact, owner, FACTS);
  await h.publishing.publish(owner, FACTS);
  snapshot = (await h.publishing.publicSnapshot())!;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.deepEqual(snapshot.content.metrics!.map((m) => m.slug), ["second", "test-figure"], "in order");
  assert.deepEqual(snapshot.content.impact!.sections.map((s) => s.type), ["intro", "stats"], "enabled blocks only");
  const text = JSON.stringify(snapshot);
  for (const leak of ["never public", "revision", "updatedBy", "slugHistory", "objectKey"]) assert.ok(!text.includes(leak), `leaked: ${leak}`);
  assert.deepEqual(secretProblems(snapshot), []);

  // The Impact page names a figure that is then archived: the whole publish is refused.
  await h.metrics.archive(owner, second.record.id, FACTS);
  await rejects(h.publishing.publish(owner, FACTS), "VALIDATION_ERROR", "not published");
  assert.equal((await h.publishing.publicSnapshot())!.version, 2);
  // Archived, the Impact page leaves the snapshot (the website's own page returns); the homepage's
  // change is approved before it replaces the live homepage, which names the archived figure.
  await h.impact.archive(owner, FACTS);
  const home = await h.homepage.get(owner);
  await h.homepage.update(owner, { revision: home.revision, changes: { sections: [block("impact", "stats", { heading: "Figures", metricIds: ["test-figure"] })] } }, FACTS);
  await rejects(h.publishing.publish(owner, FACTS), "VALIDATION_ERROR", "not published");
  await approvePage(h.homepage, owner, FACTS);
  await h.publishing.publish(owner, FACTS);
  assert.equal((await h.publishing.publicSnapshot())!.content.impact, undefined);
});
