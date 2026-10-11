import { unlocked, type PublishLock } from "../publishing/lock.ts";
import { z } from "zod";
import { errors, type ErrorDetail } from "../../errors.ts";
import type { AuditService, RequestFacts } from "../audit/audit.ts";
import type { AuthContext } from "../auth/types.ts";
import { checkMedia, isLive, issuesOf, member } from "../content/shared.ts";
import { ACTION } from "../content/service.ts";
import { statusAfterEdit, transition, type EditorialStatus, type WorkflowAction } from "../content/workflow.ts";
import type { MediaStore } from "../media/repository.ts";
import { UNSCHEDULE, droppedBecause, newSchedule, notApproved, notScheduled, parseScheduleRequest, requireScheduler, scheduleView, type ScheduleView } from "../publishing/schedule.ts";
import type { BlockPageRecord, BlockPageStore, PageRecord, StoredBlockPage } from "./repository.ts";

/* A BLOCK PAGE — one per organization, an ordered list of typed blocks
   (the homepage, M8; the About page, M9). Each page is a configuration of
   this service: its contract, its media, its extra checks, its words.

     GET    the page, or { record: null, revision: 0 } before it exists
     POST   create it (once): { sections?, seo?, status? }
     PATCH  { revision, changes: { sections?, seo?, status? } } — `sections`
            is the whole ordered list (reorder, add, remove, enable and
            disable are all a new list); `seo: null` clears. revision 0
            creates, as the general donation page does
     DELETE archive (idempotent); nothing is destroyed

   Rules, in order: the page's contract (blocks, ids, single/first rules,
   unknown types refused); no release markers (internal to source content,
   never set in the CMS); media must be ready images of this organization;
   then the page's own checks. M14: the editorial workflow
   (content/workflow.ts) — POST /<base>/submit, /withdraw, /approve,
   /reject — moves a page towards the public; a save never publishes, and an
   edit to an approved or published page makes it a draft again (its
   published version stays live until the new revision is approved and the
   website published). The audit trail names what changed
   by block — `sections.<id>.data.heading`, `sections.<id>.enabled`,
   `sections.order` — never the wording.

   A TYPED single page (M11: the Transparency record) uses the same
   lifecycle with its own named parts instead of blocks (`parts`): each
   part is replaced whole, `null` clears an optional one, and the audit
   names the changed part and its fields (`financialOverview.items`). */

export interface BlockPageConfig<R extends PageRecord> {
  /* "homepage" | "about" | "impact" | "transparency": the record's id and
     the audit actions' prefix. */
  kind: string;
  /* The record's id when it is not `kind` — one of several fixed pages of
     a kind (M19: the policy "privacy" of kind "policy"). */
  recordId?: string;
  /* How messages name it: "homepage", "About page". */
  label: string;
  contract: z.ZodType<R>;
  mediaIds: (record: R) => string[];
  /* Checks beyond the contract and media (the homepage's references). */
  check?: (record: R, at: string) => Promise<ErrorDetail[]>;
  conflict: string;
  /* The record's editable parts (default: a block page's sections and
     seo). A TYPED page names its own; its parts are never blocks, even one
     called `sections` (M19: a policy's sections are plain text). */
  parts?: readonly string[];
  /* What a page is before its first save (default: no blocks yet). */
  initial?: () => Record<string, unknown>;
}

const STATUS = z.enum(["draft", "submitted", "approved", "published", "archived"]);
const BLOCK_PARTS = ["sections", "seo"] as const;

export interface BlockPageView<R> {
  record: R | null;
  revision: number;
  updatedAt: string | null;
  updatedBy: { name: string; isYou: boolean } | null;
  /* M14: a version of it is in the live snapshot. */
  live: boolean;
  /* M15: when the approved revision joins a website publish, or null. */
  schedule: ScheduleView | null;
}

/* Field paths that differ between two versions of a TYPED page: each
   changed part, and within an object part its changed fields. */
export function partChanges(parts: readonly string[], before: PageRecord | null, after: PageRecord): string[] {
  const a = (before ?? {}) as Record<string, unknown>;
  const b = after as unknown as Record<string, unknown>;
  const paths = new Set<string>();
  if (!before || before.status !== after.status) paths.add("status");
  const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
  for (const part of parts) {
    const x = a[part];
    const y = b[part];
    if (JSON.stringify(x) === JSON.stringify(y)) continue;
    if (isObject(x) && isObject(y)) {
      for (const key of new Set([...Object.keys(x), ...Object.keys(y)])) if (JSON.stringify(x[key]) !== JSON.stringify(y[key])) paths.add(`${part}.${key}`);
    } else paths.add(part);
  }
  return [...paths].sort();
}

