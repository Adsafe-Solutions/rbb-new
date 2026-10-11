import type { Db } from "mongodb";
import { COLLECTIONS, INDEXES } from "../../db/collections.ts";
import { normalizeEmail } from "./types.ts";

/* M25.1: the guard rails around the one-time owner setup
   (src/scripts/bootstrap-owner.ts). Creating the owner itself stays
   bootstrapOwner's (modules/auth/bootstrap.ts) — this only decides WHETHER
   it may run, and against WHAT:

     · opt-in        BOOTSTRAP_OWNER_ENABLED=true, or nothing happens
     · exact target  the resolved database and organization must equal
                     BOOTSTRAP_TARGET_DB and BOOTSTRAP_TARGET_ORG, which the
                     operator states; either missing → refused
     · never a test or smoke database (a name ending in _test, or
       rbb_r2_smoke) and never anything but an Atlas cluster — except, for
       a *_test database only, under BOOTSTRAP_ALLOW_TEST_TARGET=true,
       which the API's own tests use
     · a READ-ONLY look at the target right before any write: an existing
       owner or account stops it with nothing changed */

const SMOKE_DATABASES = ["rbb_r2_smoke"];

/* The host of a connection string — never the credentials, never printed whole. */
export const hostOf = (uri: string) => uri.match(/^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/)?.[1] ?? "";
export const isAtlas = (uri: string) => uri.startsWith("mongodb+srv://") && hostOf(uri).endsWith(".mongodb.net");

export interface TargetCheck {
  uri: string;
  dbName: string;
  orgId: string;
  env: Record<string, string | undefined>;
}

/* Why this target must not be written to; empty = it may. Pure. */
export function bootstrapTargetProblems({ uri, dbName, orgId, env }: TargetCheck): string[] {
  const problems: string[] = [];
  if (env.BOOTSTRAP_OWNER_ENABLED !== "true") problems.push("BOOTSTRAP_OWNER_ENABLED is not true — the owner setup is opt-in");
  const expectDb = env.BOOTSTRAP_TARGET_DB?.trim();
  const expectOrg = env.BOOTSTRAP_TARGET_ORG?.trim();
  if (!expectDb) problems.push("BOOTSTRAP_TARGET_DB is not set — state the database this setup is for");
  else if (dbName !== expectDb) problems.push(`the resolved database is not BOOTSTRAP_TARGET_DB (resolved "${dbName}")`);
  if (!expectOrg) problems.push("BOOTSTRAP_TARGET_ORG is not set — state the organization this setup is for");
  else if (orgId !== expectOrg) problems.push(`the resolved organization is not BOOTSTRAP_TARGET_ORG (resolved "${orgId}")`);
  const testTarget = /_test$/.test(dbName);
  if (SMOKE_DATABASES.includes(dbName)) problems.push(`"${dbName}" is a smoke-test database — never an owner setup target`);
  if (testTarget && env.BOOTSTRAP_ALLOW_TEST_TARGET !== "true") problems.push(`"${dbName}" is a test database — never an owner setup target`);
  if (!isAtlas(uri)) problems.push("the database is not on an Atlas cluster (mongodb+srv://….mongodb.net)");
  return problems;
}

/* Where the password comes from: the environment if set, else the
   terminal's hidden prompt, else nowhere (refused). */
export const passwordSource = ({ fromEnv, isTTY }: { fromEnv: string | undefined; isTTY: boolean }): "env" | "prompt" | null =>
  fromEnv ? "env" : isTTY ? "prompt" : null;

export interface SetupState {
  databaseExists: boolean;
  collections: number;
  owners: number;
  /* An account with this email, in ANY organization (the unique index is global). */
  emailTaken: boolean;
  uniqueIndexes: boolean;
}

/* READ-ONLY: what the target holds, for the decision and the operator. */
export async function setupState(db: Db, listDatabases: () => Promise<string[]>, { orgId, email }: { orgId: string; email: string }): Promise<SetupState> {
  const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);
  const has = (key: keyof typeof COLLECTIONS) => names.includes(COLLECTIONS[key]);
  const uniqueOk = async (key: "users" | "memberships") => {
    const existing = has(key) ? (await db.collection(COLLECTIONS[key]).indexes()).map((i) => i.name) : [];
    return INDEXES[key].filter((i) => i.unique).every((i) => existing.includes(i.name!));
  };
  return {
    databaseExists: (await listDatabases()).includes(db.databaseName),
    collections: names.length,
    owners: has("memberships") ? await db.collection(COLLECTIONS.memberships).countDocuments({ orgId, role: "OWNER" }) : 0,
    emailTaken: has("users") ? (await db.collection(COLLECTIONS.users).countDocuments({ emailNormalized: normalizeEmail(email) })) > 0 : false,
    uniqueIndexes: (await uniqueOk("users")) && (await uniqueOk("memberships")),
  };
}

/* Why the owner must not be created now; empty = it may. Pure. */
export function setupStateProblems(state: SetupState, { ensureIndexes }: { ensureIndexes: boolean }): string[] {
  return [
    ...(state.owners > 0 ? ["this organization already has an owner"] : []),
    ...(state.emailTaken ? ["an account with this email already exists"] : []),
    ...(!state.uniqueIndexes && !ensureIndexes ? ["the unique indexes on users and memberships are missing — set BOOTSTRAP_ENSURE_INDEXES=true or run the index step first"] : []),
  ];
}
