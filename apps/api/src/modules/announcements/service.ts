import type { PublishLock } from "../publishing/lock.ts";
import type { Db } from "mongodb";
import { AnnouncementBar, announcementBarApprovalProblems } from "@rbb/content-schema";
import { COLLECTIONS } from "../../db/collections.ts";
import type { AuditService } from "../audit/audit.ts";
import type { MediaStore } from "../media/repository.ts";
import { MongoBlockPageStore, type BlockPageStore } from "../pages/repository.ts";
import { BlockPageService, type BlockPageConfig } from "../pages/service.ts";

/* The announcement bar (M21) — ONE per organization: the messages that
   rotate in the bar over the website's header, in order
   (packages/content-schema AnnouncementBar). A TYPED single page
   (modules/pages with one named part, as Careers): lifecycle, revisions,
   409 on a stale revision, owner-only approval and publishing,
   scheduling, the publish lock; audit as announcement_bar.created/
   updated/archived with the part name (`items`) — never the wording.

   Whether the bar shows, and how long each message stays, are site
   settings (engagement.announcementBar), not this record.

     GET    /api/v1/announcement-bar
     POST   /api/v1/announcement-bar   create (once)
     PATCH  /api/v1/announcement-bar   { revision, changes: { items?, status? } }
                                       (revision 0 creates)
     DELETE /api/v1/announcement-bar   archive
     POST   /api/v1/announcement-bar/submit | withdraw | approve | reject |
                                     schedule | unschedule */

export const ANNOUNCEMENT_BAR_CONFLICT = "The announcement bar was changed elsewhere since you opened it. Reload the latest version before saving.";

export const ANNOUNCEMENT_BAR: BlockPageConfig<AnnouncementBar> = {
  kind: "announcement_bar",
  recordId: "announcement-bar",
  label: "Announcement bar",
  contract: AnnouncementBar,
  mediaIds: () => [],
  conflict: ANNOUNCEMENT_BAR_CONFLICT,
  parts: ["items"],
  initial: () => ({ items: [] }),
  check: async (record, at) =>
    record.status === "approved" || record.status === "published" ? announcementBarApprovalProblems(record).map((p) => ({ path: `${at}.${p.path}`, message: p.message })) : [],
};

export type AnnouncementBarStore = BlockPageStore<AnnouncementBar>;

export class MongoAnnouncementBarStore extends MongoBlockPageStore<AnnouncementBar> {
  constructor(db: Db, orgId: string) {
    super(db, COLLECTIONS.announcementBars, orgId);
  }
}

export class AnnouncementBarService extends BlockPageService<AnnouncementBar> {
  constructor(store: AnnouncementBarStore, media: MediaStore, audit: AuditService, options: { orgId: string; now?: () => Date; lock?: PublishLock }) {
    super(ANNOUNCEMENT_BAR, store, media, audit, options);
  }
}
