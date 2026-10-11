import { test } from "node:test";
import assert from "node:assert/strict";
import { PublishedSnapshot, instantToZonedTime } from "@rbb/content-schema";
import { ApiError } from "../src/errors.ts";
import { secretProblems } from "../src/modules/publishing/service.ts";
import { settingsRecord } from "./fixtures/settings.ts";
import { FACTS, member } from "./media/memory.ts";
import { addMedia, harness, sharedData } from "./settings/memory.ts";
import { approvePage } from "./support/workflow.ts";

/* The site popup (M22): one typed record per organization — the Popup
   contract and the website's rules, a ready and described photograph,
   structure-only audit, owner-only approval, and the popup in the
   snapshot only while published. Test wording only. */

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

const site = async () => {
  const data = sharedData();
  const h = harness("org-a", data);
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  const image = addMedia(data, "org-a", "ready", { alt: "Two people at a market stall" });
  const content = (o: Record<string, unknown> = {}) => ({ key: "test-popup-1", heading: "A test heading.", body: "A test line.", imageId: image.id, cta: { label: "See events", href: "/media/events" }, dismissLabel: "Not now", delayMs: 6000, frequency: "session", excludePaths: ["/contact"], ...o });
  return { data, h, image, content };
};

test("popup: created whole; the website's rules; ready images of this organization only", async () => {
  const { data, h, content } = await site();
  assert.equal((await h.popup.get(editor)).record, null);
  await rejects(h.popup.update(editor, { revision: 0, changes: {} }, FACTS), "VALIDATION_ERROR", "heading");
  for (const [name, o, part] of [
    ["an external call to action", { cta: { label: "Go", href: "https://partner.rbb.test" } }, "cta.href"],
    ["a page allow-list", { includePaths: ["/"] }, "includePaths"],
    ["a time window", { endsAt: "2026-12-01T00:00:00Z" }, "endsAt"],
    ["working text", { body: "Sample event this week." }, "body"],
    ["HTML", { heading: "<b>x</b>" }, "heading"],
    ["an image still uploading", { imageId: addMedia(data, "org-a", "pending").id }, "ready image"],
    ["another organization's image", { imageId: addMedia(data, "org-b", "ready", { alt: "x" }).id }, "ready image"],
  ] as const)
    await rejects(h.popup.update(editor, { revision: 0, changes: content(o) }, FACTS), "VALIDATION_ERROR", part).catch((e) => assert.fail(`${name}: ${e.message}`));
  const created = await h.popup.update(editor, { revision: 0, changes: content() }, FACTS);
  assert.deepEqual([created.record!.id, created.record!.status, created.record!.key], ["site-popup", "draft", "test-popup-1"]);
  await rejects(h.popup.create(editor, content(), FACTS), "CONFLICT");
  const edited = await h.popup.update(editor, { revision: created.revision, changes: { key: "test-popup-2", kicker: "Kicker wording", cta: { label: "Label wording", href: "/appeals" } } }, FACTS);
  await rejects(h.popup.update(editor, { revision: created.revision, changes: { body: "Stale." } }, FACTS), "CONFLICT");
  const cleared = await h.popup.update(editor, { revision: edited.revision, changes: { kicker: null } }, FACTS);
  assert.equal(cleared.record!.kicker, undefined, "null clears an optional part");
  const trail = h.audit.filter((e) => e.resourceType === "popup");
  assert.deepEqual(trail.map((e) => e.action), ["popup.created", "popup.updated", "popup.updated"]);
  assert.deepEqual(trail[1]!.metadata.fields, ["cta.href", "cta.label", "key", "kicker"]);
  for (const words of ["Kicker wording", "Label wording", "A test heading", "A test line"]) assert.ok(!JSON.stringify(h.audit).includes(words), words);
});

