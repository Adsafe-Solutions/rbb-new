import type { Collection, Db, ObjectId } from "mongodb";
import type { Appeal } from "@rbb/content-schema";
import { COLLECTIONS } from "../../db/collections.ts";
import { asDuplicateKey } from "../../db/mongo.ts";

/* Appeal persistence. The repository moves records in and out of MongoDB
   and nothing else: no validation, no HTTP, no business rules — those are
   the service's. Every query is scoped to the organization the repository
   was created for.

   Stored document ≠ content record. The document adds what storage needs:

     _id         MongoDB's ObjectId — database identity, never shown. The
                 record's own `id` (content identity, what other records
                 reference) and `slug` (the URL) are separate fields, so a
                 slug can change without changing identity.
     revision    increments on every write; an update must name the
                 revision it was based on (optimistic concurrency).
     createdAt / updatedAt / publishedAt
                 BSON Dates in the database; ISO-8601 strings in the
                 record, as the content contract defines them. */

export type StoredRecord = Record<string, unknown>;

export interface StoredAppeal {
  /* The record as the contract shapes it — not yet validated. */
  record: StoredRecord;
  revision: number;
}

/* What the service needs from storage. MongoAppealStore is the real one;
   tests can supply another. */
export interface AppealStore {
  findBySlug(slug: string): Promise<StoredAppeal | null>;
  findById(id: string): Promise<StoredAppeal | null>;
  /* Throws DuplicateKeyError when the slug or id is taken. */
  insert(record: Appeal): Promise<StoredAppeal>;
  /* null when the appeal does not exist at `expectedRevision`. */
  replace(id: string, record: Appeal, expectedRevision: number): Promise<StoredAppeal | null>;
}

interface AppealDocument extends Record<string, unknown> {
  _id?: ObjectId;
  orgId: string;
  id: string;
  slug: string;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

const TIMESTAMPS = ["createdAt", "updatedAt", "publishedAt"] as const;

function toDocument(record: Appeal, revision: number): AppealDocument {
  const document: Record<string, unknown> = { ...record, revision };
  for (const field of TIMESTAMPS) {
    const value = record[field];
    if (value) document[field] = new Date(value);
    else delete document[field];
  }
  return document as AppealDocument;
}

function toStored(document: AppealDocument): StoredAppeal {
  const { _id, revision, ...fields } = document;
  const record: StoredRecord = { ...fields };
  for (const field of TIMESTAMPS) {
    const value = fields[field];
    if (value instanceof Date) record[field] = value.toISOString();
  }
  return { record, revision };
}

export class MongoAppealStore implements AppealStore {
  readonly #collection: Collection<AppealDocument>;
  readonly #orgId: string;

  constructor(db: Db, orgId: string) {
    this.#collection = db.collection<AppealDocument>(COLLECTIONS.appeals);
    this.#orgId = orgId;
  }

  async findBySlug(slug: string) {
    const document = await this.#collection.findOne({ orgId: this.#orgId, slug });
    return document ? toStored(document) : null;
  }

  async findById(id: string) {
    const document = await this.#collection.findOne({ orgId: this.#orgId, id });
    return document ? toStored(document) : null;
  }

  async insert(record: Appeal) {
    this.#assertOrg(record);
    const document = toDocument(record, 1);
    try {
      await this.#collection.insertOne(document);
    } catch (error) {
      throw asDuplicateKey(error) ?? error;
    }
    return toStored(document);
  }

  async replace(id: string, record: Appeal, expectedRevision: number) {
    this.#assertOrg(record);
    try {
      const document = await this.#collection.findOneAndReplace(
        { orgId: this.#orgId, id, revision: expectedRevision },
        toDocument(record, expectedRevision + 1),
        { returnDocument: "after" }
      );
      return document ? toStored(document) : null;
    } catch (error) {
      throw asDuplicateKey(error) ?? error;
    }
  }

  /* The service guarantees this; the repository refuses to write another
     organization's record regardless. */
  #assertOrg(record: Appeal) {
    if (record.orgId !== this.#orgId) throw new Error("Refusing to store a record for another organization");
  }
}
