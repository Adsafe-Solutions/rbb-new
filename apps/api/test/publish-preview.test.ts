import { test } from "node:test";
import assert from "node:assert/strict";
import { PublishedSnapshot } from "@rbb/content-schema";
import { ApiError } from "../src/errors.ts";
import { settingsRecord } from "./fixtures/settings.ts";
import { FACTS, member } from "./media/memory.ts";
import { harness, sharedData } from "./settings/memory.ts";
import { approve, approvePage } from "./support/workflow.ts";

/* M36: the owner's preview of what the next publish would put live —
   approved records, never drafts; read only (no version, nothing marked
   published, the public snapshot untouched); owners of this organization
   only. Test records only. */

const owner = member("org-a", "OWNER");
const editor = member("org-a", "EDITOR");
const rejects = async (promise: Promise<unknown>, code: string) =>
  assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError, String(error));
    assert.equal(error.code, code, error.message);
    return true;
  });

const site = async () => {
  const data = sharedData();
  const h = harness("org-a", data);
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  return { data, h };
};
const program = (title: string, slug: string) => ({ title, slug, icon: "education", description: "A test line." });
const intro = { id: "intro", type: "pageHero", enabled: true, version: 1, data: { title: "About a test organization", body: "A test line." } };

test("preview: approved records, not drafts — and nothing is stored, marked or published", async () => {
  const { h } = await site();
  const approved = await approve(h.programs, owner, (await h.programs.create(owner, program("Approved area", "approved-area"), FACTS)).record.id, FACTS);
  const draft = await h.programs.create(owner, program("Draft area", "draft-area"), FACTS);
  await h.about.create(owner, { sections: [intro] }, FACTS);
  await approvePage(h.about, owner, FACTS);

  const preview = await h.publishing.preview(owner);
  assert.deepEqual(preview.problems, []);
  assert.equal(preview.basedOnVersion, null, "nothing is live yet");
  const snapshot = preview.snapshot!;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success, "the same contract a publish stores");
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.organization.id, "org-a");
  assert.deepEqual(snapshot.content.programs!.map((p) => p.slug), ["approved-area"], "approved only — the draft is not in it");
  assert.deepEqual(snapshot.content.about!.sections.map((s) => s.type), ["pageHero"], "the approved About page");

  // Read only: no snapshot, nothing marked published, the public endpoint unchanged.
  assert.equal(await h.publishing.publicSnapshot(), null);
  assert.equal((await h.publishing.status(owner)).active, null);
  assert.equal((await h.programs.get(owner, approved.record.id)).record.status, "approved");
  assert.equal((await h.programs.get(owner, draft.record.id)).record.status, "draft");
  assert.equal((await h.about.get(owner)).record!.status, "approved");
  assert.equal(h.audit.filter((e) => e.resourceType === "snapshot").length, 0, "no publish (publish.completed / .rejected) was recorded");
});

test("preview: owners only, and only their own organization", async () => {
  const { data, h } = await site();
  await rejects(h.publishing.preview(editor), "FORBIDDEN");
  await rejects(h.publishing.preview(member("org-b", "OWNER")), "FORBIDDEN");
  const b = harness("org-b", data);
  await rejects(b.publishing.preview(member("org-b", "OWNER")), "CONFLICT"); // org-b has no settings — org-a's are never used
  await b.settings.importInitial(settingsRecord("org-b"), { id: null, name: "Settings import" });
  await approve(h.programs, owner, (await h.programs.create(owner, program("Org A area", "org-a-area"), FACTS)).record.id, FACTS);
  const other = (await b.publishing.preview(member("org-b", "OWNER"))).snapshot!;
  assert.equal(other.organization.id, "org-b");
  assert.equal(other.content.programs, undefined, "another organization's approved records never appear");
});

test("preview after a publish: follows the live version; a pending edit keeps the live version", async () => {
  const { h } = await site();
  const p = await approve(h.programs, owner, (await h.programs.create(owner, program("Area", "area"), FACTS)).record.id, FACTS);
  await h.publishing.publish(owner, FACTS);
  const live = (await h.publishing.publicSnapshot())!;
  assert.equal(h.audit.filter((e) => e.action === "publish.completed").length, 1, "the audit names a publish this way — the first test's zero is meaningful");
  await h.programs.update(owner, p.record.id, { revision: (await h.programs.get(owner, p.record.id)).revision, changes: { description: "An unapproved edit." } }, FACTS);
  const preview = await h.publishing.preview(owner);
  assert.equal(preview.basedOnVersion, live.version);
  assert.equal(preview.snapshot!.version, live.version + 1);
  assert.equal(preview.snapshot!.content.programs![0]!.description, "A test line.", "the edit is a draft: the live version is what would stay");
  assert.deepEqual(await h.publishing.publicSnapshot(), live, "the public snapshot is unchanged");
});
