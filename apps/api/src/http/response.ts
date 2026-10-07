import type { ApiError } from "../errors.ts";

/* Response conventions:

     success     { "data": … }              an object or an array
     error       { "error": { code, message, requestId, details? } }

   Every response is JSON and carries the API's security headers. The API
   serves data to programs, never pages, so its policy is the strictest one:
   nothing may load, nothing may frame it, nothing is cached. */
export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
};

export const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });

export const ok = (data: unknown, status = 200) => json(status, { data });

export const errorResponse = (error: ApiError, requestId: string) =>
  json(
    error.status,
    {
      error: {
        code: error.code,
        message: error.message,
        requestId,
        ...(error.details?.length && { details: error.details }),
      },
    },
    error.headers
  );
