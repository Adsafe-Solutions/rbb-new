import { randomUUID } from "node:crypto";
import { z } from "zod";
import { FocalPoint, MediaId } from "@rbb/content-schema";
import { ApiError, errors, type ErrorDetail } from "../../errors.ts";
import type { Logger } from "../../logging/logger.ts";
import type { AuditService, RequestFacts } from "../audit/audit.ts";
import type { ThrottleStore } from "../auth/repository.ts";
import type { AuthContext } from "../auth/types.ts";
import { MEDIA_MIME_TYPES, MEDIA_POLICY, cleanDisplayName, extensionOf, isMediaMimeType, newObjectKey } from "./policy.ts";
import type { MediaPage, MediaStore } from "./repository.ts";
import { SNIFF_BYTES, sniffImage } from "./sniff.ts";
import { StorageError, type ObjectStorage } from "./storage.ts";
import { CONSENT_VALUES, toMediaView, type MediaRecord, type MediaView } from "./types.ts";
import { unlocked, type PublishLock } from "../publishing/lock.ts";

/* The media library's rules — the one place they live.

   · the organization is the authenticated member's, from the session the
     server resolved; no request field can name one
   · permissions are checked by the routes (media:read / media:write) from
     the central RBAC table; this service additionally refuses a context
     from another organization than its store's
   · file bytes never pass through the API: it issues a presigned URL for
     one new object key, then VERIFIES what arrived (size, type from the
     file's own bytes) before the record becomes ready
   · every state change is a guarded transition (types.ts); a client can
     only ask for complete, abort, edit metadata, delete
   · deletion changes the database first, storage second; a storage
     failure leaves the record "deleting" for cleanup() to retry
   · M16: an image the public website shows (the live snapshot), or that
     content approved, scheduled or published for it uses, or the saved
     site settings use, is NOT deleted (409, naming where it is used):
     deleting it would break a live page, or a publication an owner has
     already approved. It runs under the publish lock, so no publication
     is being built meanwhile. A draft or a submission may lose an image —
     it is not public, and submitting or approving it again refuses a
     missing image. */

const Text = (max: number) => z.string().max(max).transform((value) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim());

const IntentInput = z.strictObject({
  filename: z.string().min(1).max(1024),
  mimeType: z.string().max(100),
  size: z.int().positive(),
  width: z.int().min(1).max(MEDIA_POLICY.maxDimension).optional(),
  height: z.int().min(1).max(MEDIA_POLICY.maxDimension).optional(),
});

const MetadataInput = z.strictObject({
  version: z.int().positive(),
  alt: Text(300).optional(),
  caption: Text(1000).optional(),
  /* Milestone 2: "X% Y%", or null to go back to centred. */
  focal: FocalPoint.nullable().optional(),
  credit: Text(200).optional(),
  license: Text(200).optional(),
  consent: z.enum(CONSENT_VALUES).optional(),
});

export const ListInput = z.strictObject({
  search: z.string().trim().max(100).optional(),
  type: z.enum(["image"]).optional(),
  status: z.enum(["pending", "ready", "failed"]).optional(),
  sort: z.enum(["newest", "oldest"]).default("newest"),
  /* 2026-10-13: ready images that are (or are not) still in use. */
  usage: z.enum(["used", "unused"]).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});
export type ListInput = z.input<typeof ListInput>;

export const MediaIdParam = MediaId.max(64);

const issues = (error: z.ZodError, source: string): ErrorDetail[] =>
  error.issues.map((issue) => ({ path: [source, ...issue.path].join("."), message: issue.message }));

export interface UploadIntent {
  mediaId: string;
  objectKey: string;
  uploadUrl: string;
  uploadMethod: "PUT";
  /* Headers the browser must send with the PUT, exactly. */
  uploadHeaders: Record<string, string>;
  expiresAt: string;
  media: MediaView;
}

export interface MediaServiceOptions {
  orgId: string;
  env: "development" | "test" | "production";
  log: Logger;
  now?: () => Date;
  /* M16: where a media item is still needed (PublishService.mediaUsage). */
  usage?: (mediaId: string) => Promise<string[]>;
  /* The same for many at once (PublishService.mediaUsageMany), for the
     library's "In use" / "Not in use" labels. Defaults to `usage` per id. */
  usageMany?: (mediaIds: string[]) => Promise<Record<string, string[]>>;
  /* M16: the publish lock (publishing/lock.ts). */
  lock?: PublishLock;
}

