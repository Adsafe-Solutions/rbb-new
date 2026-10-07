import { Appeal } from "@rbb/content-schema";
import { DuplicateKeyError } from "../../db/mongo.ts";
import { ApiError, errors, type ErrorDetail } from "../../errors.ts";
import type { AppealStore, StoredRecord } from "./repository.ts";

/* Appeal rules — the one place they live:

     · every record in and out is checked against the content contract
       (@rbb/content-schema `Appeal`) — the API defines no schema of its own
     · a record belongs to this deployment's organization; another orgId is
       refused
     · timestamps are the API's: whatever a caller sends as createdAt,
       updatedAt or publishedAt is replaced
     · a reader only ever sees a published appeal
     · an update names the revision it was based on; a stale one conflicts

   M2 exposes only the published read over HTTP. create/update are here for
   the admin to call once it can authenticate (M3) — there is no
   unauthenticated write route. */

const issuesOf = (error: { issues: { path: PropertyKey[]; message: string }[] }): ErrorDetail[] =>
  error.issues.map((issue) => ({ path: issue.path.map(String).join("."), message: issue.message }));

export class AppealService {
  readonly #store: AppealStore;
  readonly #orgId: string;
  readonly #now: () => Date;

  constructor(store: AppealStore, orgId: string, now: () => Date = () => new Date()) {
    this.#store = store;
    this.#orgId = orgId;
    this.#now = now;
  }

  /* A published appeal by its slug, or NOT_FOUND — a draft or archived
     appeal is indistinguishable from a missing one. */
  async getPublished(slug: string): Promise<Appeal> {
    const stored = await this.#store.findBySlug(slug);
    if (!stored || stored.record.status !== "published") throw errors.notFound("appeal");
    return this.#checked(stored.record);
  }

  async create(input: unknown): Promise<{ appeal: Appeal; revision: number }> {
    const appeal = this.#parse(input);
    const now = this.#now().toISOString();
    const record: Appeal = {
      ...withoutTimestamps(appeal),
      createdAt: now,
      updatedAt: now,
      ...(appeal.status === "published" && { publishedAt: now }),
    };
    try {
      const stored = await this.#store.insert(record);
      return { appeal: this.#checked(stored.record), revision: stored.revision };
    } catch (error) {
      throw conflictFor(error) ?? error;
    }
  }

  async update(id: string, input: unknown, expectedRevision: number): Promise<{ appeal: Appeal; revision: number }> {
    const existing = await this.#store.findById(id);
    if (!existing) throw errors.notFound("appeal");
    const appeal = this.#parse(input);
    if (appeal.id !== id) throw errors.validation([{ path: "id", message: "must not change" }]);

    const now = this.#now().toISOString();
    const publishedAt = (existing.record.publishedAt as string | undefined) ?? (appeal.status === "published" ? now : undefined);
    const record: Appeal = {
      ...withoutTimestamps(appeal),
      createdAt: existing.record.createdAt as string,
      updatedAt: now,
      ...(publishedAt && { publishedAt }),
    };
    try {
      const stored = await this.#store.replace(id, record, expectedRevision);
      if (!stored) throw errors.conflict("The appeal was changed since it was read. Reload it and try again.");
      return { appeal: this.#checked(stored.record), revision: stored.revision };
    } catch (error) {
      throw conflictFor(error) ?? error;
    }
  }

  #parse(input: unknown): Appeal {
    const result = Appeal.safeParse(input);
    if (!result.success) throw errors.validation(issuesOf(result.error));
    if (result.data.orgId !== this.#orgId)
      throw errors.validation([{ path: "orgId", message: "must be this deployment's organization" }]);
    return result.data;
  }

  /* What leaves the API is a valid record — a stored document that no
     longer meets the contract is a data problem, reported as an internal
     error (the field paths go to the log, never to the client). */
  #checked(record: StoredRecord): Appeal {
    const result = Appeal.safeParse(record);
    if (!result.success)
      throw errors.internal(new Error(`Stored appeal fails the content contract at: ${issuesOf(result.error).map((i) => i.path).join(", ")}`));
    return result.data;
  }
}

const withoutTimestamps = ({ createdAt: _c, updatedAt: _u, publishedAt: _p, ...rest }: Appeal) => rest;

const conflictFor = (error: unknown): ApiError | null =>
  error instanceof DuplicateKeyError
    ? errors.conflict(`An appeal with this ${error.field} already exists.`)
    : null;
