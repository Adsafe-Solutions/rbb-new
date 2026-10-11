import { test } from "node:test";
import assert from "node:assert/strict";
import { PublishedSnapshot, instantToZonedTime } from "@rbb/content-schema";
import { ApiError } from "../src/errors.ts";
import { secretProblems } from "../src/modules/publishing/service.ts";
import { settingsRecord } from "./fixtures/settings.ts";
import { FACTS, member } from "./media/memory.ts";
import { harness, sharedData } from "./settings/memory.ts";
import { approvePage } from "./support/workflow.ts";

/* Get Involved (M20): five fixed typed pages per organization — empty
   drafts, revisions, approval completeness, structure-only audit, and each
   page in the snapshot only while published. Test wording only. */

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
const pathContent = (o: Record<string, unknown> = {}) => ({ shortDescription: "A test line.", sections: [section()], ...o });
const hubContent = (o: Record<string, unknown> = {}) => ({ heading: "Test hub", intro: "A test introduction.", ...o });

const site = async () => {
  const data = sharedData();
  const h = harness("org-a", data);
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  return { data, h };
};

test("get involved: five fixed pages; a new page is empty; identity and unknown parts refused", async () => {
  const { h } = await site();
  const list = await h.getInvolvedDirectory.list(editor);
  assert.deepEqual(list.pages.map((p) => [p.id, p.route, p.view.record]), [["hub", "/get-involved", null], ["volunteer", "/get-involved/volunteer", null], ["fellowship", "/get-involved/fellowship", null], ["partner", "/get-involved/partner", null], ["travel", "/get-involved/travel", null]]);

  const path = await h.getInvolved.volunteer.update(editor, { revision: 0, changes: {} }, FACTS);
  assert.deepEqual(path.record, { ...path.record, id: "volunteer", status: "draft", sections: [] });
  assert.ok(!("shortDescription" in path.record!), "nothing is seeded");
  const hub = await h.getInvolved.hub.update(editor, { revision: 0, changes: {} }, FACTS);
  assert.deepEqual(Object.keys(hub.record!).filter((k) => !["id", "orgId", "schemaVersion", "status", "createdAt", "updatedAt"].includes(k)), [], "the hub starts empty");
  await rejects(h.getInvolved.volunteer.create(editor, {}, FACTS), "CONFLICT");

  for (const [name, changes, part] of [
    ["a title", { title: "Volunteer" }, "title"],
    ["a route", { to: "/x" }, "to"],
    ["an icon", { icon: "x" }, "icon"],
    ["HTML", { shortDescription: "<b>x</b>" }, "shortDescription"],
    ["working text", { sections: [section("a", { body: ["Demo — x."] })] }, "sections"],
    ["the reserved inquiry id", { sections: [section("inquiry")] }, "sections"],
    ["duplicate headings", { sections: [section("a"), section("b", { heading: "Heading a" })] }, "sections"],
    ["a release marker", { releaseMarker: "Sample" }, "releaseMarker"],
  ] as const)
    await rejects(h.getInvolved.volunteer.update(editor, { revision: path.revision, changes }, FACTS), "VALIDATION_ERROR", part).catch((e) => assert.fail(`${name}: ${e.message}`));
  for (const [name, changes] of [
    ["an address as a CTA", { closing: { heading: "H", primary: { label: "Go", href: "/appeals" } } }],
    ["an unknown CTA target", { closing: { heading: "H", primary: { label: "Go", target: "donate" } } }],
    ["path parts on the hub", { sections: [section()] }],
  ] as const)
    await rejects(h.getInvolved.hub.update(editor, { revision: hub.revision, changes }, FACTS), "VALIDATION_ERROR").catch((e) => assert.fail(`${name}: ${e.message}`));
  assert.equal((await h.getInvolved.travel.get(editor)).record, null, "each page is its own record");
});

