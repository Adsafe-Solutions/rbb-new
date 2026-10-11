import { test } from "node:test";
import assert from "node:assert/strict";
import { Media, PublishedSnapshot, isFocalPoint } from "@rbb/content-schema";
import { ApiError } from "../../src/errors.ts";
import { toContentMedia } from "../../src/modules/media/types.ts";
import { contentHash } from "../../src/modules/publishing/service.ts";
import { settingsRecord } from "../fixtures/settings.ts";
import { addMedia, harness, sharedData } from "../settings/memory.ts";
import { createApproved } from "../support/workflow.ts";
import { FACTS, fixture, mediaHarness, member } from "./memory.ts";

/* Milestone 2 — an image's focal point and caption, from the media library
   to the published snapshot. The focal point is "X% Y%": whole
   percentages 0–100 (CSS object-position); absent or null is centred.
   Test data only. */

const png = fixture("sample.png");
const rejects = async (promise: Promise<unknown>, code: string, path?: string) =>
  assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError, String(error));
    assert.equal(error.code, code, error.message);
    if (path) assert.ok(error.details?.some((d) => d.path.includes(path)), JSON.stringify(error.details));
    return true;
  });
async function uploaded(h: ReturnType<typeof mediaHarness>, who: ReturnType<typeof member>) {
  const intent = await h.service.createUploadIntent(who, { filename: "Photo.png", mimeType: "image/png", size: png.byteLength }, FACTS);
  h.storage.put(intent.objectKey, png, "image/png");
  return h.service.complete(who, intent.mediaId, FACTS);
}

test("the focal-point contract: two whole percentages from 0 to 100, one space — nothing else", () => {
  for (const ok of ["50% 50%", "0% 0%", "100% 100%", "0% 100%", "72% 45%", "5% 95%"]) assert.ok(isFocalPoint(ok), ok);
  for (const bad of ["101% 0%", "0% 101%", "-1% 5%", "50.5% 40%", "50%  40%", "50% 40", "50%,40%", "50 % 40 %", "center", "", "1000% 1%", " 50% 40%", "50% 40% ", null, 50, undefined])
    assert.ok(!isFocalPoint(bad), String(bad));
  /* The website's own photographs already use this form. */
  assert.ok(Media.safeParse({ id: "rbb-kids", orgId: "rbb", schemaVersion: 1, status: "published", kind: "image", alt: "A photograph", focal: "72% 45%" }).success);
  assert.ok(!Media.safeParse({ id: "rbb-kids", orgId: "rbb", schemaVersion: 1, status: "published", kind: "image", alt: "A photograph", focal: "150% 45%" }).success);
});

test("API: a new image is centred (focal null); a focal point and caption are saved, boundaries included", async () => {
  const h = mediaHarness();
  const who = member("org-a");
  const ready = await uploaded(h, who);
  assert.equal(ready.focal, null, "nothing invented: centred until someone sets it");
  assert.equal(ready.caption, "");
  const set = await h.service.updateMetadata(who, ready.id, { version: ready.version, focal: "0% 100%", caption: "  Volunteers at the community centre  " }, FACTS);
  assert.deepEqual([set.focal, set.caption], ["0% 100%", "Volunteers at the community centre"]);
  assert.equal((await h.service.get(who, ready.id)).focal, "0% 100%", "persisted");
  const moved = await h.service.updateMetadata(who, ready.id, { version: set.version, focal: "100% 0%" }, FACTS);
  assert.equal(moved.focal, "100% 0%");
  assert.deepEqual(h.audit.filter((e) => e.action === "media.metadata_updated").map((e) => (e.metadata.fields as string[]).sort()), [["caption", "focal"], ["focal"]], "audited by field name");
});