/* Field paths that differ between two versions of a page, block by block. */
export function blockPageChanges(before: BlockPageRecord | null, after: BlockPageRecord): string[] {
  const paths = new Set<string>();
  if (!before) return ["sections", ...(after.seo ? ["seo"] : []), "status"];
  if (before.status !== after.status) paths.add("status");
  for (const key of ["title", "description", "ogImageId", "noIndex"] as const) if (before.seo?.[key] !== after.seo?.[key]) paths.add(`seo.${key}`);
  const old = new Map(before.sections.map((s) => [s.id, s]));
  const now = new Map(after.sections.map((s) => [s.id, s]));
  for (const [id, s] of now) {
    const was = old.get(id);
    if (!was) {
      paths.add(`sections.${id}`);
      continue;
    }
    if (was.enabled !== s.enabled) paths.add(`sections.${id}.enabled`);
    if (was.type !== s.type) paths.add(`sections.${id}.type`);
    const a = was.data as Record<string, unknown>;
    const b = s.data as Record<string, unknown>;
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) paths.add(`sections.${id}.data.${key}`);
  }
  for (const id of old.keys()) if (!now.has(id)) paths.add(`sections.${id}`);
  const order = (list: BlockPageRecord["sections"]) => list.map((s) => s.id).filter((id) => old.has(id) && now.has(id)).join(",");
  if (order(before.sections) !== order(after.sections)) paths.add("sections.order");
  return [...paths].sort();
}

export class BlockPageService<R extends PageRecord> {
  readonly #config: BlockPageConfig<R>;
  readonly #parts: readonly string[];
  readonly #blocks: boolean;
  readonly #create: z.ZodType;
  readonly #update: z.ZodType;
  readonly #store: BlockPageStore<R>;
  readonly #media: MediaStore;
  readonly #audit: AuditService;
  readonly #orgId: string;
  readonly #now: () => Date;
  readonly #lock: PublishLock;

  constructor(config: BlockPageConfig<R>, store: BlockPageStore<R>, media: MediaStore, audit: AuditService, { orgId, now = () => new Date(), lock = unlocked }: { orgId: string; now?: () => Date; lock?: PublishLock }) {
    this.#lock = lock;
    this.#config = config;
    this.#store = store;
    this.#media = media;
    this.#audit = audit;
    this.#orgId = orgId;
    this.#now = now;
    this.#parts = config.parts ?? BLOCK_PARTS;
    this.#blocks = !config.parts;
    const fields = { ...Object.fromEntries(this.#parts.map((p) => [p, z.unknown().optional()])), status: STATUS.optional() };
    this.#create = z.strictObject(fields);
    this.#update = z.strictObject({ revision: z.int().min(0), changes: z.strictObject(fields) });
  }

  #initial(): Record<string, unknown> {
    return this.#config.initial?.() ?? { sections: [] };
  }

  #view(stored: StoredBlockPage<R> | null, auth: AuthContext): BlockPageView<R> {
    if (!stored) return { record: null, revision: 0, updatedAt: null, updatedBy: null, live: false, schedule: null };
    return { record: stored.record, revision: stored.revision, updatedAt: stored.updatedAt, updatedBy: { name: stored.updatedBy.name, isYou: stored.updatedBy.id === auth.user.id }, live: isLive(stored), schedule: scheduleView(stored.schedule) };
  }

