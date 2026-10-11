import type { PublishLock } from "../publishing/lock.ts";
import { z } from "zod";
import { Project } from "@rbb/content-schema";
import type { AuditService } from "../audit/audit.ts";
import type { ContentStore } from "../content/repository.ts";
import { OrderedContentService } from "../content/ordered.ts";
import type { CollectionConfig } from "../content/service.ts";
import { isLive, referenceProblems, undescribed, type ReferenceTarget } from "../content/shared.ts";
import type { MediaStore } from "../media/repository.ts";
import { isApproval, isSubmission, publicReady } from "../content/workflow.ts";

/* Projects (M12) — the content contract's Project, an ORDERED content
   collection (content/ordered.ts), as the programs: drafts, published,
   archived; unique addresses (/work/projects/<slug>, which stories name);
   confirmed address changes; media from the library (described once
   published); audit as project.created, project.updated, project.archived
   and one project.reordered per reorder; owner-only publishing.

   Its program is checked at save (content/shared.ts referenceProblems):
   this organization's, not archived, and published when the project is
   saved as published. The order is the collection's own operation
   (POST /api/v1/projects/order).

   Milestone 6: location, stage, date, impact, partners and the linked
   story are editable (the contract's fields; each optional, `null` clears
   it). The story is named by id and checked at save like a story's related
   stories: this organization's story (the store is scoped to it and to
   stories), not archived, and public-ready by the time the project is
   approved — except that a story naming THIS project back may be on its
   way through review with it (submitted): the two name each other, so one
   of them has to be approved first. The website publish checks again: a
   project naming a story the publish does not carry is refused. While the
   organization has no CMS story, the id names one of the website's own
   stories (as the Impact page does) and the website build checks it. */

const editable = Object.fromEntries(["title", "slug", "programId", "description", "imageId", "context", "activities", "approach", "outcomes", "location", "stage", "date", "impact", "partners", "storyId", "featured", "seo"].map((f) => [f, z.unknown()]));

export const PROJECT_COLLECTION: CollectionConfig<Project> = {
  kind: "project",
  contract: Project,
  fields: editable,
  required: ["title", "programId", "description"],
  defaults: () => ({ order: 0 }),
  rules: () => [],
  media: (p) => [
    ["body.imageId", p.imageId],
    ["body.seo.ogImageId", p.seo?.ogImageId],
  ],
  opaque: ["context", "activities", "approach", "outcomes"],
};

/* The stories a project may name: the reference target, and the stored
   story (its status, its own project) for the mutual case. */
export interface ProjectStoryTarget extends ReferenceTarget {
  findManyStored(ids: string[]): Promise<{ record: { id: string; status: string; projectId?: string }; publishedRevision?: number | null }[]>;
}

async function storyProblems(stories: ProjectStoryTarget, p: Project, publishing: boolean) {
  if (!p.storyId) return [];
  const path = "body.storyId";
  const found = await referenceProblems(stories, [p.storyId], { path, noun: "story", by: "id", publishing: false });
  if (found.length || !publishing || (await stories.count()) === 0) return found;
  const [story] = await stories.findManyStored([p.storyId]);
  if (!story || publicReady(story.record.status, isLive(story))) return [];
  if (story.record.projectId === p.slug && story.record.status === "submitted") return [];
  return [{ path, message: `refers to story "${p.storyId}", which is not approved yet — approve it first` }];
}

export const projectCollection = (media: MediaStore, programs: ReferenceTarget, stories: ProjectStoryTarget): CollectionConfig<Project> => ({
  ...PROJECT_COLLECTION,
  async check(p) {
    // Archiving is never blocked by what a project names: an archived project is never public.
    if (p.status === "archived") return [];
    // M14: images described from submission; references public-ready at approval.
    const submitting = isSubmission(p.status);
    const publishing = isApproval(p.status);
    return [
      ...(await undescribed(media, [["body.imageId", p.imageId]], submitting)),
      ...(await referenceProblems(programs, [p.programId], { path: "body.programId", noun: "program", by: "slug", publishing })),
      ...(await storyProblems(stories, p, publishing)),
    ];
  },
});

export class ProjectService extends OrderedContentService<Project> {
  constructor(store: ContentStore<Project>, media: MediaStore, refs: { programs: ReferenceTarget; stories: ProjectStoryTarget }, audit: AuditService, options: { orgId: string; now?: () => Date; lock?: PublishLock }) {
    super(projectCollection(media, refs.programs, refs.stories), store, media, audit, { ...options, auditReorderOnce: true });
  }
}
