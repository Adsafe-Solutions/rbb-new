import type { PublishLock } from "../publishing/lock.ts";
import type { Db } from "mongodb";
import { GET_INVOLVED_PAGE_IDS, GET_INVOLVED_ROUTES, GetInvolvedHub, GetInvolvedPath, getInvolvedApprovalProblems, type GetInvolvedPage, type GetInvolvedPageId } from "@rbb/content-schema";
import { COLLECTIONS } from "../../db/collections.ts";
import type { ErrorDetail } from "../../errors.ts";
import type { AuditService } from "../audit/audit.ts";
import type { AuthContext } from "../auth/types.ts";
import { member } from "../content/shared.ts";
import type { MediaStore } from "../media/repository.ts";
import { MongoBlockPageStore, type BlockPageStore } from "../pages/repository.ts";
import { BlockPageService, type BlockPageConfig, type BlockPageView } from "../pages/service.ts";

/* Get Involved (M20) — five fixed pages per organization, each a TYPED
   single page (modules/pages with named parts, as Careers and the
   policies) keyed by its id (packages/content-schema getInvolved):

     hub          /get-involved              GetInvolvedHub
     volunteer    /get-involved/volunteer    GetInvolvedPath
     fellowship   /get-involved/fellowship   GetInvolvedPath
     partner      /get-involved/partner      GetInvolvedPath
     fundraise    /get-involved/fundraise    GetInvolvedPath (2026-10-17)
     travel       /get-involved/travel       GetInvolvedPath

   Lifecycle, revisions, 409 on a stale revision, owner-only approval and
   publishing, scheduling, the publish lock — all the page service's. The
   audit is get_involved.created/updated/archived with the page id as
   resourceId and the changed PART names (`sections`, `closing.primary`) —
   never the wording.

   ⚠ A new page starts EMPTY: nothing is seeded, and the website keeps its
   own words for a page until one is published here. A path's identity —
   title, button label, route, icon, images, form, `featured` — is the
   website's and is not part of the record.

     GET    /api/v1/get-involved           the five, with their state
     GET    /api/v1/get-involved/<id>      one ({ record: null } before it exists)
     POST   /api/v1/get-involved/<id>      create (once)
     PATCH  /api/v1/get-involved/<id>      { revision, changes } — revision 0
                                           creates; null clears an optional part
     DELETE /api/v1/get-involved/<id>      archive
     POST   /api/v1/get-involved/<id>/submit | withdraw | approve | reject |
                                     schedule | unschedule */

export const GET_INVOLVED_CONFLICT = "This page was changed elsewhere since you opened it. Reload the latest version before saving.";

/* How messages and the review queue name each page — the site's own
   names, not editable. */
export const GET_INVOLVED_LABELS: Record<GetInvolvedPageId, string> = {
  hub: "Get Involved page",
  volunteer: "Volunteer page",
  fellowship: "Fellowship page",
  partner: "Partner With Us page",
  fundraise: "Fundraise With Us page",
  travel: "Travel With Us page",
};

const HUB_PARTS = ["heading", "intro", "ways", "choose", "why", "closing"] as const;
const PATH_PARTS = ["shortDescription", "hubNote", "sections", "faq", "seo"] as const;

export const getInvolvedPage = (id: GetInvolvedPageId): BlockPageConfig<GetInvolvedPage> => ({
  kind: "get_involved",
  recordId: id,
  label: GET_INVOLVED_LABELS[id],
  contract: (id === "hub" ? GetInvolvedHub : GetInvolvedPath) as never,
  mediaIds: () => [],
  conflict: GET_INVOLVED_CONFLICT,
  parts: id === "hub" ? HUB_PARTS : PATH_PARTS,
  initial: () => (id === "hub" ? {} : { sections: [] }),
  check: async (record, at): Promise<ErrorDetail[]> =>
    record.status === "approved" || record.status === "published" ? getInvolvedApprovalProblems(record).map((p) => ({ path: `${at}.${p.path}`, message: p.message })) : [],
});

export type GetInvolvedStore = BlockPageStore<GetInvolvedPage>;

export class MongoGetInvolvedStore extends MongoBlockPageStore<GetInvolvedPage> {
  constructor(db: Db, orgId: string, id: GetInvolvedPageId) {
    super(db, COLLECTIONS.getInvolvedPages, orgId, { field: "pageId", value: id });
  }
}

export class GetInvolvedService extends BlockPageService<GetInvolvedPage> {
  constructor(id: GetInvolvedPageId, store: GetInvolvedStore, media: MediaStore, audit: AuditService, options: { orgId: string; now?: () => Date; lock?: PublishLock }) {
    super(getInvolvedPage(id), store, media, audit, options);
  }
}

export interface GetInvolvedSummary {
  id: GetInvolvedPageId;
  route: string;
  label: string;
  view: BlockPageView<GetInvolvedPage>;
}

/* The five pages at once, for the admin's list. */
export class GetInvolvedDirectory {
  readonly #services: Record<GetInvolvedPageId, GetInvolvedService>;
  readonly #orgId: string;

  constructor(services: Record<GetInvolvedPageId, GetInvolvedService>, orgId: string) {
    this.#services = services;
    this.#orgId = orgId;
  }

  async list(auth: AuthContext): Promise<{ pages: GetInvolvedSummary[] }> {
    member(auth, this.#orgId);
    return { pages: await Promise.all(GET_INVOLVED_PAGE_IDS.map(async (id) => ({ id, route: GET_INVOLVED_ROUTES[id], label: GET_INVOLVED_LABELS[id], view: await this.#services[id].get(auth) }))) };
  }
}
