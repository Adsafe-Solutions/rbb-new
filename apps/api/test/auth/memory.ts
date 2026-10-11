import { DuplicateKeyError } from "../../src/db/mongo.ts";
import { AuditService, type AuditEntry, type AuditStore } from "../../src/modules/audit/audit.ts";
import { hashPassword, type ScryptParams } from "../../src/modules/auth/password.ts";
import type { AuthStores } from "../../src/modules/auth/repository.ts";
import { AuthService } from "../../src/modules/auth/service.ts";
import { normalizeEmail, type Membership, type Role, type Session, type SetupToken, type Status, type User } from "../../src/modules/auth/types.ts";
import { testConfig } from "../helpers.ts";

/* In-memory stores with the same contract as the MongoDB ones — including
   organization scoping and unique keys — over ONE shared dataset, so a
   test can hold two organizations side by side. */

export const CHEAP_SCRYPT: ScryptParams = { N: 2 ** 10, r: 8, p: 1 };

export interface MemoryData {
  users: User[];
  memberships: Membership[];
  sessions: Session[];
  throttle: Map<string, number>;
  audit: AuditEntry[];
  setupTokens: SetupToken[];
}

export const memoryData = (): MemoryData => ({ users: [], memberships: [], sessions: [], throttle: new Map(), audit: [], setupTokens: [] });

export function memoryAuthStores(data: MemoryData, orgId: string): AuthStores {
  const mine = <T extends { orgId: string }>(rows: T[]) => rows.filter((row) => row.orgId === orgId);
  return {
    users: {
      findByEmail: async (email) => mine(data.users).find((u) => u.emailNormalized === email) ?? null,
      findById: async (id) => mine(data.users).find((u) => u.id === id) ?? null,
      insert: async (user) => {
        if (mine(data.users).some((u) => u.emailNormalized === user.emailNormalized)) throw new DuplicateKeyError("emailNormalized");
        data.users.push({ ...user });
      },
      list: async () => mine(data.users).map((u) => ({ ...u })),
      setPassword: async (id, expectedHash, passwordHash, at) => {
        const user = mine(data.users).find((u) => u.id === id && (u.passwordHash ?? null) === expectedHash);
        if (!user) return false;
        Object.assign(user, { passwordHash, updatedAt: at.toISOString(), revision: user.revision + 1 });
        return true;
      },
    },
    memberships: {
      findForUser: async (userId) => mine(data.memberships).find((m) => m.userId === userId) ?? null,
      insert: async (membership) => {
        if (mine(data.memberships).some((m) => m.userId === membership.userId)) throw new DuplicateKeyError("userId");
        data.memberships.push({ ...membership });
      },
      countOwners: async () => mine(data.memberships).filter((m) => m.role === "OWNER").length,
      list: async () => mine(data.memberships).map((m) => ({ ...m })),
      update: async (userId, expectedRevision, changes, at) => {
        const membership = mine(data.memberships).find((m) => m.userId === userId && m.revision === expectedRevision);
        if (!membership) return null;
        Object.assign(membership, changes, { updatedAt: at, revision: membership.revision + 1 });
        return { ...membership };
      },
    },
    sessions: {
      insert: async (session) => void data.sessions.push({ ...session }),
      findByTokenHash: async (hash) => mine(data.sessions).find((s) => s.tokenHash === hash) ?? null,
      findById: async (id) => mine(data.sessions).find((s) => s.id === id) ?? null,
      listActiveForUser: async (userId, now) =>
        mine(data.sessions).filter((s) => s.userId === userId && !s.revokedAt && Date.parse(s.expiresAt) > now.getTime()),
      touch: async (id, at) => {
        const session = mine(data.sessions).find((s) => s.id === id && !s.revokedAt);
        if (session) session.lastSeenAt = at.toISOString();
      },
      revoke: async (id, at) => {
        const session = mine(data.sessions).find((s) => s.id === id && !s.revokedAt);
        if (!session) return false;
        session.revokedAt = at.toISOString();
        return true;
      },
      revokeAllForUser: async (userId, at) => {
        const live = mine(data.sessions).filter((s) => s.userId === userId && !s.revokedAt && Date.parse(s.expiresAt) > at.getTime());
        for (const session of live) session.revokedAt = at.toISOString();
        return live.length;
      },
      countActiveByUser: async (now) => {
        const counts: Record<string, number> = {};
        for (const s of mine(data.sessions)) if (!s.revokedAt && Date.parse(s.expiresAt) > now.getTime()) counts[s.userId] = (counts[s.userId] ?? 0) + 1;
        return counts;
      },
    },
    setupTokens: {
      insert: async (token) => {
        if (data.setupTokens.some((t) => t.tokenHash === token.tokenHash)) throw new DuplicateKeyError("tokenHash");
        data.setupTokens.push({ ...token });
      },
      findByHash: async (hash) => {
        const token = mine(data.setupTokens).find((t) => t.tokenHash === hash);
        return token ? { ...token } : null;
      },
      /* Synchronous between the check and the write, like MongoDB's single
         atomic update: two concurrent calls cannot both succeed. */
      consume: async (hash, now) => {
        const token = mine(data.setupTokens).find((t) => t.tokenHash === hash && !t.usedAt && !t.revokedAt && Date.parse(t.expiresAt) > now.getTime());
        if (!token) return null;
        token.usedAt = now.toISOString();
        return { ...token };
      },
      revokeOpenForUser: async (userId, at) => {
        const open = mine(data.setupTokens).filter((t) => t.userId === userId && !t.usedAt && !t.revokedAt);
        for (const token of open) token.revokedAt = at.toISOString();
        return open.length;
      },
    },
    throttle: {
      hit: async (key) => {
        const count = (data.throttle.get(key) ?? 0) + 1;
        data.throttle.set(key, count);
        return count;
      },
      peek: async (key) => data.throttle.get(key) ?? 0,
    },
  };
}

