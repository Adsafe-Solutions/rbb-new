import type { PublishLock } from "../publishing/lock.ts";
import type { Db } from "mongodb";
import { POPUP_RECORD_ID, Popup, popupCmsProblems } from "@rbb/content-schema";
import { COLLECTIONS } from "../../db/collections.ts";
import type { ErrorDetail } from "../../errors.ts";
import type { AuditService } from "../audit/audit.ts";
import type { MediaStore } from "../media/repository.ts";
import { MongoBlockPageStore, type BlockPageStore } from "../pages/repository.ts";
import { BlockPageService, type BlockPageConfig } from "../pages/service.ts";

/* The site popup (M22) — ONE per organization (packages/content-schema
   Popup, with the website's rules: popupCmsProblems). A TYPED single page
   (modules/pages with named parts, as Careers and the announcement bar):
   lifecycle, revisions, 409 on a stale revision, owner-only approval and
   publishing, scheduling, the publish lock; audit as popup.created/
   updated/archived with the part names — never the wording. Its
   photograph is a ready media-library image of this organization
   (checked on every save) and must be described (its alt text) once the
   popup is submitted for review.

   Whether the popup shows at all is a site setting (engagement.popup),
   not this record.

     GET    /api/v1/popup
     POST   /api/v1/popup   create (once)
     PATCH  /api/v1/popup   { revision, changes } (revision 0 creates)
     DELETE /api/v1/popup   archive
     POST   /api/v1/popup/submit | withdraw | approve | reject | schedule | unschedule */

export const POPUP_CONFLICT = "The popup was changed elsewhere since you opened it. Reload the latest version before saving.";
const PARTS = ["key", "kicker", "heading", "highlight", "body", "imageId", "cta", "dismissLabel", "delayMs", "frequency", "excludePaths"] as const;
const SUBMITTED = new Set(["submitted", "approved", "published"]);

export const popupPage = (media: MediaStore): BlockPageConfig<Popup> => ({
  kind: "popup",
  recordId: POPUP_RECORD_ID,
  label: "Popup",
  contract: Popup,
  mediaIds: (p) => [p.imageId],
  conflict: POPUP_CONFLICT,
  parts: PARTS,
  initial: () => ({}),
  check: async (record, at): Promise<ErrorDetail[]> => {
    const problems: ErrorDetail[] = popupCmsProblems(record).map((p) => ({ path: `${at}.${p.path}`, message: p.message }));
    if (SUBMITTED.has(record.status)) {
      const [image] = await media.findMany([record.imageId]);
      if (image && !image.alt.trim()) problems.push({ path: `${at}.imageId`, message: "the photograph has no alt text — describe it in the media library first" });
    }
    return problems;
  },
});

export type PopupStore = BlockPageStore<Popup>;

export class MongoPopupStore extends MongoBlockPageStore<Popup> {
  constructor(db: Db, orgId: string) {
    super(db, COLLECTIONS.popups, orgId);
  }
}

export class PopupService extends BlockPageService<Popup> {
  constructor(store: PopupStore, media: MediaStore, audit: AuditService, options: { orgId: string; now?: () => Date; lock?: PublishLock }) {
    super(popupPage(media), store, media, audit, options);
  }
}
