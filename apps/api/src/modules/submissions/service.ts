import { z } from "zod";
import { randomUUID } from "node:crypto";
import { errors, fromZod } from "../../errors.ts";
import type { Deliver } from "../forms/email.ts";
import { reply as replyEmail } from "../forms/templates.ts";
import type { AuditService, RequestFacts } from "../audit/audit.ts";
import { requirePermission } from "../auth/permissions.ts";
import type { AuthContext } from "../auth/types.ts";
import { SUBMISSION_STATUSES, type SubmissionCounts, type SubmissionStore, type StoredSubmission } from "./repository.ts";

/* Form submissions in the admin — OWNERS only (submissions:read to look,
   submissions:write to mark read/unread and delete). Kept until an owner
   deletes one (no automatic expiry: owner decision, 2026-10-13).

   The audit trail records each change by id and form only — never a
   name, address or message. */

export const STORED_FORM_IDS = ["contact", "volunteer", "partner"] as const;
export const SUBMISSION_PAGE_SIZE = 50;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const ListQuery = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  before: z.string().max(200).optional(),
  form: z.enum(STORED_FORM_IDS).optional(),
  status: z.enum(SUBMISSION_STATUSES).optional(),
  from: z.string().regex(DAY).optional(),
  to: z.string().regex(DAY).optional(),
  q: z.string().trim().min(1).max(100).optional(),
});
const StatusBody = z.strictObject({ status: z.enum(SUBMISSION_STATUSES) });
const ReplyBody = z.strictObject({ message: z.string().trim().min(1, "must not be empty").max(5000) });

/* Sending a reply: the forms' email delivery (same sender and mode), and
   where the visitor's answer should go — the form's RBB inbox. */
export interface ReplyMailer {
  deliver: Deliver;
  replyTo: (formId: string) => string | undefined;
}
const Id = z.uuid();

export interface SubmissionSummary {
  id: string;
  formId: string;
  reference: string;
  createdAt: string;
  status: StoredSubmission["status"];
  name: string;
  email: string;
  organization: string | null;
  topic: string | null;
  /* The message's opening, for the list. */
  preview: string;
  /* An owner has replied from the admin. */
  replied: boolean;
}

export const cursorOf = (s: Pick<StoredSubmission, "createdAt" | "id">) => Buffer.from(JSON.stringify([s.createdAt, s.id])).toString("base64url");
export function parseCursor(value: string): { createdAt: string; id: string } | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (Array.isArray(parsed) && parsed.length === 2 && typeof parsed[0] === "string" && !Number.isNaN(Date.parse(parsed[0])) && typeof parsed[1] === "string" && parsed[1].length <= 64)
      return { createdAt: new Date(parsed[0]).toISOString(), id: parsed[1] };
  } catch {
    /* not a cursor */
  }
  return null;
}
const dayAfter = (day: string) => new Date(Date.parse(`${day}T00:00:00.000Z`) + 86_400_000).toISOString();

export const summaryOf = (s: StoredSubmission): SubmissionSummary => ({
  id: s.id,
  formId: s.formId,
  reference: s.reference,
  createdAt: s.createdAt,
  status: s.status,
  name: s.fields.name ?? "",
  email: s.fields.email ?? "",
  organization: s.fields.organization || null,
  topic: s.fields.topic || null,
  preview: (s.fields.message ?? "").replace(/\s+/g, " ").trim().slice(0, 160),
  replied: Boolean(s.replies?.length),
});

export class SubmissionService {
  readonly #store: SubmissionStore;
  readonly #audit: AuditService;
  readonly #now: () => Date;
  readonly #mailer: ReplyMailer | null;

  constructor(store: SubmissionStore, audit: AuditService, options: { now?: () => Date; mailer?: ReplyMailer | null } = {}) {
    this.#store = store;
    this.#audit = audit;
    this.#now = options.now ?? (() => new Date());
    this.#mailer = options.mailer ?? null;
  }

  /* Whether replies can be sent (email configured). */
  get canReply(): boolean {
    return this.#mailer !== null;
  }

