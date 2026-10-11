import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AuthConfig } from "../../config/env.ts";
import { errors } from "../../errors.ts";
import type { Logger } from "../../logging/logger.ts";
import type { AuditService, RequestFacts } from "../audit/audit.ts";
import { DEFAULT_SCRYPT, PASSWORD_POLICY, hashPassword, verifyPassword, type ScryptParams } from "./password.ts";
import { permissionsFor, requirePermission } from "./permissions.ts";
import type { AuthStores } from "./repository.ts";
import { LoginThrottle } from "./throttle.ts";
import { hashToken, looksLikeToken, newSessionToken, pseudonym } from "./tokens.ts";
import { normalizeEmail, type AuthContext, type Permission, type Role, type Session } from "./types.ts";

/* Authentication: login, session resolution, logout, session revocation —
   and (M17.2) setting a first password from a setup link, and changing
   your password.

   The ONLY way a request becomes authenticated is resolveSession(token):
   token → SHA-256 → session (this organization only) → not revoked, not
   expired → user active → membership active → permissions from the role.
   Nothing a client sends — user id, role, orgId — is ever trusted.

   Session lifetime: ABSOLUTE, AuthConfig.sessionTtlMs from login (7 days
   by default); no sliding extension. lastSeenAt is refreshed at most once
   every 5 minutes, so a busy session does not write on every request. */

export const LoginInput = z.strictObject({
  email: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(1024),
});

const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

/* M17.2. A setup link lasts 72 hours. Every unusable link — unknown,
   malformed, used, revoked, expired, or for an account that cannot take a
   first password — gets this one answer, so the response never says which. */
export const SETUP_LINK_TTL_MS = 72 * 60 * 60 * 1000;
export const INVALID_SETUP_LINK = "This setup link is invalid, already used or expired. Ask an owner for a new one.";

/* The password policy (password.ts) for every NEW password. */
const NewPassword = z
  .string()
  .min(PASSWORD_POLICY.minLength, `must be at least ${PASSWORD_POLICY.minLength} characters`)
  .max(PASSWORD_POLICY.maxLength, `must be at most ${PASSWORD_POLICY.maxLength} characters`);

export const SetupPasswordInput = z.strictObject({ token: z.string().max(128), password: NewPassword });
export const ChangePasswordInput = z.strictObject({ currentPassword: z.string().min(1).max(1024), newPassword: NewPassword });

const validation = (error: z.ZodError) => errors.validation(error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })));

/* What a client may know about its own session. No password hash, token,
   token hash or storage field — ever. */
export interface AuthView {
  user: { id: string; email: string; name: string };
  organization: { id: string };
  membership: { role: Role };
  permissions: readonly Permission[];
  session: { id: string; expiresAt: string };
}

export interface SessionView {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current: boolean;
}

export const toAuthView = (auth: AuthContext): AuthView => ({
  user: { id: auth.user.id, email: auth.user.email, name: auth.user.name },
  organization: { id: auth.organization.id },
  membership: { role: auth.membership.role },
  permissions: auth.permissions,
  session: { id: auth.session.id, expiresAt: auth.session.expiresAt },
});

/* A real scrypt hash of a random password, so a login for an unknown email
   costs the same as one with a wrong password. One per parameter set. */
const dummyHashes = new Map<string, Promise<string>>();
const dummyHash = (params: ScryptParams) => {
  const key = `${params.N}:${params.r}:${params.p}`;
  if (!dummyHashes.has(key)) dummyHashes.set(key, hashPassword(randomUUID(), params));
  return dummyHashes.get(key)!;
};

export interface AuthServiceOptions {
  orgId: string;
  config: AuthConfig;
  audit: AuditService;
  log: Logger;
  now?: () => Date;
  /* Tests use cheaper parameters; production always uses the default. */
  scrypt?: ScryptParams;
  throttle?: LoginThrottle;
}

export class AuthService {
  readonly #stores: AuthStores;
  readonly #orgId: string;
  readonly #config: AuthConfig;
  readonly #audit: AuditService;
  readonly #log: Logger;
  readonly #now: () => Date;
  readonly #scrypt: ScryptParams;
  readonly #throttle: LoginThrottle;

