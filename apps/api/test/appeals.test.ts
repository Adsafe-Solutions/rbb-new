import { test } from "node:test";
import assert from "node:assert/strict";
import { Appeal } from "@rbb/content-schema";
import { AppealService } from "../src/modules/appeals/service.ts";
import type { ApiError } from "../src/errors.ts";
import { MemoryAppealStore } from "./helpers.ts";
import { TEST_ORG, appealRecord } from "./fixtures/appeal.ts";

const clock = (iso: string) => () => new Date(iso);
const service = (store = new MemoryAppealStore(), now = clock("2026-10-06T12:00:00.000Z")) => ({
  store,
  appeals: new AppealService(store, TEST_ORG, now),
});
const codeOf = async (promise: Promise<unknown>) => ((await promise.catch((e) => e)) as ApiError).code;

test("the API uses the content contract itself — @rbb/content-schema's Appeal", () => {
  assert.equal(Appeal.safeParse(appealRecord()).success, true);
  assert.equal(Appeal.safeParse(appealRecord({ kind: "project" })).success, false);
});

test("create validates against the contract and stores the record", async () => {
  const { appeals, store } = service();
  const { appeal, revision } = await appeals.create(appealRecord());
  assert.equal(revision, 1);
  assert.equal(appeal.slug, "test-appeal-01");
  assert.equal(store.rows.size, 1);
});

test("an invalid appeal is refused with field paths, and nothing is stored", async () => {
  const { appeals, store } = service();
  const error = (await appeals.create(appealRecord({ title: "", sections: [{ type: "html" }] })).catch((e) => e)) as ApiError;
  assert.equal(error.code, "VALIDATION_ERROR");
  const paths = error.details!.map((d) => d.path);
  assert.ok(paths.includes("title"));
  assert.ok(paths.some((p) => p.startsWith("sections.0")));
  assert.equal(store.rows.size, 0);
});

test("a record for another organization is refused", async () => {
  const { appeals } = service();
  const error = (await appeals.create(appealRecord({ orgId: "someone-else" })).catch((e) => e)) as ApiError;
  assert.equal(error.code, "VALIDATION_ERROR");
  assert.deepEqual(error.details, [{ path: "orgId", message: "must be this deployment's organization" }]);
});

test("timestamps are the API's: caller-sent values are replaced", async () => {
  const { appeals } = service();
  const { appeal } = await appeals.create(
    appealRecord({ createdAt: "2000-01-01T00:00:00.000Z", updatedAt: "2000-01-01T00:00:00.000Z" })
  );
  assert.equal(appeal.createdAt, "2026-10-06T12:00:00.000Z");
  assert.equal(appeal.updatedAt, "2026-10-06T12:00:00.000Z");
  assert.equal(appeal.publishedAt, "2026-10-06T12:00:00.000Z");
});

test("a draft has no publishedAt and is invisible to readers", async () => {
  const { appeals } = service();
  const { appeal } = await appeals.create(appealRecord({ status: "draft" }));
  assert.equal(appeal.publishedAt, undefined);
  assert.equal(await codeOf(appeals.getPublished("test-appeal-01")), "NOT_FOUND");
});

test("a published appeal is read back by slug", async () => {
  const { appeals } = service();
  await appeals.create(appealRecord());
  const appeal = await appeals.getPublished("test-appeal-01");
  assert.equal(appeal.title, "Test Appeal");
  assert.equal(await codeOf(appeals.getPublished("missing")), "NOT_FOUND");
});

test("a duplicate slug or id is a CONFLICT", async () => {
  const { appeals } = service();
  await appeals.create(appealRecord());
  assert.equal(await codeOf(appeals.create(appealRecord())), "CONFLICT");
  assert.equal(await codeOf(appeals.create(appealRecord({ id: "other-id" }))), "CONFLICT");
});

test("update keeps createdAt, moves updatedAt, and needs the current revision", async () => {
  const store = new MemoryAppealStore();
  await service(store, clock("2026-10-01T09:00:00.000Z")).appeals.create(appealRecord());
  const later = service(store, clock("2026-10-06T12:00:00.000Z")).appeals;
  const { appeal, revision } = await later.update("test-appeal-01", appealRecord({ title: "Renamed" }), 1);
  assert.equal(revision, 2);
  assert.equal(appeal.title, "Renamed");
  assert.equal(appeal.createdAt, "2026-10-01T09:00:00.000Z");
  assert.equal(appeal.updatedAt, "2026-10-06T12:00:00.000Z");
  assert.equal(appeal.publishedAt, "2026-10-01T09:00:00.000Z");
  assert.equal(await codeOf(later.update("test-appeal-01", appealRecord(), 1)), "CONFLICT");
  assert.equal(await codeOf(later.update("missing", appealRecord({ id: "missing" }), 1)), "NOT_FOUND");
  assert.equal(await codeOf(later.update("test-appeal-01", appealRecord({ id: "changed" }), 2)), "VALIDATION_ERROR");
});

test("a stored record that no longer meets the contract never leaves the API", async () => {
  const store = new MemoryAppealStore();
  store.rows.set("broken", { record: { ...appealRecord({ id: "broken", slug: "broken" }), kind: "unknown" }, revision: 1 });
  assert.equal(await codeOf(service(store).appeals.getPublished("broken")), "INTERNAL_ERROR");
});
