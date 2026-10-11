import { z } from "zod";
import { SiteSettings } from "@rbb/content-schema";
import { errors, type ErrorDetail } from "../../errors.ts";
import type { AuditService, RequestFacts } from "../audit/audit.ts";
import type { AuthContext } from "../auth/types.ts";
import type { MediaStore } from "../media/repository.ts";
import type { SettingsStore, StoredSettings } from "./repository.ts";

/* Site settings — the rules, in one place.

   · ONE record per organization, validated against the content contract
     (@rbb/content-schema SiteSettings) on every write: the API defines no
     settings schema of its own
   · the organization is the session's; the record's id, orgId,
     schemaVersion, status and timestamps are the API's, never the client's
   · a save names the revision it was based on; an older one conflicts
   · only the editable SECTIONS can be sent, and each is validated whole
     (strict — an unknown field is an error, never silently dropped)
   · media references (logo, favicon, share image) must name ready media of
     this organization
   · this is the WORKING copy: nothing here is public until an owner
     publishes (modules/publishing)

   The first record is created by the import command
   (scripts/settings-import.ts) from the website's current settings, so
   nothing is invented here. */

export const SETTINGS_ID = "site-settings";
export const SECTIONS = ["general", "contact", "social", "seo", "branding", "analytics", "donations", "engagement", "features"] as const;
export type Section = (typeof SECTIONS)[number];

export const CONFLICT_MESSAGE = "These settings were changed elsewhere. Reload the latest version before saving.";

const UpdateInput = z.strictObject({
  revision: z.int().positive(),
  changes: z.strictObject(Object.fromEntries(SECTIONS.map((s) => [s, z.unknown().optional()])) as Record<Section, z.ZodOptional<z.ZodUnknown>>),
});

const issuesOf = (error: z.ZodError, prefix: string[]): ErrorDetail[] =>
  error.issues.map((issue) => ({ path: [...prefix, ...issue.path.map(String)].join("."), message: issue.message }));

/* Every leaf path whose value differs — field NAMES for the audit trail,
   never the values. */
export function changedPaths(before: unknown, after: unknown, prefix = ""): string[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  const isObject = (v: unknown) => v !== null && typeof v === "object" && !Array.isArray(v);
  if (!isObject(before) || !isObject(after)) return [prefix];
  const keys = new Set([...Object.keys(before as object), ...Object.keys(after as object)]);
  return [...keys].sort().flatMap((key) => changedPaths((before as Record<string, unknown>)[key], (after as Record<string, unknown>)[key], prefix ? `${prefix}.${key}` : key));
}

export interface SettingsView {
  settings: SiteSettings;
  revision: number;
  updatedAt: string;
  updatedBy: { name: string; isYou: boolean };
}

export class SettingsService {
  readonly #store: SettingsStore;
  readonly #media: MediaStore;
  readonly #audit: AuditService;
  readonly #orgId: string;
  readonly #now: () => Date;

  constructor(store: SettingsStore, media: MediaStore, audit: AuditService, { orgId, now = () => new Date() }: { orgId: string; now?: () => Date }) {
    this.#store = store;
    this.#media = media;
    this.#audit = audit;
    this.#orgId = orgId;
    this.#now = now;
  }

  #member(auth: AuthContext) {
    if (auth.organization.id !== this.#orgId) throw errors.forbidden("You do not have permission to do this.");
    return auth;
  }

