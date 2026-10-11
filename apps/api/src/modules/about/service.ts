import type { PublishLock } from "../publishing/lock.ts";
import type { Db } from "mongodb";
import { About, aboutMediaIds } from "@rbb/content-schema";
import { COLLECTIONS } from "../../db/collections.ts";
import type { AuditService } from "../audit/audit.ts";
import type { MediaStore } from "../media/repository.ts";
import { MongoBlockPageStore, type BlockPageStore } from "../pages/repository.ts";
import { BlockPageService, type BlockPageConfig } from "../pages/service.ts";

/* The About page — ONE per organization: an ordered list of the page's
   chapters as blocks (packages/content-schema About, registry
   ABOUT_BLOCKS), as a block page (modules/pages: lifecycle, revisions,
   media, audit as about.created/updated/archived, owner-only publishing).
   No checks beyond those: its blocks reference no other records. */

export const ABOUT_CONFLICT = "These About page changes are out of date. Reload the latest version before saving.";

export const ABOUT_PAGE: BlockPageConfig<About> = {
  kind: "about",
  label: "About page",
  contract: About,
  mediaIds: aboutMediaIds,
  conflict: ABOUT_CONFLICT,
};

export type AboutStore = BlockPageStore<About>;

export class MongoAboutStore extends MongoBlockPageStore<About> {
  constructor(db: Db, orgId: string) {
    super(db, COLLECTIONS.aboutPages, orgId);
  }
}

export class AboutService extends BlockPageService<About> {
  constructor(store: AboutStore, media: MediaStore, audit: AuditService, options: { orgId: string; now?: () => Date; lock?: PublishLock }) {
    super(ABOUT_PAGE, store, media, audit, options);
  }
}
