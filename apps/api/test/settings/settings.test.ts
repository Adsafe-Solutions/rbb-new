import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "../../src/errors.ts";
import { CONFLICT_MESSAGE, changedPaths } from "../../src/modules/settings/service.ts";
import { settingsRecord } from "../fixtures/settings.ts";
import { FACTS, member } from "../media/memory.ts";
import { addMedia, harness, sharedData } from "./memory.ts";

const rejects = async (promise: Promise<unknown>, code: string, message?: string) =>
  assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError, String(error));
    assert.equal(error.code, code);
    if (message) assert.equal(error.message, message);
    return true;
  });

async function imported(h = harness()) {
  const result = await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  assert.deepEqual(result, { created: true, problems: [] });
  return h;
}

test("import: creates the first record once, as this organization's working copy", async () => {
  const h = harness();
  const owner = member("org-a", "OWNER");
  assert.equal(await h.settings.get(owner), null, "nothing until imported");
  await h.settings.importInitial({ ...settingsRecord("org-a"), status: "published", releaseMarker: "sample", orgId: "org-a" }, { id: null, name: "Settings import" });
  const view = (await h.settings.get(owner))!;
  assert.equal(view.settings.status, "draft", "the working copy is never 'published'");
  assert.equal(view.settings.releaseMarker, undefined);
  assert.equal(view.revision, 1);
  const again = await h.settings.importInitial({ ...settingsRecord("org-a"), general: { shortName: "X", name: "X", summary: "X" } }, { id: null, name: "x" });
  assert.equal(again.created, false, "an existing record is never replaced");
  assert.equal((await h.settings.get(owner))!.settings.general.shortName, "TEST");
  const invalid = await harness().settings.importInitial({ ...settingsRecord("org-a"), social: [{ platform: "myspace", url: "x" }] }, { id: null, name: "x" });
  assert.equal(invalid.created, false);
  assert.ok(invalid.problems.some((p) => p.path.startsWith("social")));
});

test("update: whole sections, contract-validated, revision-checked, audited by field name", async () => {
  const h = await imported();
  const owner = member("org-a", "OWNER");
  const saved = await h.settings.update(owner, { revision: 1, changes: { general: { shortName: "TEST", name: "Test Organization", summary: "A new summary." }, analytics: { googleAnalyticsId: "G-ABC1234" } } }, FACTS);
  assert.equal(saved.revision, 2);
  assert.equal(saved.settings.general.summary, "A new summary.");
  assert.equal(saved.updatedBy.isYou, true);
  const entry = h.audit.find((e) => e.action === "settings.updated")!;
  assert.deepEqual(entry.metadata.fields, ["analytics.googleAnalyticsId", "general.summary"]);
  assert.equal(entry.actorUserId, owner.user.id);
  assert.ok(!JSON.stringify(entry).includes("A new summary") && !JSON.stringify(entry).includes("G-ABC1234"), "names, never values");

  await rejects(h.settings.update(owner, { revision: 1, changes: { general: { shortName: "A", name: "B", summary: "C" } } }, FACTS), "CONFLICT", CONFLICT_MESSAGE);
  assert.equal((await h.settings.get(owner))!.settings.general.shortName, "TEST", "a stale save changes nothing");
});

test("update: invalid or unknown input is refused, never silently dropped", async () => {
  const h = await imported();
  const owner = member("org-a", "OWNER");
  const base = settingsRecord("org-a");
  for (const changes of [
    { footer: { text: "x" } },
    { orgId: "org-b" },
    { status: "published" },
    { general: { ...base.general, extra: true } },
    { general: { shortName: "" , name: base.general.name, summary: base.general.summary } },
    { social: [{ platform: "instagram", url: "http://insecure.example" }] },
    { social: [{ platform: "instagram", url: "https://a.example" }, { platform: "instagram", url: "https://b.example" }] },
    { social: [{ platform: "instagram", url: "javascript:alert(1)" }] },
    { analytics: { googleAnalyticsId: "UA-12345-1" } },
    { analytics: { resendApiKey: "re_123456789012345" } },
    { contact: { methods: [{ id: "m1", type: "email", label: "Email", value: "a@b.example" }, { id: "m1", type: "phone", label: "Phone", value: "+1 555 0100" }] } },
    { donations: { ...base.donations, form: { ...base.donations.form, minimumAmount: 500, maximumAmount: 10 } } },
    {},
  ])
    await rejects(h.settings.update(owner, { revision: 1, changes }, FACTS), "VALIDATION_ERROR");
  await rejects(h.settings.update(owner, { changes: { general: base.general } }, FACTS), "VALIDATION_ERROR");
  assert.equal((await h.settings.get(owner))!.revision, 1, "nothing was saved");
});

test("branding: only ready media of this organization can be referenced", async () => {
  const data = sharedData();
  const h = await imported(harness("org-a", data));
  const owner = member("org-a", "OWNER");
  const ready = addMedia(data, "org-a", "ready");
  for (const bad of [addMedia(data, "org-a", "pending"), addMedia(data, "org-a", "deleted"), addMedia(data, "org-a", "failed"), addMedia(data, "org-b", "ready")])
    await rejects(h.settings.update(owner, { revision: 1, changes: { branding: { logoId: bad.id } } }, FACTS), "VALIDATION_ERROR");
  const saved = await h.settings.update(owner, { revision: 1, changes: { branding: { logoId: ready.id, faviconId: ready.id } } }, FACTS);
  assert.equal(saved.settings.branding.logoId, ready.id);
});

test("organization isolation: another organization's context is refused; records never cross", async () => {
  const data = sharedData();
  const a = await imported(harness("org-a", data));
  const b = harness("org-b", data);
  await rejects(a.settings.get(member("org-b", "OWNER")), "FORBIDDEN");
  await rejects(a.settings.update(member("org-b", "OWNER"), { revision: 1, changes: {} }, FACTS), "FORBIDDEN");
  assert.equal(await b.settings.get(member("org-b", "OWNER")), null, "org B sees no settings, not org A's");
});

test("changedPaths: leaf paths of what differs", () => {
  assert.deepEqual(changedPaths({ a: { b: 1, c: [1] } }, { a: { b: 2, c: [1, 2] } }), ["a.b", "a.c"]);
  assert.deepEqual(changedPaths({ a: 1 }, { a: 1 }), []);
});
