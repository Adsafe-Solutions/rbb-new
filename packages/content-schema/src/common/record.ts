import { z } from "zod";
import { EntityId, IsoDateTime, OrgId, ReleaseMarker } from "./primitives.ts";

/* The publication lifecycle a stored record moves through:

     draft       being written; never on the public site
     published   live on the public site
     archived    retired; kept, never shown

   This is the EDITORIAL lifecycle only. Whether the organization has
   approved a subject for release (apps/web/release/approvals.mjs) and
   whether a record is still sample content (`releaseMarker`) are separate
   questions, answered by the release system — a published record can
   still keep a production release blocked. */
export const PublicationStatus = z.enum(["draft", "published", "archived"]);
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
