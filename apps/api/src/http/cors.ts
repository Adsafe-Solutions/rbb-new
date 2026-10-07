/* Cross-origin policy. Only the origins configured for this deployment
   (WEB_ORIGIN, ADMIN_ORIGIN) may read API responses from a browser; every
   other origin gets no CORS headers at all, so the browser refuses it.
   Never "*": the admin will call this API with credentials (M3), and a
   wildcard cannot be combined with those safely.

   Requests without an Origin header (servers, build scripts, curl) are not
   browser cross-origin requests and are unaffected. */

export const ALLOWED_REQUEST_HEADERS = "Content-Type, X-Request-Id";
const PREFLIGHT_MAX_AGE_SECONDS = "600";

export const isAllowedOrigin = (origin: string | null, allowed: readonly string[]): origin is string =>
  origin !== null && allowed.includes(origin);

/* Headers for an actual (non-preflight) response. */
export function corsHeaders(origin: string | null, allowed: readonly string[]): Record<string, string> {
  if (!isAllowedOrigin(origin, allowed)) return origin ? { Vary: "Origin" } : {};
  return { "Access-Control-Allow-Origin": origin, "Access-Control-Expose-Headers": "X-Request-Id", Vary: "Origin" };
}

/* Headers for a preflight from an allowed origin. */
export const preflightHeaders = (origin: string, methods: string[]): Record<string, string> => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": methods.join(", "),
  "Access-Control-Allow-Headers": ALLOWED_REQUEST_HEADERS,
  "Access-Control-Max-Age": PREFLIGHT_MAX_AGE_SECONDS,
  Vary: "Origin",
});
