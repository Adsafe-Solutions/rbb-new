import { unlocked, type PublishLock } from "../publishing/lock.ts";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DuplicateKeyError } from "../../db/mongo.ts";
import { ApiError, errors, type ErrorDetail } from "../../errors.ts";
import type { AuditService, RequestFacts } from "../audit/audit.ts";
import type { AuthContext } from "../auth/types.ts";
import type { MediaStore } from "../media/repository.ts";
import type { ContentRecordBase, ContentStore, StoredContent } from "./repository.ts";
import { CONFLICT, LIST_INPUT, SLUG_CHANGE, changedFields, checkMedia, issuesOf, member, slugify, viewOf, type ContentView } from "./shared.ts";
import { MARKER_BY_ACTION, NOT_TEMPLATE, TEMPLATE_LOCKED, isTemplate, statusAfterEdit, transition, type EditorialStatus, type WorkflowAction } from "./workflow.ts";
import { UNSCHEDULE, droppedBecause, newSchedule, notApproved, notScheduled, parseScheduleRequest, requireScheduler } from "../publishing/schedule.ts";

/* The lifecycle of a content collection, shared by posts and events. Each
   module supplies only what differs (its contract, its editable fields,
   its own rules) — see posts/service.ts, events/service.ts.

     draft      being written or changed; not public (a record already
                published stays live in its published version)
     submitted  waiting for an owner's review
     approved   approved by an owner; goes live at the next website publish
     published  this revision is in the live snapshot (set only by the
                website publish — POST /api/v1/publish, owners)
     archived   withdrawn; kept, never public. DELETE archives — nothing is
                ever destroyed — and an archived record can be reopened as
                a draft

   · M14: the editorial workflow (workflow.ts) — POST /<base>/:id/submit,
     /withdraw (editors and owners), /approve, /reject (owners); a save
     never publishes, and an edit to an approved or published record makes
     it a draft again
   · the organization, id, timestamps and publishedAt are the API's
   · every write is checked against the content contract, the module's
     rules and the media library, and names the revision it was based on
   · an address (slug) is unique in the organization; once a record has
     been published, changing it needs an explicit confirmation and the
     old address is kept for future redirects
   · the audit trail records field NAMES, never wording */

/* A workflow action names the revision the member has open. */
export const ACTION = z.strictObject({ revision: z.int().positive() });

export interface CollectionConfig<R extends ContentRecordBase> {
  /* "post" | "event": audit actions and messages. */
  kind: string;
  contract: z.ZodType<R>;
  /* Editable fields, every one optional; `null` clears an optional field. */
  fields: z.ZodRawShape;
  /* Fields a new record must have from the editor. */
  required: readonly string[];
  /* Required by the contract but not edited in the CMS yet. */
  defaults: () => Record<string, unknown>;
  /* Editable fields the contract still requires: what clearing one (null)
     sets instead of removing it (an event's program: null, open to all). */
  cleared?: Record<string, unknown>;
  rules: (record: R) => ErrorDetail[];
  media: (record: R) => [string, string | undefined][];
  /* Rich-text fields: audited by name only. */
  opaque: readonly string[];
  listTypes?: readonly string[];
  /* Checks that need a service outside the API (appeals: the donation
     provider). `previous` is the stored record (null on create), so a
     module checks only what changed. */
  check?: (record: R, previous: R | null) => Promise<ErrorDetail[]>;
}

export class ContentService<R extends ContentRecordBase & { publishedAt?: string; createdAt?: string; updatedAt?: string }> {
  readonly #config: CollectionConfig<R>;
  readonly #store: ContentStore<R>;
  readonly #media: MediaStore;
  readonly #audit: AuditService;
  readonly #orgId: string;
  readonly #now: () => Date;
  readonly #lock: PublishLock;
  readonly #create: z.ZodType;
  readonly #update: z.ZodType;
  readonly #list: z.ZodType;

