import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import { COLLECTIONS } from "../../db/collections.ts";
import { asDuplicateKey } from "../../db/mongo.ts";
import { errors } from "../../errors.ts";

/* The team-change lock (member_state.lockId, a lease) — ONE role or status
   change at a time per organization, across every server instance. The
   last-active-owner check and the change it allows therefore never
   interleave with another change: when two owners demote each other at
   the same moment, the second one runs after the first and is refused,
   instead of both passing the check and leaving no owner. Transactions
   would do the same, but need a replica set; this works on any MongoDB.

   A holder that crashes keeps the lease only until it lapses. A request
   that meets a held lock waits briefly (changes take milliseconds), then
   gets a 409. */

export const MEMBER_LOCK_TTL_MS = 15_000;
export const TEAM_BUSY = "Another team change is in progress. Try again in a moment.";
/* A change is a handful of round trips; ~5 s covers a slow database link. */
const WAIT = { attempts: 50, delayMs: 100 } as const;

export interface LeaseStore {
  /* true if this lockId now holds the lease. */
  acquire(lockId: string, now: Date, ttlMs: number): Promise<boolean>;
  release(lockId: string): Promise<void>;
}

export interface TeamLock {
  exclusive<T>(work: () => Promise<T>): Promise<T>;
}

export const teamLock = (store: LeaseStore, now: () => Date = () => new Date(), wait: { attempts: number; delayMs: number } = WAIT): TeamLock => ({
  async exclusive(work) {
    const lockId = randomUUID();
    for (let attempt = 1; !(await store.acquire(lockId, now(), MEMBER_LOCK_TTL_MS)); attempt++) {
      if (attempt >= wait.attempts) throw errors.conflict(TEAM_BUSY);
      await new Promise((resolve) => setTimeout(resolve, wait.delayMs));
    }
    try {
      return await work();
    } finally {
      await store.release(lockId);
    }
  },
});

export function mongoMemberLeases(db: Db, orgId: string): LeaseStore {
  const state = db.collection<{ orgId: string; lockId: string | null; lockedUntil: Date | null }>(COLLECTIONS.memberState);
  return {
    async acquire(lockId, now, ttlMs) {
      try {
        await state.updateOne({ orgId }, { $setOnInsert: { orgId, lockId: null, lockedUntil: null } }, { upsert: true });
      } catch (error) {
        if (!asDuplicateKey(error)) throw error; // a concurrent first change created it
      }
      const locked = await state.findOneAndUpdate(
        { orgId, $or: [{ lockId: null }, { lockedUntil: { $lte: now } }] },
        { $set: { lockId, lockedUntil: new Date(now.getTime() + ttlMs) } }
      );
      return locked !== null;
    },
    async release(lockId) {
      await state.updateOne({ orgId, lockId }, { $set: { lockId: null, lockedUntil: null } });
    },
  };
}
