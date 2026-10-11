import type { MediaKind, MediaMimeType } from "./policy.ts";

/* A media library record — the API's record of one stored object.

   Lifecycle (the only transitions the service performs):

     pending ──complete (object verified)──▶ ready
        │  ──abort / verification failed / abandoned──▶ failed
        └──────────────┐
     ready, failed ────┴──delete──▶ deleted        (terminal)

   A record is never removed from the database; deleting is a state.

   `id` is what content references (`…Id` fields in @rbb/content-schema
   match its format, MediaId). Nothing outside the API needs `objectKey`;
   content resolves an id to `publicUrl` through the API.

   Object state, separate from the record's status, is what makes deletion
   safe to retry: the database changes first ("deleting"), then storage;
   only a confirmed storage delete makes it "deleted". */

export const MEDIA_STATUSES = ["pending", "ready", "failed", "deleted"] as const;
export type MediaStatus = (typeof MEDIA_STATUSES)[number];

/* People in the image: has their consent to publish been recorded? */
export const CONSENT_VALUES = ["unknown", "not-required", "obtained", "not-obtained"] as const;
export type Consent = (typeof CONSENT_VALUES)[number];

export type ObjectState = "awaiting-upload" | "present" | "deleting" | "deleted";

export interface MediaRecord {
  id: string;
  orgId: string;
  status: MediaStatus;
  kind: MediaKind;
  objectKey: string;
  objectState: ObjectState;
  /* Set when the record becomes ready; null otherwise. */
  publicUrl: string | null;
  originalFilename: string;
  mimeType: MediaMimeType;
  /* Bytes. Declared at intent; confirmed against storage at completion. */
  size: number;
  width: number | null;
  height: number | null;
  alt: string;
  caption: string;
  /* Milestone 2: the point to keep in frame when a page crops the image,
     "X% Y%" (@rbb/content-schema FocalPoint). Absent or null: centred.
     Records saved before Milestone 2 have no field at all. */
  focal?: string | null;
  credit: string;
  license: string;
  consent: Consent;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  failedAt: string | null;
  /* A short machine reason, e.g. "content-mismatch"; never a raw error. */
  failureReason: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  /* Increments on every write; metadata edits must name it. */
  version: number;
  schemaVersion: 1;
}

/* What clients see. Storage internals (object state, key) stay inside the
   API — `objectKey` is exposed read-only for diagnostics but is never an
   input anywhere. No signed URL is ever part of a record. */
export interface MediaView {
  id: string;
  status: Exclude<MediaStatus, "deleted">;
  kind: MediaKind;
  objectKey: string;
  publicUrl: string | null;
  originalFilename: string;
  mimeType: MediaMimeType;
  size: number;
  width: number | null;
  height: number | null;
  alt: string;
  caption: string;
  focal: string | null;
  credit: string;
  license: string;
  consent: Consent;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  failureReason: string | null;
  version: number;
}

export function toMediaView(record: MediaRecord): MediaView {
  if (record.status === "deleted") throw new Error("A deleted media record has no client view");
  return {
    id: record.id,
    status: record.status,
    kind: record.kind,
    objectKey: record.objectKey,
    publicUrl: record.status === "ready" ? record.publicUrl : null,
    originalFilename: record.originalFilename,
    mimeType: record.mimeType,
    size: record.size,
    width: record.width,
    height: record.height,
    alt: record.alt,
    caption: record.caption,
    focal: record.focal ?? null,
    credit: record.credit,
    license: record.license,
    consent: record.consent,
    createdBy: record.createdBy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    completedAt: record.completedAt,
    failureReason: record.failureReason,
    version: record.version,
  };
}

/* The content contract's Media shape (@rbb/content-schema), for a READY
   library record — how a future content module will describe an image it
   references. The names differ where the contract predates the library:
   size → bytes, license → licence, originalFilename → filename. */
export function toContentMedia(record: MediaRecord) {
  if (record.status !== "ready") throw new Error("Only a ready media record maps to content");
  return {
    id: record.id,
    orgId: record.orgId,
    schemaVersion: 1 as const,
    status: "published" as const,
    kind: record.kind,
    alt: record.alt,
    ...(record.focal && { focal: record.focal }),
    filename: record.originalFilename,
    mimeType: record.mimeType,
    ...(record.width && { width: record.width }),
    ...(record.height && { height: record.height }),
    bytes: record.size,
    ...(record.credit && { credit: record.credit }),
    ...(record.license && { licence: record.license }),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
