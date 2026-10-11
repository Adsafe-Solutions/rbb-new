import type { Collection, Db, Filter, ObjectId } from "mongodb";
import { COLLECTIONS } from "../../db/collections.ts";
import { asDuplicateKey } from "../../db/mongo.ts";
import type { MediaKind } from "./policy.ts";
import type { MediaRecord, MediaStatus } from "./types.ts";

/* Media persistence: records in and out of MongoDB, scoped to ONE
   organization fixed at construction. No rules here — the service owns
   them — except that the store refuses to touch another organization's
   record whatever it is asked.

   Writes that change state are conditional on the record's current
   status and version, so two requests racing (a double "complete", an
   edit against a stale copy) cannot both win. */

export interface MediaQuery {
  search?: string;
  kind?: MediaKind;
  status?: Exclude<MediaStatus, "deleted">;
  sort: "newest" | "oldest";
  page: number;
  pageSize: number;
}

export interface MediaPage {
  items: MediaRecord[];
  total: number;
}

export interface MediaStore {
  insert(record: MediaRecord): Promise<void>;
  findById(id: string): Promise<MediaRecord | null>;
  /* Several at once (one query) — for resolving a snapshot's references. */
  findMany(ids: string[]): Promise<MediaRecord[]>;
  /* Never returns deleted records. */
  list(query: MediaQuery): Promise<MediaPage>;
  /* Applies `changes` (and version + 1) only if the record is still in one
     of `fromStatuses` at `expectedVersion` (when given). null otherwise. */
  update(id: string, guard: { fromStatuses: readonly MediaStatus[]; expectedVersion?: number }, changes: Partial<MediaRecord>): Promise<MediaRecord | null>;
  /* Pending records created before `before` — abandoned uploads. */
  findStalePending(before: Date, limit: number): Promise<MediaRecord[]>;
  /* Records whose object deletion has not been confirmed. */
  findObjectsToDelete(limit: number): Promise<MediaRecord[]>;
}

type MediaDocument = Omit<MediaRecord, "createdAt" | "updatedAt" | "completedAt" | "failedAt" | "deletedAt"> & {
  _id?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  failedAt: Date | null;
  deletedAt: Date | null;
};

const DATES = ["createdAt", "updatedAt", "completedAt", "failedAt", "deletedAt"] as const;

function toDocument(fields: Partial<MediaRecord>): Partial<MediaDocument> {
  const document: Record<string, unknown> = { ...fields };
  for (const key of DATES) if (key in fields) document[key] = fields[key] ? new Date(fields[key] as string) : null;
  return document as Partial<MediaDocument>;
}

function toRecord(document: MediaDocument): MediaRecord {
  const { _id, ...rest } = document;
  const record: Record<string, unknown> = { ...rest };
  for (const key of DATES) record[key] = rest[key] instanceof Date ? (rest[key] as Date).toISOString() : null;
  return record as unknown as MediaRecord;
}

/* User text inside a regular expression, matched literally. */
const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export class MongoMediaStore implements MediaStore {
  readonly #collection: Collection<MediaDocument>;
  readonly #orgId: string;

  constructor(db: Db, orgId: string) {
    this.#collection = db.collection<MediaDocument>(COLLECTIONS.media);
    this.#orgId = orgId;
  }

  async insert(record: MediaRecord) {
    if (record.orgId !== this.#orgId) throw new Error("Refusing to store a media record for another organization");
    try {
      await this.#collection.insertOne(toDocument(record) as MediaDocument);
    } catch (error) {
      throw asDuplicateKey(error) ?? error;
    }
  }

  async findById(id: string) {
    const document = await this.#collection.findOne({ orgId: this.#orgId, id });
    return document ? toRecord(document) : null;
  }

  async findMany(ids: string[]) {
    if (!ids.length) return [];
    const documents = await this.#collection.find({ orgId: this.#orgId, id: { $in: ids } }).toArray();
    return documents.map(toRecord);
  }

  async list({ search, kind, status, sort, page, pageSize }: MediaQuery): Promise<MediaPage> {
    const filter: Filter<MediaDocument> = { orgId: this.#orgId, status: status ?? { $in: ["pending", "ready", "failed"] } };
    if (kind) filter.kind = kind;
    if (search) filter.originalFilename = { $regex: literal(search), $options: "i" };
    const direction = sort === "oldest" ? 1 : -1;
    const [documents, total] = await Promise.all([
      this.#collection
        .find(filter)
        .sort({ createdAt: direction, id: direction })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
      this.#collection.countDocuments(filter),
    ]);
    return { items: documents.map(toRecord), total };
  }

  async update(id: string, guard: { fromStatuses: readonly MediaStatus[]; expectedVersion?: number }, changes: Partial<MediaRecord>) {
    const { id: _id, orgId: _org, objectKey: _key, createdBy: _by, createdAt: _at, version: _v, ...allowed } = changes;
    const filter: Filter<MediaDocument> = { orgId: this.#orgId, id, status: { $in: [...guard.fromStatuses] } };
    if (guard.expectedVersion !== undefined) filter.version = guard.expectedVersion;
    const document = await this.#collection.findOneAndUpdate(filter, { $set: toDocument(allowed), $inc: { version: 1 } }, { returnDocument: "after" });
    return document ? toRecord(document) : null;
  }

  async findStalePending(before: Date, limit: number) {
    const documents = await this.#collection.find({ orgId: this.#orgId, status: "pending", createdAt: { $lt: before } }).limit(limit).toArray();
    return documents.map(toRecord);
  }

  async findObjectsToDelete(limit: number) {
    const documents = await this.#collection.find({ orgId: this.#orgId, objectState: "deleting" }).limit(limit).toArray();
    return documents.map(toRecord);
  }
}
