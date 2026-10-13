import type { Collection, Db, ObjectId } from "mongodb";
import { COLLECTIONS } from "../../db/collections.ts";

/* Form submissions (stored since 2026-10-13, owner decision): what a
   visitor sent through the website's Contact, Volunteer or Partner With
   Us form, kept until an owner deletes it. Organization-scoped like every
   store. Only the validated fields are kept — never the IP address, the
   user agent, the honeypot or timing values. */

export const SUBMISSION_STATUSES = ["new", "read"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/* A reply an owner sent from the admin. */
export interface SubmissionReply {
  id: string;
  at: string;
  by: { id: string; name: string };
  message: string;
}

export interface StoredSubmission {
  id: string;
  orgId: string;
  formId: string;
  /* The reference the visitor was shown ("RBB-…"). */
  reference: string;
  fields: Record<string, string>;
  status: SubmissionStatus;
  createdAt: string;
  updatedAt: string;
  /* Replies sent from the admin, oldest first (absent: none). */
  replies?: SubmissionReply[];
  /* A form saved in the admin: its name and each field's label when the
     submission came in (the form may change later). */
  formTitle?: string;
  labels?: Record<string, string>;
  /* Files attached to a career application — in the media bucket under
     private/forms/, read only by a short-lived signed link. */
  attachments?: SubmissionAttachment[];
}

export interface SubmissionAttachment {
  id: string;
  fieldId: string;
  name: string;
  size: number;
  contentType: string;
  key: string;
}

export interface SubmissionQuery {
  limit: number;
  /* Newest first; the page after this one (the last entry's time and id). */
  before?: { createdAt: string; id: string };
  formId?: string;
  status?: SubmissionStatus;
  /* ISO instants: from (inclusive), to (exclusive). */
  from?: string;
  to?: string;
  /* Name, email, organization or message contains this (case ignored). */
  search?: string;
}

export interface SubmissionCounts {
  total: number;
  new: number;
  byForm: Record<string, { total: number; new: number }>;
}

/* One person across every form (Admin → Audience): matched by email
   address (case ignored), newest contact first. `marketing` is their
   LATEST answer to the marketing emails checkbox ("Yes" / "No"), or null
   when no submission of theirs carried it. */
export interface AudienceMember {
  email: string;
  name: string;
  forms: string[];
  submissions: number;
  firstAt: string;
  lastAt: string;
  marketing: "Yes" | "No" | null;
  marketingAt: string | null;
}

/* The audience from submissions (any order in), grouped by email. */
export function audienceOf(rows: readonly Pick<StoredSubmission, "formId" | "fields" | "createdAt">[]): AudienceMember[] {
  const people = new Map<string, AudienceMember>();
  for (const r of [...rows].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))) {
    const email = r.fields.email?.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    const p = people.get(key) ?? { email, name: "", forms: [], submissions: 0, firstAt: r.createdAt, lastAt: r.createdAt, marketing: null, marketingAt: null };
    p.email = email;
    if (r.fields.name) p.name = r.fields.name;
    if (!p.forms.includes(r.formId)) p.forms.push(r.formId);
    p.submissions += 1;
    p.lastAt = r.createdAt;
    const m = r.fields.marketing;
    if (m === "Yes" || m === "No") {
      p.marketing = m;
      p.marketingAt = r.createdAt;
    }
    people.set(key, p);
  }
  return [...people.values()].sort((a, b) => (a.lastAt < b.lastAt ? 1 : a.lastAt > b.lastAt ? -1 : a.email.localeCompare(b.email)));
}

export interface SubmissionStore {
  insert(submission: StoredSubmission): Promise<void>;
  list(query: SubmissionQuery): Promise<StoredSubmission[]>;
  get(id: string): Promise<StoredSubmission | null>;
  setStatus(id: string, status: SubmissionStatus, at: string): Promise<StoredSubmission | null>;
  remove(id: string): Promise<boolean>;
  counts(): Promise<SubmissionCounts>;
  /* Every person across the forms (audienceOf). */
  audience(): Promise<AudienceMember[]>;
  /* Records a sent reply; the submission becomes read. */
  addReply(id: string, reply: SubmissionReply): Promise<StoredSubmission | null>;
}

const SEARCHED = ["name", "email", "organization", "message"] as const;
const lower = (s: string) => s.toLowerCase();

/* The same conditions, in memory (tests) — and the order: newest first,
   ties by id, descending. */
