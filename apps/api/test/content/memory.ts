import { DuplicateKeyError } from "../../src/db/mongo.ts";
import type { PublicationSchedule } from "@rbb/content-schema";
import type { ContentQuery, ContentRecordBase, ContentStore, Member, StoredContent } from "../../src/modules/content/repository.ts";

/* An in-memory content store with MongoContentStore's contract —
   organization-scoped, unique id and slug, revision-guarded — over a
   SHARED row list, so two organizations can sit side by side. */
export class MemoryContentStore<R extends ContentRecordBase> implements ContentStore<R> {
  readonly rows: (StoredContent<R> & { orgId: string })[];
  readonly orgId: string;
  readonly titleKey: string;
  readonly types: readonly string[] | null;
  constructor(rows: (StoredContent<R> & { orgId: string })[], orgId: string, { titleKey = "title", types }: { titleKey?: string; types?: readonly string[] } = {}) {
    this.rows = rows;
    this.orgId = orgId;
    this.titleKey = titleKey;
    this.types = types ?? null;
  }
  #title = (r: StoredContent<R>) => String((r.record as unknown as Record<string, unknown>)[this.titleKey] ?? "");
  #typeOf = (record: R) => (record as unknown as { type?: string }).type ?? "";
  /* Unique addresses span the whole collection (as the Mongo index does). */
  #org = () => this.rows.filter((r) => r.orgId === this.orgId);
  #mine = () => this.#org().filter((r) => !this.types || this.types.includes(this.#typeOf(r.record)));
  #out = ({ orgId: _o, ...s }: StoredContent<R> & { orgId: string }): StoredContent<R> => structuredClone(s);

  async findById(id: string) {
    const row = this.#mine().find((r) => r.record.id === id);
    return row ? this.#out(row) : null;
  }
  async findBySlug(slug: string) {
    const row = this.#mine().find((r) => r.record.slug === slug);
    return row ? this.#out(row) : null;
  }
  async findMany(ids: string[]) {
    return this.#mine().filter((r) => ids.includes(r.record.id)).map((r) => structuredClone(r.record));
  }
  async list({ search, status, type, sort, page, pageSize }: ContentQuery) {
    let rows = this.#mine();
    if (status) rows = rows.filter((r) => r.record.status === status);
    if (type) rows = rows.filter((r) => (r.record as unknown as { type?: string }).type === type);
    if (search) rows = rows.filter((r) => this.#title(r).toLowerCase().includes(search.toLowerCase()));
    const date = (r: StoredContent<R>) => String((r.record as unknown as { date?: string }).date ?? "");
    rows = [...rows].sort((a, b) =>
      sort === "title" ? this.#title(a).localeCompare(this.#title(b)) : sort === "date" ? date(b).localeCompare(date(a)) : b.updatedAt.localeCompare(a.updatedAt) || a.record.id.localeCompare(b.record.id)
    );
    return { items: rows.slice((page - 1) * pageSize, page * pageSize).map(this.#out), total: rows.length };
  }
  async insert(stored: StoredContent<R>) {
    if (stored.record.orgId !== this.orgId) throw new Error("Refusing to store content for another organization");
    if (this.types && !this.types.includes(this.#typeOf(stored.record))) throw new Error("Refusing to store a record of another type in this store");
    if (this.#org().some((r) => r.record.id === stored.record.id)) throw new DuplicateKeyError("record.id");
    if (this.#org().some((r) => r.record.slug === stored.record.slug)) throw new DuplicateKeyError("record.slug");
    this.rows.push({ ...structuredClone(stored), orgId: this.orgId });
  }
  async replace(id: string, record: R, expectedRevision: number, by: Member, at: string, slugHistory: string[]) {
    if (record.orgId !== this.orgId) throw new Error("Refusing to store content for another organization");
    const row = this.#mine().find((r) => r.record.id === id);
    if (!row || row.revision !== expectedRevision) return null;
    if (this.#org().some((r) => r.record.id !== id && r.record.slug === record.slug)) throw new DuplicateKeyError("record.slug");
    Object.assign(row, { record: structuredClone(record), revision: row.revision + 1, updatedAt: at, updatedBy: by, slugHistory: [...slugHistory], ...(record.status === "archived" && { publishedRevision: null }) });
    if (record.status !== "approved") delete row.schedule;
    return this.#out(row);
  }
  async findManyStored(ids: string[]) {
    return this.#mine().filter((r) => ids.includes(r.record.id)).map(this.#out);
  }
  async listForPublish() {
    return this.#mine()
      .filter((r) => r.record.status !== "archived" && (["approved", "published"].includes(r.record.status) || typeof r.publishedRevision === "number"))
      .sort((a, b) => a.record.id.localeCompare(b.record.id))
      .map(this.#out);
  }
  async markPublished(id: string, revision: number, at: string) {
    const row = this.#mine().find((r) => r.record.id === id);
    if (!row) return;
    row.publishedRevision = revision;
    if (row.revision === revision && row.record.status === "approved") {
      row.record = { ...row.record, status: "published" };
      delete row.schedule;
    }
    if (row.revision === revision && !(row.record as { publishedAt?: string }).publishedAt) row.record = { ...row.record, publishedAt: at };
  }
  async setSchedule(id: string, expectedRevision: number, schedule: PublicationSchedule | null, by: Member, at: string) {
    const row = this.#mine().find((r) => r.record.id === id);
    if (!row || row.revision !== expectedRevision || row.record.status !== "approved") return null;
    Object.assign(row, { revision: row.revision + 1, updatedAt: at, updatedBy: by });
    if (schedule) row.schedule = structuredClone(schedule);
    else delete row.schedule;
    return this.#out(row);
  }
  async listScheduled() {
    return this.#mine()
      .filter((r) => r.record.status === "approved" && r.schedule)
      .sort((a, b) => a.schedule!.at.localeCompare(b.schedule!.at) || a.record.id.localeCompare(b.record.id))
      .map(this.#out);
  }
  async markScheduleFailed(id: string, scheduledAt: string, failedAt: string, problems: string[]) {
    const row = this.#mine().find((r) => r.record.id === id && r.record.status === "approved" && r.schedule?.at === scheduledAt);
    if (row) row.schedule = { ...row.schedule!, failedAt, problems };
  }
  async listPublished() {
    return this.#mine().filter((r) => r.record.status === "published").map((r) => structuredClone(r.record));
  }
  async distinct(field: "type") {
    return [...new Set(this.#mine().map((r) => (r.record as unknown as Record<string, string>)[field]).filter(Boolean))];
  }
  async count() {
    return this.#mine().length;
  }
}
