import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.ts";
import { MongoClient } from "mongodb";
import { CLIENT_OPTIONS, createMongoProvider } from "../src/db/mongo.ts";
import { downMongo, get, jsonOf, testConfig } from "./helpers.ts";

const upMongo = { db: async () => ({}) as never, ping: async () => {}, close: async () => {} };

test("liveness answers ok and never touches the database", async () => {
  const app = createApp({ config: testConfig(), mongo: downMongo(), write: () => {} });
  for (const path of ["/health", "/api/v1/health", "/api/v1/health/live"]) {
    const res = await get(app, path);
    assert.equal(res.status, 200, path);
    assert.deepEqual(await jsonOf(res), { data: { status: "ok" } });
  }
});

test("readiness is 200 when configured and the database answers", async () => {
  const res = await get(createApp({ config: testConfig(), mongo: upMongo, write: () => {} }), "/api/v1/health/ready");
  assert.equal(res.status, 200);
  assert.deepEqual(await jsonOf(res), { data: { status: "ok", configuration: "ok", database: "ok", target: "none" } });
});

test("readiness is 503 when the database is down — and names no host", async () => {
  const res = await get(createApp({ config: testConfig(), mongo: downMongo(), write: () => {} }), "/api/v1/health/ready");
  assert.equal(res.status, 503);
  const text = await res.text();
  assert.deepEqual(JSON.parse(text), { data: { status: "unavailable", configuration: "ok", database: "unavailable", target: "none" } });
  assert.ok(!text.includes("db.internal"));
});

test("readiness is 503 when no database is configured", async () => {
  const res = await get(createApp({ config: testConfig(), mongo: null, write: () => {} }), "/api/v1/health/ready");
  assert.equal(res.status, 503);
  assert.equal((await jsonOf(res)).data.database, "not-configured");
});

test("readiness is 503 when the configuration is invalid", async () => {
  const res = await get(createApp({ env: { NODE_ENV: "production" }, write: () => {} }), "/api/v1/health/ready");
  assert.equal(res.status, 503);
  const { data } = await jsonOf(res);
  assert.equal(data.configuration, "invalid");
  assert.equal(data.target, "unknown", "an invalid configuration proves no target");
});

test("readiness names the KIND of database (never its name), for test tooling to refuse production", async () => {
  const production = { kind: "production", database: "risingbeyondborders", bucket: "rbb", productionBucket: true } as const;
  const res = await get(createApp({ config: testConfig({ target: production }), mongo: upMongo, write: () => {} }), "/api/v1/health/ready");
  const text = await res.text();
  assert.equal(JSON.parse(text).data.target, "production");
  assert.ok(!text.includes("risingbeyondborders"), "the database name is not in the body");
});

test("readiness with a real driver and an unreachable server is 503", async () => {
  /* Port 9 on localhost: nothing listens, so the driver fails fast. */
  const mongo = createMongoProvider(
    { uri: "mongodb://127.0.0.1:9/", dbName: "nowhere" },
    { createClient: (uri) => new MongoClient(uri, { ...CLIENT_OPTIONS, serverSelectionTimeoutMS: 300, connectTimeoutMS: 300 }) }
  );
  try {
    const res = await get(createApp({ config: testConfig(), mongo, write: () => {} }), "/api/v1/health/ready");
    assert.equal(res.status, 503);
    assert.equal((await jsonOf(res)).data.database, "unavailable");
  } finally {
    await mongo.close();
  }
});