test("API: an invalid focal point is refused by name; null clears it back to centred", async () => {
  const h = mediaHarness();
  const who = member("org-a");
  const ready = await uploaded(h, who);
  for (const focal of ["101% 50%", "50%", "-5% 10%", "50.5% 40%", "left top", 72])
    await rejects(h.service.updateMetadata(who, ready.id, { version: ready.version, focal }, FACTS), "VALIDATION_ERROR", "focal");
  const set = await h.service.updateMetadata(who, ready.id, { version: ready.version, focal: "30% 60%" }, FACTS);
  const cleared = await h.service.updateMetadata(who, ready.id, { version: set.version, focal: null }, FACTS);
  assert.equal(cleared.focal, null);
  /* Clearing what is already clear changes nothing — no new version. */
  const again = await h.service.updateMetadata(who, ready.id, { version: cleared.version, focal: null }, FACTS);
  assert.equal(again.version, cleared.version);
});

test("API: an image saved before Milestone 2 (no focal field at all) reads as centred, and can be given one", async () => {
  const h = mediaHarness();
  const who = member("org-a");
  const ready = await uploaded(h, who);
  const row = h.shared.rows.find((r) => r.id === ready.id)!;
  delete (row as { focal?: unknown }).focal;
  const view = await h.service.get(who, ready.id);
  assert.equal(view.focal, null);
  assert.equal((await h.service.updateMetadata(who, ready.id, { version: view.version, focal: null }, FACTS)).version, view.version, "null on a record without one is no change");
  assert.equal((await h.service.updateMetadata(who, ready.id, { version: view.version, focal: "40% 20%", alt: "A test image" }, FACTS)).focal, "40% 20%");
  /* …and its content-contract shape carries it. */
  const content = toContentMedia(h.shared.rows.find((r) => r.id === ready.id)!);
  assert.equal(content.focal, "40% 20%");
  assert.ok(Media.safeParse(content).success);
});

/* ---------- Publishing ---------- */
const owner = member("org-a", "OWNER");
const body = [{ type: "paragraph", children: [{ type: "text", text: "A test paragraph." }] }];
async function site() {
  const data = sharedData();
  const h = harness("org-a", data);
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  return { data, h };
}

test("publishing: an image's focal point and caption go into the snapshot — only when it has them", async () => {
  const { data, h } = await site();
  const framed = addMedia(data, "org-a", "ready", { alt: "A framed test image", focal: "20% 80%", caption: "  A test caption  " });
  const plain = addMedia(data, "org-a", "ready", { alt: "A plain test image", caption: "" });
  await createApproved(h.posts as never, owner, { type: "news", title: "Framed", body, imageId: framed.id }, FACTS);
  await createApproved(h.posts as never, owner, { type: "news", title: "Plain", body, imageId: plain.id }, FACTS);
  await h.publishing.publish(owner, FACTS);
  const snapshot = (await h.publishing.publicSnapshot())!;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success, "the contract accepts it");
  assert.deepEqual([snapshot.media[framed.id]!.focal, snapshot.media[framed.id]!.caption], ["20% 80%", "A test caption"]);
  assert.ok(!("focal" in snapshot.media[plain.id]!) && !("caption" in snapshot.media[plain.id]!), "nothing invented for an image without them");
});

test("publishing: changing only an image's focal point or caption is a change to publish", async () => {
  const { data, h } = await site();
  const image = addMedia(data, "org-a", "ready", { alt: "A test image" });
  await createApproved(h.posts as never, owner, { type: "news", title: "With an image", body, imageId: image.id }, FACTS);
  await h.publishing.publish(owner, FACTS);
  assert.equal((await h.publishing.status(owner)).hasUnpublishedChanges, false);
  image.focal = "10% 90%";
  assert.equal((await h.publishing.status(owner)).hasUnpublishedChanges, true, "a new focal point waits to be published");
  await h.publishing.publish(owner, FACTS);
  assert.equal((await h.publishing.publicSnapshot())!.media[image.id]!.focal, "10% 90%");
  image.caption = "A new caption";
  assert.equal((await h.publishing.status(owner)).hasUnpublishedChanges, true, "a new caption too");
});

test("publishing: content without any focal point or caption hashes exactly as before Milestone 2", () => {
  const settings = settingsRecord("org-a") as never;
  assert.equal(contentHash(settings, {}, {}), contentHash(settings));
  assert.equal(contentHash(settings, { news: [] }, {}), contentHash(settings, { news: [] }));
  assert.notEqual(contentHash(settings, { news: [] }, { img: { focal: "1% 2%" } }), contentHash(settings, { news: [] }));
});
