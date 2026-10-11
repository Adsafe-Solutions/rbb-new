import { z } from "zod";
import { EntityId, IsoDateTime, OrgId, ReleaseMarker } from "./primitives.ts";

/* The editorial lifecycle a stored record moves through (M14):

     draft       being written or changed; not on the public site (a record
                 that was published stays live in its published version)
     submitted   this revision is waiting for an owner's review
     approved    an owner approved this exact revision; it goes public at
                 the next website publish
     published   this exact revision is in the live published snapshot
     archived    retired; kept, never shown

   A published snapshot holds `published` records only.

   This is the EDITORIAL lifecycle only. Whether the organization has
   approved a subject for release (apps/web/release/approvals.mjs) and
   whether a record is still sample content (`releaseMarker`) are separate
   questions, answered by the release system — a published record can
   still keep a production release blocked. */
export const PublicationStatus = z.enum(["draft", "submitted", "approved", "published", "archived"]);
export type PublicationStatus = z.infer<typeof PublicationStatus>;

/* The fields every stored content record has. Spread into each record
   schema; singletons (homepage, settings) use them too. */
export const recordFields = {
  id: EntityId,
  /* The organization the record belongs to. Set by the API from the
     deployment, never chosen by an editor. */
  orgId: OrgId,
  /* The version of THIS contract the record was written against, so a
     record can be migrated when its schema changes. */
  schemaVersion: z.literal(1),
  status: PublicationStatus,
  /* Set by the API; absent from source-controlled content. */
  createdAt: IsoDateTime.optional(),
  updatedAt: IsoDateTime.optional(),
  publishedAt: IsoDateTime.optional(),
  /* INTERNAL: sample/working content awaiting the organization's own. */
  releaseMarker: ReleaseMarker.optional(),
};
