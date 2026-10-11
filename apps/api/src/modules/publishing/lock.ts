import { randomUUID } from "node:crypto";
import { errors } from "../../errors.ts";
import type { PublishStore } from "./repository.ts";

/* The publish lock (publish_state.lockId, a lease) — one website publish
   or scheduler run at a time, across every server instance. M15: schedule
   and unschedule take it too, so a schedule never changes WHILE a
   publication is being built: unscheduling either happens before a run
   (which then finds nothing due) or after it (the record is published, and
   there is nothing left to unschedule) — never half-way. */

export const LOCK_TTL_MS = 60_000;
export const PUBLISH_BUSY = "A website publication is in progress. Try again in a moment.";

export interface PublishLock {
  /* Runs `work` holding the lock; 409 while another holds it. */
  exclusive<T>(work: () => Promise<T>): Promise<T>;
}

export const publishLock = (store: Pick<PublishStore, "acquireLock" | "releaseLock">, now: () => Date = () => new Date()): PublishLock => ({
  async exclusive(work) {
    const lockId = randomUUID();
    if (!(await store.acquireLock(lockId, now(), LOCK_TTL_MS))) throw errors.conflict(PUBLISH_BUSY);
    try {
      return await work();
    } finally {
      await store.releaseLock(lockId);
    }
  },
});

/* No lock (a service built without one runs the work directly). */
export const unlocked: PublishLock = { exclusive: (work) => work() };
