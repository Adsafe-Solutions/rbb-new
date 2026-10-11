import { test } from "node:test";
import assert from "node:assert/strict";
import { Media } from "@rbb/content-schema";
import { ApiError } from "../../src/errors.ts";
import { MEDIA_POLICY } from "../../src/modules/media/policy.ts";
import { toContentMedia } from "../../src/modules/media/types.ts";
import { memoryData } from "../auth/memory.ts";
import { FACTS, fixture, mediaHarness, member } from "./memory.ts";

const png = fixture("sample.png");
const intentFor = (bytes: Uint8Array, overrides: Record<string, unknown> = {}) => ({ filename: "Team Photo.png", mimeType: "image/png", size: bytes.byteLength, ...overrides });

const rejects = async (promise: Promise<unknown>, code: string, status?: number) => {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError, String(error));
    assert.equal(error.code, code);
    if (status) assert.equal(error.status, status);
    return true;
  });
};

/* Intent → (browser PUT) → complete. */
async function uploaded(h: ReturnType<typeof mediaHarness>, who = member("org-a"), bytes = png) {
  const intent = await h.service.createUploadIntent(who, intentFor(bytes), FACTS);
  h.storage.put(intent.objectKey, bytes, "image/png");
  return h.service.complete(who, intent.mediaId, FACTS);
}

test("upload intent: pending record, one fresh key, a short-lived URL — and no secret in the audit", async () => {
  const h = mediaHarness();
  const owner = member("org-a", "OWNER");
  const intent = await h.service.createUploadIntent(owner, intentFor(png, { width: 9999, height: 1 }), FACTS);
  assert.equal(intent.media.status, "pending");
  assert.equal(intent.media.publicUrl, null, "no public URL before the file is verified");
  assert.match(intent.objectKey, /^_test\/org-a\/media\/[0-9a-f-]{36}\/team-photo\.png$/);
  assert.notEqual(intent.objectKey.split("/")[3], intent.mediaId, "the key does not reveal the record id");
  assert.equal(intent.uploadMethod, "PUT");
  assert.deepEqual(intent.uploadHeaders, { "Content-Type": "image/png" });
  assert.deepEqual(h.storage.issued[0], { key: intent.objectKey, contentType: "image/png", contentLength: png.byteLength, expiresInSeconds: MEDIA_POLICY.uploadUrlTtlSeconds });
  const entry = h.audit.find((e) => e.action === "media.upload_intent")!;
  assert.equal(entry.actorUserId, owner.user.id);
  assert.equal(entry.resourceId, intent.mediaId);
  assert.equal(entry.requestId, FACTS.requestId);
  assert.ok(!JSON.stringify(h.audit).includes("X-Amz"), "the presigned URL is never audited");
});

test("upload intent: type, size, extension and unknown fields are refused before any URL is issued", async () => {
  const h = mediaHarness();
  const who = member("org-a");
  for (const body of [
    intentFor(png, { mimeType: "image/svg+xml", filename: "logo.svg" }),
    intentFor(png, { mimeType: "text/html", filename: "page.html" }),
    intentFor(png, { mimeType: "image/gif", filename: "anim.gif" }),
    intentFor(png, { size: MEDIA_POLICY.maxBytes + 1 }),
    intentFor(png, { size: 0 }),
    intentFor(png, { filename: "photo.exe" }),
    intentFor(png, { filename: "photo.jpg" }),
    intentFor(png, { filename: "   " }),
    intentFor(png, { orgId: "org-b" }),
    intentFor(png, { objectKey: "org-b/media/x/y.png" }),
    intentFor(png, { width: MEDIA_POLICY.maxDimension + 1 }),
    { filename: "x.png" },
    "not an object",
  ])
    await rejects(h.service.createUploadIntent(who, body, FACTS), "VALIDATION_ERROR", 400);
  assert.equal(h.storage.issued.length, 0);
  assert.equal(h.store.rows.length, 0);
});

test("upload intent: storage not configured or down is a 503, never a broken record", async () => {
  const h = mediaHarness();
  h.storage.failAll = true;
  await rejects(h.service.createUploadIntent(member("org-a"), intentFor(png), FACTS), "SERVICE_UNAVAILABLE", 503);
  assert.equal(h.store.rows.length, 0);
});

