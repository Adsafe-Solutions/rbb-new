import type { ContentStatus, ScheduleView, WorkflowAction } from "./client";

/* The editorial workflow's rules as the admin shows them (M14) — plain
   functions, no React, so they are unit-tested (scripts/test). The API
   decides every move; these only offer the ones it would accept:

     Draft ─Submit for review─▶ Needs review ─Approve─▶ Approved ─(an owner publishes the website)─▶ Published
       ▲                            │   │                  │
       └──────── Withdraw ──────────┘   └─ Return to draft ┴─ (or any edit) ─▶ Draft

   Editors write and submit; owners approve, return to draft and publish
   the website. A record on the website keeps its published version there
   while its changes are reviewed ("Published · changes pending
   approval").

   M15: an approved revision may be SCHEDULED by an owner — queued for the
   website publication at a time chosen in an explicit IANA time zone. It
   is still approved (scheduling never approves), and it is not public
   until that time: "Scheduled" never looks like "Published".

   TEMPLATES (team): a record carrying a release marker is a template — a
   role, not a person. It is never submitted, approved, scheduled or
   published; the one move it has is an owner's "Unmark template", after
   a confirmation, which leaves it an ordinary draft. */

/* A schedule's time as the owner chose it: "Oct 15, 2026 · 10:00 AM
   Asia/Kolkata" — in the schedule's own zone, never the browser's. */
export function formatSchedule(at: string, timeZone: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).formatToParts(new Date(at)).map((p) => [p.type, p.value]));
  return `${parts.month} ${parts.day}, ${parts.year} · ${parts.hour}:${parts.minute} ${parts.dayPeriod} ${timeZone}`;
}

/* The badge: one of the design system's states, and its words. */
export function badgeOf(status: ContentStatus | undefined, live = false, schedule: ScheduleView | null = null, template = false): { status: "draft" | "submitted" | "approved" | "published" | "archived" | "scheduled" | "warning"; label?: string } {
  if (template && status !== "archived") return { status: "draft", label: "Template" };
  if (status === "archived" || status === "published") return { status };
  if (status === "approved" && schedule?.failedAt) return { status: "warning", label: "Schedule failed" };
  if (status === "approved" && schedule) return { status: "scheduled", label: live ? "Published · changes scheduled" : "Scheduled" };
  if (live) return { status: "published", label: status === "approved" ? "Published · changes approved" : "Published · changes pending approval" };
  if (status === "submitted" || status === "approved") return { status };
  return { status: "draft" };
}

/* Whether a record may be named by an approved page or record: approved,
   published, or with a published version on the website — and the word
   for it in a picker. */
export const isReady = (status: string, live = false) => status !== "archived" && (status === "approved" || status === "published" || live);
export const readinessWord = (status: string, live = false) =>
  status === "published" || (live && status !== "archived") ? "published" : status === "submitted" ? "needs review" : status === "missing" ? "not found" : status;

/* A submitted revision is under review: not edited until it is withdrawn
   or returned to draft (the API refuses, 409). Archived: reopen first. */
export const isLocked = (status: ContentStatus | undefined) => status === "submitted" || status === "archived";

/* The moves this member may make from this state: the workflow's
   transitions, and (M15, owners with publish:execute) publishing now,
   scheduling and unscheduling an approved revision. */
export type ReviewMove = WorkflowAction | "publish" | "schedule" | "unschedule";
export function actionsFor(
  status: ContentStatus,
  canEdit: boolean,
  canApprove: boolean,
  { canPublish = false, schedule = null, template = false }: { canPublish?: boolean; schedule?: ScheduleView | null; template?: boolean } = {}
): { action: ReviewMove; label: string; primary: boolean }[] {
  /* A template: no review, no publishing — only an owner's unmark, from a draft. */
  if (template) return status === "draft" && canApprove ? [{ action: "unmark", label: "Unmark template", primary: false }] : [];
  if (status === "approved") {
    const moves: { action: ReviewMove; label: string; primary: boolean }[] = [];
    if (canPublish && !schedule) moves.push({ action: "publish", label: "Publish now", primary: true }, { action: "schedule", label: "Schedule", primary: false });
    if (canPublish && schedule?.failedAt) moves.push({ action: "schedule", label: "Reschedule", primary: true });
    if (canPublish && schedule) moves.push({ action: "unschedule", label: "Unschedule", primary: false });
    if (canApprove) moves.push({ action: "reject", label: "Return to draft", primary: false });
    return moves;
  }
  if (status === "draft" && canEdit) return [{ action: "submit", label: "Submit for review", primary: true }];
  if (status === "submitted" && canApprove)
    return [
      { action: "approve", label: "Approve", primary: true },
      { action: "reject", label: "Return to draft", primary: false },
    ];
  if (status === "submitted" && canEdit) return [{ action: "withdraw", label: "Withdraw from review", primary: false }];
  return [];
}

/* What the state means, in a sentence. */
export function explain(status: ContentStatus, live: boolean, noun: string, canApprove: boolean, schedule: ScheduleView | null = null, template = false): string {
  if (template)
    return canApprove
      ? `A template — a role, not a person. It is never submitted for review or published. "Unmark template" turns it into a real ${noun}'s draft, which you can then edit and submit.`
      : `A template — a role, not a person. It is never submitted for review or published. An owner can unmark it to make it a real ${noun}.`;
  const keeps = live ? " Until then the website keeps showing the last published version." : "";
  if (status === "approved" && schedule?.failedAt)
    return `The website publication scheduled for ${formatSchedule(schedule.at, schedule.timeZone)} was refused — nothing changed on the website. Fix what it reports, then reschedule (or unschedule) it.${keeps}`;
  if (status === "approved" && schedule)
    return `Approved and queued for the website publication on ${formatSchedule(schedule.at, schedule.timeZone)}. It is not public before then.${keeps}`;
  switch (status) {
    case "draft":
      return live
        ? `The website shows the last published version of this ${noun}. These changes are a draft: submit them for review; they go live once an owner approves them and publishes the website.`
        : `A draft — not on the website. Submit it for review when it is ready; it goes live once an owner approves it and publishes the website.`;
    case "submitted":
      return canApprove
        ? `Waiting for your review. Approve it to put it in the next website publish, or return it to draft.${keeps}`
        : `Waiting for an owner's review. It can't be changed while under review — withdraw it to make changes.${keeps}`;
    case "approved":
      return `Approved — it goes live when an owner next publishes the website. Editing it returns it to draft for review again.${keeps}`;
    case "published":
      return `On the website — this exact version is published. Editing it creates a draft; the website keeps this version until the changes are approved and published.`;
    default:
      return `Archived — not on the website.`;
  }
}

/* The toast a transition earns. */
export const ACTED: Record<WorkflowAction, { title: string; description: string }> = {
  submit: { title: "Submitted for review", description: "An owner can now approve it." },
  withdraw: { title: "Withdrawn from review", description: "It is a draft again." },
  approve: { title: "Approved", description: "It goes live at the next website publish." },
  reject: { title: "Returned to draft", description: "It is no longer in the review queue." },
  unmark: { title: "Template unmarked", description: "It is an ordinary draft now: edit it and submit it for review when ready." },
};
