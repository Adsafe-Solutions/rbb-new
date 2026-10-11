import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DuplicateKeyError } from "../../db/mongo.ts";
import { errors } from "../../errors.ts";
import type { AuditService, RequestFacts } from "../audit/audit.ts";
import { permissionsFor, requirePermission } from "../auth/permissions.ts";
import { SETUP_LINK_TTL_MS } from "../auth/service.ts";
import { hashToken, newSessionToken } from "../auth/tokens.ts";
import type { AuthStores } from "../auth/repository.ts";
import { ROLES, normalizeEmail, type AuthContext, type Membership, type Role, type Status, type User } from "../auth/types.ts";
import { issuesOf } from "../content/shared.ts";
import type { TeamLock } from "./lock.ts";

/* Team management (M17.1): the organization's members, managed by its
   owners. Everything here is users:read / users:write — OWNER-only in the
   RBAC table — and checked again inside the service.

   - A member is a user + their membership of this organization. Members
     are never deleted: audit entries refer to them by id. They are
     deactivated (membership disabled, every session revoked at once) and
     can be reactivated.
   - Nobody changes their own role or status here, so an owner cannot lock
     themselves out by accident.
   - Role and status changes run under the team lock (lock.ts) and re-read
     everything inside it: the acting owner must STILL be an active owner,
     the target must still be at the revision the client saw, and the
     change must leave at least one other active owner whenever it takes
     one away.
   - A new member has no password (passwordHash null) and so cannot sign
     in until they set one from a setup link (M17.2): issueSetupLink gives
     the owner the link's token ONCE, to deliver by hand. Deactivating a
     member revokes their open links too. */

export const CONFLICT_MESSAGE = "This member was changed elsewhere. Reload and try again.";
export const LAST_OWNER_MESSAGE = "This is the organization's last active owner. Make another member an owner first.";

const CreateInput = z.strictObject({
  email: z.string().trim().max(254).pipe(z.email()),
  name: z.string().trim().min(1).max(120),
  role: z.enum(ROLES),
});
const RoleInput = z.strictObject({ revision: z.number().int().min(1), role: z.enum(ROLES) });
const RevisionInput = z.strictObject({ revision: z.number().int().min(1) });

/* What an owner sees of a member. No password hash, session token or
   storage field — ever. */
export interface MemberView {
  id: string;
  email: string;
  name: string;
  role: Role;
  /* Effective: disabled if either the account or the membership is. */
  status: Status;
  /* false until the member has set a password (they cannot sign in yet). */
  passwordSet: boolean;
  activeSessions: number;
  createdAt: string;
  updatedAt: string;
  /* The membership's revision: role and status changes must quote it. */
  revision: number;
  isYou: boolean;
}

interface Member {
  user: User;
  membership: Membership;
}

const isActiveOwner = ({ user, membership }: Member) => membership.role === "OWNER" && membership.status === "active" && user.status === "active";

export interface MemberServiceOptions {
  orgId: string;
  lock: TeamLock;
  now?: () => Date;
}

export class MemberService {
  readonly #stores: AuthStores;
  readonly #audit: AuditService;
  readonly #orgId: string;
  readonly #lock: TeamLock;
  readonly #now: () => Date;

  constructor(stores: AuthStores, audit: AuditService, options: MemberServiceOptions) {
    this.#stores = stores;
    this.#audit = audit;
    this.#orgId = options.orgId;
    this.#lock = options.lock;
    this.#now = options.now ?? (() => new Date());
  }

  async list(auth: AuthContext): Promise<MemberView[]> {
    this.#allowed(auth, "users:read");
    const [users, memberships, sessions] = await Promise.all([
      this.#stores.users.list(),
      this.#stores.memberships.list(),
      this.#stores.sessions.countActiveByUser(this.#now()),
    ]);
    const byUser = new Map(memberships.map((m) => [m.userId, m]));
    return users.flatMap((user) => {
      const membership = byUser.get(user.id);
      return membership ? [this.#view({ user, membership }, auth, sessions[user.id] ?? 0)] : [];
    });
  }

  async get(auth: AuthContext, userId: string): Promise<MemberView> {
    this.#allowed(auth, "users:read");
    return this.#viewWithSessions(await this.#load(userId), auth);
  }

  async create(auth: AuthContext, input: unknown, facts: RequestFacts): Promise<MemberView> {
    this.#allowed(auth, "users:write");
    const parsed = CreateInput.safeParse(input);
    if (!parsed.success) throw errors.validation(issuesOf(parsed.error, ["body"]));
    const { email, name, role } = parsed.data;
    const at = this.#now().toISOString();
    const user: User = {
      id: randomUUID(),
      orgId: this.#orgId,
      email: email.trim(),
      emailNormalized: normalizeEmail(email),
      name,
      passwordHash: null,
      status: "active",
      createdAt: at,
      updatedAt: at,
      revision: 1,
    };
    const membership: Membership = { id: randomUUID(), orgId: this.#orgId, userId: user.id, role, status: "active", createdAt: at, updatedAt: at, revision: 1 };
    try {
      await this.#stores.users.insert(user);
    } catch (error) {
      if (error instanceof DuplicateKeyError) throw errors.conflict("An account with this email already exists.");
      throw error;
    }
    await this.#stores.memberships.insert(membership);
    await this.#audit.recordSafely({ action: "users.created", resourceType: "user", resourceId: user.id, actorUserId: auth.user.id, metadata: { role } }, facts);
    return this.#view({ user, membership }, auth, 0);
  }

  async changeRole(auth: AuthContext, userId: string, input: unknown, facts: RequestFacts): Promise<MemberView> {
    const parsed = RoleInput.safeParse(input);
    if (!parsed.success) throw errors.validation(issuesOf(parsed.error, ["body"]));
    const { revision, role } = parsed.data;
    return this.#change(auth, userId, revision, "role", facts, async (member) => {
      if (member.membership.role === role) return null;
      return { changes: { role }, audit: { action: "users.role_changed", metadata: { from: member.membership.role, to: role } } };
    });
  }

