import { test } from "node:test";
import assert from "node:assert/strict";
import { PublishedSnapshot } from "@rbb/content-schema";
import { ApiError } from "../src/errors.ts";
import { secretProblems } from "../src/modules/publishing/service.ts";
import { settingsRecord } from "./fixtures/settings.ts";
import { FACTS, member } from "./media/memory.ts";
import { harness, sharedData } from "./settings/memory.ts";
import { approvePage } from "./support/workflow.ts";

/* How We Work (#7): one typed page per organization — lifecycle,
   revisions, part-level audit, owner-only publishing — and it in the
   snapshot only while published. Test data only: not RBB's words. */

const owner = member("org-a", "OWNER");
const editor = member("org-a", "EDITOR");
const rejects = async (promise: Promise<unknown>, code: string, pathPart?: string) =>
  assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError, String(error));
    assert.equal(error.code, code, error.message);
    if (pathPart) assert.ok(error.details?.some((d) => d.path.includes(pathPart) || d.message.includes(pathPart)), JSON.stringify(error.details));
    return true;
  });
const page = (o: Record<string, unknown> = {}) => ({
  heading: "Test heading",
  body: "A test opening line.",
  practices: { heading: "Test practices.", items: [{ title: "Test practice", description: "A test line.", icon: "community" }] },
  rows: [{ id: "first", heading: "Test passage", body: "A test passage.", items: ["One.", "Two."] }],
  ...o,
});

test("how we work: one typed page — parts only, no HTML, the site's glyphs only, the site's links and SEO stay", async () => {
  const data = sharedData();
  const h = harness("org-a", data);
  await rejects(h.howWeWork.create(editor, page({ status: "published" }), FACTS), "VALIDATION_ERROR", "draft");
  await rejects(h.howWeWork.create(editor, page({ body: "<script>x</script>" }), FACTS), "VALIDATION_ERROR", "body");
  await rejects(h.howWeWork.create(editor, page({ practices: { heading: "P", items: [{ title: "T", description: "D.", icon: "rocket" }] } }), FACTS), "VALIDATION_ERROR", "icon");
  await rejects(h.howWeWork.create(editor, page({ closing: { heading: "C." } }), FACTS), "VALIDATION_ERROR", "closing");
  await rejects(h.howWeWork.create(editor, page({ seo: { title: "T" } }), FACTS), "VALIDATION_ERROR", "seo");
  const created = await h.howWeWork.create(editor, page(), FACTS);
  assert.equal(created.record!.status, "draft");
  assert.equal(created.record!.id, "how_we_work");
  await rejects(h.howWeWork.create(editor, page(), FACTS), "CONFLICT");
  const rows = await h.howWeWork.update(editor, { revision: created.revision, changes: { rows: [{ id: "a", heading: "Secret-ish wording", body: "B." }] } }, FACTS);
  assert.deepEqual(h.audit.at(-1)!.metadata.fields, ["rows"]);
  assert.equal(h.audit.at(-1)!.action, "how_we_work.updated");
  assert.ok(!JSON.stringify(h.audit).includes("Secret-ish wording"), "no wording in the audit");
  const submitted = await h.howWeWork.act(editor, "submit", { revision: rows.revision }, FACTS);
  await rejects(h.howWeWork.act(editor, "approve", { revision: submitted.revision }, FACTS), "FORBIDDEN");
  assert.equal((await h.howWeWork.act(owner, "approve", { revision: submitted.revision }, FACTS)).record!.status, "approved");
  assert.equal((await h.howWeWork.archive(editor, FACTS)).record!.status, "archived");
  assert.equal((await harness("org-b", data).howWeWork.get(member("org-b", "OWNER"))).record, null, "another organization's own page");
});

test("snapshot: how we work only while published; a draft or archive leaves the website's own page", async () => {
  const h = harness("org-a", sharedData());
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  await h.howWeWork.create(owner, page({ heading: "Draft-only heading never public" }), FACTS);
  await h.publishing.publish(owner, FACTS);
  assert.equal((await h.publishing.publicSnapshot())!.content.howWeWork, undefined, "a draft: the website keeps its own page");
  const current = await h.howWeWork.get(owner);
  await h.howWeWork.update(owner, { revision: current.revision, changes: { heading: "Test heading" } }, FACTS);
  await approvePage(h.howWeWork, owner, FACTS);
  await h.publishing.publish(owner, FACTS);
  const snapshot = (await h.publishing.publicSnapshot())!;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.equal(snapshot.content.howWeWork!.heading, "Test heading");
  const text = JSON.stringify(snapshot.content.howWeWork);
  for (const leak of ["never public", "revision", "updatedBy", "createdAt", "updatedAt"]) assert.ok(!text.includes(leak), `leaked: ${leak}`);
  assert.deepEqual(secretProblems(snapshot), []);
  await h.howWeWork.archive(owner, FACTS);
  await h.publishing.publish(owner, FACTS);
  assert.equal((await h.publishing.publicSnapshot())!.content.howWeWork, undefined, "archived: the website's own page returns");
});
