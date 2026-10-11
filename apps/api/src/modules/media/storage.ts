/* Object storage, as the media module needs it. The service talks to this
   interface only; R2Storage (r2.ts) is today's implementation, and another
   provider replaces it without touching the service, the routes or the
   records — which hold an object KEY and a public URL, never anything
   provider-specific.

   Every method is idempotent where the operation allows: deleting a
   missing object succeeds, and `head` of a missing object is null. */

export interface UploadTarget {
  /* The single-use, short-lived URL the browser sends the file to. */
  url: string;
  method: "PUT";
  /* Headers the browser MUST send unchanged — they are part of the
     signature. */
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface StoredObject {
  size: number;
  contentType: string | null;
}

export interface ObjectStorage {
  /* A short name for logs and audit metadata ("r2"). */
  readonly provider: string;
  createUploadTarget(input: { key: string; contentType: string; contentLength: number; expiresInSeconds: number }): Promise<UploadTarget>;
  head(key: string): Promise<StoredObject | null>;
  /* The first `length` bytes, for checking what a file really is. */
  readStart(key: string, length: number): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
  /* Where the public reads the object. Derived from configuration —
     never from the storage provider's private endpoint. */
  publicUrl(key: string): string;
}

/* A storage call failed (network, provider error, credentials). The
   message is for logs and names no secret; clients see a generic error. */
export class StorageError extends Error {
  readonly status: number | null;
  constructor(message: string, options: { status?: number | null; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = "StorageError";
    this.status = options.status ?? null;
  }
}