  async deactivate(auth: AuthContext, userId: string, input: unknown, facts: RequestFacts): Promise<MemberView> {
    const { revision } = this.#revision(input);
    return this.#change(auth, userId, revision, "status", facts, async (member) => {
      if (member.membership.status === "disabled") return null;
      return { changes: { status: "disabled" }, audit: { action: "users.deactivated", metadata: {} }, revokeSessions: true };
    });
  }

  async reactivate(auth: AuthContext, userId: string, input: unknown, facts: RequestFacts): Promise<MemberView> {
    const { revision } = this.#revision(input);
    return this.#change(auth, userId, revision, "status", facts, async (member) => {
      if (member.membership.status === "active") return null;
      return { changes: { status: "active" }, audit: { action: "users.reactivated", metadata: {} } };
    });
  }

  /* Signs a member out everywhere. Your own sessions: from your account
     (DELETE /auth/sessions/:id), not from here. */
  async revokeSessions(auth: AuthContext, userId: string, facts: RequestFacts): Promise<{ revoked: number }> {
    this.#allowed(auth, "users:write");
    if (userId === auth.user.id) throw errors.forbidden("Sign out of your own sessions from your account instead.");
    const { user } = await this.#load(userId);
    const revoked = await this.#stores.sessions.revokeAllForUser(user.id, this.#now());
    await this.#audit.recordSafely(
      { action: "users.sessions_revoked", resourceType: "user", resourceId: user.id, actorUserId: auth.user.id, metadata: { count: revoked } },
      facts
    );
    return { revoked };
  }

  /* M17.2: a single-use setup link for a member who has no password yet.
     The token is returned ONCE — only its hash is stored — and the owner
     delivers it by hand (no email). Issuing a new link revokes the member's
     earlier open ones, so at most one works at a time. Not for yourself,
     and not for a member who already has a password (no owner-driven
     reset in this milestone). */
  async issueSetupLink(auth: AuthContext, userId: string, facts: RequestFacts): Promise<{ token: string; expiresAt: string }> {
    this.#allowed(auth, "users:write");
    if (userId === auth.user.id) throw errors.forbidden("You already have a password. Change it from your account instead.");
    const member = await this.#load(userId);
    if (member.user.status !== "active" || member.membership.status !== "active") throw errors.conflict("Reactivate this member before issuing a setup link.");
    if (member.user.passwordHash) throw errors.conflict("This member has already set a password.");

    const now = this.#now();
    const token = newSessionToken();
    const expiresAt = new Date(now.getTime() + SETUP_LINK_TTL_MS).toISOString();
    const replaced = await this.#stores.setupTokens.revokeOpenForUser(member.user.id, now);
    const linkId = randomUUID();
    await this.#stores.setupTokens.insert({
      id: linkId,
      orgId: this.#orgId,
      userId: member.user.id,
      tokenHash: hashToken(token),
      createdBy: auth.user.id,
      createdAt: now.toISOString(),
      expiresAt,
      usedAt: null,
      revokedAt: null,
    });
    await this.#audit.recordSafely(
      { action: "users.setup_link_issued", resourceType: "user", resourceId: member.user.id, actorUserId: auth.user.id, metadata: { linkId, expiresAt, replaced } },
      facts
    );
    return { token, expiresAt };
  }

  /* ---------------- internals ---------------- */

  /* A role or status change: self refused; then, under the team lock, the
     actor re-checked, the revision checked, the last active owner kept,
     the change written only at that revision, and audited. `decide`
     returns null for "already so" (no write, no audit). */
  async #change(
    auth: AuthContext,
    userId: string,
    revision: number,
    what: "role" | "status",
    facts: RequestFacts,
    decide: (member: Member) => Promise<{ changes: Partial<Pick<Membership, "role" | "status">>; audit: { action: string; metadata: Record<string, unknown> }; revokeSessions?: boolean } | null>
  ): Promise<MemberView> {
    this.#allowed(auth, "users:write");
    if (userId === auth.user.id) throw errors.forbidden(what === "role" ? "You can't change your own role." : "You can't deactivate or reactivate yourself.");

    return this.#lock.exclusive(async () => {
      await this.#stillAnOwner(auth);
      const member = await this.#load(userId);
      if (member.membership.revision !== revision) throw errors.conflict(CONFLICT_MESSAGE);
      const decision = await decide(member);
      if (!decision) return this.#viewWithSessions(member, auth);

      const after: Member = { user: member.user, membership: { ...member.membership, ...decision.changes } };
      if (isActiveOwner(member) && !isActiveOwner(after) && (await this.#otherActiveOwners(member.user.id)) === 0) {
        await this.#audit.recordSafely(
          { action: "users.change_refused", resourceType: "user", resourceId: member.user.id, actorUserId: auth.user.id, metadata: { reason: "last_owner", change: decision.audit.action } },
          facts
        );
        throw errors.conflict(LAST_OWNER_MESSAGE);
      }

      const now = this.#now();
      const saved = await this.#stores.memberships.update(member.user.id, revision, decision.changes, now.toISOString());
      if (!saved) throw errors.conflict(CONFLICT_MESSAGE);
      const sessionsRevoked = decision.revokeSessions ? await this.#stores.sessions.revokeAllForUser(member.user.id, now) : undefined;
      const setupLinksRevoked = decision.revokeSessions ? await this.#stores.setupTokens.revokeOpenForUser(member.user.id, now) : 0;
      await this.#audit.recordSafely(
        {
          action: decision.audit.action,
          resourceType: "user",
          resourceId: member.user.id,
          actorUserId: auth.user.id,
          metadata: {
            ...decision.audit.metadata,
            revision: saved.revision,
            ...(sessionsRevoked !== undefined && { sessionsRevoked }),
            ...(setupLinksRevoked > 0 && { setupLinksRevoked }),
          },
        },
        facts
      );
      return this.#viewWithSessions({ user: member.user, membership: saved }, auth);
    });
  }

  /* The session was resolved before the lock: the actor may have been
     demoted or deactivated since. Inside the lock, ask again. */
  async #stillAnOwner(auth: AuthContext) {
    const user = await this.#stores.users.findById(auth.user.id);
    const membership = user ? await this.#stores.memberships.findForUser(user.id) : null;
    if (!user || !membership || user.status !== "active" || membership.status !== "active" || !permissionsFor(membership.role).includes("users:write"))
      throw errors.forbidden("You do not have permission to do this.");
  }

  async #otherActiveOwners(exceptUserId: string): Promise<number> {
    const owners = (await this.#stores.memberships.list()).filter((m) => m.role === "OWNER" && m.status === "active" && m.userId !== exceptUserId);
    const users = await Promise.all(owners.map((m) => this.#stores.users.findById(m.userId)));
    return users.filter((user) => user?.status === "active").length;
  }

  async #load(userId: string): Promise<Member> {
    const user = await this.#stores.users.findById(userId);
    const membership = user ? await this.#stores.memberships.findForUser(user.id) : null;
    if (!user || !membership) throw errors.notFound("member");
    return { user, membership };
  }

  #allowed(auth: AuthContext, permission: "users:read" | "users:write") {
    if (auth.organization.id !== this.#orgId) throw errors.forbidden("You do not have permission to do this.");
    requirePermission(auth, permission);
  }

  #revision(input: unknown) {
    const parsed = RevisionInput.safeParse(input);
    if (!parsed.success) throw errors.validation(issuesOf(parsed.error, ["body"]));
    return parsed.data;
  }

  async #viewWithSessions(member: Member, auth: AuthContext) {
    const counts = await this.#stores.sessions.countActiveByUser(this.#now());
    return this.#view(member, auth, counts[member.user.id] ?? 0);
  }

  #view({ user, membership }: Member, auth: AuthContext, activeSessions: number): MemberView {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: membership.role,
      status: user.status === "active" && membership.status === "active" ? "active" : "disabled",
      passwordSet: Boolean(user.passwordHash),
      activeSessions,
      createdAt: user.createdAt,
      updatedAt: membership.updatedAt > user.updatedAt ? membership.updatedAt : user.updatedAt,
      revision: membership.revision,
      isYou: user.id === auth.user.id,
    };
  }
}
