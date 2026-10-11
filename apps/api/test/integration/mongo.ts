import { MongoClient, type Db } from "mongodb";
import { CLIENT_OPTIONS } from "../../src/db/mongo.ts";

/* Integration tests run against ONE dedicated test database — never the
   application's.

   - Where: MONGODB_TEST_URI (the cluster) + MONGODB_TEST_DB (the database).
     Both are required; nothing falls back to MONGODB_URI / MONGODB_DB. The
     name must end in "_test" and must not be MONGODB_DB.
   - Whose records: the tests only ever write as the reserved test
     organizations below. Every collection is organization-scoped (each
     document carries `orgId`), so their records never mix with anyone
     else's.
   - Refusal: before anything is written, `connect()` checks that the
     database holds NOTHING but reserved-test-organization records. A
     database with any other record (an application's data) is refused,
     untouched.
   - Cleanup: deletes the reserved test organizations' records, before a
     file (leftovers of an interrupted run) and after it. The database and
     its collections and indexes stay; nothing else is ever deleted.
   - One run at a time: the test organizations are shared by every run (and
     login throttling counts per IP), so two simultaneous runs against the
     same test database would disturb each other. */

export const TEST_ORG_IDS = ["org-a", "org-b", "org-d", "org-fresh", "test-org"] as const;
/* The live R2 test's one-off organizations: live-<hex>. */
const LIVE_ORG = /^live-[0-9a-f]+$/;
/* Scratch collections a test creates for itself (see withCollectionRenamed). */
export const SCRATCH_PREFIX = "itest_";

const testRecords = { $or: [{ orgId: { $in: [...TEST_ORG_IDS] } }, { orgId: LIVE_ORG }] };
const otherRecords = { orgId: { $nin: [...TEST_ORG_IDS], $not: LIVE_ORG } };

export function testMongo() {
  const uri = process.env.MONGODB_TEST_URI?.trim();
  const dbName = process.env.MONGODB_TEST_DB?.trim();
  if (!uri || !dbName)
    throw new Error(
      "Set MONGODB_TEST_URI (the cluster) and MONGODB_TEST_DB (the dedicated test database, e.g. risingbeyondborders_test). " +
        "Integration tests never use MONGODB_URI or MONGODB_DB (see apps/api/README.md)."
    );
  if (!/^[A-Za-z0-9_-]{1,58}_test$/.test(dbName)) throw new Error("MONGODB_TEST_DB must be a database name ending in _test.");
  if (dbName === process.env.MONGODB_DB?.trim()) throw new Error("MONGODB_TEST_DB must not be the application database (MONGODB_DB).");

  const client = new MongoClient(uri, { ...CLIENT_OPTIONS, serverSelectionTimeoutMS: 10_000 });
  const db = () => client.db(dbName);

  /* Test records only: deletes the reserved organizations' documents in
     every (non-scratch) collection. Never a database or collection drop. */
  const deleteTestRecords = async () => {
    for (const { name } of await db().listCollections({}, { nameOnly: true }).toArray()) {
      if (name.startsWith("system.") || name.startsWith(SCRATCH_PREFIX)) continue;
      await db().collection(name).deleteMany(testRecords);
    }
  };

  return {
    uri,
    dbName,
    client,
    db,
    /* Connects, refuses a database holding anything but test records, and
       clears leftovers of an interrupted run. Call before any write. */
    async connect() {
      await client.connect();
      for (const { name } of await db().listCollections({}, { nameOnly: true }).toArray()) {
        if (name.startsWith("system.") || name.startsWith(SCRATCH_PREFIX)) continue;
        if (await db().collection(name).countDocuments(otherRecords, { limit: 1 }))
          throw new Error(`Refusing to run: ${dbName}.${name} holds records that are not test records. Point MONGODB_TEST_DB at the dedicated test database.`);
      }
      await deleteTestRecords();
    },
    async cleanup() {
      try {
        await deleteTestRecords();
      } finally {
        await client.close();
      }
    },
  };
}

/* A view of `db` in which ONE collection name points at a scratch
   collection (SCRATCH_PREFIX…) — for a test that needs that collection in a
   state the shared one can't be in (e.g. conflicting indexes). Everything
   else is the real test database. */
export function withCollectionRenamed(db: Db, name: string, scratch: string): Db {
  if (!scratch.startsWith(SCRATCH_PREFIX)) throw new Error(`A scratch collection's name starts with ${SCRATCH_PREFIX}`);
  return new Proxy(db, {
    get(target, prop, receiver) {
      if (prop === "collection") return (requested: string, options?: object) => target.collection(requested === name ? scratch : requested, options);
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

/* Drops a scratch collection this test created — only ever one whose name
   starts with SCRATCH_PREFIX. */
export async function dropScratch(db: Db, scratch: string) {
  if (!scratch.startsWith(SCRATCH_PREFIX)) throw new Error("Refusing to drop a collection that is not a test scratch collection");
  await db.collection(scratch).drop().catch((error: { codeName?: string }) => {
    if (error.codeName !== "NamespaceNotFound") throw error;
  });
}