test("popup: an undescribed photograph cannot be submitted; owners approve", async () => {
  const { data, h, content } = await site();
  const bare = addMedia(data, "org-a", "ready", { alt: "" });
  let v = await h.popup.update(editor, { revision: 0, changes: content({ imageId: bare.id }) }, FACTS);
  await rejects(h.popup.act(editor, "submit", { revision: v.revision }, FACTS), "VALIDATION_ERROR", "alt text");
  v = await h.popup.update(editor, { revision: v.revision, changes: { imageId: content().imageId } }, FACTS);
  v = await h.popup.act(editor, "submit", { revision: v.revision }, FACTS);
  await rejects(h.popup.act(editor, "approve", { revision: v.revision }, FACTS), "FORBIDDEN");
  v = await h.popup.act(owner, "approve", { revision: v.revision }, FACTS);
  assert.equal(v.record!.status, "approved");
});

test("snapshot: the popup and its photograph only once published; a pending edit keeps the live popup; archive removes it", async () => {
  const { h, image, content } = await site();
  await h.publishing.publish(owner, FACTS);
  await h.popup.update(editor, { revision: 0, changes: content() }, FACTS);
  await rejects(h.publishing.publish(owner, FACTS), "CONFLICT");
  assert.equal((await h.publishing.publicSnapshot())!.content.popup, undefined, "a draft is never published");
  await approvePage(h.popup, owner, FACTS);
  await h.publishing.publish(owner, FACTS);
  let snapshot = (await h.publishing.publicSnapshot())!;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.deepEqual([snapshot.content.popup!.status, snapshot.content.popup!.key], ["published", "test-popup-1"]);
  assert.equal(snapshot.media[image.id]!.alt, "Two people at a market stall", "its photograph travels with it");
  for (const leak of ["revision", "updatedBy", "createdAt", "updatedAt", "objectKey"]) assert.ok(!JSON.stringify(snapshot.content.popup).includes(leak), leak);
  assert.deepEqual(secretProblems(snapshot), []);
  assert.ok((await h.publishing.mediaUsage(image.id)).some((u) => u.startsWith("Popup")), "its photograph cannot be deleted while it is used");

  const live = await h.popup.get(owner);
  await h.popup.update(editor, { revision: live.revision, changes: { body: "Unapproved wording." } }, FACTS);
  await rejects(h.publishing.publish(owner, FACTS), "CONFLICT");
  snapshot = (await h.publishing.publicSnapshot())!;
  assert.ok(!JSON.stringify(snapshot).includes("Unapproved wording"));

  await h.popup.archive(owner, FACTS);
  await h.publishing.publish(owner, FACTS);
  snapshot = (await h.publishing.publicSnapshot())!;
  assert.equal(snapshot.content.popup, undefined, "archived: the website's own popup returns");
  assert.equal(snapshot.media[image.id], undefined, "and its photograph leaves the snapshot");
});

test("scheduling: the approved popup joins the publish that falls due; organizations stay apart", async () => {
  const { data, h, content } = await site();
  await h.publishing.publish(owner, FACTS);
  await h.popup.update(editor, { revision: 0, changes: content() }, FACTS);
  const approved = await approvePage(h.popup, owner, FACTS);
  const at = { localTime: instantToZonedTime(new Date(h.time.now().getTime() + HOUR).toISOString(), "UTC"), timeZone: "UTC" };
  await rejects(h.popup.schedule(editor, { revision: approved.revision, ...at }, FACTS), "FORBIDDEN");
  await h.popup.schedule(owner, { revision: approved.revision, ...at }, FACTS);
  assert.ok((await h.publishing.status(owner)).review.scheduled.some((s) => s.section === "Popup"));
  h.time.advance(HOUR + 1);
  assert.equal((await h.publishing.runScheduled(FACTS)).outcome, "published");
  assert.equal((await h.publishing.publicSnapshot())!.content.popup!.key, "test-popup-1");
  const b = harness("org-b", data);
  await rejects(b.popup.get(owner), "FORBIDDEN");
  assert.equal((await b.popup.get(member("org-b", "OWNER"))).record, null);
});
