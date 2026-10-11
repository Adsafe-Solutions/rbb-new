import type { PublishLock } from "../publishing/lock.ts";
import type { Db } from "mongodb";
import { Impact, impactMediaIds, impactReferences } from "@rbb/content-schema";
import { COLLECTIONS } from "../../db/collections.ts";
import type { AuditService } from "../audit/audit.ts";
import { referenceProblems, type ReferenceTarget } from "../content/shared.ts";
import { isApproval } from "../content/workflow.ts";
import type { MediaStore } from "../media/repository.ts";
import { MongoBlockPageStore, type BlockPageStore } from "../pages/repository.ts";
import { BlockPageService, type BlockPageConfig } from "../pages/service.ts";

/* The Impact page (M11) — ONE per organization: an ordered list of
   /impact's chapters as blocks (packages/content-schema Impact, registry
   IMPACT_BLOCKS), as a block page (modules/pages: lifecycle, revisions,
   media, audit as impact.created/updated/archived, owner-only
   publishing).

   Its figures and programs are named by key, its stories by id — never
   restated. Whether figures are published is the website publish's check
   (the snapshot contract): a page may be saved naming a figure that is
   still a draft. Its stories and programs (M12) are checked at save too,
   for its ENABLED blocks (content/shared.ts referenceProblems): this
   organization's, not archived, and published when the page is saved as
   published — the website publish checks again. */

export const IMPACT_CONFLICT = "These Impact page changes are out of date. Reload the latest version before saving.";

export const IMPACT_PAGE: BlockPageConfig<Impact> = {
  kind: "impact",
  label: "Impact page",
  contract: Impact,
  mediaIds: impactMediaIds,
  conflict: IMPACT_CONFLICT,
};

export interface ImpactReferences {
  stories: ReferenceTarget;
  programs: ReferenceTarget;
}

export const impactPage = (refs: ImpactReferences): BlockPageConfig<Impact> => ({
  ...IMPACT_PAGE,
  async check(record, at) {
    // Archiving is never blocked by what the page names.
    if (record.status === "archived") return [];
    const enabled = record.sections.filter((s) => s.enabled);
    const named = impactReferences(enabled);
    const publishing = isApproval(record.status);
    return [
      ...(await referenceProblems(refs.stories, named.stories, { path: `${at}.sections.stories.storyIds`, noun: "story", by: "id", publishing })),
      ...(await referenceProblems(refs.programs, named.programs, { path: `${at}.sections.programImpact.items`, noun: "program", by: "slug", publishing })),
    ];
  },
});

export type ImpactStore = BlockPageStore<Impact>;

export class MongoImpactStore extends MongoBlockPageStore<Impact> {
  constructor(db: Db, orgId: string) {
    super(db, COLLECTIONS.impactPages, orgId);
  }
}

export class ImpactService extends BlockPageService<Impact> {
  constructor(store: ImpactStore, media: MediaStore, refs: ImpactReferences, audit: AuditService, options: { orgId: string; now?: () => Date; lock?: PublishLock }) {
    super(impactPage(refs), store, media, audit, options);
  }
}
