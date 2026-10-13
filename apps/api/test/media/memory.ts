import { readFileSync } from "node:fs";
import { DuplicateKeyError } from "../../src/db/mongo.ts";
import { AuditService } from "../../src/modules/audit/audit.ts";
import { permissionsFor } from "../../src/modules/auth/permissions.ts";
import type { AuthContext, Role } from "../../src/modules/auth/types.ts";
import type { MediaQuery, MediaStore } from "../../src/modules/media/repository.ts";
import { MediaService } from "../../src/modules/media/service.ts";
import { StorageError, type ObjectStorage } from "../../src/modules/media/storage.ts";
import type { MediaRecord } from "../../src/modules/media/types.ts";
import { clock, memoryAuditStore, memoryData, silentLog, type MemoryData } from "../auth/memory.ts";

/* In-memory doubles with the same contracts as MongoMediaStore and
   R2Storage — the store over a SHARED row list, so two organizations can
   sit side by side and isolation can be tested. */

const FIXTURES = new URL("../fixtures/media/", import.meta.url);
export const fixture = (name: string) => new Uint8Array(readFileSync(new URL(name, FIXTURES)));

export class MemoryMediaStore implements MediaStore {
  readonly rows: MediaRecord[];
  readonly orgId: string;
  constructor(rows: MediaRecord[], orgId: string) {
    this.rows = rows;
    this.orgId = orgId;
  }
  #mine = () => this.rows.filter((r) => r.orgId === this.orgId);

  async insert(record: MediaRecord) {
    if (record.orgId !== this.orgId) throw new Error("Refusing to store a media record for another organization");
    if (this.#mine().some((r) => r.id === record.id)) throw new DuplicateKeyError("id");
    if (this.#mine().some((r) => r.objectKey === record.objectKey)) throw new DuplicateKeyError("objectKey");
    this.rows.push(structuredClone(record));
  }
  async findById(id: string) {
    const row = this.#mine().find((r) => r.id === id);
    return row ? structuredClone(row) : null;
  }
  async findMany(ids: string[]) {
    return this.#mine().filter((r) => ids.includes(r.id)).map((r) => structuredClone(r));
  }
  async list({ search, kind, status, sort, page, pageSize }: MediaQuery) {
    let rows = this.#mine().filter((r) => (status ? r.status === status : r.status !== "deleted"));
    if (kind) rows = rows.filter((r) => r.kind === kind);
    if (search) rows = rows.filter((r) => r.originalFilename.toLowerCase().includes(search.toLowerCase()));
    rows.sort((a, b) => (a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt)) * (sort === "oldest" ? 1 : -1));
    return { items: rows.slice((page - 1) * pageSize, page * pageSize).map((r) => structuredClone(r)), total: rows.length };
  }
  async update(id: string, guard: { fromStatuses: readonly MediaRecord["status"][]; expectedVersion?: number }, changes: Partial<MediaRecord>) {
    const row = this.#mine().find((r) => r.id === id);
    if (!row || !guard.fromStatuses.includes(row.status)) return null;
    if (guard.expectedVersion !== undefined && row.version !== guard.expectedVersion) return null;
    const { id: _i, orgId: _o, objectKey: _k, createdBy: _c, createdAt: _a, version: _v, ...allowed } = changes;
    Object.assign(row, allowed, { version: row.version + 1 });
    return structuredClone(row);
  }
  async findStalePending(before: Date, limit: number) {
    return this.#mine().filter((r) => r.status === "pending" && Date.parse(r.createdAt) < before.getTime()).slice(0, limit).map((r) => structuredClone(r));
  }
  async findObjectsToDelete(limit: number) {
    return this.#mine().filter((r) => r.objectState === "deleting").slice(0, limit).map((r) => structuredClone(r));
  }
}

/* Object storage in memory. `put` stands in for the browser's PUT to the
   presigned URL; `failDeletes` simulates a storage outage. */
export class MemoryStorage implements ObjectStorage {
  readonly provider = "memory";
  readonly objects = new Map<string, { bytes: Uint8Array; contentType: string }>();
  readonly issued: { key: string; contentType: string; contentLength: number; expiresInSeconds: number }[] = [];
  failDeletes = false;
  failAll = false;

  async createUploadTarget(input: { key: string; contentType: string; contentLength: number; expiresInSeconds: number }) {
    if (this.failAll) throw new StorageError("storage down");
    this.issued.push(input);
    return { url: `https://storage.test/${input.key}?X-Amz-Signature=deadbeef`, method: "PUT" as const, headers: { "Content-Type": input.contentType }, expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000) };
  }
  put(key: string, bytes: Uint8Array, contentType: string) {
    this.objects.set(key, { bytes, contentType });
  }
  async head(key: string) {
    if (this.failAll) throw new StorageError("storage down");
    const object = this.objects.get(key);
    return object ? { size: object.bytes.byteLength, contentType: object.contentType } : null;
  }
  async readStart(key: string, length: number) {
    const object = this.objects.get(key);
    return object ? object.bytes.slice(0, length) : null;
  }
  async delete(key: string) {
    if (this.failDeletes || this.failAll) throw new StorageError("delete failed");
    this.objects.delete(key);
  }
  publicUrl(key: string) {
    return `https://media.test/${key}`;
  }
  async putObject(key: string, body: Uint8Array, contentType: string) {
    if (this.failAll) throw new StorageError("storage down");
    this.objects.set(key, { bytes: body, contentType });
  }
  presignGet(key: string, expiresInSeconds: number, downloadName?: string) {
    return `https://private.storage.test/${key}?expires=${expiresInSeconds}${downloadName ? `&name=${encodeURIComponent(downloadName)}` : ""}`;
  }
}

export function member(orgId: string, role: Role = "EDITOR", userId = crypto.randomUUID()): AuthContext {
  const at = "2026-10-01T00:00:00.000Z";
  return {
    user: { id: userId, orgId, email: `${userId}@test.example`, emailNormalized: `${userId}@test.example`, name: "Test Member", passwordHash: "x", status: "active", createdAt: at, updatedAt: at, revision: 1 },
    membership: { id: crypto.randomUUID(), orgId, userId, role, status: "active", createdAt: at, updatedAt: at, revision: 1 },
    organization: { id: orgId },
    permissions: permissionsFor(role),
    session: { id: crypto.randomUUID(), orgId, userId, tokenHash: "x", createdAt: at, expiresAt: "2099-01-01T00:00:00.000Z", lastSeenAt: at, revokedAt: null },
  };
}

export const FACTS = { requestId: "req-media-test", clientIp: "203.0.113.9", userAgent: "test" };

export function mediaHarness(orgId = "org-a", shared: { rows: MediaRecord[]; data: MemoryData } = { rows: [], data: memoryData() }) {
  const time = clock();
  const storage = new MemoryStorage();
  const store = new MemoryMediaStore(shared.rows, orgId);
  const audit = new AuditService(memoryAuditStore(shared.data, orgId), { orgId, secret: "test-only-auth-secret-0123456789abcdef", log: silentLog, now: time.now });
  const throttle = {
    hit: async (key: string) => {
      const count = (shared.data.throttle.get(key) ?? 0) + 1;
      shared.data.throttle.set(key, count);
      return count;
    },
    peek: async (key: string) => shared.data.throttle.get(key) ?? 0,
  };
  const service = new MediaService(store, storage, audit, throttle, { orgId, env: "test", log: silentLog, now: time.now });
  return { service, storage, store, shared, time, audit: shared.data.audit };
}
