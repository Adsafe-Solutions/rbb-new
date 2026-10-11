import { encodeKeyPath, presignUrl, signHeaders, type Credentials } from "./sigv4.ts";
import { StorageError, type ObjectStorage, type StoredObject, type UploadTarget } from "./storage.ts";

/* Cloudflare R2 through its S3-compatible API.

     endpoint     https://<account>.r2.cloudflarestorage.com — PRIVATE: the
                  API signs requests to it; browsers only ever see a
                  presigned URL for one object.
     publicBase   the bucket's public origin (a custom domain). What the
                  public site and the admin load images from.

   Path-style addressing (<endpoint>/<bucket>/<key>), region "auto", as R2
   documents. */

export interface R2Options {
  endpoint: string;
  bucket: string;
  credentials: Credentials;
  publicBaseUrl: string;
  fetch?: typeof fetch;
  now?: () => Date;
  /* Per-call network timeout for the API's own calls. */
  timeoutMs?: number;
}

const SCOPE = { region: "auto", service: "s3" } as const;

export class R2Storage implements ObjectStorage {
  readonly provider = "r2";
  readonly #endpoint: string;
  readonly #bucket: string;
  readonly #credentials: Credentials;
  readonly #publicBase: string;
  readonly #fetch: typeof fetch;
  readonly #now: () => Date;
  readonly #timeoutMs: number;

  constructor(options: R2Options) {
    this.#endpoint = new URL(options.endpoint).origin;
    this.#bucket = options.bucket;
    this.#credentials = options.credentials;
    this.#publicBase = options.publicBaseUrl.replace(/\/+$/, "");
    this.#fetch = options.fetch ?? fetch;
    this.#now = options.now ?? (() => new Date());
    this.#timeoutMs = options.timeoutMs ?? 10_000;
  }

  #objectUrl(key: string) {
    return new URL(`${this.#endpoint}/${encodeURIComponent(this.#bucket)}/${encodeKeyPath(key)}`);
  }

  async createUploadTarget({ key, contentType, contentLength, expiresInSeconds }: { key: string; contentType: string; contentLength: number; expiresInSeconds: number }): Promise<UploadTarget> {
    const now = this.#now();
    /* Content-Type and Content-Length are signed: the upload must be
       exactly the declared type and size, or R2 refuses it. */
    const headers = { "content-type": contentType, "content-length": String(contentLength) };
    const url = presignUrl({ method: "PUT", url: this.#objectUrl(key), headers, credentials: this.#credentials, scope: SCOPE, date: now, expiresInSeconds });
    return {
      url,
      method: "PUT",
      // The browser sets Content-Length itself (it may not be set by script).
      headers: { "Content-Type": contentType },
      expiresAt: new Date(now.getTime() + expiresInSeconds * 1000),
    };
  }

  async #send(method: "HEAD" | "GET" | "DELETE", key: string, extra: Record<string, string> = {}) {
    const url = this.#objectUrl(key);
    const headers = signHeaders({ method, url, headers: extra, credentials: this.#credentials, scope: SCOPE, date: this.#now() });
    try {
      return await this.#fetch(url, { method, headers, signal: AbortSignal.timeout(this.#timeoutMs) });
    } catch (error) {
      throw new StorageError(`R2 ${method} failed: ${(error as Error).name}`, { cause: error });
    }
  }

  async head(key: string): Promise<StoredObject | null> {
    const response = await this.#send("HEAD", key);
    if (response.status === 404) return null;
    if (!response.ok) throw new StorageError(`R2 HEAD answered ${response.status}`, { status: response.status });
    return { size: Number(response.headers.get("content-length") ?? NaN), contentType: response.headers.get("content-type") };
  }

  async readStart(key: string, length: number): Promise<Uint8Array | null> {
    const response = await this.#send("GET", key, { range: `bytes=0-${length - 1}` });
    if (response.status === 404) return null;
    if (!response.ok) throw new StorageError(`R2 GET answered ${response.status}`, { status: response.status });
    return new Uint8Array(await response.arrayBuffer()).slice(0, length);
  }

  async delete(key: string): Promise<void> {
    const response = await this.#send("DELETE", key);
    await response.body?.cancel().catch(() => {});
    // 204 normally; 404 means already gone — both are success.
    if (!response.ok && response.status !== 404) throw new StorageError(`R2 DELETE answered ${response.status}`, { status: response.status });
  }

  publicUrl(key: string): string {
    return `${this.#publicBase}/${encodeKeyPath(key)}`;
  }
}
