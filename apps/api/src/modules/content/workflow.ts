import { ApiError, errors } from "../../errors.ts";
import type { AuthContext, Permission } from "../auth/types.ts";
import { can } from "../auth/permissions.ts";

/* The editorial workflow (M14) — ONE set of rules for every content
   record and page (content/service.ts, pages/service.ts,
   donation-page/service.ts):

     draft ──submit──▶ submitted ──approve──▶ approved ──(website publish)──▶ published
       ▲                  │  │                    │                            │
       └────withdraw──────┘  └──reject──▶ draft ◀─┴──reject / any edit ◀──────┘
     any ──archive──▶ archived ──reopen──▶ draft

   · submit / withdraw   anyone who edits content (content:update)
   · approve / reject    owners (content:approve)
   · published           ONLY the website publish sets it: this exact
                         revision is in the live snapshot
   · an edit to an approved or published record makes it a draft again —
     its published version stays live (the website publish carries it
     forward from the live snapshot) until the new revision is approved
     and published
   · a submitted revision is not edited: withdraw it (or an owner returns
     it to draft) first
   · a plain save never changes the status, except reopening an archived
     record as a draft
   Every transition names the revision it was based on (409 if stale). */

export type EditorialStatus = "draft" | "submitted" | "approved" | "published" | "archived";
export type WorkflowAction = "submit" | "withdraw" | "approve" | "reject";
export const WORKFLOW_ACTIONS: readonly WorkflowAction[] = ["submit", "withdraw", "approve", "reject"];

const RULES: Record<WorkflowAction, { from: readonly EditorialStatus[]; to: EditorialStatus; permission: Permission; past: string }> = {
  submit: { from: ["draft"], to: "submitted", permission: "content:update", past: "submitted" },
  withdraw: { from: ["submitted"], to: "draft", permission: "content:update", past: "withdrawn" },
  approve: { from: ["submitted"], to: "approved", permission: "content:approve", past: "approved" },
  reject: { from: ["submitted", "approved"], to: "draft", permission: "content:approve", past: "rejected" },
};

const NAMES: Record<EditorialStatus, string> = { draft: "a draft", submitted: "submitted for review", approved: "approved", published: "published", archived: "archived" };

/* The status a transition leads to — or why it may not happen. */
export function transition(auth: AuthContext, action: WorkflowAction, from: EditorialStatus, noun: string): { to: EditorialStatus; past: string } {
  const rule = RULES[action];
  if (!can(auth, rule.permission)) throw errors.forbidden(action === "approve" || action === "reject" ? "Only an owner can approve content or return it to draft." : "You do not have permission to do this.");
  if (!rule.from.includes(from))
    throw new ApiError("CONFLICT", `This ${noun} is ${NAMES[from]}: it cannot be ${rule.past}.`, { details: [{ path: "body.action", message: `${action} is not possible from ${from}` }] });
  return { to: rule.to, past: rule.past };
}

export const EDIT_SUBMITTED = (noun: string) => `This ${noun} is submitted for review. Withdraw it (or ask an owner to return it to draft) before changing it.`;
export const EDIT_ARCHIVED = (noun: string) => `This ${noun} is archived. Reopen it as a draft before changing it.`;
export const STATUS_BY_ACTION = "A save does not change the status: submit for review, approve or return to draft with the workflow actions.";

/* The status a save leaves behind. `requested` is the status the save
   asks for (only "draft", to reopen an archived record). */
export function statusAfterEdit(before: EditorialStatus | null, requested: unknown, contentChanged: boolean, noun: string): EditorialStatus {
  if (requested !== undefined && requested !== null) {
    if (requested !== "draft" || before !== "archived")
      throw errors.validation([{ path: "body.changes.status", message: before === null ? "a new record starts as a draft" : STATUS_BY_ACTION }], before === null ? "A new record starts as a draft." : STATUS_BY_ACTION);
    return "draft";
  }
  if (!before) return "draft";
  if (before === "submitted" && contentChanged) throw new ApiError("CONFLICT", EDIT_SUBMITTED(noun), { details: [{ path: "body.changes", message: "is submitted for review" }] });
  if (before === "archived" && contentChanged) throw new ApiError("CONFLICT", EDIT_ARCHIVED(noun), { details: [{ path: "body.changes", message: "is archived" }] });
  return contentChanged && (before === "approved" || before === "published") ? "draft" : before;
}

/* Statuses on their way to the public (submitted for review onwards):
   a record's own images are described from its submission. */
export const isSubmission = (status: string) => status === "submitted" || status === "approved" || status === "published";

/* Statuses whose references must already be public-ready: an approved
   record goes live at the next website publish. */
export const isApproval = (status: string) => status === "approved" || status === "published";

/* A record another record may point at once it is approved: its own
   revision is approved or published, or its published version is live. */
export const publicReady = (status: string, live: boolean) => (status === "approved" || status === "published" || live) && status !== "archived";