test("upload intent: issuing URLs is rate-limited per member", async () => {
  const h = mediaHarness();
  const who = member("org-a");
  for (let i = 0; i < MEDIA_POLICY.intentLimit.perUser; i++) await h.service.createUploadIntent(who, intentFor(png), FACTS);
  await rejects(h.service.createUploadIntent(who, intentFor(png), FACTS), "RATE_LIMITED", 429);
  // Another member is unaffected; a new window resets the count.
  await h.service.createUploadIntent(member("org-a"), intentFor(png), FACTS);
  h.time.advance(MEDIA_POLICY.intentLimit.windowMs);
  await h.service.createUploadIntent(who, intentFor(png), FACTS);
});

test("complete: verifies the object, takes dimensions from the FILE, and is idempotent", async () => {
  const h = mediaHarness();
  const who = member("org-a");
  const intent = await h.service.createUploadIntent(who, intentFor(png, { width: 4000, height: 3000 }), FACTS);
  await rejects(h.service.complete(who, intent.mediaId, FACTS), "CONFLICT", 409);
  assert.equal((await h.service.get(who, intent.mediaId)).status, "pending", "nothing arrived yet: still pending, can retry");

  h.storage.put(intent.objectKey, png, "image/png");
  const ready = await h.service.complete(who, intent.mediaId, FACTS);
  assert.equal(ready.status, "ready");
  assert.equal(ready.publicUrl, `https://media.test/${intent.objectKey}`);
  assert.deepEqual([ready.width, ready.height], [48, 32], "the client's 4000×3000 claim is replaced by the file's real size");
  assert.ok(ready.completedAt);
  const again = await h.service.complete(who, intent.mediaId, FACTS);
  assert.deepEqual(again, ready, "a second complete changes nothing");
  assert.equal(h.audit.filter((e) => e.action === "media.upload_completed").length, 1);
});

test("complete: a file that is not what was declared fails, and its object is removed", async () => {
  const h = mediaHarness();
  const who = member("org-a");
  const html = new TextEncoder().encode("<!doctype html><script>alert(1)</script>".padEnd(png.byteLength, " "));
  const disguised = await h.service.createUploadIntent(who, intentFor(html), FACTS);
  h.storage.put(disguised.objectKey, html, "image/png");
  await rejects(h.service.complete(who, disguised.mediaId, FACTS), "VALIDATION_ERROR");
  const failed = await h.service.get(who, disguised.mediaId);
  assert.equal(failed.status, "failed");
  assert.equal(failed.failureReason, "content-mismatch");
  assert.equal(failed.publicUrl, null);
  assert.ok(!h.storage.objects.has(disguised.objectKey), "the rejected object is deleted");

  const jpeg = fixture("sample.jpg");
  const wrongType = await h.service.createUploadIntent(who, intentFor(jpeg), FACTS); // declared PNG, is JPEG
  h.storage.put(wrongType.objectKey, jpeg, "image/png");
  await rejects(h.service.complete(who, wrongType.mediaId, FACTS), "VALIDATION_ERROR");

  const resized = await h.service.createUploadIntent(who, intentFor(png), FACTS);
  h.storage.put(resized.objectKey, new Uint8Array([...png, 0, 0, 0]), "image/png");
  await rejects(h.service.complete(who, resized.mediaId, FACTS), "VALIDATION_ERROR");
  assert.equal((await h.service.get(who, resized.mediaId)).failureReason, "size-mismatch");

  await rejects(h.service.complete(who, resized.mediaId, FACTS), "CONFLICT", 409);
  assert.equal(h.audit.filter((e) => e.action === "media.upload_failed").length, 3);
});

test("abort: an unfinished upload becomes failed (idempotently); a ready one cannot be aborted", async () => {
  const h = mediaHarness();
  const who = member("org-a");
  const intent = await h.service.createUploadIntent(who, intentFor(png), FACTS);
  const failed = await h.service.abort(who, intent.mediaId, FACTS);
  assert.equal(failed.status, "failed");
  assert.equal(failed.failureReason, "upload-aborted");
  assert.deepEqual(await h.service.abort(who, intent.mediaId, FACTS), failed);
  const ready = await uploaded(h, who);
  await rejects(h.service.abort(who, ready.id, FACTS), "CONFLICT");
});

