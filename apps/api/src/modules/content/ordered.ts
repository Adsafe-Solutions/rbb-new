import type { PublishLock } from "../publishing/lock.ts";
import { z } from "zod";
import { errors } from "../../errors.ts";
import type { AuditService, RequestFacts } from "../audit/audit.ts";
import type { AuthContext } from "../auth/types.ts";
import type { MediaStore } from "../media/repository.ts";
import type { ContentRecordBase, ContentStore } from "./repository.ts";
import { ContentService, type CollectionConfig } from "./service.ts";
import { CONFLICT, issuesOf, member, viewOf } from "./shared.ts";

/* An ORDERED content collection (the team, M9; the programs, M10): the
   shared content lifecycle plus a position. A new record goes to the end;
   POST /api/v1/<base>/order sets everyone's position at once, naming the
   revision each record was read at — all are checked before anything is
   written, so a stale list changes nothing (409).

   The audit records a reorder either per moved record (`<kind>.updated`,
   fields ["order"] — the team's, M9) or once (`<kind>.reordered`). */

type Ordered = ContentRecordBase & { order: number; publishedAt?: string; createdAt?: string; updatedAt?: string };

const ORDER = z.strictObject({
  items: z
    .array(z.strictObject({ id: z.string().min(1).max(128), revision: z.int().positive() }))
    .min(1)
    .max(500)
    .refine((items) => new Set(items.map((i) => i.id)).size === items.length, "a record is listed twice"),
});

export class OrderedContentService<R extends Ordered> extends ContentService<R> {
  readonly #kind: string;
  readonly #store: ContentStore<R>;
  readonly #audit: AuditService;
  readonly #orgId: string;
  readonly #now: () => Date;
  readonly #auditOnce: boolean;

  constructor(config: CollectionConfig<R>, store: ContentStore<R>, media: MediaStore, audit: AuditService, options: { orgId: string; now?: () => Date; lock?: PublishLock; auditReorderOnce?: boolean }) {
    super(config, store, media, audit, options);
    this.#kind = config.kind;
    this.#store = store;
    this.#audit = audit;
    this.#orgId = options.orgId;
    this.#now = options.now ?? (() => new Date());
    this.#auditOnce = options.auditReorderOnce ?? false;
  }

  /* A new record goes to the end. */
  override async create(auth: AuthContext, input: unknown, facts: RequestFacts) {
    const fields = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
    if ("order" in fields) throw errors.validation([{ path: "body.order", message: "is set by reordering" }]);
    const view = await super.create(auth, input, facts);
    const position = (await this.#store.count()) - 1;
    if (position === view.record.order) return view;
    const saved = await this.#store.replace(view.record.id, { ...view.record, order: position }, view.revision, { id: auth.user.id, name: auth.user.name }, this.#now().toISOString(), []);
    return saved ? viewOf(saved, auth) : view;
  }

  /* Everyone's position at once: { items: [{ id, revision }] } in the new
     order (first = 0). */
  async reorder(auth: AuthContext, input: unknown, facts: RequestFacts) {
    member(auth, this.#orgId);
    const parsed = ORDER.safeParse(input);
    if (!parsed.success) throw errors.validation(issuesOf(parsed.error, ["body"]));
    const { items } = parsed.data;
    const stored = await Promise.all(items.map((i) => this.#store.findById(i.id)));
    stored.forEach((s, i) => {
      if (!s) throw errors.notFound(this.#kind);
      if (s.revision !== items[i]!.revision) throw errors.conflict(CONFLICT);
    });
    const at = this.#now().toISOString();
    const by = { id: auth.user.id, name: auth.user.name };
    const moved: string[] = [];
    for (const [i, s] of stored.entries()) {
      if (s!.record.order === i) continue;
      const saved = await this.#store.replace(s!.record.id, { ...s!.record, order: i, updatedAt: at }, s!.revision, by, at, s!.slugHistory);
      if (!saved) throw errors.conflict(CONFLICT);
      moved.push(s!.record.id);
      if (!this.#auditOnce)
        await this.#audit.recordSafely({ action: `${this.#kind}.updated`, resourceType: this.#kind, resourceId: s!.record.id, actorUserId: auth.user.id, metadata: { fields: ["order"], status: s!.record.status } }, facts);
    }
    if (this.#auditOnce && moved.length)
      await this.#audit.recordSafely({ action: `${this.#kind}.reordered`, resourceType: this.#kind, actorUserId: auth.user.id, metadata: { moved: moved.length, total: items.length } }, facts);
    const after = await Promise.all(items.map((i) => this.#store.findById(i.id)));
    return after.map((s) => viewOf(s!, auth));
  }
}
