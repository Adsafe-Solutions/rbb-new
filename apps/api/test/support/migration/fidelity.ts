import type { PublishedSnapshot } from "@rbb/content-schema";
import { FACTS, member } from "../../media/memory.ts";
import { addMedia, harness, sharedData } from "../../settings/memory.ts";
import type { MediaRecord } from "../../../src/modules/media/types.ts";
import { approve, approvePage } from "../workflow.ts";
import { COLLECTION_TYPES, PAGE_TYPES, type CollectionType, type ExistingRecord, type PageType } from "./writer.ts";

/* What the website would draw from the rehearsal's records — computed
   IN MEMORY ONLY. The records the writer left in the test database are
   drafts, and nothing there is ever approved or published; so they are
   read back, replayed into the in-memory test harness, approved THERE, and
   the API's own publish preview composes the snapshot (the same code and
   contract a real publish uses). No database is written; no snapshot is
   stored or activated anywhere. */

const ENVELOPE = new Set(["id", "orgId", "schemaVersion", "status", "order", "createdAt", "updatedAt", "publishedAt", "releaseMarker"]);
const fields = (record: Record<string, unknown>) => Object.fromEntries(Object.entries(record).filter(([k]) => !ENVELOPE.has(k)));
const SERVICE: Record<CollectionType, string> = { program: "programs", metric: "metrics", report: "reports", project: "projects", team_member: "team", story: "stories", news: "posts", blog: "posts", event: "events" };

export async function previewSnapshot(
  readBack: { collections: Partial<Record<CollectionType, ExistingRecord[]>>; pages: Partial<Record<PageType, ExistingRecord | null>>; media?: Partial<MediaRecord>[] },
  orgId: string
): Promise<{ snapshot: PublishedSnapshot | null; problems: string[] }> {
  const data = sharedData();
  /* The media records the rehearsal's records name, as they are (ids kept). */
  for (const m of readBack.media ?? []) addMedia(data, orgId, "ready", m);
  const h = harness(orgId, data);
  const owner = member(orgId, "OWNER");
  const settings = readBack.pages.settings;
  if (!settings) return { snapshot: null, problems: ["the rehearsal has no settings record — a snapshot needs one"] };
  const imported = await h.settings.importInitial(settings.record, { id: null, name: "Rehearsal preview" });
  if (!imported.created) return { snapshot: null, problems: imported.problems.map((p) => `settings ${p.path}: ${p.message}`) };

  /* Ids the database gave → ids the harness gives (stories are named by id). */
  const ids = new Map<string, string>();
  const remap = (v: unknown): unknown => (typeof v === "string" ? (ids.get(v) ?? v) : Array.isArray(v) ? v.map(remap) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, remap(x)])) : v);
  for (const type of COLLECTION_TYPES) {
    const service = (h as unknown as Record<string, Parameters<typeof approve>[0]>)[SERVICE[type]]!;
    const records = [...(readBack.collections[type] ?? [])].sort((a, b) => Number(a.record.order ?? 0) - Number(b.record.order ?? 0));
    for (const r of records) {
      const created = await (service as unknown as { create: (a: unknown, i: unknown, f: unknown) => Promise<{ record: { id: string } }> }).create(owner, remap(fields(r.record)), FACTS);
      ids.set(r.id, created.record.id);
      await approve(service, owner, created.record.id, FACTS);
    }
  }
  for (const type of PAGE_TYPES) {
    if (type === "settings") continue;
    const page = readBack.pages[type];
    if (!page) continue;
    const service = (h as unknown as Record<string, Parameters<typeof approvePage>[0]>)[type]!;
    await (service as unknown as { create: (a: unknown, i: unknown, f: unknown) => Promise<unknown> }).create(owner, remap(fields(page.record)), FACTS);
    await approvePage(service, owner, FACTS);
  }
  const preview = await h.publishing.preview(owner);
  return { snapshot: preview.snapshot, problems: preview.problems.map((p) => (typeof p === "string" ? p : JSON.stringify(p))) };
}