  async get(auth: AuthContext): Promise<BlockPageView<R>> {
    member(auth, this.#orgId);
    return this.#view(await this.#store.get(), auth);
  }

  async create(auth: AuthContext, input: unknown, facts: RequestFacts): Promise<BlockPageView<R>> {
    member(auth, this.#orgId);
    const parsed = this.#create.safeParse(input);
    if (!parsed.success) throw errors.validation(issuesOf(parsed.error, ["body"]));
    if (await this.#store.get()) throw errors.conflict(`This organization already has a ${this.#config.label}. Edit it instead.`);
    return this.#save(auth, null, { ...this.#initial(), ...(parsed.data as Record<string, unknown>) }, facts, ["body"]);
  }

  async update(auth: AuthContext, input: unknown, facts: RequestFacts): Promise<BlockPageView<R>> {
    member(auth, this.#orgId);
    const parsed = this.#update.safeParse(input);
    if (!parsed.success) throw errors.validation(issuesOf(parsed.error, ["body"]));
    const { revision, changes } = parsed.data as { revision: number; changes: Record<string, unknown> };
    const stored = await this.#store.get();
    if ((stored?.revision ?? 0) !== revision) throw errors.conflict(this.#config.conflict);
    return this.#save(auth, stored, stored ? changes : { ...this.#initial(), ...changes }, facts, ["body", "changes"]);
  }

  /* DELETE: archive. Idempotent. */
  async archive(auth: AuthContext, facts: RequestFacts): Promise<BlockPageView<R>> {
    member(auth, this.#orgId);
    const stored = await this.#store.get();
    if (!stored) throw errors.notFound(this.#config.kind);
    if (stored.record.status === "archived") return this.#view(stored, auth);
    return this.#save(auth, stored, {}, facts, ["body"], "archived");
  }

  /* M14: a workflow transition of the revision the member has open.
     Submitting and approving check the whole page again (contract, every
     image, its own checks — approving at the public's level). */
  async act(auth: AuthContext, action: WorkflowAction, input: unknown, facts: RequestFacts): Promise<BlockPageView<R>> {
    member(auth, this.#orgId);
    const parsed = ACTION.safeParse(input);
    if (!parsed.success) throw errors.validation(issuesOf(parsed.error, ["body"]));
    const stored = await this.#store.get();
    if (!stored) throw errors.notFound(this.#config.kind);
    if (stored.revision !== parsed.data.revision) throw errors.conflict(this.#config.conflict);
    const from = stored.record.status as EditorialStatus;
    const { to, past } = transition(auth, action, from, this.#config.label);
    const now = this.#now().toISOString();
    const record = { ...stored.record, status: to, updatedAt: now } as R;
    if (to !== "draft") {
      const problems = await this.#problems(record, "body", null);
      if (problems.length) throw errors.validation(problems);
    }
    const saved = await this.#store.replace(record, stored.revision, { id: auth.user.id, name: auth.user.name }, now);
    if (!saved) throw errors.conflict(this.#config.conflict);
    const kind = this.#config.kind;
    await this.#audit.recordSafely({ action: `${kind}.${past}`, resourceType: kind, resourceId: record.id, actorUserId: auth.user.id, metadata: { from, to, revision: saved.revision } }, facts);
    await this.#dropped(auth, stored, saved, "rejected", facts);
    return this.#view(saved, auth);
  }

  /* M15: schedule the APPROVED page's website publication (owners) — the
     page as a whole, at its approved revision. Validated as on approval.
     Both run holding the publish lock (publishing/lock.ts). */
  schedule(auth: AuthContext, input: unknown, facts: RequestFacts): Promise<BlockPageView<R>> {
    return this.#lock.exclusive(() => this.#schedule(auth, input, facts));
  }
  unschedule(auth: AuthContext, input: unknown, facts: RequestFacts): Promise<BlockPageView<R>> {
    return this.#lock.exclusive(() => this.#unschedule(auth, input, facts));
  }

  async #schedule(auth: AuthContext, input: unknown, facts: RequestFacts): Promise<BlockPageView<R>> {
    member(auth, this.#orgId);
    requireScheduler(auth);
    const now = this.#now();
    const request = parseScheduleRequest(input, now);
    const stored = await this.#store.get();
    if (!stored) throw errors.notFound(this.#config.kind);
    if (stored.revision !== request.revision) throw errors.conflict(this.#config.conflict);
    if (stored.record.status !== "approved") throw notApproved(this.#config.label, stored.record.status);
    const problems = await this.#problems(stored.record, "body", null);
    if (problems.length) throw errors.validation(problems);
    const schedule = newSchedule(request, stored.record, stored.revision + 1, auth, now);
    const saved = await this.#store.setSchedule(stored.revision, schedule, { id: auth.user.id, name: auth.user.name }, now.toISOString());
    if (!saved) throw await this.#lost(request.revision);
    const kind = this.#config.kind;
    await this.#audit.recordSafely({ action: `${kind}.scheduled`, resourceType: kind, resourceId: stored.record.id, actorUserId: auth.user.id, metadata: { revision: saved.revision, at: schedule.at, timeZone: schedule.timeZone, ...(stored.schedule && { previousAt: stored.schedule.at }) } }, facts);
    return this.#view(saved, auth);
  }

  /* M15: drop the page's schedule (owners); it stays approved. */
  async #unschedule(auth: AuthContext, input: unknown, facts: RequestFacts): Promise<BlockPageView<R>> {
    member(auth, this.#orgId);
    requireScheduler(auth);
    const parsed = UNSCHEDULE.safeParse(input);
    if (!parsed.success) throw errors.validation(issuesOf(parsed.error, ["body"]));
    const stored = await this.#store.get();
    if (!stored) throw errors.notFound(this.#config.kind);
    if (stored.revision !== parsed.data.revision) throw errors.conflict(this.#config.conflict);
    if (!stored.schedule) throw notScheduled(this.#config.label);
    const saved = await this.#store.setSchedule(stored.revision, null, { id: auth.user.id, name: auth.user.name }, this.#now().toISOString());
    if (!saved) throw await this.#lost(parsed.data.revision);
    const kind = this.#config.kind;
    await this.#audit.recordSafely({ action: `${kind}.unscheduled`, resourceType: kind, resourceId: stored.record.id, actorUserId: auth.user.id, metadata: { revision: saved.revision, at: stored.schedule.at, reason: "owner" } }, facts);
    return this.#view(saved, auth);
  }

  async #lost(revision: number) {
    const now = await this.#store.get();
    return !now || now.revision !== revision ? errors.conflict(this.#config.conflict) : notApproved(this.#config.label, now.record.status);
  }

  async #dropped(auth: AuthContext, before: StoredBlockPage<R>, after: StoredBlockPage<R>, reason: string, facts: RequestFacts) {
    if (!before.schedule || after.schedule) return;
    const kind = this.#config.kind;
    await this.#audit.recordSafely({ action: `${kind}.unscheduled`, resourceType: kind, resourceId: after.record.id, actorUserId: auth.user.id, metadata: { revision: after.revision, at: before.schedule.at, reason } }, facts);
  }

  /* Release markers, media (only what changed since `before`, or all of
     it), then the page's own checks. */
  async #problems(record: R, at: string, before: R | null): Promise<ErrorDetail[]> {
    const problems: ErrorDetail[] = [];
    const MARKER = "release markers are internal to source content and are never set in the CMS";
    if (this.#blocks)
      (record as unknown as BlockPageRecord).sections.forEach((s, i) => {
        if (JSON.stringify(s.data).includes('"releaseMarker"')) problems.push({ path: `${at}.sections.${i}.data`, message: MARKER });
      });
    for (const part of this.#parts) if (part !== "sections" && JSON.stringify((record as unknown as Record<string, unknown>)[part] ?? null).includes('"releaseMarker"')) problems.push({ path: `${at}.${part}`, message: MARKER });
    const known = new Set(before ? this.#config.mediaIds(before) : []);
    problems.push(...(await checkMedia(this.#media, this.#config.mediaIds(record).filter((id) => !known.has(id)).map((id) => [`${at}.media.${id}`, id] as [string, string]))));
    if (this.#config.check) problems.push(...(await this.#config.check(record, at)));
    return problems;
  }

  async #save(auth: AuthContext, stored: StoredBlockPage<R> | null, changes: Record<string, unknown>, facts: RequestFacts, prefix: string[], archiving?: "archived"): Promise<BlockPageView<R>> {
    const before = stored?.record ?? null;
    const now = this.#now().toISOString();
    const { status: requested, ...content } = changes;
    const merged: Record<string, unknown> = {
      ...((before as unknown as Record<string, unknown> | null) ?? { id: this.#config.recordId ?? this.#config.kind, orgId: this.#orgId, schemaVersion: 1, status: "draft", ...this.#initial(), createdAt: now }),
      ...Object.fromEntries(Object.entries(content).filter(([, v]) => v !== undefined)),
      updatedAt: now,
    };
    for (const [key, value] of Object.entries(content)) if (value === null) delete merged[key];
    const strip = (r: Record<string, unknown> | null) => JSON.stringify(r && { ...r, updatedAt: undefined, status: undefined });
    const contentChanged = !before || strip(before as unknown as Record<string, unknown>) !== strip(merged);
    merged.status = archiving ?? statusAfterEdit((before?.status as EditorialStatus | undefined) ?? null, requested, contentChanged, this.#config.label);

    const at = prefix.join(".");
    const result = this.#config.contract.safeParse(merged);
    if (!result.success) throw errors.validation(issuesOf(result.error, prefix));
    const record = result.data;
    const problems = await this.#problems(record, at, before);
    if (problems.length) throw errors.validation(problems);

    const fields = this.#blocks ? blockPageChanges(before as unknown as BlockPageRecord | null, record as unknown as BlockPageRecord) : partChanges(this.#parts, before, record);
    const by = { id: auth.user.id, name: auth.user.name };
    let saved: StoredBlockPage<R> | null;
    if (!stored) {
      if (!(await this.#store.create({ record, revision: 1, createdAt: now, updatedAt: now, updatedBy: by }))) throw errors.conflict(this.#config.conflict);
      saved = await this.#store.get();
    } else {
      if (!fields.length) return this.#view(stored, auth);
      saved = await this.#store.replace(record, stored.revision, by, now);
      if (!saved) throw errors.conflict(this.#config.conflict);
    }
    const kind = this.#config.kind;
    const action = !stored ? `${kind}.created` : record.status === "archived" && before?.status !== "archived" ? `${kind}.archived` : `${kind}.updated`;
    await this.#audit.recordSafely({ action, resourceType: kind, resourceId: record.id, actorUserId: auth.user.id, metadata: { fields, status: record.status, ...(this.#blocks && { sections: (record as unknown as BlockPageRecord).sections.length }) } }, facts);
    if (stored && saved) await this.#dropped(auth, stored, saved, droppedBecause(record.status), facts);
    return this.#view(saved, auth);
  }
}
