import type { Collection, Db, Filter, ObjectId, Sort } from "mongodb";
import type { PublicationSchedule } from "@rbb/content-schema";
import { asDuplicateKey } from "../../db/mongo.ts";

/* Storage for a content collection (posts, events) — the contract record
   plus what the CMS needs around it, one document per record, scoped to
   ONE organization fixed at construction:

     record       the content-contract record (validated by the service)
     revision     increments on every write; saves name it (409 if stale)
     createdBy / updatedBy   { id, name } of the members — never published
     slugHistory  addresses the record had while published, newest last:
                  kept for the redirects a later milestone will create
     publishedRevision  the revision whose version is in the live snapshot
                  (M14), or null: set by the website publish, cleared on
                  archive. A record edited since stays live in that version
     schedule     (M15) when an APPROVED revision joins a website publish
                  (content-schema PublicationSchedule). Any write that leaves
                  the record not approved drops it, so a schedule only ever
                  stands on the approved content it was set on; the publish
                  that takes it drops it too

   The store refuses another organization's record whatever it is asked,
   and never deletes: archiving is a status.

   A store may be SCOPED to some `types` of one collection (M12: stories
   and news/blog posts share the posts collection and the Post contract,
   but each is its own content module): it then sees, writes and counts
   only records of those types. Addresses stay unique across the whole
   collection (the index), so a story cannot take a news post's slug. */

export interface Member {
  id: string | null;
  name: string;
}

export interface ContentRecordBase {
  id: string;
  orgId: string;
  slug: string;
  status: "draft" | "submitted" | "approved" | "published" | "archived";
  /* What lists search and sort by (team members name it `name`: the
     store's `titleField`). */
  title?: string;
}

export interface StoredContent<R extends ContentRecordBase> {
  record: R;
  revision: number;
  createdAt: string;
  updatedAt: string;
  createdBy: Member;
  updatedBy: Member;
  slugHistory: string[];
  publishedRevision?: number | null;
  schedule?: PublicationSchedule | null;
}

export interface ContentQuery {
  search?: string;
  status?: ContentRecordBase["status"];
  type?: string;
  sort: "updated" | "date" | "title";
  page: number;
  pageSize: number;
}

export interface ContentStore<R extends ContentRecordBase> {
  findById(id: string): Promise<StoredContent<R> | null>;
  findBySlug(slug: string): Promise<StoredContent<R> | null>;
  /* The records with these ids (any status), in one query — for checking
     what a homepage points at. */
  findMany(ids: string[]): Promise<R[]>;
  list(query: ContentQuery): Promise<{ items: StoredContent<R>[]; total: number }>;
  /* Throws DuplicateKeyError for a taken id or slug. */
  insert(stored: StoredContent<R>): Promise<void>;
  /* null when the record is not at `expectedRevision`. */
  replace(id: string, record: R, expectedRevision: number, by: Member, at: string, slugHistory: string[]): Promise<StoredContent<R> | null>;
  /* Every PUBLISHED record — for building a snapshot. */
  listPublished(): Promise<R[]>;
  /* Distinct values of `field` across ALL records (any status). */
  distinct(field: "type"): Promise<string[]>;
  count(): Promise<number>;
  /* Milestone 1: records (of `type`, for posts) that have been on the
     website: live now (`publishedRevision`) or first published at some
     point (`publishedAt`, which archiving keeps). Archived ones count. */
  countEverPublished(filter?: { type?: string }): Promise<number>;
  /* M14: the stored records with these ids (their live state too). */
  findManyStored(ids: string[]): Promise<StoredContent<R>[]>;
  /* M14: what a website publish may draw on — every record that is not
     archived and is approved, published, or live in an earlier version. */
  listForPublish(): Promise<StoredContent<R>[]>;
  /* M14: after a website publish, `revision` of this record is live. If
     the record is still at that revision and approved, it is now
     published (and first published `at`, if it never was). */
  markPublished(id: string, revision: number, at: string): Promise<void>;
  /* M15: set (or, with null, drop) the schedule of an APPROVED record at
     `expectedRevision` — one write, a new revision. null when the record
     is not at that revision or not approved. */
  setSchedule(id: string, expectedRevision: number, schedule: PublicationSchedule | null, by: Member, at: string): Promise<StoredContent<R> | null>;
  /* M15: every approved record with a schedule. */
  listScheduled(): Promise<StoredContent<R>[]>;
  /* M15: the publication a schedule was due in was refused: record it on
     that schedule (matched by its time), so it is not retried by itself. */
  markScheduleFailed(id: string, scheduledAt: string, failedAt: string, problems: string[]): Promise<void>;
}

