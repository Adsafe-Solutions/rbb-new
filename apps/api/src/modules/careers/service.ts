import type { PublishLock } from "../publishing/lock.ts";
import type { Db } from "mongodb";
import { Careers } from "@rbb/content-schema";
import { COLLECTIONS } from "../../db/collections.ts";
import type { AuditService } from "../audit/audit.ts";
import type { MediaStore } from "../media/repository.ts";
import { MongoBlockPageStore, type BlockPageStore } from "../pages/repository.ts";
import { BlockPageService, type BlockPageConfig } from "../pages/service.ts";

/* Careers (M13) — ONE per organization: the Careers page
   (/about-us/careers; packages/content-schema Careers) — its header, the
   "Why work with us", "Open opportunities" (with the open roles, in
   order) and "How to apply" sections, the closing ask and SEO. A TYPED
   single page (modules/pages with named parts, as the Transparency
   record): lifecycle, revisions, audit as careers.created/updated/archived
   with part paths (`opportunities.roles`), owner-only publishing. No
   media and no references: the page has neither.

     GET    /api/v1/careers
     POST   /api/v1/careers   create (once)
     PATCH  /api/v1/careers   { revision, changes: { kicker?, title?, intro?,
                                why?, opportunities?, apply?, closing?, seo?,
                                status? } }
     DELETE /api/v1/careers   archive */

export const CAREERS_CONFLICT = "These Careers changes are out of date. Reload the latest version before saving.";

export const CAREERS_PAGE: BlockPageConfig<Careers> = {
  kind: "careers",
  label: "Careers page",
  contract: Careers,
  mediaIds: () => [],
  conflict: CAREERS_CONFLICT,
  parts: ["kicker", "title", "intro", "why", "opportunities", "apply", "closing", "seo"],
  initial: () => ({}),
};

export type CareersStore = BlockPageStore<Careers>;

export class MongoCareersStore extends MongoBlockPageStore<Careers> {
  constructor(db: Db, orgId: string) {
    super(db, COLLECTIONS.careersPages, orgId);
  }
}

export class CareersService extends BlockPageService<Careers> {
  constructor(store: CareersStore, media: MediaStore, audit: AuditService, options: { orgId: string; now?: () => Date; lock?: PublishLock }) {
    super(CAREERS_PAGE, store, media, audit, options);
  }
}