export class MediaService {
  readonly #store: MediaStore;
  readonly #storage: ObjectStorage | null;
  readonly #audit: AuditService;
  readonly #throttle: ThrottleStore;
  readonly #orgId: string;
  readonly #env: MediaServiceOptions["env"];
  readonly #log: Logger;
  readonly #now: () => Date;
  readonly #usage: (mediaId: string) => Promise<string[]>;
  readonly #usageMany: (mediaIds: string[]) => Promise<Record<string, string[]>>;
  readonly #lock: PublishLock;

  constructor(store: MediaStore, storage: ObjectStorage | null, audit: AuditService, throttle: ThrottleStore, options: MediaServiceOptions) {
    this.#usage = options.usage ?? (async () => []);
    this.#usageMany = options.usageMany ?? (async (ids) => Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await this.#usage(id)] as const))));
    this.#lock = options.lock ?? unlocked;
    this.#store = store;
    this.#storage = storage;
    this.#audit = audit;
    this.#throttle = throttle;
    this.#orgId = options.orgId;
    this.#env = options.env;
    this.#log = options.log;
    this.#now = options.now ?? (() => new Date());
  }

  /* The limits, for the admin's instant feedback. Not a security boundary. */
  static policy() {
    return { maxBytes: MEDIA_POLICY.maxBytes, mimeTypes: MEDIA_MIME_TYPES, extensions: MEDIA_MIME_TYPES.flatMap((t) => [...MEDIA_POLICY.types[t].extensions]), maxDimension: MEDIA_POLICY.maxDimension };
  }

  #member(auth: AuthContext) {
    // The route resolved this context; the organization is the session's.
    if (auth.organization.id !== this.#orgId) throw errors.forbidden("You do not have permission to do this.");
    return auth;
  }

  #requireStorage(): ObjectStorage {
    if (!this.#storage) throw errors.unavailable("Media storage is not configured.");
    return this.#storage;
  }