test("get involved: a stale save is a 409; the audit names the page and its parts, never wording", async () => {
  const { h } = await site();
  const created = await h.getInvolved.partner.update(editor, { revision: 0, changes: pathContent({ hubNote: "Secret-looking note" }) }, FACTS);
  await h.getInvolved.partner.update(editor, { revision: created.revision, changes: { faq: { heading: "Questions", items: [{ question: "Wording question?", answer: "Wording answer." }] }, seo: { description: "Description wording." } } }, FACTS);
  await rejects(h.getInvolved.partner.update(editor, { revision: created.revision, changes: { hubNote: "Stale" } }, FACTS), "CONFLICT");
  await rejects(h.getInvolved.partner.act(editor, "submit", { revision: created.revision }, FACTS), "CONFLICT");
  const hub = await h.getInvolved.hub.update(editor, { revision: 0, changes: hubContent({ closing: { heading: "Closing wording", primary: { label: "Label wording", target: "appeals" } } }) }, FACTS);
  await h.getInvolved.hub.update(editor, { revision: hub.revision, changes: { closing: { heading: "Closing wording", primary: { label: "Label wording", target: "work" } } } }, FACTS);
  const entries = h.audit.filter((e) => e.resourceType === "get_involved");
  assert.deepEqual(entries.map((e) => [e.action, e.resourceId]), [["get_involved.created", "partner"], ["get_involved.updated", "partner"], ["get_involved.created", "hub"], ["get_involved.updated", "hub"]]);
  assert.deepEqual(entries[1]!.metadata.fields, ["faq", "seo"]);
  assert.deepEqual(entries[3]!.metadata.fields, ["closing.primary"]);
  const audited = JSON.stringify(h.audit);
  for (const words of ["Secret-looking", "Wording question", "Wording answer", "Description wording", "Closing wording", "Label wording", "Test paragraph"]) assert.ok(!audited.includes(words), `no wording in the audit: ${words}`);
});

test("get involved: approval needs a path's short description and a section, the hub's heading and intro; only owners approve", async () => {
  const { h } = await site();
  let v = await h.getInvolved.fellowship.update(editor, { revision: 0, changes: { hubNote: "Only a note." } }, FACTS);
  v = await h.getInvolved.fellowship.act(editor, "submit", { revision: v.revision }, FACTS);
  await rejects(h.getInvolved.fellowship.act(editor, "approve", { revision: v.revision }, FACTS), "FORBIDDEN");
  await rejects(h.getInvolved.fellowship.act(owner, "approve", { revision: v.revision }, FACTS), "VALIDATION_ERROR", "shortDescription");
  await rejects(h.getInvolved.fellowship.act(owner, "approve", { revision: v.revision }, FACTS), "VALIDATION_ERROR", "sections");
  v = await h.getInvolved.fellowship.act(owner, "reject", { revision: v.revision }, FACTS);
  await rejects(h.getInvolved.fellowship.update(owner, { revision: v.revision, changes: { status: "approved" } }, FACTS), "VALIDATION_ERROR", "status");
  await h.getInvolved.fellowship.update(editor, { revision: v.revision, changes: pathContent() }, FACTS);
  assert.equal((await approvePage(h.getInvolved.fellowship, owner, FACTS)).record!.status, "approved");

  let hub = await h.getInvolved.hub.update(editor, { revision: 0, changes: { heading: "Only a heading" } }, FACTS);
  hub = await h.getInvolved.hub.act(editor, "submit", { revision: hub.revision }, FACTS);
  await rejects(h.getInvolved.hub.act(owner, "approve", { revision: hub.revision }, FACTS), "VALIDATION_ERROR", "intro");
});

