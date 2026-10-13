import { test } from "node:test";
import assert from "node:assert/strict";
import { NotificationService } from "../src/modules/notifications/service.ts";
import type { StoredSubmission } from "../src/modules/submissions/repository.ts";
import { settingsRecord } from "./fixtures/settings.ts";
import { FACTS, member } from "./media/memory.ts";
import { harness } from "./settings/memory.ts";
import { memorySubmissionStore } from "./submissions/memory.ts";
import { createApproved } from "./support/workflow.ts";

/* The topbar's notifications (2026-10-13): live counts of what waits —
   new form submissions (owners), content waiting for review and approved
   changes waiting for publication (owners and editors). Test records only. */

const owner = member("org-a", "OWNER");
const editor = member("org-a", "EDITOR");
const body = [{ type: "paragraph", children: [{ type: "text", text: "A test paragraph." }] }];
const story = (title: string) => ({ title, category: "field", body });
const row = (formId: string, status: "new" | "read", n: number): StoredSubmission => ({ id: `s${n}`, orgId: "org-a", formId, reference: `R${n}`, fields: { email: `p${n}@test.example` }, status, createdAt: "2026-10-13T10:00:00.000Z", updatedAt: "2026-10-13T10:00:00.000Z" }) as StoredSubmission;

async function world() {
  const h = harness("org-a");
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  const rows = [row("contact", "new", 1), row("contact", "read", 2), row("newsletter", "new", 3), row("volunteer", "new", 4)];
  const store = memorySubmissionStore(rows, "org-a");
  const service = new NotificationService({ counts: () => store.counts(), review: (auth) => h.publishing.review(auth), now: h.time.now });
  return { h, service };
}

test("owners: new submissions by form, content waiting for review, approved changes waiting to be published", async () => {
  const { h, service } = await world();
  await createApproved(h.stories, owner, story("Approved story"), FACTS);
  const draft = await h.stories.create(editor, story("Waiting story"), FACTS);
  await h.stories.act(editor, draft.record.id, "submit", { revision: draft.revision }, FACTS);
  const n = await service.list(owner);
  assert.deepEqual(n.submissions, { new: 3, byForm: { contact: 1, newsletter: 1, volunteer: 1 } });
  assert.equal(n.publishing!.submitted.total, 1);
  assert.deepEqual(n.publishing!.submitted.items, [{ section: "Stories", title: "Waiting story" }]);
  assert.equal(n.publishing!.approved.total, 1);
  assert.deepEqual(n.publishing!.approved.items, [{ section: "Stories", title: "Approved story" }]);
  assert.deepEqual(n.publishing!.failedSchedules, []);
  assert.equal(n.canApprove && n.canPublish, true);
  // Published: nothing waits any more.
  await h.publishing.publish(owner, FACTS);
  assert.equal((await service.list(owner)).publishing!.approved.total, 0);
});

test("editors see the publishing queue but never form submissions, and cannot approve or publish", async () => {
  const { service } = await world();
  const n = await service.list(editor);
  assert.equal(n.submissions, null);
  assert.ok(n.publishing);
  assert.equal(n.canApprove, false);
  assert.equal(n.canPublish, false);
});
