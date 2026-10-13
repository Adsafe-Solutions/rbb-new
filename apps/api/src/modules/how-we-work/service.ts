import type { PublishLock } from "../publishing/lock.ts";
import type { Db } from "mongodb";
import { HowWeWork } from "@rbb/content-schema";
import { COLLECTIONS } from "../../db/collections.ts";
import type { AuditService } from "../audit/audit.ts";
import type { MediaStore } from "../media/repository.ts";
import { MongoBlockPageStore, type BlockPageStore } from "../pages/repository.ts";
import { BlockPageService, type BlockPageConfig } from "../pages/service.ts";

/* How We Work (#7) — ONE per organization: the How We Work page
   (/about/how-we-work; packages/content-schema HowWeWork) — its header,
   the "In practice" cards and the numbered passages. A TYPED single page
   (modules/pages with named parts, as Careers): lifecycle, revisions,
   audit as how_we_work.created/updated/archived with part paths, owner-only
   publishing. No media and no references: the page has neither.

     GET    /api/v1/how-we-work
     POST   /api/v1/how-we-work   create (once)
     PATCH  /api/v1/how-we-work   { revision, changes: { kicker?, heading?,
                                    body?, practices?, rows?, status? } }
     DELETE /api/v1/how-we-work   archive */

export const HOW_WE_WORK_CONFLICT = "These How We Work changes are out of date. Reload the latest version before saving.";

export const HOW_WE_WORK_PAGE: BlockPageConfig<HowWeWork> = {
  kind: "how_we_work",
  label: "How We Work page",
  contract: HowWeWork,
  mediaIds: () => [],
  conflict: HOW_WE_WORK_CONFLICT,
  parts: ["kicker", "heading", "body", "practices", "rows"],
  initial: () => ({}),
};

export type HowWeWorkStore = BlockPageStore<HowWeWork>;

export class MongoHowWeWorkStore extends MongoBlockPageStore<HowWeWork> {
  constructor(db: Db, orgId: string) {
    super(db, COLLECTIONS.howWeWorkPages, orgId);
  }
}

export class HowWeWorkService extends BlockPageService<HowWeWork> {
  constructor(store: HowWeWorkStore, media: MediaStore, audit: AuditService, options: { orgId: string; now?: () => Date; lock?: PublishLock }) {
    super(HOW_WE_WORK_PAGE, store, media, audit, options);
  }
}
