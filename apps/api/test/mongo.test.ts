import { test } from "node:test";
import assert from "node:assert/strict";
import { DuplicateKeyError, asDuplicateKey, createMongoProvider } from "../src/db/mongo.ts";

/* A stand-in for MongoClient that counts what happens to it. */
const fakeFactory = (connect: () => Promise<void> = async () => {}) => {
  const made: { connects: number; dbs: string[] }[] = [];
  const createClient = () => {
    const stats = { connects: 0, dbs: [] as string[] };
    made.push(stats);
    return {
      connect: async () => {
        stats.connects++;
        await connect();
        return undefined as never;
      },
      db: (name?: string) => {
        stats.dbs.push(name ?? "");
        return { name } as never;
      },
      close: async () => {},
    };
  };
  return { made, createClient };
};

let n = 0;
const settings = () => ({ uri: `mongodb://reuse-test-${++n}.invalid`, dbName: "rbb_test" });

test("one client per process: concurrent and later requests reuse it", async () => {
  const { made, createClient } = fakeFactory();
  const config = settings();
  const a = createMongoProvider(config, { createClient });
  const b = createMongoProvider(config, { createClient });
  await Promise.all([a.db(), a.db(), b.db()]);
  await a.db();
  assert.equal(made.length, 1, "a second client was created");
  assert.equal(made[0]!.connects, 1, "the client connected more than once");
  await a.close();
});

test("a failed connect is not cached: the next request tries again", async () => {
  let fail = true;
  const { made, createClient } = fakeFactory(async () => {
    if (fail) throw new Error("connect ECONNREFUSED");
  });
  const provider = createMongoProvider(settings(), { createClient });
  const error = await provider.db().catch((e) => e);
  assert.equal(error.code, "SERVICE_UNAVAILABLE");
  assert.ok(!error.message.includes("ECONNREFUSED"), "the driver's message is not the client's business");
  fail = false;
  await provider.db();
  assert.equal(made.length, 2);
  await provider.close();
});

test("the configured database name is used", async () => {
  const { made, createClient } = fakeFactory();
  const provider = createMongoProvider({ uri: settings().uri, dbName: "rbb_custom" }, { createClient });
  await provider.db();
  assert.deepEqual(made[0]!.dbs, ["rbb_custom"]);
  await provider.close();
});

test("a duplicate-key error names the field, never the value", () => {
  const error = asDuplicateKey({ code: 11000, keyPattern: { orgId: 1, slug: 1 }, keyValue: { slug: "secret-slug" } });
  assert.ok(error instanceof DuplicateKeyError);
  assert.equal(error.field, "slug");
  assert.ok(!error.message.includes("secret-slug"));
  assert.equal(asDuplicateKey(new Error("other")), null);
});
