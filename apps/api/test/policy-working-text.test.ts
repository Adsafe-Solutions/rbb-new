import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "../src/errors.ts";
import { settingsRecord } from "./fixtures/settings.ts";
import { FACTS, member } from "./media/memory.ts";
import { harness, sharedData } from "./settings/memory.ts";
import { approvePage } from "./support/workflow.ts";

/* Milestone 1 — working-placeholder text in a policy ("Demo text —",
   "WORKING text —", example.org …: the website's own rules) is refused
   from SUBMISSION on: submit, approve, schedule and publish. A draft may
   hold it while the policy is being written. Before this, the API accepted
   it and the website build failed after the publish. Test text only. */

const owner = member("org-a", "OWNER");
const editor = member("org-a", "EDITOR");
const HOUR = 3_600_000;
const WORKING = "Demo text — a placeholder paragraph.";
const section = (id = "test-section", body = [`Test paragraph ${id}.`]) => ({ id, heading: `Heading ${id}`, body });
const complete = (o: Record<string, unknown> = {}) => ({ effectiveDate: "2026-09-01", lastUpdated: "2026-09-15", intro: ["Test intro."], sections: [section()], ...o });
const refused = async (promise: Promise<unknown>, path: string) =>
  assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError, String(error));
    assert.equal(error.code, "VALIDATION_ERROR", error.message);
    const detail = error.details?.find((d) => d.path.endsWith(path));
    assert.ok(detail, `a problem at ${path}: ${JSON.stringify(error.details)}`);
    assert.match(detail!.message, /working-placeholder text \([^)]*\b(demo text|working text)\b/);
    return true;
  });
async function site() {
  const data = sharedData();
  const h = harness("org-a", data);
  await h.settings.importInitial({ ...settingsRecord("org-a"), contact: { methods: [] } }, { id: null, name: "Settings import" });
  return { data, h };
}
/* The stored policy, edited in place — a record saved before this check
   existed (the store, not the service: no validation runs). */
const tamper = (data: ReturnType<typeof sharedData>, change: Record<string, unknown>) => {
  for (const stored of data.policies.privacy.values()) stored.record = { ...stored.record, ...change } as never;
};
const draftWith = async (h: ReturnType<typeof harness>, changes: Record<string, unknown>) => h.policies.privacy.update(editor, { revision: 0, changes: complete(changes) }, FACTS);

test("a draft may hold working text while it is written — saved, kept, and editable", async () => {
  const { h } = await site();
  const draft = await draftWith(h, { intro: [WORKING], sections: [section("a", [WORKING])] });
  assert.equal(draft.record!.status, "draft");
  assert.deepEqual(draft.record!.intro, [WORKING]);
  const edited = await h.policies.privacy.update(editor, { revision: draft.revision, changes: { lastUpdated: "2026-09-20" } }, FACTS);
  assert.equal(edited.record!.status, "draft");
});

test("submitting refuses working text — in the intro, or in any section, by path", async () => {
  const { h } = await site();
  const intro = await draftWith(h, { intro: [WORKING] });
  await refused(h.policies.privacy.act(editor, "submit", { revision: intro.revision }, FACTS), "body.intro");
  const fixedIntro = await h.policies.privacy.update(editor, { revision: intro.revision, changes: { intro: ["Test intro."], sections: [section("a"), section("b", ["WORKING text — to come.", WORKING])] } }, FACTS);
  await refused(h.policies.privacy.act(editor, "submit", { revision: fixedIntro.revision }, FACTS), "body.sections.1");
  assert.equal((await h.policies.privacy.get(editor)).record!.status, "draft", "still a draft, still editable");
});

test("approval and scheduling refuse it too — a policy submitted or approved before this check cannot slip through", async () => {
  const { h, data } = await site();
  const clean = await draftWith(h, {});
  const submitted = await h.policies.privacy.act(editor, "submit", { revision: clean.revision }, FACTS);
  tamper(data, { intro: [WORKING] });
  await refused(h.policies.privacy.act(owner, "approve", { revision: submitted.revision }, FACTS), "body.intro");

  tamper(data, { intro: ["Test intro."] });
  const approved = await h.policies.privacy.act(owner, "approve", { revision: submitted.revision }, FACTS);
  tamper(data, { sections: [section("a", [WORKING])] });
  const at = new Date(Date.now() + 2 * HOUR).toISOString();
  await refused(h.policies.privacy.schedule(owner, { revision: approved.revision, localTime: at.slice(0, 16), timeZone: "UTC" }, FACTS), "body.sections.0");
});

test("publishing refuses an approved policy that carries working text — the website build would fail on it", async () => {
  const { h, data } = await site();
  await draftWith(h, {});
  await approvePage(h.policies.privacy, owner, FACTS);
  tamper(data, { sections: [section("a", [WORKING])] });
  const preview = await h.publishing.preview(owner);
  assert.equal(preview.snapshot, null);
  assert.ok(preview.problems.some((p) => p.path === "content.policies.privacy.sections.0" && /working-placeholder text/.test(p.message)), JSON.stringify(preview.problems));
  await assert.rejects(h.publishing.publish(owner, FACTS));
  assert.equal(await h.publishing.publicSnapshot(), null, "nothing was published");
});

test("RBB's own text goes through: submit, approve and publish", async () => {
  const { h } = await site();
  await draftWith(h, {});
  await approvePage(h.policies.privacy, owner, FACTS);
  await h.publishing.publish(owner, FACTS);
  const snapshot = (await h.publishing.publicSnapshot())!;
  assert.deepEqual(snapshot.content.policies!.map((p) => p.id), ["privacy"]);
  /* The format hint the email field uses is never a finding (as in the website's scan). */
  const { h: h2 } = await site();
  const hinted = await h2.policies.privacy.update(editor, { revision: 0, changes: complete({ intro: ["Write to us at name@example.com style addresses only in forms."] }) }, FACTS);
  await h2.policies.privacy.act(editor, "submit", { revision: hinted.revision }, FACTS);
});