  #storageFailure(error: unknown, action: string): ApiError {
    this.#log.error("media storage call failed", { action, error });
    return errors.unavailable("Media storage is unavailable. Try again shortly.", error);
  }

  async #find(id: string): Promise<MediaRecord> {
    if (!MediaIdParam.safeParse(id).success) throw errors.notFound("media");
    const record = await this.#store.findById(id);
    if (!record || record.status === "deleted") throw errors.notFound("media");
    return record;
  }

  async list(auth: AuthContext, input: unknown): Promise<{ items: MediaView[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }> {
    this.#member(auth);
    const parsed = ListInput.safeParse(input);
    if (!parsed.success) throw errors.validation(issues(parsed.error, "query"));
    const { search, type, status, sort, usage, page, pageSize } = parsed.data;
    const query = { ...(search && { search }), ...(type && { kind: type }), ...(status && { status }), sort };
    if (usage) {
      /* Usage is not a database field: read every matching ready image (a
         library is hundreds, not millions), look each up, then page. */
      if (status && status !== "ready") return { items: [], pagination: { page, pageSize, total: 0, totalPages: 1 } };
      const all = (await this.#store.list({ ...query, status: "ready", page: 1, pageSize: 10_000 })).items;
      const uses = await this.#usageMany(all.map((r) => r.id));
      const matching = all.filter((r) => (uses[r.id]?.length ?? 0) > 0 === (usage === "used"));
      const items = matching.slice((page - 1) * pageSize, page * pageSize).map((r) => ({ ...toMediaView(r), usedBy: uses[r.id] ?? [] }));
      return { items, pagination: { page, pageSize, total: matching.length, totalPages: Math.max(1, Math.ceil(matching.length / pageSize)) } };
    }
    const result: MediaPage = await this.#store.list({ ...query, page, pageSize });
    return {
      items: await this.#withUsage(result.items),
      pagination: { page, pageSize, total: result.total, totalPages: Math.max(1, Math.ceil(result.total / pageSize)) },
    };
  }

  async get(auth: AuthContext, id: string): Promise<MediaView> {
    this.#member(auth);
    return (await this.#withUsage([await this.#find(id)]))[0]!;
  }

  /* Views, each ready one with where it is still used. */
  async #withUsage(records: MediaRecord[]): Promise<MediaView[]> {
    const ready = records.filter((r) => r.status === "ready").map((r) => r.id);
    const uses = ready.length ? await this.#usageMany(ready) : {};
    return records.map((r) => (r.status === "ready" ? { ...toMediaView(r), usedBy: uses[r.id] ?? [] } : toMediaView(r)));
  }

  async createUploadIntent(auth: AuthContext, input: unknown, facts: RequestFacts): Promise<UploadIntent> {
    this.#member(auth);
    const parsed = IntentInput.safeParse(input);
    if (!parsed.success) throw errors.validation(issues(parsed.error, "body"));
    const { mimeType, size, width, height } = parsed.data;
    const filename = cleanDisplayName(parsed.data.filename);

    const problems: ErrorDetail[] = [];
    if (!filename) problems.push({ path: "body.filename", message: "must name the file" });
    if (!isMediaMimeType(mimeType)) problems.push({ path: "body.mimeType", message: `is not a supported type (${MEDIA_MIME_TYPES.join(", ")})` });
    else {
      const extension = extensionOf(filename);
      if (extension && !(MEDIA_POLICY.types[mimeType].extensions as readonly string[]).includes(extension))
        problems.push({ path: "body.filename", message: "has an extension that does not match its type" });
    }
    if (size > MEDIA_POLICY.maxBytes) problems.push({ path: "body.size", message: `must be at most ${MEDIA_POLICY.maxBytes} bytes` });
    if (problems.length || !isMediaMimeType(mimeType)) throw errors.validation(problems);

    const storage = this.#requireStorage();

    // Abuse guard: issuing upload URLs is cheap for a caller, so count it.
    const window = Math.floor(this.#now().getTime() / MEDIA_POLICY.intentLimit.windowMs);
    const count = await this.#throttle.hit(`media-intent:${auth.user.id}:${window}`, new Date((window + 2) * MEDIA_POLICY.intentLimit.windowMs));
    if (count > MEDIA_POLICY.intentLimit.perUser)
      throw errors.rateLimited(Math.max(1, Math.ceil(((window + 1) * MEDIA_POLICY.intentLimit.windowMs - this.#now().getTime()) / 1000)));

    const now = this.#now().toISOString();
    const record: MediaRecord = {
      id: randomUUID(),
      orgId: this.#orgId,
      status: "pending",
      kind: MEDIA_POLICY.types[mimeType].kind,
      objectKey: newObjectKey({ orgId: this.#orgId, filename, mimeType, env: this.#env }),
      objectState: "awaiting-upload",
      publicUrl: null,
      originalFilename: filename,
      mimeType,
      size,
      width: width ?? null,
      height: height ?? null,
      alt: "",
      caption: "",
      focal: null,
      credit: "",
      license: "",
      consent: "unknown",
      createdBy: auth.user.id,
      updatedBy: auth.user.id,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      failedAt: null,
      failureReason: null,
      deletedAt: null,
      deletedBy: null,
      version: 1,
      schemaVersion: 1,
    };

    let target;
    try {
      target = await storage.createUploadTarget({ key: record.objectKey, contentType: mimeType, contentLength: size, expiresInSeconds: MEDIA_POLICY.uploadUrlTtlSeconds });
    } catch (error) {
      throw this.#storageFailure(error, "presign");
    }
    await this.#store.insert(record);
    await this.#audit.recordSafely(
      { action: "media.upload_intent", resourceType: "media", resourceId: record.id, actorUserId: auth.user.id, metadata: { mimeType, size, provider: storage.provider } },
      facts
    );
    return {
      mediaId: record.id,
      objectKey: record.objectKey,
      uploadUrl: target.url,
      uploadMethod: target.method,
      uploadHeaders: target.headers,
      expiresAt: target.expiresAt.toISOString(),
      media: toMediaView(record),
    };
  }

  async complete(auth: AuthContext, id: string, facts: RequestFacts): Promise<MediaView> {
    this.#member(auth);
    const record = await this.#find(id);
    if (record.status === "ready") return toMediaView(record); // idempotent
    if (record.status !== "pending") throw errors.conflict("This upload can no longer be completed.");
    const storage = this.#requireStorage();

    let head, start;
    try {
      head = await storage.head(record.objectKey);
      start = head ? await storage.readStart(record.objectKey, SNIFF_BYTES) : null;
    } catch (error) {
      throw error instanceof StorageError ? this.#storageFailure(error, "verify") : error;
    }
    if (!head || !start) throw errors.conflict("The file has not reached storage yet. Upload it, then complete again.");

    const sniffed = sniffImage(start);
    const reason =
      head.size !== record.size ? "size-mismatch"
      : !sniffed || sniffed.mimeType !== record.mimeType ? "content-mismatch"
      : (sniffed.width ?? 0) > MEDIA_POLICY.maxDimension || (sniffed.height ?? 0) > MEDIA_POLICY.maxDimension ? "dimensions-too-large"
      : null;
    if (reason) {
      await this.#fail(auth, record, reason, facts);
      throw errors.validation([{ path: "file", message: reason === "content-mismatch" ? "is not the image type it claimed to be" : reason === "size-mismatch" ? "is not the size that was declared" : "is larger than the maximum image dimensions" }], "The uploaded file was rejected.");
    }

    const now = this.#now().toISOString();
    const ready = await this.#store.update(record.id, { fromStatuses: ["pending"] }, {
      status: "ready",
      objectState: "present",
      publicUrl: storage.publicUrl(record.objectKey),
      width: sniffed!.width ?? record.width,
      height: sniffed!.height ?? record.height,
      completedAt: now,
      updatedAt: now,
      updatedBy: auth.user.id,
    });
    if (!ready) {
      // Lost a race: another completion (or an abort) got there first.
      const current = await this.#find(id);
      if (current.status === "ready") return toMediaView(current);
      throw errors.conflict("This upload can no longer be completed.");
    }
    await this.#audit.recordSafely(
      { action: "media.upload_completed", resourceType: "media", resourceId: ready.id, actorUserId: auth.user.id, metadata: { mimeType: ready.mimeType, size: ready.size, width: ready.width, height: ready.height } },
      facts
    );
    return toMediaView(ready);
  }

  /* The browser could not upload (error, or the person cancelled). */
  async abort(auth: AuthContext, id: string, facts: RequestFacts): Promise<MediaView> {
    this.#member(auth);
    const record = await this.#find(id);
    if (record.status === "failed") return toMediaView(record);
    if (record.status !== "pending") throw errors.conflict("Only an unfinished upload can be cancelled.");
    return toMediaView(await this.#fail(auth, record, "upload-aborted", facts));
  }

  async #fail(auth: AuthContext | null, record: MediaRecord, reason: string, facts: RequestFacts): Promise<MediaRecord> {
    const now = this.#now().toISOString();
    const failed = await this.#store.update(record.id, { fromStatuses: ["pending"] }, {
      status: "failed",
      failureReason: reason,
      failedAt: now,
      updatedAt: now,
      ...(auth && { updatedBy: auth.user.id }),
      // Whatever may have arrived is removed; the record stays as history.
      objectState: "deleting",
    });
    if (!failed) return (await this.#store.findById(record.id)) ?? record;
    await this.#audit.recordSafely({ action: "media.upload_failed", resourceType: "media", resourceId: record.id, actorUserId: auth?.user.id ?? null, metadata: { reason } }, facts);
    return await this.#removeObject(failed);
  }

  /* Storage second: confirm the object is gone, or leave it for cleanup(). */
  async #removeObject(record: MediaRecord): Promise<MediaRecord> {
    if (!this.#storage) return record;
    try {
      await this.#storage.delete(record.objectKey);
    } catch (error) {
      this.#log.warn("media object delete failed; left for cleanup", { mediaId: record.id, error });
      return record;
    }
    return (await this.#store.update(record.id, { fromStatuses: [record.status] }, { objectState: "deleted" })) ?? record;
  }

  async updateMetadata(auth: AuthContext, id: string, input: unknown, facts: RequestFacts): Promise<MediaView> {
    this.#member(auth);
    const parsed = MetadataInput.safeParse(input);
    if (!parsed.success) throw errors.validation(issues(parsed.error, "body"));
    const record = await this.#find(id);
    if (record.status !== "ready") throw errors.conflict("Only a ready file's details can be edited.");
    const { version, ...fields } = parsed.data;
    /* A field never saved (a focal point before Milestone 2) is null. */
    const changed = Object.fromEntries(Object.entries(fields).filter(([key, value]) => value !== undefined && (record[key as keyof MediaRecord] ?? null) !== value));
    if (!Object.keys(changed).length) {
      if (version !== record.version) throw errors.conflict("This file was changed since it was opened. Reload it and try again.");
      return (await this.#withUsage([record]))[0]!;
    }
    const now = this.#now().toISOString();
    const updated = await this.#store.update(record.id, { fromStatuses: ["ready"], expectedVersion: version }, { ...changed, updatedAt: now, updatedBy: auth.user.id });
    if (!updated) throw errors.conflict("This file was changed since it was opened. Reload it and try again.");
    await this.#audit.recordSafely(
      { action: "media.metadata_updated", resourceType: "media", resourceId: record.id, actorUserId: auth.user.id, metadata: { fields: Object.keys(changed) } },
      facts
    );
    return (await this.#withUsage([updated]))[0]!;
  }

  async delete(auth: AuthContext, id: string, facts: RequestFacts): Promise<{ deleted: true; storage: "removed" | "pending" }> {
    this.#member(auth);
    return this.#lock.exclusive(() => this.#delete(auth, id, facts));
  }

  async #delete(auth: AuthContext, id: string, facts: RequestFacts): Promise<{ deleted: true; storage: "removed" | "pending" }> {
    const record = await this.#find(id);
    // Only a ready image can be referenced (content and settings refuse any other).
    if (record.status === "ready") {
      const usedBy = await this.#usage(record.id);
      if (usedBy.length) {
        await this.#audit.recordSafely({ action: "media.delete_refused", resourceType: "media", resourceId: record.id, actorUserId: auth.user.id, metadata: { uses: usedBy.length } }, facts);
        throw new ApiError("CONFLICT", "This image is still used by the website or by content approved for it. Remove it there first.", { details: usedBy.slice(0, 20).map((where) => ({ path: "usedBy", message: where })) });
      }
    }
    const now = this.#now().toISOString();
    const deleted = await this.#store.update(record.id, { fromStatuses: ["pending", "ready", "failed"] }, {
      status: "deleted",
      publicUrl: null,
      deletedAt: now,
      deletedBy: auth.user.id,
      updatedAt: now,
      updatedBy: auth.user.id,
      objectState: record.objectState === "deleted" ? "deleted" : "deleting",
    });
    if (!deleted) throw errors.notFound("media");
    await this.#audit.recordSafely(
      { action: "media.deleted", resourceType: "media", resourceId: record.id, actorUserId: auth.user.id, metadata: { previousStatus: record.status } },
      facts
    );
    if (deleted.objectState === "deleted") return { deleted: true, storage: "removed" };
    const after = await this.#removeObject(deleted);
    return { deleted: true, storage: after.objectState === "deleted" ? "removed" : "pending" };
  }

  /* Housekeeping — run on demand (scripts/media-cleanup.ts), not on a
     schedule yet:
       1. pending uploads older than MEDIA_POLICY.abandonAfterMs → failed
          (their presigned URL expired long ago), objects removed
       2. retries every storage delete not yet confirmed */
  async cleanup({ limit = 200 }: { limit?: number } = {}) {
    const before = new Date(this.#now().getTime() - MEDIA_POLICY.abandonAfterMs);
    const facts: RequestFacts = { requestId: null, clientIp: null, userAgent: "media-cleanup" };
    let abandoned = 0;
    for (const record of await this.#store.findStalePending(before, limit)) {
      await this.#fail(null, record, "abandoned", facts);
      abandoned++;
    }
    let removed = 0;
    let stillPending = 0;
    for (const record of await this.#store.findObjectsToDelete(limit)) {
      const after = await this.#removeObject(record);
      if (after.objectState === "deleted") removed++;
      else stillPending++;
    }
    return { abandoned, objectsRemoved: removed, objectsStillPending: stillPending };
  }
}