test("metadata: editable fields only, version-checked, audited by field name", async () => {
  const h = mediaHarness();
  const who = member("org-a");
  const ready = await uploaded(h, who);
  const updated = await h.service.updateMetadata(who, ready.id, { version: ready.version, alt: "  Volunteers packing food boxes  ", caption: "Caption", credit: "Credit", license: "CC BY 4.0", consent: "obtained" }, FACTS);
  assert.equal(updated.alt, "Volunteers packing food boxes", "trimmed");
  assert.equal(updated.consent, "obtained");
  assert.equal(updated.version, ready.version + 1);
  assert.equal(updated.objectKey, ready.objectKey);

  await rejects(h.service.updateMetadata(who, ready.id, { version: ready.version, alt: "stale" }, FACTS), "CONFLICT", 409);
  for (const body of [
    { version: updated.version, orgId: "org-b" },
    { version: updated.version, objectKey: "x" },
    { version: updated.version, createdBy: "someone" },
    { version: updated.version, createdAt: "2020-01-01T00:00:00Z" },
    { version: updated.version, status: "ready" },
    { version: updated.version, publicUrl: "https://evil.example/x.png" },
    { version: updated.version, consent: "maybe" },
    { version: updated.version, alt: "x".repeat(301) },
    { alt: "no version" },
  ])
    await rejects(h.service.updateMetadata(who, ready.id, body, FACTS), "VALIDATION_ERROR", 400);

  const entry = h.audit.find((e) => e.action === "media.metadata_updated")!;
  assert.deepEqual(entry.metadata, { fields: ["alt", "caption", "credit", "license", "consent"] });
  assert.ok(!JSON.stringify(entry).includes("Volunteers"), "the audit names fields, not their text");

  const pending = await h.service.createUploadIntent(who, intentFor(png), FACTS);
  await rejects(h.service.updateMetadata(who, pending.mediaId, { version: 1, alt: "x" }, FACTS), "CONFLICT");
});

test("delete: database first, storage second — the record stays, hidden; deleting again is not found", async () => {
  const h = mediaHarness();
  const who = member("org-a");
  const ready = await uploaded(h, who);
  assert.deepEqual(await h.service.delete(who, ready.id, FACTS), { deleted: true, storage: "removed" });
  assert.ok(!h.storage.objects.has(ready.objectKey));
  const row = h.store.rows.find((r) => r.id === ready.id)!;
  assert.equal(row.status, "deleted");
  assert.equal(row.objectState, "deleted");
  assert.equal(row.publicUrl, null);
  assert.equal(row.deletedBy, who.user.id);
  await rejects(h.service.get(who, ready.id), "NOT_FOUND", 404);
  await rejects(h.service.delete(who, ready.id, FACTS), "NOT_FOUND", 404);
  await rejects(h.service.updateMetadata(who, ready.id, { version: row.version, alt: "x" }, FACTS), "NOT_FOUND");
  assert.equal((await h.service.list(who, {})).items.length, 0);
});

test("delete: a storage failure leaves the record recoverable, and cleanup finishes the job", async () => {
  const h = mediaHarness();
  const who = member("org-a");
  const ready = await uploaded(h, who);
  h.storage.failDeletes = true;
  assert.deepEqual(await h.service.delete(who, ready.id, FACTS), { deleted: true, storage: "pending" });
  assert.equal(h.store.rows.find((r) => r.id === ready.id)!.objectState, "deleting");
  assert.ok(h.storage.objects.has(ready.objectKey));
  h.storage.failDeletes = false;
  assert.deepEqual(await h.service.cleanup(), { abandoned: 0, objectsRemoved: 1, objectsStillPending: 0 });
  assert.ok(!h.storage.objects.has(ready.objectKey));
  assert.equal(h.store.rows.find((r) => r.id === ready.id)!.objectState, "deleted");
});

/* M16: realistic failure and retry — storage unreachable (or refusing
   the credentials) mid-upload, then back. Nothing is half-made and the
   same upload completes once storage answers again. */
test("complete: storage down while verifying is a 503; the upload stays pending and completes on retry", async () => {
  const h = mediaHarness();
  const who = member("org-a");
  const intent = await h.service.createUploadIntent(who, intentFor(png), FACTS);
  h.storage.put(intent.objectKey, png, "image/png");
  h.storage.failAll = true;
  await rejects(h.service.complete(who, intent.mediaId, FACTS), "SERVICE_UNAVAILABLE", 503);
  const still = await h.service.get(who, intent.mediaId);
  assert.equal(still.status, "pending", "not failed: the file may be fine");
  assert.ok(h.storage.objects.has(intent.objectKey), "the object is untouched");
  h.storage.failAll = false;
  assert.equal((await h.service.complete(who, intent.mediaId, FACTS)).status, "ready");
  assert.equal(h.audit.filter((e) => e.action === "media.upload_failed").length, 0);
});

