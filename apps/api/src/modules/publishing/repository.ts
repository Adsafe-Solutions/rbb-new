import type { Collection, Db, ObjectId } from "mongodb";
import type { PublishedSnapshot } from "@rbb/content-schema";
import { COLLECTIONS } from "../../db/collections.ts";
import { asDuplicateKey } from "../../db/mongo.ts";

/* Published snapshots and the pointer to the active one, per organization.

     published_snapshots   immutable: one document per version, never
                           updated except to mark it activated
     publish_state         one document per organization:
                             lastVersion    the version counter ($inc)
                             activeVersion  what the public reads
                             lockId/lockedUntil  one publish at a time

   A publish writes the new snapshot FIRST and moves the pointer LAST, in
   one document update — so a reader sees the old snapshot or the new one,
   never a partial one. */

/* M15: what became of telling the website to rebuild from a version.
   "pending" from the moment the public moves until the trigger answers: a
   publish found still pending (by the next one, under the lock) stopped
   part-way, and is finished then. */
export interface DeploymentState {
  status: "pending" | "triggered" | "not-configured" | "failed";
  attempts: number;
  reason?: string;
  at?: string;
}

export interface ActiveInfo {
  version: number;
  generatedAt: string;
  publishedBy: { id: string; name: string };
  sourceHash: string;
  /* M15 (absent on versions published before it). */
  deployment?: DeploymentState;
}

export interface StoredSnapshot extends ActiveInfo {
  snapshot: PublishedSnapshot;
}

export interface PublishStore {
  /* A lock for `ttlMs`, or null while another publish holds one. */
  acquireLock(lockId: string, now: Date, ttlMs: number): Promise<boolean>;
  releaseLock(lockId: string): Promise<void>;
  /* The next version number (only while holding the lock). */
  nextVersion(lockId: string): Promise<number>;
  insertSnapshot(stored: StoredSnapshot): Promise<void>;
  /* Points the public at `version`; false if the lock was lost. */
  activate(lockId: string, info: ActiveInfo): Promise<boolean>;
  active(): Promise<ActiveInfo | null>;
  /* The active snapshot, or an older one that was once active. */
  activeSnapshot(): Promise<StoredSnapshot | null>;
  snapshotByVersion(version: number): Promise<StoredSnapshot | null>;
  /* M15: record the deployment state of `version` — only while it is the
     active one (a later publish owns its own). */
  setDeployment(version: number, deployment: DeploymentState): Promise<void>;
}

interface StateDocument {
  _id?: ObjectId;
  orgId: string;
  lastVersion: number;
  active: ActiveInfo | null;
  lockId: string | null;
  lockedUntil: Date | null;
}

interface SnapshotDocument extends StoredSnapshot {
  _id?: ObjectId;
  orgId: string;
  activated: boolean;
  createdAt: Date;
}

const strip = ({ _id, orgId: _o, activated: _a, createdAt: _c, ...stored }: SnapshotDocument): StoredSnapshot => stored;

export class MongoPublishStore implements PublishStore {
  readonly #state: Collection<StateDocument>;
  readonly #snapshots: Collection<SnapshotDocument>;
  readonly #orgId: string;

  constructor(db: Db, orgId: string) {
    this.#state = db.collection<StateDocument>(COLLECTIONS.publishState);
    this.#snapshots = db.collection<SnapshotDocument>(COLLECTIONS.publishedSnapshots);
    this.#orgId = orgId;
  }

  async acquireLock(lockId: string, now: Date, ttlMs: number) {
    try {
      await this.#state.updateOne(
        { orgId: this.#orgId },
        { $setOnInsert: { orgId: this.#orgId, lastVersion: 0, active: null, lockId: null, lockedUntil: null } },
        { upsert: true }
      );
    } catch (error) {
      if (!asDuplicateKey(error)) throw error; // a concurrent first publish created it
    }
    const locked = await this.#state.findOneAndUpdate(
      { orgId: this.#orgId, $or: [{ lockId: null }, { lockedUntil: { $lte: now } }] },
      { $set: { lockId, lockedUntil: new Date(now.getTime() + ttlMs) } }
    );
    return locked !== null;
  }

  async releaseLock(lockId: string) {
    await this.#state.updateOne({ orgId: this.#orgId, lockId }, { $set: { lockId: null, lockedUntil: null } });
  }

  async nextVersion(lockId: string) {
    const state = await this.#state.findOneAndUpdate({ orgId: this.#orgId, lockId }, { $inc: { lastVersion: 1 } }, { returnDocument: "after" });
    if (!state) throw new Error("The publish lock was lost");
    return state.lastVersion;
  }

  async insertSnapshot(stored: StoredSnapshot) {
    if (stored.snapshot.organization.id !== this.#orgId) throw new Error("Refusing to store a snapshot for another organization");
    await this.#snapshots.insertOne({ ...stored, orgId: this.#orgId, activated: false, createdAt: new Date() });
  }

  async activate(lockId: string, info: ActiveInfo) {
    const result = await this.#state.updateOne({ orgId: this.#orgId, lockId }, { $set: { active: info } });
    if (result.modifiedCount !== 1) return false;
    await this.#snapshots.updateOne({ orgId: this.#orgId, version: info.version }, { $set: { activated: true } });
    return true;
  }

  async active() {
    return (await this.#state.findOne({ orgId: this.#orgId }, { projection: { active: 1 } }))?.active ?? null;
  }

  async setDeployment(version: number, deployment: DeploymentState) {
    await this.#state.updateOne({ orgId: this.#orgId, "active.version": version }, { $set: { "active.deployment": deployment } });
  }

  async activeSnapshot() {
    const active = await this.active();
    if (!active) return null;
    const document = await this.#snapshots.findOne({ orgId: this.#orgId, version: active.version });
    return document ? strip(document) : null;
  }

  async snapshotByVersion(version: number) {
    const active = await this.active();
    if (!active || version > active.version) return null;
    const document = await this.#snapshots.findOne({ orgId: this.#orgId, version, activated: true });
    return document ? strip(document) : null;
  }
}
