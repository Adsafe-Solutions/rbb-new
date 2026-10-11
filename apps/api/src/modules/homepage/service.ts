import type { PublishLock } from "../publishing/lock.ts";
import { HOMEPAGE_BLOCKS, Homepage, homepageMediaIds, homepageReferences } from "@rbb/content-schema";
import type { ErrorDetail } from "../../errors.ts";
import type { AuditService } from "../audit/audit.ts";
import type { ContentRecordBase, ContentStore } from "../content/repository.ts";
import { isLive } from "../content/shared.ts";
import { isApproval, publicReady } from "../content/workflow.ts";
import type { MediaStore } from "../media/repository.ts";
import { BlockPageService, blockPageChanges, type BlockPageConfig, type BlockPageView } from "../pages/service.ts";
import type { HomepageStore } from "./repository.ts";

/* The homepage — ONE per organization: an ordered list of blocks
   (packages/content-schema Homepage, registry HOMEPAGE_BLOCKS), as a
   block page (modules/pages: lifecycle, revisions, media, audit,
   owner-only publishing).

   Its own rule: every post, event and appeal an ENABLED block points at
   must exist in this organization — and, when an owner approves the
   homepage (M14), be approved or live (the website publish checks
   again). */

export const HOMEPAGE_ID = "homepage";
export const HOMEPAGE_CONFLICT = "These homepage changes are out of date. Reload the latest version before saving.";
export const homepageChanges = blockPageChanges;
export type HomepageView = BlockPageView<Homepage>;

type Referenced = { record: Pick<ContentRecordBase, "id" | "status">; publishedRevision?: number | null };
export interface HomepageReferences {
  posts: Pick<ContentStore<ContentRecordBase>, "findManyStored">;
  events: Pick<ContentStore<ContentRecordBase>, "findManyStored">;
  appeals: Pick<ContentStore<ContentRecordBase>, "findManyStored">;
}

export const homepagePage = (refs: HomepageReferences): BlockPageConfig<Homepage> => ({
  kind: HOMEPAGE_ID,
  label: "homepage",
  contract: Homepage,
  mediaIds: homepageMediaIds,
  conflict: HOMEPAGE_CONFLICT,
  async check(record, at) {
    const enabled = record.sections.filter((s) => s.enabled);
    const ids = homepageReferences(enabled);
    const [posts, events, appeals] = await Promise.all([refs.posts.findManyStored(ids.posts), refs.events.findManyStored(ids.events), refs.appeals.findManyStored(ids.appeals)]);
    const found = { posts: new Map(posts.map((r) => [r.record.id, r])), events: new Map(events.map((r) => [r.record.id, r])), appeals: new Map(appeals.map((r) => [r.record.id, r])) } as Record<"posts" | "events" | "appeals", Map<string, Referenced>>;
    const field = { posts: "postIds", events: "eventIds", appeals: "appealIds" } as const;
    const noun = { posts: "a post", events: "an event", appeals: "an appeal" } as const;
    const problems: ErrorDetail[] = [];
    record.sections.forEach((section, i) => {
      if (!section.enabled) return;
      const kind = HOMEPAGE_BLOCKS.find((b) => b.type === section.type)?.references;
      if (!kind) return;
      const list = ((section.data as Record<string, unknown>)[field[kind]] as string[] | undefined) ?? [];
      for (const id of list) {
        const r = found[kind].get(id);
        const path = `${at}.sections.${i}.data.${field[kind]}`;
        if (!r) problems.push({ path, message: `refers to ${noun[kind]} that does not exist in this organization` });
        else if (isApproval(record.status) && !publicReady(r.record.status, isLive(r))) problems.push({ path, message: `refers to ${noun[kind]} that is ${r.record.status}, not approved` });
      }
    });
    return problems;
  },
});

export class HomepageService extends BlockPageService<Homepage> {
  constructor(store: HomepageStore, media: MediaStore, refs: HomepageReferences, audit: AuditService, options: { orgId: string; now?: () => Date; lock?: PublishLock }) {
    super(homepagePage(refs), store, media, audit, options);
  }
}
