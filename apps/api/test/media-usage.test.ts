import { test } from "node:test";
import assert from "node:assert/strict";
import { instantToZonedTime } from "@rbb/content-schema";
import { ApiError } from "../src/errors.ts";
import { AuditService } from "../src/modules/audit/audit.ts";
import { publishLock } from "../src/modules/publishing/lock.ts";
import { MediaService } from "../src/modules/media/service.ts";
import { memoryAuditStore, silentLog } from "./auth/memory.ts";
import { settingsRecord } from "./fixtures/settings.ts";
import { FACTS, MemoryMediaStore, MemoryStorage, member } from "./media/memory.ts";
import { addMedia, harness, sharedData } from "./settings/memory.ts";
import { approve, createApproved } from "./support/workflow.ts";

/* M16: media governance — a media item the website or approved content
   still needs is never deleted out from under it; deleted, pending,
   failed and another organization's media can never be referenced or
   published; the whole lifecycle is organization-scoped on the server.
   Test records only. */

const owner = member("org-a", "OWNER");
const editor = member("org-a", "EDITOR");
const body = [{ type: "paragraph", children: [{ type: "text", text: "A test paragraph." }] }];
const story = (o: Record<string, unknown> = {}) => ({ title: "Test story", category: "field", body, ...o });
const HOUR = 3_600_000;
const rejects = async (promise: Promise<unknown>, code: string, part?: string) =>
  assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError, String(error));
    assert.equal(error.code, code, error.message);
    if (part) assert.ok(error.message.includes(part) || error.details?.some((d) => d.path.includes(part) || d.message.includes(part)), `${error.message} ${JSON.stringify(error.details)}`);
    return true;
  });

/* The publishing harness, with the media library over the same rows. */
async function site(orgId = "org-a", data = sharedData()) {
  const h = harness(orgId, data);
  const storage = new MemoryStorage();
  const audit = new AuditService(memoryAuditStore(data.base, orgId), { orgId, secret: "test-only-auth-secret-0123456789abcdef", log: silentLog, now: h.time.now });
  const throttle = { hit: async () => 1, peek: async () => 0 };
  const media = new MediaService(new MemoryMediaStore(data.media, orgId), storage, audit, throttle, {
    orgId,
    env: "test",
    log: silentLog,
    now: h.time.now,
    usage: (id) => h.publishing.mediaUsage(id),
    lock: publishLock(h.publishStore, h.time.now),
  });
  await h.settings.importInitial(settingsRecord(orgId), { id: null, name: "Settings import" });
  const image = (alt = "A described test image") => addMedia(data, orgId, "ready", { alt });
  return { data, h, media, storage, image };
}

test("delete: refused while the live website, approved, scheduled or published content, or the saved settings use the image", async () => {
  const { h, media, image } = await site();
  const live = image();
  const approved = image();
  const scheduled = image();
  const logo = image();
  const draftOnly = image();
  const unused = image();
  // Live: in a published story (and so in the live snapshot).
  await createApproved(h.stories, owner, story({ title: "Live story", imageId: live.id }), FACTS);
  await h.publishing.publish(owner, FACTS);
  // Approved, scheduled, settings, draft.
  await createApproved(h.stories, owner, story({ title: "Approved story", imageId: approved.id }), FACTS);
  const s = await createApproved(h.stories, owner, story({ title: "Scheduled story", imageId: scheduled.id }), FACTS);
  await h.stories.schedule(owner, s.record.id, { revision: s.revision, localTime: instantToZonedTime(new Date(h.time.now().getTime() + HOUR).toISOString(), "UTC"), timeZone: "UTC" }, FACTS);
  const settings = await h.settings.get(owner);
  await h.settings.update(owner, { revision: settings!.revision, changes: { branding: { ...settings!.settings.branding, logoId: logo.id } } }, FACTS);
  await h.stories.create(editor, story({ title: "Draft story", imageId: draftOnly.id }), FACTS);

  const refused = async (id: string, where: RegExp) =>
    assert.rejects(media.delete(owner, id, FACTS), (error: unknown) => {
      assert.ok(error instanceof ApiError && error.code === "CONFLICT", String(error));
      assert.ok(error.details!.some((d) => where.test(d.message)), JSON.stringify(error.details));
      return true;
    });
  await refused(live.id, /^The live website \(published version \d+\)$/);
  await refused(live.id, /^Stories: Live story \(published\)$/);
  await refused(approved.id, /^Stories: Approved story \(approved\)$/);
  await refused(scheduled.id, /^Stories: Scheduled story \(scheduled\)$/);
  await refused(logo.id, /^Site settings$/);
  for (const m of [live, approved, scheduled, logo]) assert.equal(h.data.media.find((x) => x.id === m.id)!.status, "ready", "nothing changed");
  assert.equal(h.audit.filter((e) => e.action === "media.delete_refused").length, 5);
  // Unused, or used only by a draft: deleted. The draft's review then refuses the missing image.
  assert.deepEqual(await media.delete(owner, unused.id, FACTS), { deleted: true, storage: "removed" });
  assert.deepEqual(await media.delete(editor, draftOnly.id, FACTS), { deleted: true, storage: "removed" });
  const draft = (await h.stories.list(owner, { status: "draft" })).items.find((v) => v.record.title === "Draft story")!;
  await rejects(h.stories.act(editor, draft.record.id, "submit", { revision: draft.revision }, FACTS), "VALIDATION_ERROR", "must be a ready image");
  await rejects(media.delete(owner, unused.id, FACTS), "NOT_FOUND", undefined);
});

