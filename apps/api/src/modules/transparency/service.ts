import type { PublishLock } from "../publishing/lock.ts";
import type { Db } from "mongodb";
import { Transparency } from "@rbb/content-schema";
import { COLLECTIONS } from "../../db/collections.ts";
import type { AuditService } from "../audit/audit.ts";
import type { MediaStore } from "../media/repository.ts";
import { MongoBlockPageStore, type BlockPageStore } from "../pages/repository.ts";
import { BlockPageService, type BlockPageConfig } from "../pages/service.ts";

/* Transparency (M11) — ONE per organization: the Transparency chapter of
   the About page (packages/content-schema Transparency): its words, the
   financial overview, governance and "How we report". A TYPED single page
   (modules/pages with named parts, not blocks): lifecycle, revisions,
   audit as transparency.created/updated/archived with part paths
   (`financialOverview.items`), owner-only publishing. No media; its
   documents are Report records (modules/reports).

     GET    /api/v1/transparency
     POST   /api/v1/transparency   create (once)
     PATCH  /api/v1/transparency   { revision, changes: { kicker?, heading?,
                                     intro?, financialOverview?, governance?,
                                     accountability?, status? } }
     DELETE /api/v1/transparency   archive */

export const TRANSPARENCY_CONFLICT = "These transparency changes are out of date. Reload the latest version before saving.";

export const TRANSPARENCY_PAGE: BlockPageConfig<Transparency> = {
  kind: "transparency",
  label: "Transparency record",
  contract: Transparency,
  mediaIds: () => [],
  conflict: TRANSPARENCY_CONFLICT,
  parts: ["kicker", "heading", "intro", "financialOverview", "governance", "accountability"],
  initial: () => ({}),
};

export type TransparencyStore = BlockPageStore<Transparency>;

export class MongoTransparencyStore extends MongoBlockPageStore<Transparency> {
  constructor(db: Db, orgId: string) {
    super(db, COLLECTIONS.transparencyPages, orgId);
  }
}

export class TransparencyService extends BlockPageService<Transparency> {
  constructor(store: TransparencyStore, media: MediaStore, audit: AuditService, options: { orgId: string; now?: () => Date; lock?: PublishLock }) {
    super(TRANSPARENCY_PAGE, store, media, audit, options);
  }
}