  #view(stored: StoredSettings, auth: AuthContext): SettingsView {
    return { settings: stored.record, revision: stored.revision, updatedAt: stored.updatedAt, updatedBy: { name: stored.updatedBy.name, isYou: stored.updatedBy.id === auth.user.id } };
  }

  /* null: no settings have been imported yet. */
  async get(auth: AuthContext): Promise<SettingsView | null> {
    this.#member(auth);
    const stored = await this.#store.get();
    return stored ? this.#view(stored, auth) : null;
  }

  async update(auth: AuthContext, input: unknown, facts: RequestFacts): Promise<SettingsView> {
    this.#member(auth);
    const parsed = UpdateInput.safeParse(input);
    if (!parsed.success) throw errors.validation(issuesOf(parsed.error, ["body"]));
    const { revision, changes } = parsed.data;
    const sections = (Object.keys(changes) as Section[]).filter((key) => changes[key] !== undefined);
    if (!sections.length) throw errors.validation([{ path: "body.changes", message: "must change at least one section" }]);

    const stored = await this.#store.get();
    if (!stored) throw errors.conflict("Site settings have not been set up yet.");
    if (stored.revision !== revision) throw errors.conflict(CONFLICT_MESSAGE);

    const now = this.#now().toISOString();
    const candidate = { ...stored.record, ...Object.fromEntries(sections.map((s) => [s, changes[s]])), updatedAt: now };
    const result = SiteSettings.safeParse(candidate);
    if (!result.success) throw errors.validation(issuesOf(result.error, ["body", "changes"]));
    const record = result.data;
    await this.#checkBusinessRules(record, sections);

    const fields = changedPaths(
      Object.fromEntries(sections.map((s) => [s, stored.record[s]])),
      Object.fromEntries(sections.map((s) => [s, record[s]]))
    );
    if (!fields.length) return this.#view(stored, auth);

    const saved = await this.#store.replace(record, revision, { id: auth.user.id, name: auth.user.name }, now);
    if (!saved) throw errors.conflict(CONFLICT_MESSAGE);
    await this.#audit.recordSafely(
      { action: "settings.updated", resourceType: "settings", resourceId: SETTINGS_ID, actorUserId: auth.user.id, metadata: { fields, revision: saved.revision } },
      facts
    );
    return this.#view(saved, auth);
  }

  /* Rules the contract cannot express on its own. Media references are
     checked in the sections being saved (publishing re-checks them all). */
  async #checkBusinessRules(record: SiteSettings, sections: Section[]) {
    const problems: ErrorDetail[] = [];
    const ids = record.contact.methods.map((m) => m.id);
    if (new Set(ids).size !== ids.length) problems.push({ path: "body.changes.contact.methods", message: "each contact method needs its own id" });
    const references: [string, string | undefined][] = [
      ...(sections.includes("branding") ? ([["body.changes.branding.logoId", record.branding.logoId], ["body.changes.branding.faviconId", record.branding.faviconId]] as [string, string | undefined][]) : []),
      ...(sections.includes("seo") ? ([["body.changes.seo.ogImageId", record.seo.ogImageId]] as [string, string | undefined][]) : []),
    ];
    for (const [path, id] of references) {
      if (!id) continue;
      // Org-scoped store: another organization's media is simply not found.
      const media = await this.#media.findById(id);
      if (!media || media.status !== "ready") problems.push({ path, message: "must be a ready image from this organization's media library" });
    }
    if (problems.length) throw errors.validation(problems);
  }

  /* The import command's way in: the FIRST record only. */
  async importInitial(record: unknown, by: { id: string | null; name: string }): Promise<{ created: boolean; problems: ErrorDetail[] }> {
    const now = this.#now().toISOString();
    const result = SiteSettings.safeParse({ ...(record as object), id: SETTINGS_ID, orgId: this.#orgId, status: "draft", createdAt: now, updatedAt: now });
    if (!result.success) return { created: false, problems: issuesOf(result.error, []) };
    const { releaseMarker: _internal, publishedAt: _published, ...clean } = result.data;
    const created = await this.#store.create({ record: clean as SiteSettings, revision: 1, updatedAt: now, updatedBy: by });
    if (created)
      await this.#audit.recordSafely({ action: "settings.imported", resourceType: "settings", resourceId: SETTINGS_ID, actorUserId: by.id, metadata: { source: "import" } }, { requestId: null, clientIp: null, userAgent: "settings-import" });
    return { created, problems: [] };
  }
}
