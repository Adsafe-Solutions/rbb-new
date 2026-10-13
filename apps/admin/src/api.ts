/* The admin's only way to reach the API.

   Authentication is the API's HttpOnly session cookie, which the browser
   attaches by itself: this code never sees, stores or sends a token. By
   default the API is called on the admin's own origin (/api/... — proxied
   in dev, rewritten by the host in production). VITE_API_BASE can point at
   another origin instead; the browser then needs `credentials: "include"`
   and the API must list this origin. */

const BASE = import.meta.env.VITE_API_BASE ?? "";

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfterSeconds: number | null;
  /* Field-level problems from a VALIDATION_ERROR: where, never the value. */
  readonly details: { path: string; message: string }[];

  constructor(status: number, code: string, message: string, retryAfterSeconds: number | null = null, details: { path: string; message: string }[] = []) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
    this.details = details;
  }
}

/* The API's success envelope is { data }; errors are { error: { code, message } }. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  return (await apiEnvelope<T>(path, init)).data as T;
}

/* The whole success body, for responses that carry more than `data`
   (a list's `pagination`). */
export async function apiEnvelope<T, Extra extends object = object>(path: string, init: RequestInit = {}): Promise<{ data: T } & Partial<Extra>> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      credentials: BASE ? "include" : "same-origin",
      headers: {
        Accept: "application/json",
        ...(init.body !== undefined && { "Content-Type": "application/json" }),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiRequestError(0, "NETWORK_ERROR", "The server could not be reached.");
  }

  const body = (await response.json().catch(() => null)) as ({ data?: T; error?: { code?: string; message?: string; details?: { path: string; message: string }[] } } & Partial<Extra>) | null;
  if (!response.ok) {
    const retryAfter = Number(response.headers.get("Retry-After"));
    throw new ApiRequestError(
      response.status,
      body?.error?.code ?? "UNKNOWN",
      body?.error?.message ?? "The request failed.",
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
      Array.isArray(body?.error?.details) ? body.error.details : []
    );
  }
  return { ...(body as object), data: body?.data as T } as { data: T } & Partial<Extra>;
}

/* What GET /api/v1/auth/me returns — the API's AuthView. */
export interface AuthView {
  user: { id: string; email: string; name: string };
  organization: { id: string };
  membership: { role: "OWNER" | "EDITOR" };
  permissions: string[];
  session: { id: string; expiresAt: string };
}

/* A file from the API (a CSV export), with the same credentials as every
   call; a refusal throws as `api` does. */
export async function apiDownload(path: string): Promise<{ blob: Blob; name: string | null }> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, { credentials: BASE ? "include" : "same-origin" });
  } catch {
    throw new ApiRequestError(0, "NETWORK_ERROR", "The server could not be reached.");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    throw new ApiRequestError(response.status, body?.error?.code ?? "UNKNOWN", body?.error?.message ?? "The download failed.");
  }
  const name = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? null;
  return { blob: await response.blob(), name };
}
