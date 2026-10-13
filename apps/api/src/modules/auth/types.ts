/* The authentication domain. These are server-side records: none of them
   is ever sent to a client as-is — clients get `AuthView` (service.ts),
   which carries no password hash, token or storage field. */

export const ROLES = ["OWNER", "EDITOR"] as const;
export type Role = (typeof ROLES)[number];

export type Status = "active" | "disabled";

export const PERMISSIONS = [
  "settings:read",
  "settings:write",
  "content:read",
  "content:create",
  "content:update",
  "content:delete",
  /* M14: approving content for publication (editorial review) — owners. */
  "content:approve",
  "media:read",
  "media:write",
  "appeals:read",
  "appeals:write",
  "publish:execute",
  "users:read",
  "users:write",
  /* Form submissions from the website (2026-10-13) — owners only:
     visitors' names, addresses and messages. */
  "submissions:read",
  "submissions:write",
  /* The website forms (2026-10-13) — owners only: live when saved. */
  "forms:write",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export interface User {
  id: string;
  orgId: string;
  email: string;
  /* The lookup key: see normalizeEmail. Unique within an organization. */
  emailNormalized: string;
  name: string;
  /* scrypt hash (password.ts) — never leaves the server. null for a member
     an owner added who has not set a password yet: login treats it exactly
     like a wrong password (same response, same time). */
  passwordHash: string | null;
  status: Status;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export interface Membership {
  id: string;
  orgId: string;
  userId: string;
  role: Role;
  status: Status;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export interface Session {
  id: string;
  orgId: string;
  userId: string;
  /* SHA-256 of the cookie token. The token itself is never stored. */
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
}

/* M17.2: an owner-issued, single-use link that lets a new member set their
   first password. The link carries the token; the database holds only its
   SHA-256 (as sessions do). Usable once, before expiresAt, while neither
   used nor revoked. */
export interface SetupToken {
  id: string;
  orgId: string;
  userId: string;
  tokenHash: string;
  /* The owner who issued it. */
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
}

/* Everything the server knows about the caller once a session resolves.
   Built only by AuthService.resolveSession — never from request input. */
export interface AuthContext {
  user: User;
  membership: Membership;
  organization: { id: string };
  permissions: readonly Permission[];
  session: Session;
}

/* Lowercased, trimmed, Unicode-normalised: "  Jo@Example.ORG " and
   "jo@example.org" are the same account. */
export const normalizeEmail = (email: string) => email.normalize("NFKC").trim().toLowerCase();
