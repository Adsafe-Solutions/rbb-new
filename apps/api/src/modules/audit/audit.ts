import { randomUUID } from "node:crypto";
import type { Db, ObjectId } from "mongodb";
import { COLLECTIONS } from "../../db/collections.ts";
import { SENSITIVE_KEY, redactText, type Logger } from "../../logging/logger.ts";
import { pseudonym } from "../auth/tokens.ts";

/* The audit trail — append-only. The store can add an entry and read
   entries back; there is no update and no delete, in code or over HTTP.

   Who did it (`actorUserId`) always comes from the authenticated context
   the server resolved, never from request input. What is recorded about
   the request is limited to its id, a keyed hash of the client IP and a
   truncated user agent. `metadata` is sanitised before it is stored: keys
   that name credentials are dropped (not masked), strings are redacted and
   bounded, and the structure is capped — so a password, token, cookie or
   key can never be persisted here, whatever a caller passes. */

export interface AuditEntry {
  id: string;
  orgId: string;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  requestId: string | null;
  ipHash: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditStore {
  append(entry: AuditEntry): Promise<void>;
  /* Newest first — for tests now, the admin audit module later. */
  listRecent(limit: number): Promise<AuditEntry[]>;
}

export interface AuditEvent {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface RequestFacts {
  requestId: string | null;
  clientIp: string | null;
  userAgent: string | null;
}

const NAME = /^[a-z][a-z0-9_.]{1,63}$/;
const LIMITS = { depth: 3, keys: 30, items: 20, text: 500, userAgent: 256 } as const;

/* Metadata → something safe to keep forever. */
export function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return redactText(value).slice(0, LIMITS.text);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (depth >= LIMITS.depth) return undefined;
  if (Array.isArray(value)) return value.slice(0, LIMITS.items).map((v) => sanitizeMetadata(v, depth + 1)).filter((v) => v !== undefined);
  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !SENSITIVE_KEY.test(key) && !/hash$/i.test(key))
      .slice(0, LIMITS.keys)
      .map(([key, v]) => [key, sanitizeMetadata(v, depth + 1)] as const)
      .filter(([, v]) => v !== undefined);
    return Object.fromEntries(entries);
  }
  return undefined;
}

export class AuditService {
  readonly #store: AuditStore;
  readonly #orgId: string;
  readonly #secret: string;
  readonly #log: Logger;
  readonly #now: () => Date;

  constructor(store: AuditStore, { orgId, secret, log, now = () => new Date() }: { orgId: string; secret: string; log: Logger; now?: () => Date }) {
    this.#store = store;
    this.#orgId = orgId;
    this.#secret = secret;
    this.#log = log;
    this.#now = now;
  }

  /* Records an event. Throws if it cannot be stored — use `recordSafely`
     where the action must not fail because the audit write did. */
  async record(event: AuditEvent, request: RequestFacts): Promise<AuditEntry> {
    if (!NAME.test(event.action) || !NAME.test(event.resourceType)) throw new Error("Invalid audit action or resource type");
    const entry: AuditEntry = {
      id: randomUUID(),
      orgId: this.#orgId,
      actorUserId: event.actorUserId ?? null,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId ?? null,
      metadata: (sanitizeMetadata(event.metadata ?? {}) as Record<string, unknown>) ?? {},
      requestId: request.requestId,
      ipHash: request.clientIp ? pseudonym(this.#secret, `ip:${request.clientIp}`) : null,
      userAgent: request.userAgent ? request.userAgent.slice(0, LIMITS.userAgent) : null,
      createdAt: this.#now().toISOString(),
    };
    await this.#store.append(entry);
    return entry;
  }

  /* For authentication events: a failed audit write is logged loudly but
     does not lock everyone out of the admin. */
  async recordSafely(event: AuditEvent, request: RequestFacts): Promise<void> {
    try {
      await this.record(event, request);
    } catch (error) {
      this.#log.error("audit write failed", { action: event.action, error });
    }
  }
}

type AuditDocument = Omit<AuditEntry, "createdAt"> & { _id?: ObjectId; createdAt: Date };

export function mongoAuditStore(db: Db, orgId: string): AuditStore {
  const collection = db.collection<AuditDocument>(COLLECTIONS.auditLogs);
  return {
    async append(entry) {
      if (entry.orgId !== orgId) throw new Error("Refusing to store an audit entry for another organization");
      await collection.insertOne({ ...entry, createdAt: new Date(entry.createdAt) });
    },
    async listRecent(limit) {
      const documents = await collection.find({ orgId }).sort({ createdAt: -1 }).limit(Math.min(limit, 500)).toArray();
      return documents.map(({ _id, createdAt, ...rest }) => ({ ...rest, createdAt: createdAt.toISOString() }));
    },
  };
}