  constructor(stores: AuthStores, options: AuthServiceOptions) {
    this.#stores = stores;
    this.#orgId = options.orgId;
    this.#config = options.config;
    this.#audit = options.audit;
    this.#log = options.log;
    this.#now = options.now ?? (() => new Date());
    this.#scrypt = options.scrypt ?? DEFAULT_SCRYPT;
    this.#throttle = options.throttle ?? new LoginThrottle(stores.throttle, options.config.secret, this.#now);
  }

  /* Email + password → a new session. Every failure is the same 401, in the
     same time, so the response never says whether the account exists. */
  async login(input: unknown, request: RequestFacts): Promise<{ token: string; maxAgeSeconds: number; view: AuthView }> {
    const parsed = LoginInput.safeParse(input);
    if (!parsed.success)
      throw errors.validation(parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })));

    const emailNormalized = normalizeEmail(parsed.data.email);
    const accountRef = pseudonym(this.#config.secret, `account:${this.#orgId}:${emailNormalized}`);

    const decision = await this.#throttle.attempt(request.clientIp, accountRef);
    if (decision.blocked) {
      if (decision.firstBlock)
        await this.#audit.recordSafely({ action: "auth.login.rate_limited", resourceType: "session", metadata: { scope: "ip" } }, request);
      throw errors.rateLimited(decision.retryAfterSeconds);
    }

    const user = await this.#stores.users.findByEmail(emailNormalized);
    const membership = user ? await this.#stores.memberships.findForUser(user.id) : null;
    const passwordMatches = await verifyPassword(parsed.data.password, user?.passwordHash ?? (await dummyHash(this.#scrypt)));

    if (!user || !passwordMatches || user.status !== "active" || !membership || membership.status !== "active") {
      const lockedOut = await this.#throttle.failed(accountRef);
      /* One generic reason: the audit trail must not become a way to learn
         which emails have accounts. The keyed accountRef still lets an
         owner see repeated attempts against one account. */
      await this.#audit.recordSafely(
        { action: "auth.login.failure", resourceType: "session", metadata: { reason: "invalid_credentials", accountRef, lockedOut } },
        request
      );
      throw errors.unauthenticated("Email or password is incorrect.");
    }

    const token = newSessionToken();
    const now = this.#now();
    const session: Session = {
      id: randomUUID(),
      orgId: this.#orgId,
      userId: user.id,
      tokenHash: hashToken(token),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.#config.sessionTtlMs).toISOString(),
      lastSeenAt: now.toISOString(),
      revokedAt: null,
    };
    await this.#stores.sessions.insert(session);
    await this.#audit.recordSafely(
      { action: "auth.login.success", resourceType: "session", resourceId: session.id, actorUserId: user.id, metadata: { role: membership.role } },
      request
    );
    this.#log.info("login", { userId: user.id, sessionId: session.id });

    const auth: AuthContext = { user, membership, organization: { id: this.#orgId }, permissions: permissionsFor(membership.role), session };
    return { token, maxAgeSeconds: this.#config.sessionTtlMs / 1000, view: toAuthView(auth) };
  }

  /* The cookie's token → the full authenticated context, or null for
     anything short of a live session of an active member of THIS
     organization. */
  async resolveSession(token: string | null): Promise<AuthContext | null> {
    if (!token || !looksLikeToken(token)) return null;
    const session = await this.#stores.sessions.findByTokenHash(hashToken(token));
    if (!session) return null;
    const now = this.#now();
    if (session.revokedAt || Date.parse(session.expiresAt) <= now.getTime()) return null;

    const user = await this.#stores.users.findById(session.userId);
    if (!user || user.status !== "active") return null;
    const membership = await this.#stores.memberships.findForUser(user.id);
    if (!membership || membership.status !== "active") return null;

    if (now.getTime() - Date.parse(session.lastSeenAt) > TOUCH_INTERVAL_MS) {
      await this.#stores.sessions.touch(session.id, now).catch((error: unknown) => this.#log.warn("session touch failed", { error }));
    }
    return { user, membership, organization: { id: this.#orgId }, permissions: permissionsFor(membership.role), session };
  }

  /* Revokes the current session. Signed out already: nothing to do. */
  async logout(auth: AuthContext | null, request: RequestFacts): Promise<void> {
    if (!auth) return;
    if (await this.#stores.sessions.revoke(auth.session.id, this.#now()))
      await this.#audit.recordSafely(
        { action: "auth.logout", resourceType: "session", resourceId: auth.session.id, actorUserId: auth.user.id },
        request
      );
  }

  async listSessions(auth: AuthContext): Promise<SessionView[]> {
    const sessions = await this.#stores.sessions.listActiveForUser(auth.user.id, this.#now());
    return sessions.map((s) => ({ id: s.id, createdAt: s.createdAt, lastSeenAt: s.lastSeenAt, expiresAt: s.expiresAt, current: s.id === auth.session.id }));
  }

  /* Your own session: always. Someone else's: OWNER only (users:write).
     A session of another organization does not exist from here. */
  async revokeSession(auth: AuthContext, sessionId: string, request: RequestFacts): Promise<{ current: boolean }> {
    const session = await this.#stores.sessions.findById(sessionId);
    if (!session) throw errors.notFound("session");
    const own = session.userId === auth.user.id;
    if (!own) requirePermission(auth, "users:write");
    if (await this.#stores.sessions.revoke(session.id, this.#now()))
      await this.#audit.recordSafely(
        { action: "auth.session.revoked", resourceType: "session", resourceId: session.id, actorUserId: auth.user.id, metadata: { own } },
        request
      );
    return { current: session.id === auth.session.id };
  }

  /* M17.2 — a new member's first password, from an owner-issued setup link.

     Unauthenticated (the member has no password yet), but CSRF-checked like
     every POST, and throttled like login: every attempt counts against the
     IP, every refusal against the link. The link must be unused, unrevoked
     and unexpired, and its member active and still without a password. The
     password is hashed BEFORE the link is consumed, and consuming it is one
     atomic update — of two simultaneous requests, exactly one sets the
     password. It does not sign the member in: they log in as usual. */
  async setupPassword(input: unknown, request: RequestFacts): Promise<void> {
    const parsed = SetupPasswordInput.safeParse(input);
    if (!parsed.success) throw validation(parsed.error);
    const { token, password } = parsed.data;
    if (!looksLikeToken(token)) throw errors.badRequest(INVALID_SETUP_LINK);

    const tokenHash = hashToken(token);
    const linkRef = pseudonym(this.#config.secret, `setup:${this.#orgId}:${tokenHash}`);
    const decision = await this.#throttle.attempt(request.clientIp, linkRef);
    if (decision.blocked) {
      if (decision.firstBlock)
        await this.#audit.recordSafely({ action: "auth.password_setup.rate_limited", resourceType: "user", metadata: { scope: "ip" } }, request);
      throw errors.rateLimited(decision.retryAfterSeconds);
    }

    const now = this.#now();
    const link = await this.#stores.setupTokens.findByHash(tokenHash);
    const user = link ? await this.#stores.users.findById(link.userId) : null;
    const membership = user ? await this.#stores.memberships.findForUser(user.id) : null;
    const reason = !link
      ? null
      : link.usedAt
        ? "used"
        : link.revokedAt
          ? "revoked"
          : Date.parse(link.expiresAt) <= now.getTime()
            ? "expired"
            : !user || user.status !== "active" || !membership || membership.status !== "active"
              ? "inactive"
              : user.passwordHash
                ? "password_already_set"
                : "";
    if (reason !== "") {
      await this.#throttle.failed(linkRef);
      // An unknown token is not anyone's: nothing to attribute it to.
      if (reason)
        await this.#audit.recordSafely({ action: "auth.password_setup.refused", resourceType: "user", resourceId: link!.userId, metadata: { reason } }, request);
      throw errors.badRequest(INVALID_SETUP_LINK);
    }

    const passwordHash = await hashPassword(password, this.#scrypt);
    // Exactly one request gets the link; a concurrent one gets null.
    const consumed = await this.#stores.setupTokens.consume(tokenHash, now);
    if (!consumed || !(await this.#stores.users.setPassword(user!.id, null, passwordHash, now))) {
      await this.#throttle.failed(linkRef);
      throw errors.badRequest(INVALID_SETUP_LINK);
    }
    await this.#stores.setupTokens.revokeOpenForUser(user!.id, now);
    await this.#audit.recordSafely(
      { action: "auth.password_setup.completed", resourceType: "user", resourceId: user!.id, actorUserId: user!.id, metadata: { linkId: consumed.id } },
      request
    );
    this.#log.info("password set from setup link", { userId: user!.id });
  }

  /* M17.2 — change your own password. The current password is required and
     a wrong one counts against the account exactly like a failed login (it
     shares login's throttle). On success EVERY session of the account is
     revoked — a stolen session cannot outlive a password change — and the
     caller gets a fresh session (new token) with the SAME absolute expiry,
     never a longer one. */
  async changePassword(auth: AuthContext, input: unknown, request: RequestFacts): Promise<{ token: string; maxAgeSeconds: number; view: AuthView }> {
    const parsed = ChangePasswordInput.safeParse(input);
    if (!parsed.success) throw validation(parsed.error);
    const { currentPassword, newPassword } = parsed.data;

    const accountRef = pseudonym(this.#config.secret, `account:${this.#orgId}:${auth.user.emailNormalized}`);
    const decision = await this.#throttle.attempt(request.clientIp, accountRef);
    if (decision.blocked) {
      if (decision.firstBlock)
        await this.#audit.recordSafely({ action: "auth.password.rate_limited", resourceType: "user", resourceId: auth.user.id, actorUserId: auth.user.id, metadata: { scope: "ip" } }, request);
      throw errors.rateLimited(decision.retryAfterSeconds);
    }

    const user = await this.#stores.users.findById(auth.user.id);
    // The hash we verify against is the one the update must still find.
    const verifiedHash = user?.passwordHash ?? null;
    if (!user || !verifiedHash || !(await verifyPassword(currentPassword, verifiedHash))) {
      const lockedOut = await this.#throttle.failed(accountRef);
      await this.#audit.recordSafely(
        { action: "auth.password.change_failed", resourceType: "user", resourceId: auth.user.id, actorUserId: auth.user.id, metadata: { reason: "invalid_current", lockedOut } },
        request
      );
      throw errors.validation([{ path: "currentPassword", message: "is incorrect" }]);
    }
    if (newPassword.normalize("NFKC") === currentPassword.normalize("NFKC"))
      throw errors.validation([{ path: "newPassword", message: "must differ from the current password" }]);

    const now = this.#now();
    const passwordHash = await hashPassword(newPassword, this.#scrypt);
    // Only over the hash we verified: a concurrent change makes this one fail.
    if (!(await this.#stores.users.setPassword(user.id, verifiedHash, passwordHash, now)))
      throw errors.conflict("Your password was just changed elsewhere. Sign in again.");

    const revoked = await this.#stores.sessions.revokeAllForUser(user.id, now);
    const token = newSessionToken();
    const session: Session = {
      id: randomUUID(),
      orgId: this.#orgId,
      userId: user.id,
      tokenHash: hashToken(token),
      createdAt: now.toISOString(),
      expiresAt: auth.session.expiresAt,
      lastSeenAt: now.toISOString(),
      revokedAt: null,
    };
    await this.#stores.sessions.insert(session);
    await this.#audit.recordSafely(
      { action: "auth.password.changed", resourceType: "user", resourceId: user.id, actorUserId: user.id, metadata: { otherSessionsRevoked: Math.max(0, revoked - 1) } },
      request
    );
    this.#log.info("password changed", { userId: user.id, sessionId: session.id });

    const view = toAuthView({ ...auth, user: { ...auth.user, passwordHash }, session });
    return { token, maxAgeSeconds: (Date.parse(session.expiresAt) - now.getTime()) / 1000, view };
  }
}
