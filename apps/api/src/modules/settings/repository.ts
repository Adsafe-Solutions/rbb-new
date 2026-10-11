import type { Collection, Db, ObjectId } from "mongodb";
import type { SiteSettings } from "@rbb/content-schema";
import { COLLECTIONS } from "../../db/collections.ts";

/* The organization's working settings — ONE document per organization.
   This is the editable copy; what the public site sees is the copy frozen
   into a published snapshot (modules/publishing). Every query is scoped to
   the organization the store was created for.

   Writes are conditional on `revision` (optimistic concurrency): a save
   based on an older read changes nothing and reports a conflict. */

export interface StoredSettings {
  /* The contract record (validated by the service, not here). */
  record: SiteSettings;
  revision: number;
  updatedAt: string;
  updatedBy: { id: string | null; name: string };
}

export interface SettingsStore {
  get(): Promise<StoredSettings | null>;
  /* Creates the first record; false if one already exists. */
  create(stored: StoredSettings): Promise<boolean>;
  /* null when the record is not at `expectedRevision`. */
  replace(record: SiteSettings, expectedRevision: number, by: StoredSettings["updatedBy"], at: string): Promise<StoredSettings | null>;
}

interface SettingsDocument {
  _id?: ObjectId;
  orgId: string;
  record: SiteSettings;
  revision: number;
  updatedAt: Date;
  updatedBy: { id: string | null; name: string };
}

const toStored = (d: SettingsDocument): StoredSettings => ({ record: d.record, revision: d.revision, updatedAt: d.updatedAt.toISOString(), updatedBy: d.updatedBy });

export class MongoSettingsStore implements SettingsStore {
  readonly #collection: Collection<SettingsDocument>;
  readonly #orgId: string;

  constructor(db: Db, orgId: string) {
    this.#collection = db.collection<SettingsDocument>(COLLECTIONS.siteSettings);
    this.#orgId = orgId;
  }

  #assert(record: SiteSettings) {
    if (record.orgId !== this.#orgId) throw new Error("Refusing to store settings for another organization");
  }

  async get() {
    const document = await this.#collection.findOne({ orgId: this.#orgId });
    return document ? toStored(document) : null;
  }

  async create(stored: StoredSettings) {
    this.#assert(stored.record);
    const result = await this.#collection.updateOne(
      { orgId: this.#orgId },
      { $setOnInsert: { orgId: this.#orgId, record: stored.record, revision: stored.revision, updatedAt: new Date(stored.updatedAt), updatedBy: stored.updatedBy } },
      { upsert: true }
    );
    return result.upsertedCount === 1;
  }

  async replace(record: SiteSettings, expectedRevision: number, by: StoredSettings["updatedBy"], at: string) {
    this.#assert(record);
    const document = await this.#collection.findOneAndUpdate(
      { orgId: this.#orgId, revision: expectedRevision },
      { $set: { record, updatedAt: new Date(at), updatedBy: by }, $inc: { revision: 1 } },
      { returnDocument: "after" }
    );
    return document ? toStored(document) : null;
  }
}
