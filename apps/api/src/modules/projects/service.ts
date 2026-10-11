import type { PublishLock } from "../publishing/lock.ts";
import { z } from "zod";
import { Project } from "@rbb/content-schema";
import type { AuditService } from "../audit/audit.ts";
import type { ContentStore } from "../content/repository.ts";
import { OrderedContentService } from "../content/ordered.ts";
import type { CollectionConfig } from "../content/service.ts";
import { referenceProblems, undescribed, type ReferenceTarget } from "../content/shared.ts";
import type { MediaStore } from "../media/repository.ts";
import { isApproval, isSubmission } from "../content/workflow.ts";

/* Projects (M12) — the content contract's Project, an ORDERED content
   collection (content/ordered.ts), as the programs: drafts, published,
   archived; unique addresses (/work/projects/<slug>, which stories name);
   confirmed address changes; media from the library (described once
   published); audit as project.created, project.updated, project.archived
   and one project.reordered per reorder; owner-only publishing.

   Its program is checked at save (content/shared.ts referenceProblems):
   this organization's, not archived, and published when the project is
   saved as published. The order is the collection's own operation
   (POST /api/v1/projects/order). */

const editable = Object.fromEntries(["title", "slug", "programId", "description", "imageId", "context", "activities", "approach", "outcomes", "featured", "seo"].map((f) => [f, z.unknown()]));

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

export const projectCollection = (media: MediaStore, programs: ReferenceTarget): CollectionConfig<Project> => ({
  ...PROJECT_COLLECTION,
  async check(p) {
    // Archiving is never blocked by what a project names: an archived project is never public.
    if (p.status === "archived") return [];
    // M14: images described from submission; references public-ready at approval.
    const submitting = isSubmission(p.status);
    const publishing = isApproval(p.status);
    return [...(await undescribed(media, [["body.imageId", p.imageId]], submitting)), ...(await referenceProblems(programs, [p.programId], { path: "body.programId", noun: "program", by: "slug", publishing }))];
  },
});

export class ProjectService extends OrderedContentService<Project> {
  constructor(store: ContentStore<Project>, media: MediaStore, programs: ReferenceTarget, audit: AuditService, options: { orgId: string; now?: () => Date; lock?: PublishLock }) {
    super(projectCollection(media, programs), store, media, audit, { ...options, auditReorderOnce: true });
  }
}
