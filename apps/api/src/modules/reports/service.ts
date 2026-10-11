import type { PublishLock } from "../publishing/lock.ts";
import { z } from "zod";
import { Report } from "@rbb/content-schema";
import type { AuditService } from "../audit/audit.ts";
import type { ContentStore } from "../content/repository.ts";
import { OrderedContentService } from "../content/ordered.ts";
import type { CollectionConfig } from "../content/service.ts";
import type { MediaStore } from "../media/repository.ts";

/* Transparency documents (M11) — annual reports, financial statements and
   governance papers (the content contract's Report), an ORDERED content
   collection (content/ordered.ts), as the programs: drafts, published,
   archived; a unique key; audit as report.created, report.updated,
   report.archived and one report.reordered per reorder; owner-only
   publishing.

   The document itself is an https:// link (`fileUrl`): the media library
   holds images only, and there is no second file store. Editable:
   category, title, year, type, link. The order is the collection's own
   operation (POST /api/v1/reports/order); the admin moves a document
   within its category. */

const editable = Object.fromEntries(["category", "title", "slug", "year", "type", "fileUrl"].map((f) => [f, z.unknown()]));

export const REPORT_COLLECTION: CollectionConfig<Report> = {
  kind: "report",
  contract: Report,
  fields: editable,
  required: ["category", "title", "fileUrl"],
  defaults: () => ({ order: 0 }),
  rules: () => [],
  media: () => [],
  opaque: [],
};

export class ReportService extends OrderedContentService<Report> {
  constructor(store: ContentStore<Report>, media: MediaStore, audit: AuditService, options: { orgId: string; now?: () => Date; lock?: PublishLock }) {
    super(REPORT_COLLECTION, store, media, audit, { ...options, auditReorderOnce: true });
  }
}