  constructor(config: CollectionConfig<R>, store: ContentStore<R>, media: MediaStore, audit: AuditService, { orgId, now = () => new Date(), lock = unlocked }: { orgId: string; now?: () => Date; lock?: PublishLock }) {
    this.#lock = lock;
    this.#config = config;
    this.#store = store;
    this.#media = media;
    this.#audit = audit;
    this.#orgId = orgId;
    this.#now = now;
    const status = z.enum(["draft", "submitted", "approved", "published", "archived"]);
    // Every editable field may be left out (create checks `required` itself).
    const fields = Object.fromEntries(Object.entries(config.fields).map(([k, v]) => [k, (v as z.ZodType).optional()]));
    this.#create = z.strictObject({ ...fields, status: status.optional() });
    this.#update = z.strictObject({
      revision: z.int().positive(),
      changes: z.strictObject({ ...fields, status: status.optional() }),
      confirmSlugChange: z.boolean().optional(),
    });
    this.#list = config.listTypes ? LIST_INPUT.extend({ type: z.enum(config.listTypes as [string, ...string[]]).optional() }) : LIST_INPUT;
  }

  async list(auth: AuthContext, query: unknown) {
    member(auth, this.#orgId);
    const parsed = this.#list.safeParse(query);
    if (!parsed.success) throw errors.validation(issuesOf(parsed.error, ["query"]));
    const q = parsed.data as z.infer<typeof LIST_INPUT> & { type?: string };
    const { items, total } = await this.#store.list({ ...q, search: q.search || undefined });
    return { items: items.map((s) => viewOf(s, auth)), pagination: { page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) } };
  }

  async get(auth: AuthContext, id: string): Promise<ContentView<R>> {
    member(auth, this.#orgId);
    return viewOf(await this.#find(id), auth);
  }

  async #find(id: string): Promise<StoredContent<R>> {
    const stored = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id) ? await this.#store.findById(id) : null;
    if (!stored) throw errors.notFound(this.#config.kind);
    return stored;
  }

  /* Contract, the module's rules, media (only `refs` paths), then the
     module's own external checks — only once everything else is valid. */
  async #validate(candidate: Record<string, unknown>, refsToCheck: (record: R) => [string, string | undefined][], previous: R | null = null): Promise<R> {
    const parsed = this.#config.contract.safeParse(candidate);
    if (!parsed.success) throw errors.validation(issuesOf(parsed.error, ["body"]));
    const record = parsed.data;
    const problems = [...this.#config.rules(record), ...(await checkMedia(this.#media, refsToCheck(record)))];
    if (!problems.length && this.#config.check) problems.push(...(await this.#config.check(record, previous)));
    if (problems.length) throw errors.validation(problems);
    return record;
  }

  async #slugFree(slug: string, exceptId?: string) {
    const holder = await this.#store.findBySlug(slug);
    if (holder && holder.record.id !== exceptId) throw errors.validation([{ path: "body.slug", message: `is already the address of another ${this.#config.kind}` }], `This address is already used by another ${this.#config.kind}.`);
  }

  #duplicate(error: unknown): ApiError | null {
    return error instanceof DuplicateKeyError ? errors.validation([{ path: "body.slug", message: `is already the address of another ${this.#config.kind}` }], `This address is already used by another ${this.#config.kind}.`) : null;
  }

  async create(auth: AuthContext, input: unknown, facts: RequestFacts): Promise<ContentView<R>> {
    member(auth, this.#orgId);
    const parsed = this.#create.safeParse(input);
    if (!parsed.success) throw errors.validation(issuesOf(parsed.error, ["body"]));
    const fields = Object.fromEntries(Object.entries(parsed.data as Record<string, unknown>).filter(([, v]) => v !== null && v !== undefined));
    const missing = this.#config.required.filter((f) => fields[f] === undefined);
    if (missing.length) throw errors.validation(missing.map((f) => ({ path: `body.${f}`, message: "is required" })));

    const now = this.#now().toISOString();
    const status = statusAfterEdit(null, fields.status, true, this.#config.kind) as R["status"];
    const slug = slugify(String(fields.slug ?? fields.title ?? fields.name ?? ""));
    if (!slug) throw errors.validation([{ path: "body.slug", message: "must contain letters or digits" }]);
    const record = await this.#validate(
      { ...this.#config.defaults(), ...fields, slug, id: randomUUID(), orgId: this.#orgId, schemaVersion: 1, status, createdAt: now, updatedAt: now },
      this.#config.media
    );
    await this.#slugFree(record.slug);
    const by = { id: auth.user.id, name: auth.user.name };
    try {
      await this.#store.insert({ record, revision: 1, createdAt: now, updatedAt: now, createdBy: by, updatedBy: by, slugHistory: [] });
    } catch (error) {
      throw this.#duplicate(error) ?? error;
    }
    await this.#audit.recordSafely(
      { action: `${this.#config.kind}.created`, resourceType: this.#config.kind, resourceId: record.id, actorUserId: auth.user.id, metadata: { status, fields: Object.keys(fields).sort() } },
      facts
    );
    return viewOf((await this.#store.findById(record.id))!, auth);
  }

  async update(auth: AuthContext, id: string, input: unknown, facts: RequestFacts): Promise<ContentView<R>> {
    member(auth, this.#orgId);
    const parsed = this.#update.safeParse(input);
    if (!parsed.success) throw errors.validation(issuesOf(parsed.error, ["body"]));
    const { revision, changes, confirmSlugChange } = parsed.data as { revision: number; changes: Record<string, unknown>; confirmSlugChange?: boolean };
    const stored = await this.#find(id);
    if (stored.revision !== revision) throw errors.conflict(CONFLICT);
    return this.#write(auth, stored, changes, Boolean(confirmSlugChange), facts);
  }

  /* DELETE: archive. Idempotent. Its live version leaves the website at
     the next publish (the store drops the live marker). */
  async archive(auth: AuthContext, id: string, facts: RequestFacts): Promise<ContentView<R>> {
    member(auth, this.#orgId);
    const stored = await this.#find(id);
    if (stored.record.status === "archived") return viewOf(stored, auth);
    return this.#write(auth, stored, {}, false, facts, "archived");
  }

  /* M14: a workflow transition (workflow.ts) of the revision the member
     has open. Submitting and approving check the record as a whole again —
     contract, rules, every image, its own checks — approving at the
     public's level (what it names must be approved or live). */
  async act(auth: AuthContext, id: string, action: WorkflowAction, input: unknown, facts: RequestFacts): Promise<ContentView<R>> {
    member(auth, this.#orgId);
    const parsed = ACTION.safeParse(input);
    if (!parsed.success) throw errors.validation(issuesOf(parsed.error, ["body"]));
    const stored = await this.#find(id);
    if (stored.revision !== parsed.data.revision) throw errors.conflict(CONFLICT);
    const from = stored.record.status as EditorialStatus;
    /* A template (release marker) never moves towards the website; `unmark`
       is the one action that applies to it, and only to it. */
    const template = isTemplate(stored.record as { releaseMarker?: unknown });
    if (template && (action === "submit" || action === "approve")) throw new ApiError("CONFLICT", TEMPLATE_LOCKED(this.#config.kind), { details: [{ path: "body.action", message: `${action} is not possible for a template` }] });
    if (action === "unmark" && !template) throw new ApiError("CONFLICT", NOT_TEMPLATE(this.#config.kind), { details: [{ path: "body.action", message: "unmark applies to a template only" }] });
    const { to, past } = transition(auth, action, from, this.#config.kind);
    const now = this.#now().toISOString();
    const candidate = { ...stored.record, status: to, updatedAt: now } as unknown as Record<string, unknown>;
    if (action === "unmark") delete candidate.releaseMarker;
    const record = to === "draft" ? (candidate as unknown as R) : await this.#validate(candidate, this.#config.media, stored.record);
    const saved = await this.#store.replace(record.id, record, stored.revision, { id: auth.user.id, name: auth.user.name }, now, stored.slugHistory);
    if (!saved) throw errors.conflict(CONFLICT);
    await this.#audit.recordSafely({ action: `${this.#config.kind}.${past}`, resourceType: this.#config.kind, resourceId: record.id, actorUserId: auth.user.id, metadata: { from, to, revision: saved.revision } }, facts);
    await this.#dropped(auth, stored, saved, "rejected", facts);
    return viewOf(saved, auth);
  }

  /* M15: schedule this APPROVED record's website publication (owners). A
     new schedule replaces an earlier one. Full validation, as on approval.
     Both run holding the publish lock (publishing/lock.ts). */
  schedule(auth: AuthContext, id: string, input: unknown, facts: RequestFacts): Promise<ContentView<R>> {
    return this.#lock.exclusive(() => this.#schedule(auth, id, input, facts));
  }
  unschedule(auth: AuthContext, id: string, input: unknown, facts: RequestFacts): Promise<ContentView<R>> {
    return this.#lock.exclusive(() => this.#unschedule(auth, id, input, facts));
  }

  async #schedule(auth: AuthContext, id: string, input: unknown, facts: RequestFacts): Promise<ContentView<R>> {
    member(auth, this.#orgId);
    requireScheduler(auth);
    const now = this.#now();
    const request = parseScheduleRequest(input, now);
    const stored = await this.#find(id);
    if (stored.revision !== request.revision) throw errors.conflict(CONFLICT);
    if (stored.record.status !== "approved") throw notApproved(this.#config.kind, stored.record.status);
    if (isTemplate(stored.record as { releaseMarker?: unknown })) throw new ApiError("CONFLICT", TEMPLATE_LOCKED(this.#config.kind), { details: [{ path: "body.action", message: "schedule is not possible for a template" }] });
    await this.#validate({ ...stored.record } as unknown as Record<string, unknown>, this.#config.media, stored.record);
    const schedule = newSchedule(request, stored.record, stored.revision + 1, auth, now);
    const saved = await this.#store.setSchedule(id, stored.revision, schedule, { id: auth.user.id, name: auth.user.name }, now.toISOString());
    if (!saved) throw await this.#lost(id, request.revision);
    await this.#audit.recordSafely(
      { action: `${this.#config.kind}.scheduled`, resourceType: this.#config.kind, resourceId: id, actorUserId: auth.user.id, metadata: { revision: saved.revision, at: schedule.at, timeZone: schedule.timeZone, ...(stored.schedule && { previousAt: stored.schedule.at }) } },
      facts
    );
    return viewOf(saved, auth);
  }

  /* M15: drop the schedule (owners); the record stays approved. */
  async #unschedule(auth: AuthContext, id: string, input: unknown, facts: RequestFacts): Promise<ContentView<R>> {
    member(auth, this.#orgId);
    requireScheduler(auth);
    const parsed = UNSCHEDULE.safeParse(input);
    if (!parsed.success) throw errors.validation(issuesOf(parsed.error, ["body"]));
    const stored = await this.#find(id);
    if (stored.revision !== parsed.data.revision) throw errors.conflict(CONFLICT);
    if (!stored.schedule) throw notScheduled(this.#config.kind);
    const saved = await this.#store.setSchedule(id, stored.revision, null, { id: auth.user.id, name: auth.user.name }, this.#now().toISOString());
    if (!saved) throw await this.#lost(id, parsed.data.revision);
    await this.#audit.recordSafely(
      { action: `${this.#config.kind}.unscheduled`, resourceType: this.#config.kind, resourceId: id, actorUserId: auth.user.id, metadata: { revision: saved.revision, at: stored.schedule.at, reason: "owner" } },
      facts
    );
    return viewOf(saved, auth);
  }

  /* A schedule write that changed nothing: stale (409) or no longer approved (409). */
  async #lost(id: string, revision: number) {
    const now = await this.#find(id);
    return now.revision !== revision ? errors.conflict(CONFLICT) : notApproved(this.#config.kind, now.record.status);
  }

  /* A write that left the record not approved dropped its schedule: say so. */
  async #dropped(auth: AuthContext, before: StoredContent<R>, after: StoredContent<R>, reason: string, facts: RequestFacts) {
    if (!before.schedule || after.schedule) return;
    await this.#audit.recordSafely(
      { action: `${this.#config.kind}.unscheduled`, resourceType: this.#config.kind, resourceId: after.record.id, actorUserId: auth.user.id, metadata: { revision: after.revision, at: before.schedule.at, reason } },
      facts
    );
  }

  async #write(auth: AuthContext, stored: StoredContent<R>, changes: Record<string, unknown>, confirmSlugChange: boolean, facts: RequestFacts, archiving?: "archived") {
    const before = stored.record as Record<string, unknown>;
    const now = this.#now().toISOString();
    const { status: requested, ...content } = changes;
    /* A release marker is removed by an owner's Unmark action only, and a
       record that has been on the website never becomes a template. */
    if (content.releaseMarker === null) throw errors.validation([{ path: "body.changes.releaseMarker", message: MARKER_BY_ACTION }], MARKER_BY_ACTION);
    if (typeof content.releaseMarker === "string" && before.publishedAt) throw errors.validation([{ path: "body.changes.releaseMarker", message: `a ${this.#config.kind} that has been published cannot become a template` }]);
    const merged: Record<string, unknown> = { ...before, ...content, updatedAt: now };
    for (const [key, value] of Object.entries(content))
      if (value === null) {
        if (this.#config.cleared && key in this.#config.cleared) merged[key] = this.#config.cleared[key];
        else delete merged[key];
      }
    if (content.slug !== undefined) merged.slug = slugify(String(content.slug ?? ""));
    if (!merged.slug) throw errors.validation([{ path: "body.changes.slug", message: "must contain letters or digits" }]);
    const contentChanged = changedFields(before, merged, this.#config.opaque).some((f) => f !== "updatedAt");
    merged.status = archiving ?? statusAfterEdit(before.status as EditorialStatus, requested, contentChanged, this.#config.kind);

    // An address that has been public is only changed on purpose.
    const slugChanged = merged.slug !== before.slug;
    let slugHistory = stored.slugHistory;
    if (slugChanged && before.publishedAt) {
      if (!confirmSlugChange) throw new ApiError("CONFLICT", SLUG_CHANGE, { details: [{ path: "body.changes.slug", message: "changing a published address needs confirmSlugChange" }] });
      slugHistory = [...slugHistory.filter((s) => s !== merged.slug), String(before.slug)];
    }

    const changedRefs = (record: R) => this.#config.media(record).filter(([, value], i) => value !== this.#config.media(stored.record)[i]?.[1]);
    const record = await this.#validate(merged, changedRefs, stored.record);
    if (slugChanged) await this.#slugFree(record.slug, record.id);

    const fields = changedFields(before, record as Record<string, unknown>, this.#config.opaque).filter((f) => f !== "updatedAt" && f !== "publishedAt" && f !== "status");
    if (!fields.length && record.status !== before.status) fields.push("status");
    if (!fields.length) return viewOf(stored, auth);

    let saved;
    try {
      saved = await this.#store.replace(record.id, record, stored.revision, { id: auth.user.id, name: auth.user.name }, now, slugHistory);
    } catch (error) {
      throw this.#duplicate(error) ?? error;
    }
    if (!saved) throw errors.conflict(CONFLICT);
    const archived = record.status === "archived" && before.status !== "archived";
    await this.#audit.recordSafely(
      { action: `${this.#config.kind}.${archived ? "archived" : "updated"}`, resourceType: this.#config.kind, resourceId: record.id, actorUserId: auth.user.id, metadata: { fields, status: record.status } },
      facts
    );
    await this.#dropped(auth, stored, saved, droppedBecause(record.status), facts);
    return viewOf(saved, auth);
  }
}
