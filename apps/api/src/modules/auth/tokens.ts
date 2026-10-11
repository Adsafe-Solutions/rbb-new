import { createHash, createHmac, randomBytes } from "node:crypto";

/* Session tokens: 32 random bytes (256 bits), base64url — opaque, never
   derived from anything about the user. The browser holds the token (in
   the HttpOnly cookie); the database holds only its SHA-256. A plain hash
   is right here because the token is already high-entropy: unlike a
   password, it cannot be guessed and then checked against the hash. */
export const newSessionToken = () => randomBytes(32).toString("base64url");

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/* A session token as a browser could send it — anything else is not looked
   up at all. */
export const looksLikeToken = (value: string) => /^[A-Za-z0-9_-]{43}$/.test(value);

/* Keyed pseudonyms for values we must count or correlate but should not
   store — IP addresses, attempted emails. HMAC with the deployment's
   AUTH_SECRET, so the small IPv4 space cannot simply be enumerated back. */
export const pseudonym = (secret: string, value: string) =>
  createHmac("sha256", secret).update(value).digest("hex").slice(0, 32);
