import { createHash } from "node:crypto";

/* The TEST-ONLY migration writer's core: it replays the eligible records
   of a rehearsal manifest (apps/web/scripts/migration-rehearsal.mjs)
   through a `WriterClient` — the API's own services, never raw documents
   — as DRAFTS, in the manifest's dependency order. It never submits,
   approves, publishes, schedules or activates anything, and never
   overwrites: a record whose key already exists is reported and skipped.

   Eligible: `action: "create"`, no release marker, no blocker, nothing
   withheld, no decision outstanding, a type this writer writes, and every
   reference resolvable. Everything else is skipped WITH its reason.

   Rerun-safe and interruption-safe: every create is reported to
   `onProgress` at once (the CLI writes the ledger after each one), and a
   rerun finds what an earlier run created by key and skips it. */

export const COLLECTION_TYPES = ["program", "metric", "report", "project", "team_member", "story", "news", "blog", "event"] as const;
export const PAGE_TYPES = ["settings", "about", "impact", "transparency", "careers"] as const;
export type CollectionType = (typeof COLLECTION_TYPES)[number];
export type PageType = (typeof PAGE_TYPES)[number];
type WriterType = CollectionType | PageType;
const isCollection = (t: string): t is CollectionType => (COLLECTION_TYPES as readonly string[]).includes(t);
const isPage = (t: string): t is PageType => (PAGE_TYPES as readonly string[]).includes(t);

export interface ExistingRecord {
  id: string;
  slug?: string;
  record: Record<string, unknown>;
}
export interface WriterClient {
  /* The organization's records of a collection (read). */
  list(type: CollectionType): Promise<ExistingRecord[]>;
  /* The organization's page or settings, or null (read). */
  page(type: PageType): Promise<ExistingRecord | null>;
  /* Create one draft through the API's service; returns its new id. */
  create(type: WriterType, payload: Record<string, unknown>): Promise<{ id: string; slug?: string }>;
  /* The organization's media library (read), and one upload to TEST storage. */
  media(): Promise<{ id: string; originalFilename: string; size: number }[]>;
  upload(entry: { key: string; filename: string; bytes: Buffer; mimeType: string; alt: string; focal?: string }): Promise<{ id: string }>;
}

interface ManifestRecord {
  key: string;
  type: string;
  sourceId?: string;
  action: string;
  releaseMarker?: string;
  blockers?: string[];
  decisions?: string[];
  withheld?: unknown[];
  payload: Record<string, unknown>;
}
interface ManifestMedia {
  key: string;
  file?: string;
  bytes?: number;
  sha256?: string;
  mimeType?: string;
  alt?: string;
  focal?: string;
}
export interface Manifest {
  manifestVersion: number;
  mode: string;
  organization: string;
  sourceHash: string;
  existing: { checked: boolean; source: string };
  records: ManifestRecord[];
  media: ManifestMedia[];
}

export interface Ledger {
  reportVersion: 1;
  target: { database: string; organization: string };
  manifest: { sourceHash: string; existing: string };
  /* Every record this writer created, ever (earlier runs included) — the
     ONLY ids a cleanup of this rehearsal may touch. */
  created: { key: string; type: string; id: string; run: number; resolved?: { field: string; ref: string; to: string; how: string }[] }[];
  media: { key: string; id: string; run: number; storage: "test" }[];
  runs: number;
  /* The latest run: */
  complete: boolean;
  skipped: { key: string; reason: string }[];
  existing: { key: string; id: string; createdByRehearsal: boolean; differs: string[] }[];
  resolved: { key: string; field: string; ref: string; to: string; how: "created" | "existing" | "website" }[];
}

export const newLedger = (target: Ledger["target"], manifest: Manifest): Ledger => ({
  reportVersion: 1,
  target,
  manifest: { sourceHash: manifest.sourceHash, existing: manifest.existing.source },
  created: [],
  media: [],
  runs: 0,
  complete: false,
  skipped: [],
  existing: [],
  resolved: [],
});

/* ---------- The manifest ---------- */
export function manifestProblems(m: unknown): string[] {
  const x = m as Partial<Manifest>;
  const problems: string[] = [];
  if (!x || typeof x !== "object") return ["the manifest is not a JSON object"];
  if (x.manifestVersion !== 1) problems.push(`unsupported manifestVersion ${String(x.manifestVersion)} (expected 1)`);
  if (x.mode !== "dry-run") problems.push('the manifest is not a dry-run manifest from the rehearsal tool (mode must be "dry-run")');
  if (typeof x.sourceHash !== "string" || !/^[0-9a-f]{64}$/.test(x.sourceHash)) problems.push("the manifest has no source hash");
  if (!Array.isArray(x.records)) problems.push("the manifest has no records");
  if (!Array.isArray(x.media)) problems.push("the manifest has no media list");
  const keys = new Set<string>();
  for (const r of x.records ?? []) {
    if (!r || typeof r.key !== "string" || typeof r.type !== "string" || typeof r.action !== "string" || typeof r.payload !== "object") {
      problems.push("a record is missing its key, type, action or payload");
      continue;
    }
    if (keys.has(r.key)) problems.push(`duplicate key in the manifest: ${r.key}`);
    keys.add(r.key);
  }
  return problems;
}