export const memoryAuditStore = (data: MemoryData, orgId: string): AuditStore => ({
  append: async (entry) => void data.audit.push(structuredClone(entry)),
  listRecent: async (limit) => data.audit.filter((e) => e.orgId === orgId).reverse().slice(0, limit),
});

/* A controllable clock. */
export const clock = (iso = "2026-10-07T10:00:00.000Z") => {
  let now = Date.parse(iso);
  return { now: () => new Date(now), advance: (ms: number) => (now += ms) };
};

export const silentLog = { debug() {}, info() {}, warn() {}, error() {}, child: () => silentLog };

export function memoryAuth(data: MemoryData, orgId: string, now: () => Date) {
  const config = testConfig({ orgId }).auth;
  const audit = new AuditService(memoryAuditStore(data, orgId), { orgId, secret: config.secret, log: silentLog, now });
  return { audit, service: new AuthService(memoryAuthStores(data, orgId), { orgId, config, audit, log: silentLog, now, scrypt: CHEAP_SCRYPT }) };
}

/* The team-change lease (members/lock.ts) in memory, one per dataset +
   organization. `gate`, when set, is awaited after the lease is taken —
   a test holds the lock open to make two changes truly overlap. */
export function memoryLeases(orgId: string, state: { holders: Map<string, string | null> } = { holders: new Map() }) {
  return {
    state,
    gate: null as null | (() => Promise<void>),
    async acquire(lockId: string) {
      if (state.holders.get(orgId)) return false;
      state.holders.set(orgId, lockId);
      if (this.gate) await this.gate();
      return true;
    },
    async release(lockId: string) {
      if (state.holders.get(orgId) === lockId) state.holders.set(orgId, null);
    },
  };
}

/* An account straight into the stores, as a fixture. (Through the API,
   owners add members with MemberService — M17.) */
export async function addMember(
  stores: AuthStores,
  { orgId, email, password, role = "EDITOR", userStatus = "active", membershipStatus = "active", name = "Test User" }: {
    orgId: string;
    email: string;
    password: string;
    role?: Role;
    userStatus?: Status;
    membershipStatus?: Status;
    name?: string;
  }
) {
  const at = "2026-10-01T00:00:00.000Z";
  const user: User & { passwordHash: string } = {
    id: crypto.randomUUID(),
    orgId,
    email,
    emailNormalized: normalizeEmail(email),
    name,
    passwordHash: await hashPassword(password, CHEAP_SCRYPT),
    status: userStatus,
    createdAt: at,
    updatedAt: at,
    revision: 1,
  };
  await stores.users.insert(user);
  await stores.memberships.insert({ id: crypto.randomUUID(), orgId, userId: user.id, role, status: membershipStatus, createdAt: at, updatedAt: at, revision: 1 });
  return user;
}