export function matchesSubmission(s: StoredSubmission, q: Omit<SubmissionQuery, "limit">): boolean {
  if (q.formId !== undefined && s.formId !== q.formId) return false;
  if (q.status !== undefined && s.status !== q.status) return false;
  if (q.from !== undefined && s.createdAt < q.from) return false;
  if (q.to !== undefined && s.createdAt >= q.to) return false;
  if (q.before && (s.createdAt > q.before.createdAt || (s.createdAt === q.before.createdAt && s.id >= q.before.id))) return false;
  if (q.search && !SEARCHED.some((f) => lower(s.fields[f] ?? "").includes(lower(q.search!)))) return false;
  return true;
}
export const submissionOrder = (a: StoredSubmission, b: StoredSubmission) => (a.createdAt === b.createdAt ? (a.id < b.id ? 1 : a.id > b.id ? -1 : 0) : a.createdAt < b.createdAt ? 1 : -1);

/* Totals from (form, status, how many) groups. */
export function countsOf(groups: readonly { formId: string; status: SubmissionStatus; n: number }[]): SubmissionCounts {
  const counts: SubmissionCounts = { total: 0, new: 0, byForm: {} };
  for (const g of groups) {
    const form = (counts.byForm[g.formId] ??= { total: 0, new: 0 });
    counts.total += g.n;
    form.total += g.n;
    if (g.status === "new") {
      counts.new += g.n;
      form.new += g.n;
    }
  }
  return counts;
}

type SubmissionDocument = Omit<StoredSubmission, "createdAt" | "updatedAt"> & { _id?: ObjectId; createdAt: Date; updatedAt: Date };
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const fromDocument = ({ _id, createdAt, updatedAt, ...rest }: SubmissionDocument): StoredSubmission => ({ ...rest, createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString() });

export class MongoSubmissionStore implements SubmissionStore {
  readonly #collection: Collection<SubmissionDocument>;
  readonly #orgId: string;

  constructor(db: Db, orgId: string) {
    this.#collection = db.collection<SubmissionDocument>(COLLECTIONS.formSubmissions);
    this.#orgId = orgId;
  }

  async insert(s: StoredSubmission) {
    await this.#collection.insertOne({ ...s, orgId: this.#orgId, createdAt: new Date(s.createdAt), updatedAt: new Date(s.updatedAt) });
  }

  async list(q: SubmissionQuery) {
    const and: Record<string, unknown>[] = [{ orgId: this.#orgId }];
    if (q.formId !== undefined) and.push({ formId: q.formId });
    if (q.status !== undefined) and.push({ status: q.status });
    if (q.from !== undefined) and.push({ createdAt: { $gte: new Date(q.from) } });
    if (q.to !== undefined) and.push({ createdAt: { $lt: new Date(q.to) } });
    if (q.before) {
      const at = new Date(q.before.createdAt);
      and.push({ $or: [{ createdAt: { $lt: at } }, { createdAt: at, id: { $lt: q.before.id } }] });
    }
    if (q.search) {
      const re = { $regex: escape(q.search), $options: "i" };
      and.push({ $or: SEARCHED.map((f) => ({ [`fields.${f}`]: re })) });
    }
    const docs = await this.#collection.find({ $and: and } as never).sort({ createdAt: -1, id: -1 }).limit(Math.min(q.limit, 101)).toArray();
    return docs.map(fromDocument);
  }

  async get(id: string) {
    const doc = await this.#collection.findOne({ orgId: this.#orgId, id });
    return doc ? fromDocument(doc) : null;
  }

  async setStatus(id: string, status: SubmissionStatus, at: string) {
    const doc = await this.#collection.findOneAndUpdate({ orgId: this.#orgId, id }, { $set: { status, updatedAt: new Date(at) } }, { returnDocument: "after" });
    return doc ? fromDocument(doc) : null;
  }

  async audience() {
    const docs = await this.#collection
      .find({ orgId: this.#orgId, "fields.email": { $type: "string" } }, { projection: { _id: 0, formId: 1, "fields.email": 1, "fields.name": 1, "fields.marketing": 1, createdAt: 1 } })
      .toArray();
    return audienceOf(docs.map((d) => ({ formId: d.formId, fields: d.fields, createdAt: d.createdAt.toISOString() })));
  }

  async addReply(id: string, reply: SubmissionReply) {
    const doc = await this.#collection.findOneAndUpdate({ orgId: this.#orgId, id }, { $push: { replies: reply }, $set: { status: "read", updatedAt: new Date(reply.at) } } as never, { returnDocument: "after" });
    return doc ? fromDocument(doc) : null;
  }

  async remove(id: string) {
    return (await this.#collection.deleteOne({ orgId: this.#orgId, id })).deletedCount === 1;
  }

  async counts() {
    const rows = await this.#collection.aggregate<{ _id: { formId: string; status: SubmissionStatus }; n: number }>([{ $match: { orgId: this.#orgId } }, { $group: { _id: { formId: "$formId", status: "$status" }, n: { $sum: 1 } } }]).toArray();
    return countsOf(rows.map((r) => ({ formId: r._id.formId, status: r._id.status, n: r.n })));
  }
}
