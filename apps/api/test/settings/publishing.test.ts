import { test } from "node:test";
import assert from "node:assert/strict";
import { PublishedSnapshot } from "@rbb/content-schema";
import { ApiError } from "../../src/errors.ts";
import { WebhookDeploymentTrigger, type DeploymentTrigger } from "../../src/modules/publishing/deploy.ts";
import { contentHash, secretProblems } from "../../src/modules/publishing/service.ts";
import { settingsRecord } from "../fixtures/settings.ts";
import { FACTS, member } from "../media/memory.ts";
import { addMedia, harness, sharedData } from "./memory.ts";

const owner = member("org-a", "OWNER");
const rejects = async (promise: Promise<unknown>, code: string) =>
  assert.rejects(promise, (error: unknown) => error instanceof ApiError && error.code === code);

async function ready(h = harness()) {
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  return h;
}
const summary = (h: ReturnType<typeof harness>, text: string) =>
  h.settings.get(owner).then((v) => h.settings.update(owner, { revision: v!.revision, changes: { general: { ...v!.settings.general, summary: text } } }, FACTS));

test("status before and after the first publish", async () => {
  const h = harness();
  assert.deepEqual(await h.publishing.status(owner), { active: null, hasUnpublishedChanges: false, changedSections: [], settingsReady: false, canPublish: true, deployment: { configured: false }, review: { approved: [], scheduled: [], submitted: [], totals: { approved: 0, scheduled: 0, submitted: 0 } }, blockers: [], changesKey: null });
  await ready(h);
  assert.equal((await h.publishing.status(owner)).hasUnpublishedChanges, true);
  assert.equal((await h.publishing.status(member("org-a", "EDITOR"))).canPublish, false);
  const result = await h.publishing.publish(owner, FACTS);
  assert.equal(result.version, 1);
  assert.deepEqual(result.deployment, { status: "not-configured" }, "no pretend deploy");
  const status = await h.publishing.status(owner);
  assert.equal(status.active?.version, 1);
  assert.equal(status.active?.publishedBy, "Test Member");
  assert.equal(status.hasUnpublishedChanges, false);
  assert.deepEqual(status.changedSections, []);
  await summary(h, "Changed.");
  assert.deepEqual((await h.publishing.status(owner)).changedSections, ["general"]);
});

test("a publish freezes a valid, published, public-only snapshot; drafts stay out until the next publish", async () => {
  const h = await ready();
  await h.publishing.publish(owner, FACTS);
  const first = (await h.publishing.publicSnapshot())!;
  assert.ok(PublishedSnapshot.safeParse(first).success);
  assert.equal(first.settings.status, "published");
  assert.ok(first.settings.publishedAt);
  assert.deepEqual(first.content, {});

  await summary(h, "Working copy, not yet published.");
  assert.equal((await h.publishing.status(owner)).hasUnpublishedChanges, true);
  assert.notEqual((await h.publishing.publicSnapshot())!.settings.general.summary, "Working copy, not yet published.", "the draft is not public");

  await rejects(h.publishing.publish(owner, FACTS).then(() => h.publishing.publish(owner, FACTS)), "CONFLICT");
  const second = (await h.publishing.publicSnapshot())!;
  assert.equal(second.version, 2);
  assert.equal(second.settings.general.summary, "Working copy, not yet published.");
  assert.equal((await h.publishing.publicSnapshot(1))!.settings.general.summary, "A test organization.", "old versions stay as they were");
  assert.equal(await h.publishing.publicSnapshot(3), null, "no future versions");
});

test("media: only referenced, ready media of this organization is published — and nothing private about it", async () => {
  const data = sharedData();
  const h = await ready(harness("org-a", data));
  const logo = addMedia(data, "org-a", "ready", { alt: "Test logo", objectKey: "org-a/media/secret-key/logo.png", caption: "A public caption", credit: "private credit", license: "private licence" });
  addMedia(data, "org-a", "ready", { originalFilename: "unrelated.png" });
  addMedia(data, "org-a", "pending");
  const v = (await h.settings.get(owner))!;
  await h.settings.update(owner, { revision: v.revision, changes: { branding: { logoId: logo.id } } }, FACTS);
  await h.publishing.publish(owner, FACTS);
  const snapshot = (await h.publishing.publicSnapshot())!;
  assert.deepEqual(Object.keys(snapshot.media), [logo.id]);
  /* Milestone 2: the caption is published (pages show it); credit, licence and consent are not. */
  assert.deepEqual(snapshot.media[logo.id], { id: logo.id, url: logo.publicUrl, mimeType: "image/png", width: 128, height: 128, alt: "Test logo", caption: "A public caption" });
  const text = JSON.stringify(snapshot);
  for (const leak of ["secret-key", "private credit", "private licence", "unrelated.png", "objectKey", "createdBy", "consent"]) assert.ok(!text.includes(leak), leak);
});