test("snapshot: published pages only, hub first then the paths in order; a pending edit keeps the live version; archive removes it", async () => {
  const { h } = await site();
  await h.publishing.publish(owner, FACTS);
  assert.equal((await h.publishing.publicSnapshot())!.content.getInvolved, undefined, "nothing published: the key is absent");

  await h.getInvolved.travel.update(editor, { revision: 0, changes: pathContent({ sections: [section("travel-a")] }) }, FACTS);
  await h.getInvolved.hub.update(editor, { revision: 0, changes: hubContent() }, FACTS);
  await h.getInvolved.volunteer.update(editor, { revision: 0, changes: pathContent() }, FACTS);
  await rejects(h.publishing.publish(owner, FACTS), "CONFLICT");
  assert.equal((await h.publishing.publicSnapshot())!.content.getInvolved, undefined, "drafts are never published");

  for (const id of ["travel", "hub"] as const) await approvePage(h.getInvolved[id], owner, FACTS);
  await h.publishing.publish(owner, FACTS);
  let snapshot = (await h.publishing.publicSnapshot())!;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.deepEqual(snapshot.content.getInvolved!.map((p) => [p.id, p.status]), [["hub", "published"], ["travel", "published"]]);
  const text = JSON.stringify(snapshot.content.getInvolved);
  for (const leak of ["revision", "updatedBy", "createdAt", "updatedAt", "pageId"]) assert.ok(!text.includes(leak), `leaked: ${leak}`);
  assert.deepEqual(secretProblems(snapshot), []);

  const travel = await h.getInvolved.travel.get(owner);
  assert.equal(travel.live, true);
  await h.getInvolved.travel.update(editor, { revision: travel.revision, changes: { sections: [section("travel-a", { body: ["Unapproved wording"] })] } }, FACTS);
  await rejects(h.publishing.publish(owner, FACTS), "CONFLICT");
  await approvePage(h.getInvolved.volunteer, owner, FACTS);
  await h.publishing.publish(owner, FACTS);
  snapshot = (await h.publishing.publicSnapshot())!;
  assert.ok(!JSON.stringify(snapshot).includes("Unapproved wording"), "a pending edit is never published");
  assert.deepEqual(snapshot.content.getInvolved!.map((p) => p.id), ["hub", "volunteer", "travel"]);
  assert.deepEqual((snapshot.content.getInvolved!.find((p) => p.id === "travel") as { sections: unknown }).sections, [section("travel-a")]);

  for (const id of ["hub", "volunteer", "travel"] as const) await h.getInvolved[id].archive(owner, FACTS);
  await h.publishing.publish(owner, FACTS);
  assert.equal((await h.publishing.publicSnapshot())!.content.getInvolved, undefined, "archived: the website's own words return");
});

test("scheduling: an approved page joins the publish that falls due", async () => {
  const { h } = await site();
  await h.publishing.publish(owner, FACTS);
  await h.getInvolved.partner.update(editor, { revision: 0, changes: pathContent() }, FACTS);
  const approved = await approvePage(h.getInvolved.partner, owner, FACTS);
  const at = { localTime: instantToZonedTime(new Date(h.time.now().getTime() + HOUR).toISOString(), "UTC"), timeZone: "UTC" };
  await rejects(h.getInvolved.partner.schedule(editor, { revision: approved.revision, ...at }, FACTS), "FORBIDDEN");
  assert.ok((await h.getInvolved.partner.schedule(owner, { revision: approved.revision, ...at }, FACTS)).schedule);
  assert.ok((await h.publishing.status(owner)).review.scheduled.some((s) => s.section === "Partner With Us page"));
  await rejects(h.publishing.publish(owner, FACTS), "CONFLICT");
  h.time.advance(HOUR + 1);
  assert.equal((await h.publishing.runScheduled(FACTS)).outcome, "published");
  assert.deepEqual((await h.publishing.publicSnapshot())!.content.getInvolved!.map((p) => p.id), ["partner"]);
  assert.ok(h.audit.some((e) => e.action === "get_involved.scheduled" && e.resourceId === "partner"));
});

test("get involved: organizations stay apart", async () => {
  const { data, h } = await site();
  await h.getInvolved.hub.update(editor, { revision: 0, changes: hubContent() }, FACTS);
  const b = harness("org-b", data);
  await rejects(b.getInvolved.hub.get(owner), "FORBIDDEN");
  await rejects(b.getInvolvedDirectory.list(owner), "FORBIDDEN");
  assert.equal((await b.getInvolved.hub.get(member("org-b", "OWNER"))).record, null);
});
