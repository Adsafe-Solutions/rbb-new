import { randomBytes } from "node:crypto";
import { MongoClient } from "mongodb";
import { CLIENT_OPTIONS } from "../../src/db/mongo.ts";

/* Integration tests run against a DISPOSABLE MongoDB only.

   They read MONGODB_TEST_URI and nothing else — never MONGODB_URI, the
   deployment's database — and every run creates its own uniquely named
   database (rbb_test_<random>), which is the only database cleanup ever
   drops. Without MONGODB_TEST_URI the tests fail with instructions rather
   than falling back to anything. */
export function testMongo() {
  const uri = process.env.MONGODB_TEST_URI?.trim();
  if (!uri)
    throw new Error(
      "MONGODB_TEST_URI is not set. Integration tests need a disposable MongoDB, e.g. a local mongod: " +
        "MONGODB_TEST_URI=mongodb://127.0.0.1:27017 pnpm api:test:integration (see apps/api/README.md)."
    );
  const dbName = `rbb_test_${randomBytes(6).toString("hex")}`;
  const client = new MongoClient(uri, { ...CLIENT_OPTIONS, serverSelectionTimeoutMS: 3_000 });
  return {
    uri,
    dbName,
    client,
    db: () => client.db(dbName),
    async cleanup() {
      if (!dbName.startsWith("rbb_test_")) throw new Error("Refusing to drop a database this test run did not create");
      await client.db(dbName).dropDatabase();
      await client.close();
    },
  };
}
