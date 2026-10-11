import type { Collection, Db, ObjectId } from "mongodb";
import type { GeneralDonationPage, PublicationSchedule } from "@rbb/content-schema";
import { COLLECTIONS } from "../../db/collections.ts";
import type { Member } from "../content/repository.ts";

/* The organization's general donation page — ONE document per
   organization (a unique index on orgId), like site settings. Every query
   is scoped to the organization the store was created for, and writes are
   conditional on `revision`. Nothing here is a donation, a payment or a
   donor: those are Givebutter's alone. */

export interface StoredDonationPage {
  /* The contract record (validated by the service, not here). */
  record: GeneralDonationPage;
  revision: number;
  updatedAt: string;
  updatedBy: Member;
  /* M14: the revision whose version is in the live snapshot, or null. */
  publishedRevision?: number | null;
  /* M15: see pages/repository.ts. */
  schedule?: PublicationSchedule | null;
}

export interface DonationPageStore {
  get(): Promise<StoredDonationPage | null>;
  /* Creates the page; false if the organization already has one. */
  create(stored: StoredDonationPage): Promise<boolean>;
  /* null when the page is not at `expectedRevision`. */
  replace(record: GeneralDonationPage, expectedRevision: number, by: Member, at: string): Promise<StoredDonationPage | null>;
  /* M14: after a website publish (see pages/repository.ts). */
  markPublished(revision: number, at: string): Promise<void>;
  /* M15: see pages/repository.ts. */
  setSchedule(expectedRevision: number, schedule: PublicationSchedule | null, by: Member, at: string): Promise<StoredDonationPage | null>;
  markScheduleFailed(scheduledAt: string, failedAt: string, problems: string[]): Promise<void>;
}

interface DonationPageDocument {
  _id?: ObjectId;
  orgId: string;
  record: GeneralDonationPage;
  revision: number;
  updatedAt: Date;
  updatedBy: Member;
  publishedRevision?: number | null;
  schedule?: PublicationSchedule | null;
}

const toStored = (d: DonationPageDocument): StoredDonationPage => ({ record: d.record, revision: d.revision, updatedAt: d.updatedAt.toISOString(), updatedBy: d.updatedBy, publishedRevision: d.publishedRevision ?? null, schedule: d.schedule ?? null });

export class MongoDonationPageStore implements DonationPageStore {
  readonly #collection: Collection<DonationPageDocument>;
  readonly #orgId: string;

  constructor(db: Db, orgId: string) {
    this.#collection = db.collection<DonationPageDocument>(COLLECTIONS.generalDonationPages);
    this.#orgId = orgId;
  }

  #assert(record: GeneralDonationPage) {
    if (record.orgId !== this.#orgId) throw new Error("Refusing to store a donation page for another organization");
  }

  async get() {
    const document = await this.#collection.findOne({ orgId: this.#orgId });
    return document ? toStored(document) : null;
  }

  async create(stored: StoredDonationPage) {
    this.#assert(stored.record);
    const result = await this.#collection.updateOne(
      { orgId: this.#orgId },
      { $setOnInsert: { orgId: this.#orgId, record: stored.record, revision: stored.revision, updatedAt: new Date(stored.updatedAt), updatedBy: stored.updatedBy } },
      { upsert: true }
    );
    return result.upsertedCount === 1;
  }

  async replace(record: GeneralDonationPage, expectedRevision: number, by: Member, at: string) {
    this.#assert(record);
    const document = await this.#collection.findOneAndUpdate(
      { orgId: this.#orgId, revision: expectedRevision },
      { $set: { record, updatedAt: new Date(at), updatedBy: by, ...(record.status === "archived" && { publishedRevision: null }) }, $inc: { revision: 1 }, ...(record.status !== "approved" && { $unset: { schedule: "" as const } }) },
      { returnDocument: "after" }
    );
    return document ? toStored(document) : null;
  }

  async markPublished(revision: number, at: string) {
    const base = { orgId: this.#orgId };
    await this.#collection.updateOne(base, { $set: { publishedRevision: revision } });
    await this.#collection.updateOne({ ...base, revision, "record.status": "approved" }, { $set: { "record.status": "published" }, $unset: { schedule: "" } });
    await this.#collection.updateOne({ ...base, revision, "record.publishedAt": { $exists: false } }, { $set: { "record.publishedAt": at } });
  }

  async setSchedule(expectedRevision: number, schedule: PublicationSchedule | null, by: Member, at: string) {
    const document = await this.#collection.findOneAndUpdate(
      { orgId: this.#orgId, revision: expectedRevision, "record.status": "approved" },
      { $set: { updatedAt: new Date(at), updatedBy: by, ...(schedule && { schedule }) }, $inc: { revision: 1 }, ...(!schedule && { $unset: { schedule: "" as const } }) },
      { returnDocument: "after" }
    );
    return document ? toStored(document) : null;
  }

  async markScheduleFailed(scheduledAt: string, failedAt: string, problems: string[]) {
    await this.#collection.updateOne({ orgId: this.#orgId, "record.status": "approved", "schedule.at": scheduledAt }, { $set: { "schedule.failedAt": failedAt, "schedule.problems": problems } });
  }
}
