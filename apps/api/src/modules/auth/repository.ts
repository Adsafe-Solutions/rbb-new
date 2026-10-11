import type { Collection, Db, ObjectId } from "mongodb";
import { COLLECTIONS } from "../../db/collections.ts";
import { asDuplicateKey } from "../../db/mongo.ts";
import type { Membership, Session, SetupToken, User } from "./types.ts";

/* Persistence for users, memberships, sessions and login throttling.
   Repositories store and fetch — nothing else — and every one is bound to
   ONE organization at construction: every query includes that orgId, so
   a caller cannot reach another organization's records whatever ids it
   passes. The orgId comes from the deployment's configuration, never from
   a request.

   As in M2: documents get their own `_id` (ObjectId), timestamps are BSON
   Dates in the database and ISO strings in the domain. */

export interface UserStore {
  findByEmail(emailNormalized: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  /* Throws DuplicateKeyError("emailNormalized" | "id"). */
  insert(user: User): Promise<void>;
  /* M17: the organization's users (the team list), oldest first. */
  list(): Promise<User[]>;
  /* M17.2: sets the password hash only if the stored one is still
     `expectedHash` (null: no password yet); false if it was not. */
  setPassword(id: string, expectedHash: string | null, passwordHash: string, at: Date): Promise<boolean>;
}

/* M17.2: setup links. */
export interface SetupTokenStore {
  insert(token: SetupToken): Promise<void>;
  findByHash(tokenHash: string): Promise<SetupToken | null>;
  /* Marks the link used — only if it is unused, unrevoked and unexpired at
     `now`, in ONE atomic update, so of two simultaneous requests exactly
     one gets the link back and the other gets null. */
  consume(tokenHash: string, now: Date): Promise<SetupToken | null>;
  /* Revokes a user's unused, unrevoked links; how many. */
  revokeOpenForUser(userId: string, at: Date): Promise<number>;
}

export interface MembershipStore {
  findForUser(userId: string): Promise<Membership | null>;
  /* Throws DuplicateKeyError("userId" | "id"). */
  insert(membership: Membership): Promise<void>;
  /* Every OWNER membership, active or not (bootstrap: "has an owner ever
     been set up"). The last-owner guard counts ACTIVE owners itself. */
  countOwners(): Promise<number>;
  /* M17: the organization's memberships. */
  list(): Promise<Membership[]>;
  /* M17: role and/or status, only if the membership is still at
     `expectedRevision`; the updated membership, or null if it was not. */
  update(userId: string, expectedRevision: number, changes: Partial<Pick<Membership, "role" | "status">>, at: string): Promise<Membership | null>;
}

export interface SessionStore {
  insert(session: Session): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  findById(id: string): Promise<Session | null>;
  listActiveForUser(userId: string, now: Date): Promise<Session[]>;
  touch(id: string, at: Date): Promise<void>;
  /* true if this call revoked it; false if it was already revoked or absent. */
  revoke(id: string, at: Date): Promise<boolean>;
  /* M17: revokes every live session of a user; how many it revoked. */
  revokeAllForUser(userId: string, at: Date): Promise<number>;
  /* M17: live (unrevoked, unexpired) sessions per user id. */
  countActiveByUser(now: Date): Promise<Record<string, number>>;
}

export interface ThrottleStore {
  /* Adds one to the counter and returns the new count. The counter
     disappears at `expiresAt`. */
  hit(key: string, expiresAt: Date): Promise<number>;
  peek(key: string): Promise<number>;
}

export interface AuthStores {
  users: UserStore;
  memberships: MembershipStore;
  sessions: SessionStore;
  throttle: ThrottleStore;
  setupTokens: SetupTokenStore;
}

/* ---------------- Document mapping ---------------- */

type Document = Record<string, unknown> & { _id?: ObjectId };
/* A team is a handful of people; the list is bounded all the same. */
const TEAM_LIMIT = 500;
const DATE_KEYS: readonly string[] = ["createdAt", "updatedAt", "expiresAt", "lastSeenAt", "revokedAt", "usedAt"];

function toDocument(record: object): Document {
  const document: Document = { ...record };
  for (const key of DATE_KEYS) if (typeof document[key] === "string") document[key] = new Date(document[key] as string);
  return document;
}

function toRecord<T>(document: Document | null): T | null {
  if (!document) return null;
  const { _id, ...fields } = document;
  for (const key of DATE_KEYS) if (fields[key] instanceof Date) fields[key] = (fields[key] as Date).toISOString();
  return fields as T;
}

async function insertOne(collection: Collection<Document>, document: Document) {
  try {
    await collection.insertOne({ ...document });
  } catch (error) {
    throw asDuplicateKey(error) ?? error;
  }
}

/* ---------------- MongoDB implementations ---------------- */

export function mongoAuthStores(db: Db, orgId: string): AuthStores {
  const users = db.collection<Document>(COLLECTIONS.users);
  const memberships = db.collection<Document>(COLLECTIONS.memberships);
  const sessions = db.collection<Document>(COLLECTIONS.sessions);
  const throttle = db.collection<{ _id: string; orgId: string; count: number; expiresAt: Date }>(COLLECTIONS.authThrottle);
  const setupTokens = db.collection<Document>(COLLECTIONS.setupTokens);

  const assertOrg = (record: { orgId: string }) => {
    if (record.orgId !== orgId) throw new Error("Refusing to store a record for another organization");
  };

  return {
    users: {
      findByEmail: async (emailNormalized) => toRecord<User>(await users.findOne({ orgId, emailNormalized })),
      findById: async (id) => toRecord<User>(await users.findOne({ orgId, id })),
      insert: async (user) => {
        assertOrg(user);
        await insertOne(users, toDocument(user));
      },
      list: async () => (await users.find({ orgId }).sort({ createdAt: 1 }).limit(TEAM_LIMIT).toArray()).map((document) => toRecord<User>(document)!),
      setPassword: async (id, expectedHash, passwordHash, at) => {
        const user = await users.findOne({ orgId, id }, { projection: { revision: 1 } });
        if (!user) return false;
        const result = await users.updateOne(
          { orgId, id, passwordHash: expectedHash, revision: user.revision },
          { $set: { passwordHash, updatedAt: at, revision: (user.revision as number) + 1 } }
        );
        return result.modifiedCount === 1;
      },
    },
    memberships: {
      findForUser: async (userId) => toRecord<Membership>(await memberships.findOne({ orgId, userId })),
      insert: async (membership) => {
        assertOrg(membership);
        await insertOne(memberships, toDocument(membership));
      },
      countOwners: () => memberships.countDocuments({ orgId, role: "OWNER" }),
      list: async () => (await memberships.find({ orgId }).limit(TEAM_LIMIT).toArray()).map((document) => toRecord<Membership>(document)!),
      update: async (userId, expectedRevision, changes, at) =>
        toRecord<Membership>(
          await memberships.findOneAndUpdate(
            { orgId, userId, revision: expectedRevision },
            { $set: { ...changes, updatedAt: new Date(at), revision: expectedRevision + 1 } },
            { returnDocument: "after" }
          )
        ),
    },
    sessions: {
      insert: async (session) => {
        assertOrg(session);
        await insertOne(sessions, toDocument(session));
      },
      findByTokenHash: async (tokenHash) => toRecord<Session>(await sessions.findOne({ orgId, tokenHash })),
      findById: async (id) => toRecord<Session>(await sessions.findOne({ orgId, id })),
      listActiveForUser: async (userId, now) =>
        (await sessions.find({ orgId, userId, revokedAt: null, expiresAt: { $gt: now } }).sort({ createdAt: -1 }).limit(50).toArray()).map(
          (document) => toRecord<Session>(document)!
        ),
      touch: async (id, at) => {
        await sessions.updateOne({ orgId, id, revokedAt: null }, { $set: { lastSeenAt: at } });
      },
      revoke: async (id, at) => (await sessions.updateOne({ orgId, id, revokedAt: null }, { $set: { revokedAt: at } })).modifiedCount === 1,
      revokeAllForUser: async (userId, at) =>
        (await sessions.updateMany({ orgId, userId, revokedAt: null, expiresAt: { $gt: at } }, { $set: { revokedAt: at } })).modifiedCount,
      countActiveByUser: async (now) =>
        Object.fromEntries(
          (
            await sessions
              .aggregate<{ _id: string; count: number }>([
                { $match: { orgId, revokedAt: null, expiresAt: { $gt: now } } },
                { $group: { _id: "$userId", count: { $sum: 1 } } },
              ])
              .toArray()
          ).map((row) => [row._id, row.count])
        ),
    },
    setupTokens: {
      insert: async (token) => {
        assertOrg(token);
        await insertOne(setupTokens, toDocument(token));
      },
      findByHash: async (tokenHash) => toRecord<SetupToken>(await setupTokens.findOne({ orgId, tokenHash })),
      consume: async (tokenHash, now) =>
        toRecord<SetupToken>(
          await setupTokens.findOneAndUpdate(
            { orgId, tokenHash, usedAt: null, revokedAt: null, expiresAt: { $gt: now } },
            { $set: { usedAt: now } },
            { returnDocument: "after" }
          )
        ),
      revokeOpenForUser: async (userId, at) =>
        (await setupTokens.updateMany({ orgId, userId, usedAt: null, revokedAt: null }, { $set: { revokedAt: at } })).modifiedCount,
    },
    throttle: {
      hit: async (key, expiresAt) => {
        const document = await throttle.findOneAndUpdate(
          { _id: key },
          { $inc: { count: 1 }, $setOnInsert: { orgId, expiresAt } },
          { upsert: true, returnDocument: "after" }
        );
        return document?.count ?? 1;
      },
      peek: async (key) => (await throttle.findOne({ _id: key }))?.count ?? 0,
    },
  };
}