  /* Emails the visitor an owner's reply, then records it on the
     submission. Nothing is recorded unless the email was accepted. */
  async reply(auth: AuthContext | null, id: unknown, body: unknown, facts: RequestFacts): Promise<StoredSubmission> {
    const member = requirePermission(auth, "submissions:write");
    const parsed = ReplyBody.safeParse(body);
    if (!parsed.success) throw fromZod(parsed.error, "body");
    const current = await this.get(auth, id);
    const to = current.fields.email;
    if (!to) throw errors.conflict("This submission has no email address to reply to.");
    if (!this.#mailer) throw errors.unavailable("Email is not set up, so replies cannot be sent from the admin. Use your own mail program.");
    const replyId = randomUUID();
    const rendered = replyEmail({ message: parsed.data.message, reference: current.reference, memberName: member.user.name });
    const replyTo = this.#mailer.replyTo(current.formId);
    const sent = await this.#mailer.deliver({ to, ...(replyTo && { replyTo }), ...rendered }, `reply:${current.id}:${replyId}`);
    if (!sent.ok) throw errors.unavailable("The reply could not be sent. Please try again in a moment.");
    const at = this.#now().toISOString();
    const saved = await this.#store.addReply(current.id, { id: replyId, at, by: { id: member.user.id, name: member.user.name }, message: parsed.data.message });
    if (!saved) throw errors.notFound("submission");
    await this.#audit.recordSafely({ action: "submissions.replied", resourceType: "submission", resourceId: saved.id, actorUserId: member.user.id, metadata: { form: saved.formId, replies: saved.replies?.length ?? 1 } }, facts);
    return saved;
  }

  async list(auth: AuthContext | null, input: unknown): Promise<{ items: SubmissionSummary[]; next: string | null; counts: SubmissionCounts; canReply: boolean }> {
    requirePermission(auth, "submissions:read");
    const parsed = ListQuery.safeParse(input ?? {});
    if (!parsed.success) throw fromZod(parsed.error, "query");
    const q = parsed.data;
    const before = q.before === undefined ? undefined : parseCursor(q.before);
    if (before === null) throw errors.validation([{ path: "query.before", message: "is not a page of this list" }]);
    if (q.from && q.to && q.from > q.to) throw errors.validation([{ path: "query.to", message: "must not be before from" }]);
    const limit = q.limit ?? SUBMISSION_PAGE_SIZE;
    const [rows, counts] = await Promise.all([
      this.#store.list({
        limit: limit + 1,
        ...(before && { before }),
        ...(q.form && { formId: q.form }),
        ...(q.status && { status: q.status }),
        ...(q.from && { from: `${q.from}T00:00:00.000Z` }),
        ...(q.to && { to: dayAfter(q.to) }),
        ...(q.q && { search: q.q }),
      }),
      this.#store.counts(),
    ]);
    const page = rows.slice(0, limit);
    return { items: page.map(summaryOf), next: rows.length > limit ? cursorOf(page[page.length - 1]!) : null, counts, canReply: this.canReply };
  }

  async get(auth: AuthContext | null, id: unknown): Promise<StoredSubmission> {
    requirePermission(auth, "submissions:read");
    const found = Id.safeParse(id).success ? await this.#store.get(id as string) : null;
    if (!found) throw errors.notFound("submission");
    return found;
  }

  async setStatus(auth: AuthContext | null, id: unknown, body: unknown, facts: RequestFacts): Promise<StoredSubmission> {
    const member = requirePermission(auth, "submissions:write");
    const parsed = StatusBody.safeParse(body);
    if (!parsed.success) throw fromZod(parsed.error, "body");
    const current = await this.get(auth, id);
    if (current.status === parsed.data.status) return current;
    const saved = await this.#store.setStatus(current.id, parsed.data.status, this.#now().toISOString());
    if (!saved) throw errors.notFound("submission");
    await this.#audit.recordSafely({ action: "submissions.status_changed", resourceType: "submission", resourceId: saved.id, actorUserId: member.user.id, metadata: { form: saved.formId, from: current.status, to: saved.status } }, facts);
    return saved;
  }

  async remove(auth: AuthContext | null, id: unknown, facts: RequestFacts): Promise<{ deleted: true }> {
    const member = requirePermission(auth, "submissions:write");
    const current = await this.get(auth, id);
    if (!(await this.#store.remove(current.id))) throw errors.notFound("submission");
    await this.#audit.recordSafely({ action: "submissions.deleted", resourceType: "submission", resourceId: current.id, actorUserId: member.user.id, metadata: { form: current.formId } }, facts);
    return { deleted: true };
  }
}