/* Why a manifest record is not written, or null when it is eligible. */
export function ineligibility(r: ManifestRecord): string | null {
  if (r.releaseMarker !== undefined) return "sample content: its release marker stays in the website's code (the CMS cannot hold it)";
  if (r.action !== "create") return `the rehearsal planned "${r.action}"${r.blockers?.length ? `: ${r.blockers.join("; ")}` : ""}`;
  if (r.blockers?.length) return `blocked: ${r.blockers.join("; ")}`;
  if (r.withheld?.length) return `${r.withheld.length} field(s) the CMS cannot take as they stand — not migrated without loss`;
  if (r.decisions?.length) return `decision outstanding: ${r.decisions.join(", ")}`;
  if (!isCollection(r.type) && !isPage(r.type)) return `the writer does not write "${r.type}" records`;
  return null;
}

/* ---------- Comparing with what exists ---------- */
const canonical = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(canonical) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical((v as Record<string, unknown>)[k])])) : v;
const same = (a: unknown, b: unknown) => JSON.stringify(canonical(a ?? null)) === JSON.stringify(canonical(b ?? null));
const ENVELOPE = new Set(["id", "orgId", "schemaVersion", "status", "order", "createdAt", "updatedAt", "publishedAt", "releaseMarker"]);
/* Fields that differ, sections by position. A field or section holding a
   symbolic reference ("@story:…") is not compared: the ids it becomes
   differ by design. */
const holdsReference = (v: unknown) => /"@[a-z_]+:/.test(JSON.stringify(v ?? null));
function differences(payload: Record<string, unknown>, existing: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const field of Object.keys(payload).sort()) {
    if (ENVELOPE.has(field)) continue;
    if (field === "sections" && Array.isArray(payload.sections)) {
      const mine = payload.sections as { type: string; enabled: boolean; data: unknown }[];
      const theirs = (existing.sections as typeof mine | undefined) ?? [];
      for (let i = 0; i < Math.max(mine.length, theirs.length); i++)
        if (!holdsReference(mine[i]) && !same(mine[i] && { type: mine[i]!.type, enabled: mine[i]!.enabled, data: mine[i]!.data }, theirs[i] && { type: theirs[i]!.type, enabled: theirs[i]!.enabled, data: theirs[i]!.data })) out.push(`sections.${i}`);
      continue;
    }
    if (!holdsReference(payload[field]) && !same(payload[field], existing[field])) out.push(field);
  }
  return out;
}

