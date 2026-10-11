import type { AuthConfig } from "../../config/env.ts";

/* The session cookie. It holds only the opaque token:

     HttpOnly         scripts cannot read it
     Secure           https only (production)
     SameSite         Strict by default — never sent on cross-site requests
     Path=/           the whole API
     Max-Age          the session's remaining absolute lifetime
     no Domain        host-only: never shared with sibling subdomains

   Clearing it sends the same attributes with Max-Age=0. */

type CookieSettings = AuthConfig["cookie"];

const attributes = (cookie: CookieSettings, maxAgeSeconds: number) =>
  [
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
    "HttpOnly",
    ...(cookie.secure ? ["Secure"] : []),
    `SameSite=${cookie.sameSite}`,
  ].join("; ");

export const sessionCookie = (cookie: CookieSettings, token: string, maxAgeSeconds: number) =>
  `${cookie.name}=${token}; ${attributes(cookie, Math.max(0, Math.floor(maxAgeSeconds)))}`;

export const clearedSessionCookie = (cookie: CookieSettings) => `${cookie.name}=; ${attributes(cookie, 0)}`;

/* The named cookie's value from a Cookie header, or null. */
export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim() || null;
  }
  return null;
}
