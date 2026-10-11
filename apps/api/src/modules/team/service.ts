import type { PublishLock } from "../publishing/lock.ts";
import { z } from "zod";
import { TeamMember } from "@rbb/content-schema";
import type { AuditService } from "../audit/audit.ts";
import type { ContentStore } from "../content/repository.ts";
import { OrderedContentService } from "../content/ordered.ts";
import type { CollectionConfig } from "../content/service.ts";
import type { MediaStore } from "../media/repository.ts";
import { isSubmission } from "../content/workflow.ts";

/* Team members (M9) — the content contract's TeamMember, on the shared
   content lifecycle (modules/content): drafts, published, archived;
   unique addresses (the profile URL); confirmed address changes; media
   from the library; audit as team_member.created/updated/archived;
   owner-only publishing.

   Editable: name, address, role, group, featured, short bio, biography,
   photograph, department/area, location, social and related links. ORDER
   is the ordered collection's (content/ordered.ts): a new member goes to
   the end, and POST /api/v1/team/order sets everyone's position at once —
   naming the revision each member was read at, so nobody's edit is
   overwritten. */

const editable = Object.fromEntries(
  ["name", "slug", "role", "group", "featured", "shortBio", "biography", "imageId", "departmentOrArea", "location", "socialLinks", "relatedLinks"].map((f) => [f, z.unknown()])
);

/* The team's own check: a person's photograph is described (its alt
   text, from the media library) once they are submitted for review (M14). */
export const teamCollection = (media: MediaStore): CollectionConfig<TeamMember> => ({
  ...TEAM_COLLECTION,
  async check(m) {
    if (!m.imageId || !isSubmission(m.status)) return [];
    const [item] = await media.findMany([m.imageId]);
    return item && !item.alt.trim() ? [{ path: "body.imageId", message: "the photograph has no alt text — describe it in the media library first" }] : [];
  },
});

export const TEAM_COLLECTION: CollectionConfig<TeamMember> = {
  kind: "team_member",
  contract: TeamMember,
  fields: editable,
  required: ["name", "role", "group"],
  defaults: () => ({ order: 0 }),
  rules: () => [],
  media: (m) => [["body.imageId", m.imageId]],
  opaque: ["biography"],
};

export class TeamService extends OrderedContentService<TeamMember> {
  constructor(store: ContentStore<TeamMember>, media: MediaStore, audit: AuditService, options: { orgId: string; now?: () => Date; lock?: PublishLock }) {
    super(teamCollection(media), store, media, audit, options);
  }
}
