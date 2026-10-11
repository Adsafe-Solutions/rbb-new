import { test } from "node:test";
import assert from "node:assert/strict";
import { PublishedSnapshot } from "@rbb/content-schema";
import { ApiError } from "../src/errors.ts";
import { secretProblems } from "../src/modules/publishing/service.ts";
import { settingsRecord } from "./fixtures/settings.ts";
import { FACTS, member } from "./media/memory.ts";
import { harness, sharedData } from "./settings/memory.ts";
import { approvePage } from "./support/workflow.ts";

/* Careers (M13): one typed page per organization — lifecycle, revisions,
   part-level audit, owner-only publishing — and it in the snapshot only
   while published. Test data only: no real role is named. */

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
  title: "Test careers",
  intro: "A test intro.",
  why: { heading: "Why", body: ["A test paragraph."] },
  opportunities: { heading: "Open opportunities", empty: "None at the moment.", roles: [] },
  closing: { heading: "Explore.", primary: { label: "About Us", href: "/about" }, secondary: { label: "Contact", href: "/contact" } },
  ...o,
});

test("careers: one typed page — parts only, no HTML, no invented role fields, no image", async () => {
  const data = sharedData();
  const h = harness("org-a", data);
  await rejects(h.careers.create(editor, page({ status: "published" }), FACTS), "VALIDATION_ERROR", "draft");
  await rejects(h.careers.create(editor, page({ sections: [] }), FACTS), "VALIDATION_ERROR", "sections");
  await rejects(h.careers.create(editor, page({ intro: "<script>x</script>" }), FACTS), "VALIDATION_ERROR", "intro");
  await rejects(h.careers.create(editor, page({ opportunities: { heading: "O", empty: "N.", roles: [{ title: "R", salary: "1" }] } }), FACTS), "VALIDATION_ERROR", "salary");
  await rejects(h.careers.create(editor, page({ seo: { ogImageId: "img" } }), FACTS), "VALIDATION_ERROR", "ogImageId");
  await rejects(h.careers.create(editor, page({ closing: { heading: "E.", primary: { label: "Go", href: "javascript:alert(1)" } } }), FACTS), "VALIDATION_ERROR", "href");
  const created = await h.careers.create(editor, page(), FACTS);
  assert.equal(created.record!.status, "draft");
  await rejects(h.careers.create(editor, page(), FACTS), "CONFLICT");
  const roles = await h.careers.update(editor, { revision: created.revision, changes: { opportunities: { heading: "Open opportunities", empty: "None at the moment.", roles: [{ title: "Test role A" }, { title: "Test role B" }] } } }, FACTS);
  assert.deepEqual(h.audit.at(-1)!.metadata.fields, ["opportunities.roles"]);
  assert.ok(!JSON.stringify(h.audit).includes("Test role A"), "no wording in the audit");
  await rejects(h.careers.update(editor, { revision: created.revision, changes: { title: "Stale" } }, FACTS), "CONFLICT");
  const cleared = await h.careers.update(editor, { revision: roles.revision, changes: { why: null } }, FACTS);
  assert.equal(cleared.record!.why, undefined, "null clears an optional section");
  await rejects(h.careers.update(editor, { revision: cleared.revision, changes: { status: "published" } }, FACTS), "VALIDATION_ERROR", "status");
  const submitted = await h.careers.act(editor, "submit", { revision: cleared.revision }, FACTS);
  await rejects(h.careers.update(editor, { revision: submitted.revision, changes: { intro: "Changed while submitted." } }, FACTS), "CONFLICT", "submitted");
  await rejects(h.careers.act(editor, "approve", { revision: submitted.revision }, FACTS), "FORBIDDEN");
  const approved = await h.careers.act(owner, "approve", { revision: submitted.revision }, FACTS);
  assert.equal(approved.record!.status, "approved");
  const byEditor = await h.careers.update(editor, { revision: approved.revision, changes: { intro: "Edited by an editor." } }, FACTS);
  assert.equal(byEditor.record!.status, "draft", "an edit after approval returns it to draft");
  assert.equal((await h.careers.archive(editor, FACTS)).record!.status, "archived");
  assert.equal(h.audit.filter((e) => e.action === "careers.archived").length, 1);
  await rejects(harness("org-b", data).careers.get(owner), "FORBIDDEN");
  assert.equal((await harness("org-b", data).careers.get(member("org-b", "OWNER"))).record, null, "another organization's own page");
});

test("snapshot: careers only while published, its roles in order; a draft or archive leaves the website's own page", async () => {
  const h = harness("org-a", sharedData());
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  const created = await h.careers.create(owner, page({ opportunities: { heading: "Open", empty: "None.", roles: [{ title: "Draft-only role never public" }] } }), FACTS);
  await h.publishing.publish(owner, FACTS);
  assert.equal((await h.publishing.publicSnapshot())!.content.careers, undefined, "a draft: the website keeps its own Careers page");
  await h.careers.update(owner, { revision: created.revision, changes: { opportunities: { heading: "Open", empty: "None.", roles: [{ title: "Test role B" }, { title: "Test role A" }] } } }, FACTS);
  await approvePage(h.careers, owner, FACTS);
  await h.publishing.publish(owner, FACTS);
  const snapshot = (await h.publishing.publicSnapshot())!;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.deepEqual(snapshot.content.careers!.opportunities.roles.map((r) => r.title), ["Test role B", "Test role A"]);
  const text = JSON.stringify(snapshot.content.careers);
  for (const leak of ["never public", "revision", "updatedBy", "createdAt", "updatedAt"]) assert.ok(!text.includes(leak), `leaked: ${leak}`);
  assert.deepEqual(secretProblems(snapshot), []);
  await h.careers.archive(owner, FACTS);
  await h.publishing.publish(owner, FACTS);
  assert.equal((await h.publishing.publicSnapshot())!.content.careers, undefined, "archived: the website's own page returns");
});
