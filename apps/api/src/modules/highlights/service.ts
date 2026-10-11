import type { PublishLock } from "../publishing/lock.ts";
import type { Db } from "mongodb";
import { StoryStrip, storyStripApprovalProblems } from "@rbb/content-schema";
import { COLLECTIONS } from "../../db/collections.ts";
import type { ErrorDetail } from "../../errors.ts";
import type { AuditService } from "../audit/audit.ts";
import type { ContentRecordBase, ContentStore } from "../content/repository.ts";
import { isLive } from "../content/shared.ts";
import { publicReady } from "../content/workflow.ts";
import type { MediaStore } from "../media/repository.ts";
import { MongoBlockPageStore, type BlockPageStore } from "../pages/repository.ts";
import { BlockPageService, type BlockPageConfig } from "../pages/service.ts";

/* Highlights — the story strip over the navbar (M23): ONE record per
   organization naming, in order, the appeals whose circles the website
   shows (packages/content-schema StoryStrip). A TYPED single page
   (modules/pages, as the announcement bar): lifecycle, revisions, 409 on a
   stale revision, owner-only approval and publishing, scheduling, the
   publish lock; audit as story_strip.created/updated/archived with the
   part name (`appealIds`).

   Each circle's label and photograph are the appeal's own
   (Appeal.highlight, edited with the appeal). An appeal named here must be
   one of this organization's, not archived — and, from the strip's
   submission for review, approved, published or live in an earlier
   version (the website publish checks again: it must be published in the
   same snapshot). Whether the strip shows is a site setting
   (engagement.storyStrip).

     GET    /api/v1/story-strip
     POST   /api/v1/story-strip   create (once)
     PATCH  /api/v1/story-strip   { revision, changes: { appealIds?, status? } }
     DELETE /api/v1/story-strip   archive
     POST   /api/v1/story-strip/submit | withdraw | approve | reject | schedule | unschedule */

export const STORY_STRIP_CONFLICT = "Highlights were changed elsewhere since you opened them. Reload the latest version before saving.";
const SUBMITTED = new Set(["submitted", "approved", "published"]);

export const storyStripPage = (appeals: Pick<ContentStore<ContentRecordBase>, "findManyStored">): BlockPageConfig<StoryStrip> => ({
  kind: "story_strip",
  recordId: "story-strip",
  label: "Highlights",
  contract: StoryStrip,
  mediaIds: () => [],
  conflict: STORY_STRIP_CONFLICT,
  parts: ["appealIds"],
  initial: () => ({ appealIds: [] }),
  check: async (record, at): Promise<ErrorDetail[]> => {
    // Archiving is never refused: an appeal leaving the website must not trap the strip.
    if (record.status === "archived") return [];
    const problems: ErrorDetail[] = [];
    if (record.status === "approved" || record.status === "published") problems.push(...storyStripApprovalProblems(record).map((p) => ({ path: `${at}.${p.path}`, message: p.message })));
    const found = new Map((await appeals.findManyStored(record.appealIds)).map((r) => [r.record.id, r]));
    record.appealIds.forEach((id, i) => {
      const r = found.get(id);
      const path = `${at}.appealIds.${i}`;
      if (!r) problems.push({ path, message: `refers to appeal "${id}", which does not exist in this organization` });
      else if (r.record.status === "archived") problems.push({ path, message: `refers to an appeal that is archived` });
      else if (SUBMITTED.has(record.status) && !publicReady(r.record.status, isLive(r))) problems.push({ path, message: "refers to an appeal that is not approved yet — approve it first" });
    });
    return problems;
  },
});

export type StoryStripStore = BlockPageStore<StoryStrip>;

export class MongoStoryStripStore extends MongoBlockPageStore<StoryStrip> {
  constructor(db: Db, orgId: string) {
    super(db, COLLECTIONS.storyStrips, orgId);
  }
}

export class StoryStripService extends BlockPageService<StoryStrip> {
  constructor(store: StoryStripStore, appeals: Pick<ContentStore<ContentRecordBase>, "findManyStored">, media: MediaStore, audit: AuditService, options: { orgId: string; now?: () => Date; lock?: PublishLock }) {
    super(storyStripPage(appeals), store, media, audit, options);
  }
}
