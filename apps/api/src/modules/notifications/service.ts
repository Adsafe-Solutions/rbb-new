import { can } from "../auth/permissions.ts";
import type { AuthContext } from "../auth/types.ts";
import type { PublishStatus } from "../publishing/service.ts";
import type { SubmissionCounts } from "../submissions/repository.ts";

/* The admin's notifications (2026-10-13): what is waiting for someone, read
   live each time — nothing is stored, so there is nothing to mark read
   here. An item goes away when the work is done: a submission is opened
   (marked read), content is approved, an approved change is published.

   Each person sees only what they may act on or read:
     · new form submissions — submissions:read (owners)
     · content waiting for review, approved changes not yet published,
       failed scheduled publications — settings:read (owners and editors,
       who already see the same in the publish panel) */

export interface Notifications {
  submissions: { new: number; byForm: Record<string, number> } | null;
  publishing: {
    /* Submitted for review — an owner approves (content:approve). */
    submitted: { total: number; items: PublishStatus["review"]["submitted"] };
    /* Approved, taken by the next publish — an owner publishes. */
    approved: { total: number; items: PublishStatus["review"]["approved"] };
    /* Scheduled publications that failed and wait for an owner. */
    failedSchedules: { section: string; title: string; at: string }[];
  } | null;
  canApprove: boolean;
  canPublish: boolean;
  checkedAt: string;
}

/* Names per group in the dropdown; the totals count them all. */
const NAMED = 5;

export class NotificationService {
  readonly #counts: () => Promise<SubmissionCounts>;
  readonly #review: (auth: AuthContext) => Promise<PublishStatus["review"]>;
  readonly #now: () => Date;

  constructor(deps: { counts: () => Promise<SubmissionCounts>; review: (auth: AuthContext) => Promise<PublishStatus["review"]>; now?: () => Date }) {
    this.#counts = deps.counts;
    this.#review = deps.review;
    this.#now = deps.now ?? (() => new Date());
  }

  async list(auth: AuthContext): Promise<Notifications> {
    const [counts, review] = await Promise.all([
      can(auth, "submissions:read") ? this.#counts() : null,
      can(auth, "settings:read") ? this.#review(auth) : null,
    ]);
    return {
      submissions: counts && {
        new: counts.new,
        byForm: Object.fromEntries(Object.entries(counts.byForm).filter(([, c]) => c.new > 0).map(([id, c]) => [id, c.new])),
      },
      publishing: review && {
        submitted: { total: review.totals.submitted, items: review.submitted.slice(0, NAMED) },
        approved: { total: review.totals.approved, items: review.approved.slice(0, NAMED) },
        failedSchedules: review.scheduled.filter((s) => s.failed).map(({ section, title, at }) => ({ section, title, at })),
      },
      canApprove: can(auth, "content:approve"),
      canPublish: can(auth, "publish:execute"),
      checkedAt: this.#now().toISOString(),
    };
  }
}