test("delete becomes possible once nothing public or approved needs the image — and the live site is never broken", async () => {
  const { h, media, image } = await site();
  const pic = image();
  const v = await createApproved(h.stories, owner, story({ title: "Pictured", imageId: pic.id }), FACTS);
  await h.publishing.publish(owner, FACTS);
  // An edit removing the image is a draft: the LIVE version still shows it.
  const live = await h.stories.get(owner, v.record.id);
  const edited = await h.stories.update(owner, v.record.id, { revision: live.revision, changes: { imageId: null } }, FACTS);
  await rejects(media.delete(owner, pic.id, FACTS), "CONFLICT", "The live website");
  // Approved and published without it: now nothing needs it.
  await approve(h.stories, owner, edited.record.id, FACTS);
  await h.publishing.publish(owner, FACTS);
  assert.ok(!JSON.stringify(await h.publishing.publicSnapshot()).includes(pic.id));
  assert.deepEqual(await h.publishing.mediaUsage(pic.id), []);
  assert.deepEqual(await media.delete(owner, pic.id, FACTS), { deleted: true, storage: "removed" });
});

test("delete waits for a publication: it is refused while the publish lock is held", async () => {
  const { h, media, image } = await site();
  const pic = image();
  assert.ok(await h.publishStore.acquireLock("a-publish", h.time.now(), 60_000));
  await rejects(media.delete(owner, pic.id, FACTS), "CONFLICT", "A website publication is in progress");
  await h.publishStore.releaseLock("a-publish");
  assert.equal((await media.delete(owner, pic.id, FACTS)).deleted, true);
});

test("deleted, pending and failed media are never referenced or published; the snapshot carries ready, described images only", async () => {
  const { data, h, media, image } = await site();
  const deleted = image();
  await media.delete(owner, deleted.id, FACTS);
  const pending = addMedia(data, "org-a", "pending");
  const failed = addMedia(data, "org-a", "failed");
  for (const m of [deleted, pending, failed]) await rejects(h.stories.create(editor, story({ title: `Refs ${m.status}`, imageId: m.id }), FACTS), "VALIDATION_ERROR", "must be a ready image");
  // A ready image that becomes unusable after approval: the publish refuses it, the live site stays.
  const pic = image();
  await createApproved(h.stories, owner, story({ title: "Was ready", imageId: pic.id }), FACTS);
  data.media.find((m) => m.id === pic.id)!.status = "pending";
  await rejects(h.publishing.publish(owner, FACTS), "VALIDATION_ERROR", "media");
  data.media.find((m) => m.id === pic.id)!.status = "ready";
  await h.publishing.publish(owner, FACTS);
  const snapshot = (await h.publishing.publicSnapshot())!;
  assert.deepEqual(Object.keys(snapshot.media), [pic.id], "only what is referenced");
  const m = snapshot.media[pic.id]!;
  assert.ok(m.url.startsWith("https://") && m.alt === "A described test image");
  const text = JSON.stringify(snapshot);
  for (const leak of ["objectKey", "objectState", "X-Amz", "r2.cloudflarestorage", "createdBy", "consent", pending.id, failed.id, deleted.id]) assert.ok(!text.includes(leak), `leaked: ${leak}`);
});

test("alt text: an image without a description cannot be submitted, approved or published", async () => {
  const { data, h, image } = await site();
  const bare = image("");
  const v = await h.stories.create(editor, story({ title: "Undescribed", imageId: bare.id }), FACTS);
  await rejects(h.stories.act(editor, v.record.id, "submit", { revision: 1 }, FACTS), "VALIDATION_ERROR", "alt text");
  // Described, approved, then the description is removed in the library: the publish refuses.
  data.media.find((m) => m.id === bare.id)!.alt = "Now described";
  await approve(h.stories, owner, v.record.id, FACTS);
  data.media.find((m) => m.id === bare.id)!.alt = "";
  await rejects(h.publishing.publish(owner, FACTS), "VALIDATION_ERROR");
  assert.equal(await h.publishing.publicSnapshot(), null);
});

test("organization isolation: B cannot read, complete, edit, delete, reference or publish A's media", async () => {
  const data = sharedData();
  const a = await site("org-a", data);
  const b = await site("org-b", data);
  const bOwner = member("org-b", "OWNER");
  // A: the whole lifecycle.
  const intent = await a.media.createUploadIntent(owner, { filename: "a.png", mimeType: "image/png", size: 10 }, FACTS);
  assert.ok(intent.objectKey.startsWith("_test/org-a/media/"));
  const ready = a.image();
  // B: not found in its own organization, refused in A's.
  for (const call of [() => b.media.get(bOwner, ready.id), () => b.media.complete(bOwner, intent.mediaId, FACTS), () => b.media.updateMetadata(bOwner, ready.id, { version: 1, alt: "Taken" }, FACTS), () => b.media.delete(bOwner, ready.id, FACTS), () => b.media.abort(bOwner, intent.mediaId, FACTS)])
    await rejects(call(), "NOT_FOUND");
  await rejects(a.media.get(bOwner, ready.id), "FORBIDDEN");
  await rejects(a.media.delete(bOwner, ready.id, FACTS), "FORBIDDEN");
  // B's content cannot reference it, and B's settings cannot use it.
  await rejects(b.h.stories.create(member("org-b", "EDITOR"), story({ imageId: ready.id }), FACTS), "VALIDATION_ERROR", "this organization's media library");
  const bs = await b.h.settings.get(bOwner);
  await rejects(b.h.settings.update(bOwner, { revision: bs!.revision, changes: { branding: { ...bs!.settings.branding, logoId: ready.id } } }, FACTS), "VALIDATION_ERROR");
  // B's publish never carries A's media.
  await b.h.publishing.publish(bOwner, FACTS);
  assert.ok(!JSON.stringify(await b.h.publishing.publicSnapshot()).includes(ready.id));
  assert.equal(data.media.find((m) => m.id === ready.id)!.alt, "A described test image", "untouched");
});