type Document<R> = Omit<StoredContent<R & ContentRecordBase>, "createdAt" | "updatedAt"> & { _id?: ObjectId; orgId: string; createdAt: Date; updatedAt: Date };

const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export class MongoContentStore<R extends ContentRecordBase> implements ContentStore<R> {
  readonly #collection: Collection<Document<R>>;
  readonly #orgId: string;
  /* The record field used for "date" sorting (post `date`, event `date`). */
  readonly #dateField: string;
  /* The record field lists search and sort by "title". */
  readonly #titleField: string;
  /* The record types this store sees (all, when unset). */
  readonly #types: readonly string[] | null;

  constructor(db: Db, collection: string, orgId: string, { dateField = "record.date", titleField = "record.title", types }: { dateField?: string; titleField?: string; types?: readonly string[] } = {}) {
    this.#collection = db.collection<Document<R>>(collection);
    this.#orgId = orgId;
    this.#dateField = dateField;
    this.#titleField = titleField;
    this.#types = types ?? null;
  }

  /* This organization's records of this store's types. */
  #base(): Record<string, unknown> {
    return { orgId: this.#orgId, ...(this.#types && { "record.type": { $in: [...this.#types] } }) };
  }

  #assert(record: R) {
    if (record.orgId !== this.#orgId) throw new Error("Refusing to store content for another organization");
    if (this.#types && !this.#types.includes((record as unknown as { type?: string }).type ?? "")) throw new Error("Refusing to store a record of another type in this store");
  }

  #out(d: Document<R>): StoredContent<R> {
    const { _id, orgId: _o, createdAt, updatedAt, ...rest } = d;
    return { ...(rest as unknown as StoredContent<R>), createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString() };
  }

  async findById(id: string) {
    const d = await this.#collection.findOne({ ...this.#base(), "record.id": id } as Filter<Document<R>>);
    return d ? this.#out(d) : null;
  }

  async findBySlug(slug: string) {
    const d = await this.#collection.findOne({ ...this.#base(), "record.slug": slug } as Filter<Document<R>>);
    return d ? this.#out(d) : null;
  }

  async findMany(ids: string[]) {
    if (!ids.length) return [];
    const docs = await this.#collection.find({ ...this.#base(), "record.id": { $in: [...new Set(ids)] } } as Filter<Document<R>>, { projection: { record: 1 } }).toArray();
    return docs.map((d) => d.record as R);
  }

  async list({ search, status, type, sort, page, pageSize }: ContentQuery) {
    const filter: Record<string, unknown> = this.#base();
    if (status) filter["record.status"] = status;
    if (type) filter["record.type"] = this.#types && !this.#types.includes(type) ? { $in: [] } : type;
    if (search) filter[this.#titleField] = { $regex: literal(search), $options: "i" };
    const order: Sort =
      sort === "title" ? { [this.#titleField]: 1, "record.id": 1 } : sort === "date" ? { [this.#dateField]: -1, "record.id": 1 } : { updatedAt: -1, "record.id": 1 };
    const [docs, total] = await Promise.all([
      this.#collection.find(filter as Filter<Document<R>>).sort(order).skip((page - 1) * pageSize).limit(pageSize).toArray(),
      this.#collection.countDocuments(filter as Filter<Document<R>>),
    ]);
    return { items: docs.map((d) => this.#out(d)), total };
  }

  async insert(stored: StoredContent<R>) {
    this.#assert(stored.record);
    try {
      await this.#collection.insertOne({ ...stored, orgId: this.#orgId, createdAt: new Date(stored.createdAt), updatedAt: new Date(stored.updatedAt) } as Document<R>);
    } catch (error) {
      throw asDuplicateKey(error) ?? error;
    }
  }

  async replace(id: string, record: R, expectedRevision: number, by: Member, at: string, slugHistory: string[]) {
    this.#assert(record);
    try {
      const d = await this.#collection.findOneAndUpdate(
        { ...this.#base(), "record.id": id, revision: expectedRevision } as Filter<Document<R>>,
        /* Archiving drops the live version: an archived record never returns by itself.
           A write that leaves it not approved drops its schedule (M15). */
        { $set: { record, updatedAt: new Date(at), updatedBy: by, slugHistory, ...(record.status === "archived" && { publishedRevision: null }) }, $inc: { revision: 1 }, ...(record.status !== "approved" && { $unset: { schedule: "" } }) } as never,
        { returnDocument: "after" }
      );
      return d ? this.#out(d) : null;
    } catch (error) {
      throw asDuplicateKey(error) ?? error;
    }
  }

  async listPublished() {
    const docs = await this.#collection.find({ ...this.#base(), "record.status": "published" } as Filter<Document<R>>, { projection: { record: 1 } }).sort({ "record.id": 1 }).toArray();
    return docs.map((d) => d.record as R);
  }

  async distinct(field: "type") {
    return (await this.#collection.distinct(`record.${field}`, this.#base() as Filter<Document<R>>)) as string[];
  }

  async countEverPublished({ type }: { type?: string } = {}) {
    return this.#collection.countDocuments({
      ...this.#base(),
      ...(type && { "record.type": type }),
      $or: [{ publishedRevision: { $type: "number" } }, { "record.publishedAt": { $exists: true } }],
    } as Filter<Document<R>>);
  }

  async count() {
    return this.#collection.countDocuments(this.#base() as Filter<Document<R>>);
  }

  async findManyStored(ids: string[]) {
    if (!ids.length) return [];
    const docs = await this.#collection.find({ ...this.#base(), "record.id": { $in: [...new Set(ids)] } } as Filter<Document<R>>).toArray();
    return docs.map((d) => this.#out(d));
  }

  async listForPublish() {
    const docs = await this.#collection
      .find({ ...this.#base(), "record.status": { $ne: "archived" }, $or: [{ "record.status": { $in: ["approved", "published"] } }, { publishedRevision: { $type: "number" } }] } as Filter<Document<R>>)
      .sort({ "record.id": 1 })
      .toArray();
    return docs.map((d) => this.#out(d));
  }

  async markPublished(id: string, revision: number, at: string) {
    const base = { ...this.#base(), "record.id": id };
    // The revision that went live, whatever happened to the record since.
    await this.#collection.updateOne(base as Filter<Document<R>>, { $set: { publishedRevision: revision } } as never);
    // Still that approved revision: it is now the published one (no new revision — nothing an editor wrote changes).
    await this.#collection.updateOne({ ...base, revision, "record.status": "approved" } as Filter<Document<R>>, { $set: { "record.status": "published" }, $unset: { schedule: "" } } as never);
    await this.#collection.updateOne({ ...base, revision, "record.publishedAt": { $exists: false } } as Filter<Document<R>>, { $set: { "record.publishedAt": at } } as never);
  }

  async setSchedule(id: string, expectedRevision: number, schedule: PublicationSchedule | null, by: Member, at: string) {
    const d = await this.#collection.findOneAndUpdate(
      { ...this.#base(), "record.id": id, revision: expectedRevision, "record.status": "approved" } as Filter<Document<R>>,
      { $set: { updatedAt: new Date(at), updatedBy: by, ...(schedule && { schedule }) }, $inc: { revision: 1 }, ...(!schedule && { $unset: { schedule: "" } }) } as never,
      { returnDocument: "after" }
    );
    return d ? this.#out(d) : null;
  }

  async listScheduled() {
    const docs = await this.#collection
      .find({ ...this.#base(), "record.status": "approved", schedule: { $type: "object" } } as Filter<Document<R>>)
      .sort({ "schedule.at": 1, "record.id": 1 })
      .toArray();
    return docs.map((d) => this.#out(d));
  }

  async markScheduleFailed(id: string, scheduledAt: string, failedAt: string, problems: string[]) {
    await this.#collection.updateOne(
      { ...this.#base(), "record.id": id, "record.status": "approved", "schedule.at": scheduledAt } as Filter<Document<R>>,
      { $set: { "schedule.failedAt": failedAt, "schedule.problems": problems } } as never
    );
  }
}
