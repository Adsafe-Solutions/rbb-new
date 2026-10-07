import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { MongoClient, ObjectId } from "mongodb";
import type { Appeal } from "@rbb/content-schema";
import { createApp } from "../../src/app.ts";
import { COLLECTIONS, INDEXES, ensureIndexes } from "../../src/db/collections.ts";
import { CLIENT_OPTIONS, DuplicateKeyError, createMongoProvider } from "../../src/db/mongo.ts";
import { MongoAppealStore } from "../../src/modules/appeals/repository.ts";
import { AppealService } from "../../src/modules/appeals/service.ts";
import { TEST_ORG, appealRecord } from "../fixtures/appeal.ts";
import { get, jsonOf, testConfig } from "../helpers.ts";
import { testMongo } from "./mongo.ts";

const mongo = testMongo();
const raw = () => mongo.db().collection(COLLECTIONS.appeals);
const appeal = (overrides: Record<string, unknown> = {}) => appealRecord(overrides) as unknown as Appeal;

before(async () => {
  await mongo.client.connect();
  await ensureIndexes(mongo.db());
});
after(() => mongo.cleanup());

test("ensureIndexes creates exactly the declared indexes and is idempotent", async () => {
  await ensureIndexes(mongo.db());
  await ensureIndexes(mongo.db());
  const names = (await raw().indexes()).map((i) => i.name).sort();
  assert.deepEqual(names, ["_id_", ...INDEXES.appeals.map((i) => i.name!)].sort());
  const slugIndex = (await raw().indexes()).find((i) => i.name === "orgId_slug_unique")!;
  assert.equal(slugIndex.unique, true);
  assert.deepEqual(slugIndex.key, { orgId: 1, slug: 1 });
});

test("the repository stores a document with its own _id, revision and BSON dates", async () => {
  const store = new MongoAppealStore(mongo.db(), TEST_ORG);
  const stored = await store.insert({
    ...appeal({ id: "repo-1", slug: "repo-1" }),
    createdAt: "2026-10-06T12:00:00.000Z",
    updatedAt: "2026-10-06T12:00:00.000Z",
  });
  assert.equal(stored.revision, 1);
  assert.equal("_id" in stored.record, false, "_id must not leave the repository");

  const document = (await raw().findOne({ id: "repo-1" }))!;
  assert.ok(document._id instanceof ObjectId, "_id is an ObjectId, not the slug");
  assert.notEqual(String(document._id), document.slug);
  assert.ok(document.createdAt instanceof Date, "timestamps are stored as BSON dates");
  assert.equal(document.revision, 1);

  const read = (await store.findBySlug("repo-1"))!;
  assert.equal(read.record.createdAt, "2026-10-06T12:00:00.000Z", "and read back as ISO strings");
  assert.deepEqual(await store.findById("repo-1"), read);
});

test("unique indexes refuse a second slug or id within one organization", async () => {
  const store = new MongoAppealStore(mongo.db(), TEST_ORG);
  await store.insert(appeal({ id: "dupe-1", slug: "dupe-1" }));
  const bySlug = await store.insert(appeal({ id: "dupe-2", slug: "dupe-1" })).catch((e) => e);
  assert.ok(bySlug instanceof DuplicateKeyError);
  assert.equal(bySlug.field, "slug");
  const byId = await store.insert(appeal({ id: "dupe-1", slug: "dupe-3" })).catch((e) => e);
  assert.equal(byId.field, "id");
});

test("every query is scoped to the organization", async () => {
  const ours = new MongoAppealStore(mongo.db(), TEST_ORG);
  const theirs = new MongoAppealStore(mongo.db(), "another-org");
  await ours.insert(appeal({ id: "scoped-1", slug: "scoped-1" }));
  assert.equal(await theirs.findBySlug("scoped-1"), null);
  /* The same slug is free in another organization. */
  await theirs.insert(appeal({ id: "scoped-1", slug: "scoped-1", orgId: "another-org" }));
  await assert.rejects(theirs.insert(appeal({ id: "x", slug: "x" })), /another organization/);
});

test("replace needs the current revision", async () => {
  const store = new MongoAppealStore(mongo.db(), TEST_ORG);
  await store.insert(appeal({ id: "rev-1", slug: "rev-1" }));
  const next = await store.replace("rev-1", appeal({ id: "rev-1", slug: "rev-1", title: "Second" }), 1);
  assert.equal(next!.revision, 2);
  assert.equal(next!.record.title, "Second");
  assert.equal(await store.replace("rev-1", appeal({ id: "rev-1", slug: "rev-1" }), 1), null);
});

test("service → repository → MongoDB: created, read back, drafts hidden", async () => {
  const service = new AppealService(new MongoAppealStore(mongo.db(), TEST_ORG), TEST_ORG);
  await service.create(appealRecord({ id: "svc-1", slug: "svc-1" }));
  await service.create(appealRecord({ id: "svc-2", slug: "svc-2", status: "draft" }));
  assert.equal((await service.getPublished("svc-1")).title, "Test Appeal");
  await assert.rejects(service.getPublished("svc-2"), (e: { code: string }) => e.code === "NOT_FOUND");
});

test("one MongoClient serves every provider and request for the same database", async () => {
  let created = 0;
  const createClient = (uri: string) => {
    created++;
    return new MongoClient(uri, CLIENT_OPTIONS);
  };
  const settings = { uri: mongo.uri, dbName: mongo.dbName };
  const a = createMongoProvider(settings, { createClient });
  const b = createMongoProvider(settings, { createClient });
  await Promise.all([a.ping(), b.ping(), a.db(), b.db()]);
  await a.ping();
  assert.equal(created, 1);
  await a.close();
});

test("over HTTP: readiness, the internal appeal route, and no storage fields in the response", async () => {
  const provider = createMongoProvider({ uri: mongo.uri, dbName: mongo.dbName });
  const app = createApp({ config: testConfig({ mongo: { uri: mongo.uri, dbName: mongo.dbName } }), mongo: provider, write: () => {} });
  try {
    const ready = await get(app, "/api/v1/health/ready");
    assert.equal(ready.status, 200);
    assert.deepEqual(await jsonOf(ready), { data: { status: "ok", configuration: "ok", database: "ok" } });

    const service = new AppealService(new MongoAppealStore(mongo.db(), TEST_ORG), TEST_ORG);
    await service.create(appealRecord({ id: "http-1", slug: "http-1" }));
    await service.create(appealRecord({ id: "http-2", slug: "http-2", status: "draft" }));

    const res = await get(app, "/api/v1/internal/appeals/http-1");
    assert.equal(res.status, 200);
    const { data } = await jsonOf(res);
    assert.equal(data.slug, "http-1");
    assert.equal(data.orgId, TEST_ORG);
    for (const field of ["_id", "revision"]) assert.equal(field in data, false, `${field} leaked into the response`);
    assert.match(data.createdAt, /^\d{4}-\d\d-\d\dT/);

    assert.equal((await get(app, "/api/v1/internal/appeals/http-2")).status, 404, "a draft is not readable");
    assert.equal((await get(app, "/api/v1/internal/appeals/nope")).status, 404);
  } finally {
    await provider.close();
  }
});