/* ---------- The run ---------- */
export async function replay({
  manifest,
  client,
  ledger,
  readFile,
  onProgress = async () => {},
  failAfter,
}: {
  manifest: Manifest;
  client: WriterClient;
  ledger: Ledger;
  /* Reads a manifest media file (repository-relative path). */
  readFile: (file: string) => Promise<Buffer>;
  onProgress?: (ledger: Ledger) => Promise<void>;
  /* Tests: stop (throw) after this many creates — an interrupted run. */
  failAfter?: number;
}): Promise<Ledger> {
  const run = ledger.runs + 1;
  Object.assign(ledger, { runs: run, complete: false, skipped: [], existing: [], resolved: [] });
  const previous = new Map(ledger.created.map((c) => [c.key, c.id]));
  let creates = 0;

  /* What the target organization already has, by key — read once, then
     kept up to date as this run creates. */
  const slugs = new Map<CollectionType, Map<string, string>>();
  for (const type of COLLECTION_TYPES) slugs.set(type, new Map((await client.list(type)).map((e) => [String(e.slug), e.id])));
  const initiallyEmpty = new Set(COLLECTION_TYPES.filter((t) => slugs.get(t)!.size === 0));
  /* Records the manifest keeps in the website's code (skipped): a reference
     to one names the website's own record while the CMS has none. */
  const keptInCode = new Map<string, ManifestRecord>();
  for (const r of manifest.records) if (ineligibility(r)) keptInCode.set(r.key, r);
  const mediaIds = new Map<string, string>();
  for (const m of ledger.media) mediaIds.set(m.key, m.id);
  const library = await client.media();

  const skip = (key: string, reason: string) => ledger.skipped.push({ key, reason });

  /* "@type:key" → the value the API takes, or a reason it cannot be had. */
  async function resolve(record: ManifestRecord): Promise<{ payload: Record<string, unknown> } | { problem: string }> {
    const refs: { path: (string | number)[]; ref: string }[] = [];
    const walk = (v: unknown, path: (string | number)[]) => {
      if (typeof v === "string" && /^@[a-z_]+:/.test(v)) refs.push({ path, ref: v });
      else if (Array.isArray(v)) v.forEach((x, i) => walk(x, [...path, i]));
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, [...path, k]);
    };
    walk(record.payload, []);
    const payload = structuredClone(record.payload);
    for (const { path, ref } of refs) {
      const [, type, key] = /^@([a-z_]+):(.+)$/.exec(ref)!;
      let to: string | undefined;
      let how: Ledger["resolved"][number]["how"] = "existing";
      if (type === "media") {
        to = mediaIds.get(key!);
        if (!to) {
          const entry = manifest.media.find((m) => m.key === key);
          if (!entry?.file || !entry.sha256 || !entry.bytes || !entry.mimeType) return { problem: `${path.join(".")}: media "${key}" has no file in the manifest` };
          const filename = entry.file.split("/").pop()!;
          const found = library.find((m) => m.originalFilename === filename && m.size === entry.bytes);
          if (found) to = found.id;
          else {
            const bytes = await readFile(entry.file);
            if (createHash("sha256").update(bytes).digest("hex") !== entry.sha256) return { problem: `${path.join(".")}: "${entry.file}" changed since the manifest was made — re-run the rehearsal` };
            to = (await client.upload({ key: key!, filename, bytes, mimeType: entry.mimeType, alt: entry.alt ?? "", ...(entry.focal && { focal: entry.focal }) })).id;
            ledger.media.push({ key: key!, id: to, run, storage: "test" });
            how = "created";
            await onProgress(ledger);
          }
          mediaIds.set(key!, to);
        }
      } else if (isCollection(type!)) {
        const id = slugs.get(type)!.get(key!);
        const kept = keptInCode.get(`${type}:${key}`);
        /* Programs and projects are named by slug, stories by id. */
        if (id) {
          to = type === "story" ? id : key!;
          how = [...ledger.created].some((c) => c.id === id) ? "created" : "existing";
        } else if (kept && initiallyEmpty.has(type)) {
          to = type === "story" ? (kept.sourceId ?? key!) : key!;
          how = "website";
        } else return { problem: `${path.join(".")}: ${ref} is neither in the CMS nor the website's own (kept in code) while the CMS has none` };
      } else return { problem: `${path.join(".")}: unknown reference ${ref}` };
      let node = payload as Record<string | number, unknown>;
      for (const p of path.slice(0, -1)) node = node[p] as Record<string | number, unknown>;
      node[path.at(-1)!] = to;
      ledger.resolved.push({ key: record.key, field: path.join("."), ref, to: to!, how });
    }
    return { payload };
  }

  for (const record of manifest.records) {
    const why = ineligibility(record);
    if (why) {
      skip(record.key, why);
      continue;
    }
    const type = record.type as WriterType;
    /* Already there — from an earlier run of this writer, or otherwise: never overwritten. */
    const existing = isCollection(type) ? await findCollection(client, type, record) : await client.page(type);
    if (existing) {
      /* Compared on the fields that hold no reference (ids differ by
         design) — and nothing is resolved or uploaded for it. */
      ledger.existing.push({ key: record.key, id: existing.id, createdByRehearsal: previous.get(record.key) === existing.id, differs: differences(record.payload, existing.record) });
      continue;
    }
    const resolved = await resolve(record);
    if ("problem" in resolved) {
      skip(record.key, `unresolved reference — ${resolved.problem}`);
      continue;
    }
    if (failAfter !== undefined && creates >= failAfter) throw new Error(`interrupted after ${creates} create(s) (test)`);
    /* Pages take their parts only; settings keep their schema version (the
       settings import sets the rest itself). */
    const created = await client.create(type, isPage(type) && type !== "settings" ? stripEnvelope(resolved.payload) : resolved.payload);
    creates++;
    const refs = ledger.resolved.filter((r) => r.key === record.key).map(({ field, ref, to, how }) => ({ field, ref, to, how }));
    ledger.created.push({ key: record.key, type, id: created.id, run, ...(refs.length && { resolved: refs }) });
    if (isCollection(type) && created.slug) slugs.get(type)!.set(created.slug, created.id);
    await onProgress(ledger);
  }
  ledger.complete = true;
  await onProgress(ledger);
  return ledger;
}

const stripEnvelope = (payload: Record<string, unknown>) => Object.fromEntries(Object.entries(payload).filter(([k]) => !ENVELOPE.has(k)));

async function findCollection(client: WriterClient, type: CollectionType, record: ManifestRecord): Promise<ExistingRecord | null> {
  const slug = record.payload.slug ?? record.key.slice(type.length + 1);
  return (await client.list(type)).find((e) => e.slug === slug) ?? null;
}
