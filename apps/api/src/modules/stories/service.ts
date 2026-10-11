import type { PublishLock } from "../publishing/lock.ts";
import { z } from "zod";
import { Post, STORY_CATEGORY_IDS } from "@rbb/content-schema";
import type { AuditService } from "../audit/audit.ts";
import type { ContentStore } from "../content/repository.ts";
import { ContentService, type CollectionConfig } from "../content/service.ts";
import { referenceProblems, undescribed, type ReferenceTarget } from "../content/shared.ts";
import type { MediaStore } from "../media/repository.ts";
import { isApproval, isSubmission } from "../content/workflow.ts";

/* Stories (M12) — the content contract's Post of type "story", in the
   posts collection beside news and blog posts (one article model, as M1
   defined it), as their own content module: a store scoped to stories,
   routes at /api/v1/stories, audit as story.created/updated/archived.
   Drafts, published, archived; unique addresses (/stories/<slug>, unique
   across all posts); confirmed address changes; owner-only publishing.

   Editable: title, address, excerpt, date, author, category (one of the
   four story types), image, body (structured rich text — never HTML),
   program, project, location, featured, gallery, related stories, SEO;
   and (Milestone 5) quotes — { text, attribution }, up to six — and
   impact — plain lines, up to twelve (the contract's StoryQuotes and
   StoryImpact). Both are public as written; `null` clears either. News
   and blog posts have neither (/api/v1/posts refuses them as unknown).

   Its references are checked at save (content/shared.ts
   referenceProblems): the program and project by slug, related stories by
   id — this organization's, not archived, and published when the story is
   saved as published. A published story's images are described. Stories
   are ordered by date (newest first), then as they were added: no manual
   order. */

const editable = Object.fromEntries(
  ["title", "slug", "excerpt", "date", "author", "category", "imageId", "body", "programId", "projectId", "location", "featured", "galleryIds", "relatedPostIds", "quotes", "impact", "seo"].map((f) => [f, z.unknown()])
);

export interface StoryReferences {
  programs: ReferenceTarget;
  projects: ReferenceTarget;
  stories: ReferenceTarget;
}

export const STORY_COLLECTION: CollectionConfig<Post & { title: string }> = {
  kind: "story",
  contract: Post as z.ZodType<Post & { title: string }>,
  fields: editable,
  required: ["title", "category", "body"],
  defaults: () => ({ type: "story" }),
  rules: (s) => [
    ...(s.type !== "story" ? [{ path: "body.type", message: 'must be "story"' }] : []),
    ...(!s.category || !(STORY_CATEGORY_IDS as readonly string[]).includes(s.category) ? [{ path: "body.category", message: `must be one of ${STORY_CATEGORY_IDS.join(", ")}` }] : []),
    ...((s.relatedPostIds ?? []).includes(s.id) ? [{ path: "body.relatedPostIds", message: "names the story itself" }] : []),
  ],
  media: (s) => [["body.imageId", s.imageId], ...(s.galleryIds ?? []).map((id, i) => [`body.galleryIds.${i}`, id] as [string, string]), ["body.seo.ogImageId", s.seo?.ogImageId]],
  opaque: ["body"],
};

export const storyCollection = (media: MediaStore, refs: StoryReferences): CollectionConfig<Post & { title: string }> => ({
  ...STORY_COLLECTION,
  async check(s) {
    // Archiving is never blocked by what a story names: an archived story is never public.
    if (s.status === "archived") return [];
    // M14: images described from submission; references public-ready at approval.
    const submitting = isSubmission(s.status);
    const publishing = isApproval(s.status);
    return [
      ...(await undescribed(media, [["body.imageId", s.imageId], ...(s.galleryIds ?? []).map((id, i) => [`body.galleryIds.${i}`, id] as [string, string])], submitting)),
      ...(await referenceProblems(refs.programs, s.programId ? [s.programId] : [], { path: "body.programId", noun: "program", by: "slug", publishing })),
      ...(await referenceProblems(refs.projects, s.projectId ? [s.projectId] : [], { path: "body.projectId", noun: "project", by: "slug", publishing })),
      ...(await referenceProblems(refs.stories, s.relatedPostIds ?? [], { path: "body.relatedPostIds", noun: "story", by: "id", publishing })),
    ];
  },
});

export class StoryService extends ContentService<Post & { title: string }> {
  constructor(store: ContentStore<Post & { title: string }>, media: MediaStore, refs: Omit<StoryReferences, "stories">, audit: AuditService, options: { orgId: string; now?: () => Date; lock?: PublishLock }) {
    super(storyCollection(media, { ...refs, stories: store }), store, media, audit, options);
  }
}
