import { test } from "node:test";
import assert from "node:assert/strict";
import { PublishedSnapshot } from "@rbb/content-schema";
import { ApiError } from "../../src/errors.ts";
import { settingsRecord } from "../fixtures/settings.ts";
import { FACTS, member } from "../media/memory.ts";
import { harness } from "./memory.ts";

/* Settings → General: the admin's country selection. Saved, validated
   and audited like any settings section — and NEVER published: it is not
   in any snapshot and not a change to publish. Test data only. */

const owner = member("org-a", "OWNER");
const rejects = async (promise: Promise<unknown>, code: string) =>
  assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError, String(error));
    assert.equal(error.code, code);
    return true;
  });

async function imported() {
  const h = harness();
  assert.deepEqual(await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" }), { created: true, problems: [] });
  return h;
}

test("countries: empty until selected; saved from the list only, each once (owners only: the route's settings:write, as every section)", async () => {
  const h = await imported();
  assert.equal((await h.settings.get(owner))!.settings.countries, undefined, "nothing selected by default");
  for (const countries of [["Atlantis"], ["kenya"], ["Kenya", "Kenya"], "Kenya"])
    await rejects(h.settings.update(owner, { revision: 1, changes: { countries } }, FACTS), "VALIDATION_ERROR");
  const saved = await h.settings.update(owner, { revision: 1, changes: { countries: ["Kenya", "Peru"] } }, FACTS);
  assert.deepEqual(saved.settings.countries, ["Kenya", "Peru"]);
  assert.deepEqual((await h.settings.get(owner))!.settings.countries, ["Kenya", "Peru"], "loaded again as saved");
  const entry = [...h.audit].reverse().find((e) => e.action === "settings.updated")!;
  assert.ok((entry.metadata.fields as string[]).every((f) => f.startsWith("countries")));
  const cleared = await h.settings.update(owner, { revision: saved.revision, changes: { countries: [] } }, FACTS);
  assert.deepEqual(cleared.settings.countries, []);
});

test("countries: never published — not in the snapshot, not a change to publish", async () => {
  const h = await imported();
  await h.publishing.publish(owner, FACTS);
  const before = await h.publishing.status(owner);
  assert.equal(before.hasUnpublishedChanges, false);
  const v = (await h.settings.get(owner))!;
  await h.settings.update(owner, { revision: v.revision, changes: { countries: ["Kenya"] } }, FACTS);
  const after = await h.publishing.status(owner);
  assert.equal(after.hasUnpublishedChanges, false, "selecting countries is not a change to the website");
  assert.deepEqual(after.changedSections, []);
  await rejects(h.publishing.publish(owner, FACTS), "CONFLICT");
  // A real change publishes; the selection stays behind.
  const w = (await h.settings.get(owner))!;
  await h.settings.update(owner, { revision: w.revision, changes: { general: { ...w.settings.general, summary: "Changed." } } }, FACTS);
  await h.publishing.publish(owner, FACTS);
  const snapshot = (await h.publishing.publicSnapshot())!;
  assert.equal("countries" in snapshot.settings, false);
  assert.ok(!JSON.stringify(snapshot).includes("Kenya"));
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.equal(PublishedSnapshot.safeParse({ ...snapshot, settings: { ...snapshot.settings, countries: ["Kenya"] } }).success, false, "the contract refuses it in a snapshot");
});
