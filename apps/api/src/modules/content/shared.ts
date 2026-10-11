import { z } from "zod";
import { errors, type ErrorDetail } from "../../errors.ts";
import type { AuthContext } from "../auth/types.ts";
import type { MediaStore } from "../media/repository.ts";
import { scheduleView, type ScheduleView } from "../publishing/schedule.ts";
import { publicReady } from "./workflow.ts";
import type { ContentRecordBase, StoredContent } from "./repository.ts";

/* Rules shared by the content collections (posts, events). */

export const LIST_INPUT = z.strictObject({
  search: z.string().trim().max(100).optional(),
  status: z.enum(["draft", "submitted", "approved", "published", "archived"]).optional(),
  sort: z.enum(["updated", "date", "title"]).default("updated"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/* A title → an address: lowercase ASCII words joined by hyphens. */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}

export const issuesOf = (error: z.ZodError, prefix: string[]): ErrorDetail[] =>
  error.issues.map((issue) => ({ path: [...prefix, ...issue.path.map(String)].join("."), message: issue.message }));

export function member(auth: AuthContext, orgId: string) {
  if (auth.organization.id !== orgId) throw errors.forbidden("You do not have permission to do this.");
  return auth;
}

/* M14: moving a record towards the public site is the editorial workflow's
   (content/workflow.ts): submit, approve, then an owner publishes the
   website. A plain save never publishes. */

/* Leaf paths that differ — for the audit trail. Rich-text fields are
   named, never walked: their wording is content, not an audit fact. */
export function changedFields(before: Record<string, unknown>, after: Record<string, unknown>, opaque: readonly string[]): string[] {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return keys.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])).flatMap((k) => {
    const a = before[k];
    const b = after[k];
    const object = (v: unknown) => v !== null && typeof v === "object" && !Array.isArray(v);
    return !opaque.includes(k) && object(a) && object(b) ? changedFields(a as Record<string, unknown>, b as Record<string, unknown>, []).map((p) => `${k}.${p}`) : [k];
  });
}

/* Each referenced media item must be a READY image of this organization
   (the store is org-scoped: another organization's id is not found). */
export async function checkMedia(media: MediaStore, references: [string, string | undefined][]): Promise<ErrorDetail[]> {
  const wanted = references.filter((r): r is [string, string] => Boolean(r[1]));
  if (!wanted.length) return [];
  const found = new Map((await media.findMany([...new Set(wanted.map(([, id]) => id))])).map((m) => [m.id, m]));
  return wanted
    .filter(([, id]) => {
      const m = found.get(id);
      return !m || m.status !== "ready" || m.kind !== "image" || !m.publicUrl;
    })
    .map(([path]) => ({ path, message: "must be a ready image from this organization's media library" }));
}

export interface ContentView<R> {
  record: R;
  revision: number;
  createdAt: string;
  updatedAt: string;
  createdBy: { name: string };
  updatedBy: { name: string; isYou: boolean };
  /* The addresses it was published at before (for future redirects). */
  previousSlugs: string[];
  /* M14: a version of it is in the live snapshot (when its status is not
     "published", that version is an earlier one: changes are pending). */
  live: boolean;
  /* M15: when this approved revision joins a website publish, or null. */
  schedule: ScheduleView | null;
}

/* Whether a stored record has a version in the live snapshot. Records
   published before M14 carry no marker: their status says it. */
export const isLive = (stored: { record: { status: string }; publishedRevision?: number | null }) =>
  stored.record.status !== "archived" && (typeof stored.publishedRevision === "number" || (stored.publishedRevision === undefined && stored.record.status === "published"));

export const viewOf = <R extends ContentRecordBase>(stored: StoredContent<R>, auth: AuthContext): ContentView<R> => ({
  record: stored.record,
  revision: stored.revision,
  createdAt: stored.createdAt,
  updatedAt: stored.updatedAt,
  createdBy: { name: stored.createdBy.name },
  updatedBy: { name: stored.updatedBy.name, isYou: stored.updatedBy.id === auth.user.id },
  previousSlugs: stored.slugHistory,
  live: isLive(stored),
  schedule: scheduleView(stored.schedule),
});

export const CONFLICT = "This was changed elsewhere since you opened it. Reload the latest version before saving.";
export const SLUG_CHANGE = "This is published at its current address. Changing the address breaks existing links to it — confirm the change to continue.";

/* M12: a record's references to another collection, checked at save. A
   collection the organization does not manage in the CMS yet (no record
   of it) names the website's own records, which the website build checks;
   once it does, a reference must name one of its records that is not
   archived — and, for a record being APPROVED (M14), one that is ready for
   the public: approved, published, or live in an earlier version (the
   website publish checks again, atomically). Never another organization's:
   every store is scoped to one. */
interface Referenced {
  record: { id: string; status: string };
  publishedRevision?: number | null;
}
export interface ReferenceTarget {
  count(): Promise<number>;
  findManyStored?(ids: string[]): Promise<Referenced[]>;
  findBySlug?(slug: string): Promise<Referenced | null>;
}
export async function referenceProblems(
  target: ReferenceTarget,
  keys: string[],
  { path, noun, by, publishing }: { path: string; noun: string; by: "slug" | "id"; publishing: boolean }
): Promise<ErrorDetail[]> {
  if (!keys.length || (await target.count()) === 0) return [];
  const found = new Map<string, Referenced>();
  if (by === "id") for (const r of await target.findManyStored!(keys)) found.set(r.record.id, r);
  else for (const key of new Set(keys)) {
    const r = await target.findBySlug!(key);
    if (r) found.set(key, r);
  }
  const problems: ErrorDetail[] = [];
  for (const key of keys) {
    const r = found.get(key);
    if (!r) problems.push({ path, message: `refers to ${noun} "${key}", which does not exist in this organization` });
    else if (r.record.status === "archived") problems.push({ path, message: `refers to ${noun} "${key}", which is archived` });
    else if (publishing && !publicReady(r.record.status, isLive(r))) problems.push({ path, message: `refers to ${noun} "${key}", which is not approved yet — approve it first` });
  }
  return problems;
}

/* M12: a record's images are described once it goes towards the public
   (M14: from its submission for review) (alt text from the
   media library) — stories and projects, as team members' photographs. */
export async function undescribed(media: MediaStore, references: [string, string | undefined][], publishing: boolean): Promise<ErrorDetail[]> {
  const wanted = references.filter((r): r is [string, string] => Boolean(r[1]));
  if (!publishing || !wanted.length) return [];
  const byId = new Map((await media.findMany(wanted.map(([, id]) => id))).map((m) => [m.id, m]));
  return wanted.filter(([, id]) => byId.get(id) && !byId.get(id)!.alt.trim()).map(([path]) => ({ path, message: "the image has no alt text — describe it in the media library first" }));
}
