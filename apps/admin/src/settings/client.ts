import type { SiteSettings } from "@rbb/content-schema";
import { api } from "../api";

/* Site settings and publishing — the admin's calls. The settings SHAPE is
   the content contract's (type-only import: no schema code reaches the
   browser); the API validates every save against it. */

export type { SiteSettings };
export type SectionKey = "general" | "contact" | "social" | "seo" | "branding" | "analytics" | "donations" | "engagement" | "features";

export interface SettingsView {
  settings: SiteSettings;
  revision: number;
  updatedAt: string;
  updatedBy: { name: string; isYou: boolean };
}

export interface PublishStatus {
  active: { version: number; publishedAt: string; publishedBy: string; deployment: { status: "pending" | "triggered" | "not-configured" | "failed"; attempts: number } | null } | null;
  hasUnpublishedChanges: boolean;
  changedSections: string[];
  settingsReady: boolean;
  canPublish: boolean;
  deployment: { configured: boolean };
  /* M14: approved revisions the next publish takes, revisions waiting
     for review (not taken), and what would stop the publish. */
  review: { approved: ReviewItem[]; scheduled: ScheduledItem[]; submitted: ReviewItem[]; totals: { approved: number; scheduled: number; submitted: number } };
  blockers: string[];
  /* Names what this status shows; sent back with the publish, which is
     refused (409) if what would be published changed since. */
  changesKey: string | null;
}

export interface ReviewItem {
  section: string;
  title: string;
}

/* M15: approved, queued for a later publication (or failed). */
export interface ScheduledItem extends ReviewItem {
  at: string;
  timeZone: string;
  failed: boolean;
}

export interface PublishResult {
  version: number;
  generatedAt: string;
  deployment: { status: "triggered" | "not-configured" | "failed"; reason?: string };
}

export const settingsApi = {
  get: () => api<SettingsView | null>("/api/v1/settings"),
  update: (revision: number, changes: Partial<Pick<SiteSettings, SectionKey>>) =>
    api<SettingsView>("/api/v1/settings", { method: "PATCH", body: JSON.stringify({ revision, changes }) }),
};

export const publishApi = {
  status: () => api<PublishStatus>("/api/v1/publish/status"),
  publish: (changesKey?: string | null) => api<PublishResult>("/api/v1/publish", { method: "POST", ...(changesKey && { body: JSON.stringify({ changesKey }) }) }),
};