test("cleanup: abandoned pending uploads become failed; recent ones are left alone", async () => {
  const h = mediaHarness();
  const who = member("org-a");
  const old = await h.service.createUploadIntent(who, intentFor(png), FACTS);
  h.storage.put(old.objectKey, png, "image/png"); // uploaded but never completed
  h.time.advance(MEDIA_POLICY.abandonAfterMs + 1);
  const recent = await h.service.createUploadIntent(who, intentFor(png), FACTS);
  const result = await h.service.cleanup();
  assert.equal(result.abandoned, 1);
  assert.equal((await h.service.get(who, old.mediaId)).failureReason, "abandoned");
  assert.ok(!h.storage.objects.has(old.objectKey));
  assert.equal((await h.service.get(who, recent.mediaId)).status, "pending");
});

test("list: newest first, server-side pages, filename search (literal), status filter", async () => {
  const h = mediaHarness();
  const who = member("org-a");
  for (const name of ["alpha.png", "beta.png", "gamma (1).png"]) {
    const intent = await h.service.createUploadIntent(who, intentFor(png, { filename: name }), FACTS);
    h.storage.put(intent.objectKey, png, "image/png");
    await h.service.complete(who, intent.mediaId, FACTS);
    h.time.advance(1000);
  }
  await h.service.createUploadIntent(who, intentFor(png, { filename: "delta.png" }), FACTS);
  const page1 = await h.service.list(who, { pageSize: "2" });
  assert.deepEqual(page1.items.map((m) => m.originalFilename), ["delta.png", "gamma (1).png"]);
  assert.deepEqual(page1.pagination, { page: 1, pageSize: 2, total: 4, totalPages: 2 });
  assert.deepEqual((await h.service.list(who, { pageSize: "2", page: "2" })).items.map((m) => m.originalFilename), ["beta.png", "alpha.png"]);
  assert.deepEqual((await h.service.list(who, { sort: "oldest", pageSize: "1" })).items.map((m) => m.originalFilename), ["alpha.png"]);
  assert.deepEqual((await h.service.list(who, { search: "(1)" })).items.map((m) => m.originalFilename), ["gamma (1).png"]);
  assert.equal((await h.service.list(who, { status: "pending" })).items.length, 1);
  assert.equal((await h.service.list(who, { status: "ready", type: "image" })).items.length, 3);
  for (const query of [{ status: "deleted" }, { pageSize: "1000" }, { page: "0" }, { sort: "random" }, { type: "video" }, { orgId: "org-b" }])
    await rejects(h.service.list(who, query), "VALIDATION_ERROR");
});

test("organization isolation: another organization's records do not exist for you", async () => {
  const shared = { rows: [], data: memoryData() };
  const a = mediaHarness("org-a", shared);
  const b = mediaHarness("org-b", shared);
  const aMember = member("org-a", "OWNER");
  const bMember = member("org-b", "OWNER");
  const mine = await uploaded(a, aMember);
  assert.equal(shared.rows.length, 1);

  assert.equal((await b.service.list(bMember, {})).items.length, 0);
  await rejects(b.service.get(bMember, mine.id), "NOT_FOUND");
  await rejects(b.service.updateMetadata(bMember, mine.id, { version: mine.version, alt: "hijack" }, FACTS), "NOT_FOUND");
  await rejects(b.service.delete(bMember, mine.id, FACTS), "NOT_FOUND");
  await rejects(b.service.complete(bMember, mine.id, FACTS), "NOT_FOUND");
  // A context from org B handed to org A's service is refused outright.
  await rejects(a.service.get(bMember, mine.id), "FORBIDDEN", 403);
  await rejects(a.service.createUploadIntent(bMember, intentFor(png), FACTS), "FORBIDDEN");
  assert.equal((await a.service.get(aMember, mine.id)).alt, "", "untouched");
});

test("a ready record maps onto the content contract's Media shape", async () => {
  const h = mediaHarness();
  const who = member("org-a");
  const ready = await uploaded(h, who);
  await h.service.updateMetadata(who, ready.id, { version: ready.version, alt: "A flat blue test image", license: "CC0" }, FACTS);
  const record = h.store.rows.find((r) => r.id === ready.id)!;
  const result = Media.safeParse(toContentMedia(record));
  assert.ok(result.success, JSON.stringify(result.error?.issues));
  assert.equal(result.data?.bytes, png.byteLength);
  assert.equal(result.data?.licence, "CC0");
});
