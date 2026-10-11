import type { Collection, Db, ObjectId } from "mongodb";
import type { PublicationSchedule } from "@rbb/content-schema";
import type { Member } from "../content/repository.ts";

/* A single page — the homepage, the About and Impact pages, the
   Transparency record — ONE document per organization (a unique index on
   orgId), like the general donation page. Every query is scoped to the
   organization the store was created for; writes are conditional on
   `revision`.

   A KEYED store (M19, the policies) holds one of SEVERAL fixed pages per
   organization in a shared collection: every query is scoped to the
   organization AND the key (`{ orgId, policyId }`, a unique index), so
   each keyed page behaves exactly like a single page. */

/* What every single page record has. */
export interface PageRecord {
  id: string;
  orgId: string;
  status: "draft" | "submitted" | "approved" | "published" | "archived";
  publishedAt?: string;
  seo?: { title?: string; description?: string; ogImageId?: string; noIndex?: boolean };
}

/* A BLOCK page: its parts are an ordered list of typed blocks. */
export interface BlockPageRecord extends PageRecord {
  sections: { id: string; type: string; enabled: boolean; data: unknown }[];
}

export interface StoredBlockPage<R extends PageRecord> {
  record: R;
  revision: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: Member;
  /* M14: the revision whose version is in the live snapshot, or null. */
  publishedRevision?: number | null;
  /* M15: when the approved revision joins a website publish (see
     content/repository.ts — dropped by any write that leaves the page not
     approved, and by the publish that takes it). */
  schedule?: PublicationSchedule | null;
}

export interface BlockPageStore<R extends PageRecord> {
  get(): Promise<StoredBlockPage<R> | null>;
  /* Creates the page; false if the organization already has one. */
  create(stored: StoredBlockPage<R>): Promise<boolean>;
  /* null when the page is not at `expectedRevision`. */
  replace(record: R, expectedRevision: number, by: Member, at: string): Promise<StoredBlockPage<R> | null>;
  /* M14: after a website publish, `revision` of the page is live; if the
     page is still at that revision and approved, it is now published. */
  markPublished(revision: number, at: string): Promise<void>;
  /* M15: set (null: drop) the schedule of the APPROVED page at
     `expectedRevision` — a new revision; null if not at it or not approved. */
  setSchedule(expectedRevision: number, schedule: PublicationSchedule | null, by: Member, at: string): Promise<StoredBlockPage<R> | null>;
  /* M15: the publication the schedule was due in was refused. */
  markScheduleFailed(scheduledAt: string, failedAt: string, problems: string[]): Promise<void>;
}

interface BlockPageDocument<R> {
  _id?: ObjectId;
  orgId: string;
  record: R;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: Member;
  publishedRevision?: number | null;
  schedule?: PublicationSchedule | null;
}

const toStored = <R extends PageRecord>(d: BlockPageDocument<R>): StoredBlockPage<R> => ({ record: d.record, revision: d.revision, createdAt: d.createdAt.toISOString(), updatedAt: d.updatedAt.toISOString(), updatedBy: d.updatedBy, publishedRevision: d.publishedRevision ?? null, schedule: d.schedule ?? null });

/* Which of an organization's keyed pages a store holds: a top-level field
   of the document, never a path into `record` (an upsert would conflict). */
export interface PageKey {
  field: string;
  value: string;
}

export class MongoBlockPageStore<R extends PageRecord> implements BlockPageStore<R> {
  readonly #collection: Collection<BlockPageDocument<R>>;
  readonly #orgId: string;
  readonly #scope: Record<string, string>;

  constructor(db: Db, collection: string, orgId: string, key?: PageKey) {
    this.#collection = db.collection<BlockPageDocument<R>>(collection);
    this.#orgId = orgId;
    this.#scope = { orgId, ...(key && { [key.field]: key.value }) };
  }

  #assert(record: R) {
    if (record.orgId !== this.#orgId) throw new Error("Refusing to store a page for another organization");
  }

  async get() {
    const document = (await this.#collection.findOne(this.#scope as never)) as BlockPageDocument<R> | null;
    return document ? toStored(document) : null;
  }

  async create(stored: StoredBlockPage<R>) {
    this.#assert(stored.record);
    const result = await this.#collection.updateOne(
      this.#scope as never,
      { $setOnInsert: { ...this.#scope, record: stored.record as never, revision: stored.revision, createdAt: new Date(stored.createdAt), updatedAt: new Date(stored.updatedAt), updatedBy: stored.updatedBy } },
      { upsert: true }
    );
    return result.upsertedCount === 1;
  }

  async replace(record: R, expectedRevision: number, by: Member, at: string) {
    this.#assert(record);
    const document = (await this.#collection.findOneAndUpdate(
      { ...this.#scope, revision: expectedRevision } as never,
      // Archiving drops the live version: an archived page never returns by itself. Leaving approved drops the schedule (M15).
      { $set: { record, updatedAt: new Date(at), updatedBy: by, ...(record.status === "archived" && { publishedRevision: null }) }, $inc: { revision: 1 }, ...(record.status !== "approved" && { $unset: { schedule: "" } }) } as never,
      { returnDocument: "after" }
    )) as BlockPageDocument<R> | null;
    return document ? toStored(document) : null;
  }

  async markPublished(revision: number, at: string) {
    const base = this.#scope;
    await this.#collection.updateOne(base as never, { $set: { publishedRevision: revision } } as never);
    await this.#collection.updateOne({ ...base, revision, "record.status": "approved" } as never, { $set: { "record.status": "published" }, $unset: { schedule: "" } } as never);
    await this.#collection.updateOne({ ...base, revision, "record.publishedAt": { $exists: false } } as never, { $set: { "record.publishedAt": at } } as never);
  }

  async setSchedule(expectedRevision: number, schedule: PublicationSchedule | null, by: Member, at: string) {
    const document = (await this.#collection.findOneAndUpdate(
      { ...this.#scope, revision: expectedRevision, "record.status": "approved" } as never,
      { $set: { updatedAt: new Date(at), updatedBy: by, ...(schedule && { schedule }) }, $inc: { revision: 1 }, ...(!schedule && { $unset: { schedule: "" } }) } as never,
      { returnDocument: "after" }
    )) as BlockPageDocument<R> | null;
    return document ? toStored(document) : null;
  }

  async markScheduleFailed(scheduledAt: string, failedAt: string, problems: string[]) {
    await this.#collection.updateOne({ ...this.#scope, "record.status": "approved", "schedule.at": scheduledAt } as never, { $set: { "schedule.failedAt": failedAt, "schedule.problems": problems } } as never);
  }
}
