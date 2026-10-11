import { test } from "node:test";
import assert from "node:assert/strict";
import { PublishedSnapshot, instantToZonedTime } from "@rbb/content-schema";
import { ApiError } from "../src/errors.ts";
import { secretProblems } from "../src/modules/publishing/service.ts";
import { settingsRecord } from "./fixtures/settings.ts";
import { FACTS, member } from "./media/memory.ts";
import { harness, sharedData } from "./settings/memory.ts";
import { approvePage } from "./support/workflow.ts";

/* The announcement bar (M21): one typed record per organization — its
   messages in order, structure-only audit, owner-only approval, and the
   bar in the snapshot only while published. Test wording only. */

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
const item = (id: string, o: Record<string, unknown> = {}) => ({ id, text: `Message ${id}.`, ...o });

const site = async () => {
  const data = sharedData();
  const h = harness("org-a", data);
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  return { data, h };
};

test("announcement bar: empty to start; messages in order; links to this site only; no HTML, markers or windows", async () => {
  const { h } = await site();
  assert.equal((await h.announcementBar.get(editor)).record, null);
  const created = await h.announcementBar.update(editor, { revision: 0, changes: {} }, FACTS);
  assert.deepEqual([created.record!.id, created.record!.status, created.record!.items], ["announcement-bar", "draft", []]);
  for (const [name, items, part] of [
    ["an external link", [item("a", { link: { label: "Go", href: "https://example.net" } })], "items"],
    ["HTML", [item("a", { text: "<b>x</b>" })], "items"],
    ["working text", [item("a", { text: "Sample event tonight." })], "items"],
    ["a time window", [item("a", { endsAt: "2026-12-01T00:00:00Z" })], "items"],
    ["duplicate ids", [item("a"), item("a")], "items"],
  ] as const)
    await rejects(h.announcementBar.update(editor, { revision: created.revision, changes: { items } }, FACTS), "VALIDATION_ERROR", part).catch((e) => assert.fail(`${name}: ${e.message}`));
  const saved = await h.announcementBar.update(editor, { revision: created.revision, changes: { items: [item("b"), item("a", { link: { label: "See events", href: "/media/events" } })] } }, FACTS);
  assert.deepEqual(saved.record!.items.map((i) => i.id), ["b", "a"], "the order is the editor's");
  await rejects(h.announcementBar.update(editor, { revision: created.revision, changes: { items: [] } }, FACTS), "CONFLICT");
  const audit = h.audit.filter((e) => e.resourceType === "announcement_bar");
  assert.deepEqual(audit.map((e) => [e.action, e.resourceId]), [["announcement_bar.created", "announcement-bar"], ["announcement_bar.updated", "announcement-bar"]]);
  assert.deepEqual(audit[1]!.metadata.fields, ["items"]);
  assert.ok(!JSON.stringify(h.audit).includes("Message "), "no wording in the audit");
});

test("announcement bar: approval needs a message and an owner", async () => {
  const { h } = await site();
  let v = await h.announcementBar.update(editor, { revision: 0, changes: {} }, FACTS);
  v = await h.announcementBar.act(editor, "submit", { revision: v.revision }, FACTS);
  await rejects(h.announcementBar.act(editor, "approve", { revision: v.revision }, FACTS), "FORBIDDEN");
  await rejects(h.announcementBar.act(owner, "approve", { revision: v.revision }, FACTS), "VALIDATION_ERROR", "items");
  v = await h.announcementBar.act(owner, "reject", { revision: v.revision }, FACTS);
  await rejects(h.announcementBar.update(owner, { revision: v.revision, changes: { status: "approved" } }, FACTS), "VALIDATION_ERROR", "status");
  await h.announcementBar.update(editor, { revision: v.revision, changes: { items: [item("a")] } }, FACTS);
  assert.equal((await approvePage(h.announcementBar, owner, FACTS)).record!.status, "approved");
});

test("snapshot: the bar only once published; a pending edit keeps the live messages; archive removes it", async () => {
  const { h } = await site();
  await h.publishing.publish(owner, FACTS);
  await h.announcementBar.update(editor, { revision: 0, changes: { items: [item("a")] } }, FACTS);
  await rejects(h.publishing.publish(owner, FACTS), "CONFLICT");
  assert.equal((await h.publishing.publicSnapshot())!.content.announcementBar, undefined, "a draft is never published");
  await approvePage(h.announcementBar, owner, FACTS);
  await h.publishing.publish(owner, FACTS);
  let snapshot = (await h.publishing.publicSnapshot())!;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.deepEqual([snapshot.content.announcementBar!.status, snapshot.content.announcementBar!.items.map((i) => i.id)], ["published", ["a"]]);
  for (const leak of ["revision", "updatedBy", "createdAt", "updatedAt"]) assert.ok(!JSON.stringify(snapshot.content.announcementBar).includes(leak), leak);
  assert.deepEqual(secretProblems(snapshot), []);

  const live = await h.announcementBar.get(owner);
  await h.announcementBar.update(editor, { revision: live.revision, changes: { items: [item("a", { text: "Unapproved wording." })] } }, FACTS);
  await rejects(h.publishing.publish(owner, FACTS), "CONFLICT");
  snapshot = (await h.publishing.publicSnapshot())!;
  assert.ok(!JSON.stringify(snapshot).includes("Unapproved wording"));
  assert.equal(snapshot.content.announcementBar!.items[0]!.text, "Message a.");

  await h.announcementBar.archive(owner, FACTS);
  await h.publishing.publish(owner, FACTS);
  assert.equal((await h.publishing.publicSnapshot())!.content.announcementBar, undefined, "archived: the website's own messages return");
});

test("scheduling: the approved bar joins the publish that falls due; organizations stay apart", async () => {
  const { data, h } = await site();
  await h.publishing.publish(owner, FACTS);
  await h.announcementBar.update(editor, { revision: 0, changes: { items: [item("a")] } }, FACTS);
  const approved = await approvePage(h.announcementBar, owner, FACTS);
  const at = { localTime: instantToZonedTime(new Date(h.time.now().getTime() + HOUR).toISOString(), "UTC"), timeZone: "UTC" };
  await rejects(h.announcementBar.schedule(editor, { revision: approved.revision, ...at }, FACTS), "FORBIDDEN");
  await h.announcementBar.schedule(owner, { revision: approved.revision, ...at }, FACTS);
  assert.ok((await h.publishing.status(owner)).review.scheduled.some((s) => s.section === "Announcement bar"));
  h.time.advance(HOUR + 1);
  assert.equal((await h.publishing.runScheduled(FACTS)).outcome, "published");
  assert.equal((await h.publishing.publicSnapshot())!.content.announcementBar!.items.length, 1);

  const b = harness("org-b", data);
  await rejects(b.announcementBar.get(owner), "FORBIDDEN");
  assert.equal((await b.announcementBar.get(member("org-b", "OWNER"))).record, null);
});