test("a reference that stopped being valid makes the publish FAIL, and the public keeps the previous version", async () => {
  const data = sharedData();
  const h = await ready(harness("org-a", data));
  const logo = addMedia(data, "org-a", "ready");
  const v = (await h.settings.get(owner))!;
  await h.settings.update(owner, { revision: v.revision, changes: { branding: { logoId: logo.id } } }, FACTS);
  await h.publishing.publish(owner, FACTS);
  await summary(h, "Changed again.");
  logo.status = "deleted";
  await rejects(h.publishing.publish(owner, FACTS), "VALIDATION_ERROR");
  assert.equal((await h.publishing.publicSnapshot())!.version, 1);
  assert.ok(h.audit.some((e) => e.action === "publish.rejected"));
  assert.equal(data.publish.get("org-a")!.lockId, null, "the lock is released on failure");
});

test("anything credential-shaped cannot be published, even inside allowed text", async () => {
  const h = await ready();
  await summary(h, "Key re_abcdefghijklmnopqrst for the mail service.");
  await rejects(h.publishing.publish(owner, FACTS), "VALIDATION_ERROR");
  assert.equal(await h.publishing.publicSnapshot(), null);
  assert.deepEqual(secretProblems({ a: { apiKey: "x" }, b: "mongodb://u:p@h/db", c: "fine" }), ["snapshot.a.apiKey", "snapshot.b"]);
});

test("one publish at a time; versions only ever increase", async () => {
  const h = await ready();
  assert.equal(await h.publishStore.acquireLock("someone-else", h.time.now(), 60_000), true);
  await rejects(h.publishing.publish(owner, FACTS), "CONFLICT");
  h.time.advance(61_000); // an abandoned lock expires
  assert.equal((await h.publishing.publish(owner, FACTS)).version, 1);
  for (let i = 2; i <= 4; i++) {
    await summary(h, `Revision ${i}.`);
    assert.equal((await h.publishing.publish(owner, FACTS)).version, i);
  }
});

test("organization isolation: org B never publishes or reads org A's snapshot", async () => {
  const data = sharedData();
  const a = await ready(harness("org-a", data));
  const b = harness("org-b", data);
  await a.publishing.publish(owner, FACTS);
  assert.equal(await b.publishing.publicSnapshot(), null);
  await rejects(a.publishing.publish(member("org-b", "OWNER"), FACTS), "FORBIDDEN");
  await rejects(b.publishing.publish(member("org-b", "OWNER"), FACTS), "CONFLICT"); // org B has no settings of its own
});

test("audit: publish.completed with version and deployment outcome", async () => {
  const h = await ready();
  await h.publishing.publish(owner, FACTS);
  const entry = h.audit.find((e) => e.action === "publish.completed")!;
  assert.deepEqual(entry.metadata, { version: 1, previousVersion: null, deployment: "not-configured", trigger: "manual", counts: {} });
  assert.equal(entry.actorUserId, owner.user.id);
  assert.equal(entry.requestId, FACTS.requestId);
});

test("deployment trigger: a webhook is told the version; its failure never fails the publish", async () => {
  const calls: { url: string; body: string }[] = [];
  const ok = new WebhookDeploymentTrigger("https://hooks.example/build/secret-token", { fetch: (async (url: string, init: RequestInit) => (calls.push({ url, body: String(init.body) }), new Response(null, { status: 200 }))) as unknown as typeof fetch });
  assert.deepEqual(await ok.trigger({ orgId: "org-a", version: 7 }), { status: "triggered" });
  assert.deepEqual(JSON.parse(calls[0]!.body), { event: "snapshot.published", organization: "org-a", version: 7 });
  const down = new WebhookDeploymentTrigger("https://hooks.example/x", { fetch: (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch });
  assert.deepEqual(await down.trigger({ orgId: "org-a", version: 1 }), { status: "failed", reason: "network" });
  const rejected = new WebhookDeploymentTrigger("https://hooks.example/x", { fetch: (async () => new Response(null, { status: 500 })) as unknown as typeof fetch });

  const h = await ready(harness("org-a", sharedData(), rejected as DeploymentTrigger));
  const result = await h.publishing.publish(owner, FACTS);
  assert.deepEqual(result.deployment, { status: "failed", reason: "rejected" });
  assert.equal((await h.publishing.publicSnapshot())!.version, 1, "the snapshot is live regardless");
  assert.ok(!JSON.stringify(h.audit).includes("secret-token"));
});

test("contentHash ignores timestamps and status, sees content", () => {
  const record = { ...settingsRecord("org-a"), status: "draft" } as never;
  assert.equal(contentHash(record), contentHash({ ...(record as object), status: "published", updatedAt: "2026-01-01T00:00:00Z" } as never));
  assert.notEqual(contentHash(record), contentHash({ ...(record as object), features: { themeSwitcher: true } } as never));
});
