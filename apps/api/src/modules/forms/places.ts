import type { Collection, Db } from "mongodb";
import { COLLECTIONS } from "../../db/collections.ts";

/* An event's places (2026-10-17): one counter per registration form, so a
   place limit holds when two people take the last place at once. Taking a
   place is ONE conditional increment — MongoDB applies it to the document
   atomically, so it can never pass the limit — not a count followed by an
   insert, which two requests could both pass.

   The counter tracks every registration, limited or not, so a limit added
   later starts from the real number. It is created from the registrations
   already stored (`existing`), released when a registration is not kept
   (it could not be stored) or is deleted in the admin. */

export interface PlaceStore {
  /* A place, or false when `capacity` are taken (null = no limit). */
  take(formId: string, capacity: number | null, existing: () => Promise<number>): Promise<boolean>;
  release(formId: string): Promise<void>;
}

interface PlaceDocument {
  orgId: string;
  formId: string;
  taken: number;
}

const DUPLICATE_KEY = 11000;

export class MongoPlaceStore implements PlaceStore {
  readonly #collection: Collection<PlaceDocument>;
  readonly #orgId: string;

  constructor(db: Db, orgId: string) {
    this.#collection = db.collection<PlaceDocument>(COLLECTIONS.eventPlaces);
    this.#orgId = orgId;
  }

  async take(formId: string, capacity: number | null, existing: () => Promise<number>) {
    const key = { orgId: this.#orgId, formId };
    if (!(await this.#collection.findOne(key, { projection: { _id: 1 } }))) {
      try {
        await this.#collection.insertOne({ ...key, taken: await existing() });
      } catch (error) {
        // Another request created it first: use theirs.
        if ((error as { code?: number }).code !== DUPLICATE_KEY) throw error;
      }
    }
    const limit = capacity === null ? {} : { taken: { $lt: capacity } };
    return (await this.#collection.findOneAndUpdate({ ...key, ...limit }, { $inc: { taken: 1 } })) !== null;
  }

  async release(formId: string) {
    await this.#collection.updateOne({ orgId: this.#orgId, formId, taken: { $gt: 0 } }, { $inc: { taken: -1 } });
  }
}

/* The same rules in memory (tests). */
export function memoryPlaceStore(): PlaceStore & { taken: Map<string, number> } {
  const taken = new Map<string, number>();
  return {
    taken,
    async take(formId, capacity, existing) {
      if (!taken.has(formId)) {
        const n = await existing();
        // Created meanwhile by another request: keep theirs (Mongo: the unique index).
        if (!taken.has(formId)) taken.set(formId, n);
      }
      const n = taken.get(formId)!;
      if (capacity !== null && n >= capacity) return false;
      taken.set(formId, n + 1);
      return true;
    },
    async release(formId) {
      taken.set(formId, Math.max(0, (taken.get(formId) ?? 0) - 1));
    },
  };
}
