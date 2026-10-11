import type { PublishLock } from "../publishing/lock.ts";
import { z } from "zod";
import { Program } from "@rbb/content-schema";
import type { AuditService } from "../audit/audit.ts";
import type { ContentStore } from "../content/repository.ts";
import { OrderedContentService } from "../content/ordered.ts";
import type { CollectionConfig } from "../content/service.ts";
import type { MediaStore } from "../media/repository.ts";

/* Programs (M10) — the organization's areas of work (the content
   contract's Program), an ORDERED content collection (content/ordered.ts):
   drafts, published, archived; unique addresses (the program page,
   /work/<slug>, which other records name); confirmed address changes;
   media from the library (the share image); audit as program.created,
   program.updated, program.archived and, for the order, program.reordered;
   owner-only publishing.

   Editable: title, address, icon, description, the missing-content note,
   why, activities, impact, stories, SEO. The order is the collection's
   own operation (POST /api/v1/programs/order). */

const editable = Object.fromEntries(["title", "slug", "icon", "description", "missingNote", "why", "activities", "impact", "stories", "seo"].map((f) => [f, z.unknown()]));

export const PROGRAM_COLLECTION: CollectionConfig<Program> = {
  kind: "program",
  contract: Program,
  fields: editable,
  required: ["title", "icon", "description"],
  defaults: () => ({ order: 0 }),
  rules: () => [],
  media: (p) => [["body.seo.ogImageId", p.seo?.ogImageId]],
  opaque: ["why", "activities", "impact", "stories"],
};

export class ProgramService extends OrderedContentService<Program> {
  constructor(store: ContentStore<Program>, media: MediaStore, audit: AuditService, options: { orgId: string; now?: () => Date; lock?: PublishLock }) {
    super(PROGRAM_COLLECTION, store, media, audit, { ...options, auditReorderOnce: true });
  }
}
