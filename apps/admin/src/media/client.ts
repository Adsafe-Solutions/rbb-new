import { ApiRequestError, api, apiEnvelope } from "../api";

/* The media library's API calls, and the one direct-to-storage call.

   The FILE never goes to the API: the API returns a short-lived presigned
   URL for one new object, the browser PUTs the bytes there, and then asks
   the API to verify and complete. No storage credential is ever in the
   browser — only that single-use URL, which is dropped once used. */

export type MediaStatus = "pending" | "ready" | "failed";
export type Consent = "unknown" | "not-required" | "obtained" | "not-obtained";

export interface MediaItem {
  id: string;
  status: MediaStatus;
  kind: "image";
  objectKey: string;
  publicUrl: string | null;
  originalFilename: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string;
  caption: string;
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

export interface MediaPolicy {
  maxBytes: number;
  mimeTypes: string[];
  extensions: string[];
  maxDimension: number;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface MediaListParams {
  search?: string;
  type?: "image";
  status?: MediaStatus;
  sort?: "newest" | "oldest";
  page?: number;
  pageSize?: number;
}

export interface UploadIntent {
  mediaId: string;
  objectKey: string;
  uploadUrl: string;
  uploadMethod: "PUT";
  uploadHeaders: Record<string, string>;
  expiresAt: string;
  media: MediaItem;
}

export type MetadataChanges = Partial<Pick<MediaItem, "alt" | "caption" | "credit" | "license" | "consent">>;

const BASE = "/api/v1/media";
const post = (body?: unknown): RequestInit => ({ method: "POST", ...(body !== undefined && { body: JSON.stringify(body) }) });

export const mediaApi = {
  policy: () => api<MediaPolicy>(`${BASE}/policy`),
  async list(params: MediaListParams = {}) {
    const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)]));
    const body = await apiEnvelope<MediaItem[], { pagination: Pagination }>(`${BASE}${query.size ? `?${query}` : ""}`);
    return { items: body.data, pagination: body.pagination ?? { page: 1, pageSize: body.data.length, total: body.data.length, totalPages: 1 } };
  },
  get: (id: string) => api<MediaItem>(`${BASE}/${encodeURIComponent(id)}`),
  createIntent: (file: { filename: string; mimeType: string; size: number }) => api<UploadIntent>(`${BASE}/upload-intents`, post(file)),
  complete: (id: string) => api<MediaItem>(`${BASE}/${encodeURIComponent(id)}/complete`, post()),
  abort: (id: string) => api<MediaItem>(`${BASE}/${encodeURIComponent(id)}/abort`, post()),
  update: (id: string, version: number, changes: MetadataChanges) =>
    api<MediaItem>(`${BASE}/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ version, ...changes }) }),
  remove: (id: string) => api<{ deleted: true; storage: "removed" | "pending" }>(`${BASE}/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

export class StorageUploadError extends Error {
  readonly reason: "network" | "rejected" | "cancelled";
  constructor(reason: StorageUploadError["reason"]) {
    super(`Upload ${reason}`);
    this.name = "StorageUploadError";
    this.reason = reason;
  }
}

/* PUT the file to the presigned URL. XMLHttpRequest rather than fetch:
   only XHR reports upload progress. No cookies or credentials are sent to
   storage (withCredentials stays false). */
export function putToStorage(intent: UploadIntent, file: File, onProgress: (fraction: number) => void, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(intent.uploadMethod, intent.uploadUrl);
    for (const [name, value] of Object.entries(intent.uploadHeaders)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (event) => event.lengthComputable && onProgress(event.loaded / event.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new StorageUploadError("rejected")));
    xhr.onerror = () => reject(new StorageUploadError("network"));
    xhr.onabort = () => reject(new StorageUploadError("cancelled"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}

/* Error → words for an editor. Never a raw storage, database or HTTP
   message. */
export function uploadErrorMessage(error: unknown, stage: "prepare" | "upload" | "complete"): string {
  if (error instanceof StorageUploadError) return error.reason === "cancelled" ? "Upload cancelled." : "Upload failed. Please try again.";
  if (error instanceof ApiRequestError) {
    const paths = error.details.map((d) => d.path);
    if (paths.includes("body.mimeType")) return "This file type isn't supported.";
    if (paths.includes("body.size")) return "File exceeds the maximum allowed size.";
    if (paths.includes("body.filename")) return "The file name or extension doesn't match a supported image type.";
    if (paths.includes("file")) return "The file isn't a valid image of the type it claims to be.";
    if (error.status === 429) return "Too many uploads at once. Wait a few minutes and try again.";
    if (error.status === 503) return "Media storage isn't available right now. Try again later.";
    if (error.status === 401) return "Your session has ended. Sign in again.";
    if (error.status === 403) return "You don't have permission to upload media.";
  }
  return stage === "complete" ? "Media could not be completed." : "Upload failed. Please try again.";
}
