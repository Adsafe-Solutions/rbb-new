import { test } from "node:test";
import assert from "node:assert/strict";
import { Appeal, PublishedSnapshot } from "@rbb/content-schema";
import { ApiError } from "../src/errors.ts";
import { publishedAppeal } from "../src/modules/appeals/service.ts";
import { campaignProblems } from "../src/modules/donations/verify.ts";
import { settingsRecord } from "./fixtures/settings.ts";
import { FACTS, member } from "./media/memory.ts";
import { MemoryContentStore } from "./content/memory.ts";
import { addMedia, harness, sharedData } from "./settings/memory.ts";
import { FakeDonationProvider, fakeCampaign, testCheckout } from "./support/fake-donations.ts";
import { approve, approvePage, createApproved } from "./support/workflow.ts";

/* Appeals and the general donation page (M7): the shared content
   lifecycle, the donation-page section rules, media, and Givebutter
   checkouts verified through a DETERMINISTIC fake provider — no network,
   no key, no real account data. Test records only. */

const owner = member("org-a", "OWNER");
const editor = member("org-a", "EDITOR");
const rich = [{ type: "paragraph", children: [{ type: "text", text: "A test paragraph." }] }];
const why = (o: Record<string, unknown> = {}) => ({ id: "why", type: "richText", enabled: true, version: 1, data: { heading: "Why it matters", content: rich }, ...o });
const helps = (o: Record<string, unknown> = {}) => ({ id: "helps", type: "numberedCards", enabled: true, version: 1, data: { heading: "How your support helps", items: [{ title: "Test item" }] }, ...o });

const rejects = async (promise: Promise<unknown>, code: string, pathPart?: string) =>
  assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError, String(error));
    assert.equal(error.code, code, error.message);
    if (pathPart) assert.ok(error.details?.some((d) => d.path.includes(pathPart) || d.message.includes(`"${pathPart}"`)), JSON.stringify(error.details));
    return true;
  });

function setup(provider: FakeDonationProvider | null = new FakeDonationProvider()) {
  const data = sharedData();
  const h = harness("org-a", data, undefined, provider);
  const image = addMedia(data, "org-a", "ready", { alt: "A test image" });
  return { data, h, image, provider };
}
const testAppeal = (imageId: string, o: Record<string, unknown> = {}) => ({ kind: "emergency", title: "Test appeal", summary: "A test summary.", imageId, sections: [why(), helps()], ...o });
const testPage = (imageId: string) => ({
  hero: { eyebrow: "Donate", title: "Test donation page", description: "A test description.", imageId },
  donation: { designation: "where-needed-most" },
});

/* ---------------- Appeals ---------------- */

test("appeals: create as a draft, server-owned identity, the contract's own record, audited by field names", async () => {
  const { h, image } = setup();
  const view = await h.appeals.create(editor, testAppeal(image.id, { slug: "Test Appeal!" }), FACTS);
  assert.equal(view.record.status, "draft");
  assert.equal(view.record.slug, "test-appeal");
  assert.equal(view.record.orgId, "org-a");
  assert.equal(view.revision, 1);
  assert.ok(Appeal.safeParse(view.record).success);
  const entry = h.audit.find((e) => e.action === "appeal.created")!;
  assert.deepEqual(entry.metadata, { status: "draft", fields: ["imageId", "kind", "sections", "slug", "summary", "title"] });
  assert.ok(!JSON.stringify(h.audit).includes("A test paragraph"), "wording is never audited");
});

test("appeals: unknown fields, a chosen organization, HTML and undrawable blocks are refused", async () => {
  const { h, image } = setup();
  await rejects(h.appeals.create(owner, { ...testAppeal(image.id), orgId: "org-b" }, FACTS), "VALIDATION_ERROR", "orgId");
  await rejects(h.appeals.create(owner, { ...testAppeal(image.id), html: "<p>x</p>" }, FACTS), "VALIDATION_ERROR", "html");
  await rejects(h.appeals.create(owner, testAppeal(image.id, { kind: "project" }), FACTS), "VALIDATION_ERROR", "kind");
  await rejects(h.appeals.create(owner, testAppeal(image.id, { sections: [why({ data: { heading: "H", content: [{ type: "html", html: "<script>alert(1)</script>" }] } })] }), FACTS), "VALIDATION_ERROR", "sections");
  await rejects(h.appeals.create(owner, testAppeal(image.id, { sections: [why({ data: { heading: "H", content: [{ type: "paragraph", children: [{ type: "text", text: "x", marks: [{ type: "link", href: "javascript:alert(1)" }] }] }] } })] }), FACTS), "VALIDATION_ERROR", "sections");
  const imageText = { id: "it", type: "imageText", enabled: true, version: 1, data: { heading: "H", body: ["p"], imageId: image.id } };
  await rejects(h.appeals.create(owner, testAppeal(image.id, { sections: [imageText] }), FACTS), "VALIDATION_ERROR", "sections.0.type");
  await rejects(h.appeals.create(owner, testAppeal(image.id, { sections: [why(), why({ id: "why-2" })] }), FACTS), "VALIDATION_ERROR", "sections");
  await rejects(h.appeals.create(owner, testAppeal(image.id, { startsOn: "2026-12-01", endsOn: "2026-11-01" }), FACTS), "VALIDATION_ERROR", "endsOn");
  // A disabled second passage is kept but not drawn: allowed.
  await h.appeals.create(owner, testAppeal(image.id, { sections: [why(), why({ id: "why-2", enabled: false })] }), FACTS);
  assert.equal(h.data.appeals.length, 1);
});

test("appeals: media must be READY images of this organization — featured, highlight and share images", async () => {
  const { data, h, image } = setup();
  const pending = addMedia(data, "org-a", "pending");
  const theirs = addMedia(data, "org-b", "ready");
  const deleted = addMedia(data, "org-a", "deleted");
  await rejects(h.appeals.create(owner, testAppeal(pending.id), FACTS), "VALIDATION_ERROR", "body.imageId");
  await rejects(h.appeals.create(owner, testAppeal(theirs.id), FACTS), "VALIDATION_ERROR", "body.imageId");
  await rejects(h.appeals.create(owner, testAppeal(image.id, { highlight: { imageId: deleted.id } }), FACTS), "VALIDATION_ERROR", "body.highlight.imageId");
  await rejects(h.appeals.create(owner, testAppeal(image.id, { seo: { ogImageId: "not-a-real-media-id" } }), FACTS), "VALIDATION_ERROR", "body.seo.ogImageId");
  await h.appeals.create(owner, testAppeal(image.id, { highlight: { label: "Short" }, seo: { title: "SEO title", ogImageId: image.id } }), FACTS);
});

test("appeals: revisions, unique addresses, confirmed changes to a published address", async () => {
  const { h, image } = setup();
  const a = await createApproved(h.appeals, owner, testAppeal(image.id), FACTS);
  await liveSite(h);
  const live = await h.appeals.get(owner, a.record.id);
  assert.deepEqual([live.record.status, live.revision], ["published", 3]);
  await rejects(h.appeals.create(owner, testAppeal(image.id), FACTS), "VALIDATION_ERROR", "body.slug");
  const b = await h.appeals.create(owner, testAppeal(image.id, { slug: "other-appeal" }), FACTS);
  await rejects(h.appeals.update(owner, b.record.id, { revision: 1, changes: { slug: "test-appeal" } }, FACTS), "VALIDATION_ERROR", "body.slug");

  await rejects(h.appeals.update(owner, a.record.id, { revision: 3, changes: { slug: "renamed" } }, FACTS), "CONFLICT", "slug");
  const renamed = await h.appeals.update(owner, a.record.id, { revision: 3, changes: { slug: "Renamed", title: "Renamed" }, confirmSlugChange: true }, FACTS);
  assert.equal(renamed.record.slug, "renamed");
  assert.deepEqual(renamed.previousSlugs, ["test-appeal"]);
  assert.deepEqual([renamed.record.status, renamed.live], ["draft", true], "the edit waits for approval; the live version stays");
  await rejects(h.appeals.update(editor, a.record.id, { revision: 3, changes: { title: "Stale" } }, FACTS), "CONFLICT");
  const entry = h.audit.filter((e) => e.action === "appeal.updated").at(-1)!;
  assert.deepEqual(entry.metadata, { fields: ["slug", "title"], status: "draft" });
});

test("appeals: DELETE archives (idempotent) and audits appeal.archived; nothing is destroyed", async () => {
  const { h, image } = setup();
  const a = await h.appeals.create(editor, testAppeal(image.id), FACTS);
  const archived = await h.appeals.archive(editor, a.record.id, FACTS);
  assert.equal(archived.record.status, "archived");
  await h.appeals.archive(editor, a.record.id, FACTS);
  assert.equal(h.audit.filter((e) => e.action === "appeal.archived").length, 1);
  assert.equal(h.data.appeals.length, 1);
});

test("appeals: list — search, status filter, sort, pages", async () => {
  const { h, image } = setup();
  for (const title of ["Alpha appeal", "Beta appeal", "Gamma campaign"]) await h.appeals.create(owner, testAppeal(image.id, { title }), FACTS);
  const approved = await createApproved(h.appeals, owner, testAppeal(image.id, { title: "Delta appeal" }), FACTS);
  assert.equal((await h.appeals.list(owner, { search: "appeal" })).pagination.total, 3);
  assert.deepEqual((await h.appeals.list(owner, { status: "approved" })).items.map((i) => i.record.id), [approved.record.id]);
  assert.deepEqual((await h.appeals.list(owner, { sort: "title" })).items.map((i) => i.record.title), ["Alpha appeal", "Beta appeal", "Delta appeal", "Gamma campaign"]);
  const page = await h.appeals.list(owner, { pageSize: "2", page: "2" });
  assert.deepEqual([page.items.length, page.pagination.totalPages], [2, 2]);
  await rejects(h.appeals.list(owner, { status: "pending" }), "VALIDATION_ERROR");
});

test("appeals: organization isolation", async () => {
  const data = sharedData();
  const a = harness("org-a", data);
  const b = harness("org-b", data);
  const image = addMedia(data, "org-a", "ready");
  const mine = await a.appeals.create(owner, testAppeal(image.id), FACTS);
  const bOwner = member("org-b", "OWNER");
  await rejects(b.appeals.get(bOwner, mine.record.id), "NOT_FOUND");
  await rejects(b.appeals.update(bOwner, mine.record.id, { revision: 1, changes: { title: "Taken" } }, FACTS), "NOT_FOUND");
  await rejects(b.appeals.archive(bOwner, mine.record.id, FACTS), "NOT_FOUND");
  await rejects(a.appeals.get(bOwner, mine.record.id), "FORBIDDEN");
  assert.equal((await b.appeals.list(bOwner, {})).items.length, 0);
  // Another organization's image is not this organization's.
  await rejects(b.appeals.create(bOwner, testAppeal(image.id), FACTS), "VALIDATION_ERROR", "body.imageId");
});

/* ---------------- Givebutter checkouts ---------------- */

test("checkout: a draft may hold an unverified campaign; approving it needs a verified one", async () => {
  const { h, image, provider } = setup();
  const draft = await h.appeals.create(owner, testAppeal(image.id, { donation: { checkout: testCheckout({ campaignId: "123" }) } }), FACTS);
  assert.deepEqual(provider!.calls, [], "a draft is not sent to the provider");
  await h.appeals.act(editor, draft.record.id, "submit", { revision: 1 }, FACTS);
  assert.deepEqual(provider!.calls, [], "nor is a submission: the owner's approval verifies");
  await rejects(h.appeals.act(owner, draft.record.id, "approve", { revision: 2 }, FACTS), "VALIDATION_ERROR", "body.donation.checkout.campaignId");
  assert.equal((await h.appeals.get(owner, draft.record.id)).record.status, "submitted", "a refused approval changes nothing");
  await h.appeals.act(owner, draft.record.id, "reject", { revision: 2 }, FACTS);
  await h.appeals.update(owner, draft.record.id, { revision: 3, changes: { donation: { checkout: testCheckout({ defaultAmount: 50, defaultFrequency: "once" }) } } }, FACTS);
  const fixed = await approve(h.appeals, owner, draft.record.id, FACTS);
  assert.equal(fixed.record.status, "approved");
  // An edit returns it to a draft without asking the provider; approving it again asks again.
  const calls = provider!.calls.length;
  const retitled = await h.appeals.update(owner, draft.record.id, { revision: fixed.revision, changes: { title: "Retitled" } }, FACTS);
  assert.equal(provider!.calls.length, calls);
  await approve(h.appeals, owner, retitled.record.id, FACTS);
  assert.equal(provider!.calls.length, calls + 1);
  // The contract rejects a malformed or credential-bearing checkout outright.
  await rejects(h.appeals.create(owner, testAppeal(image.id, { slug: "x1", donation: { checkout: testCheckout({ widgetType: "button" }) } }), FACTS), "VALIDATION_ERROR", "widgetType");
  await rejects(h.appeals.create(owner, testAppeal(image.id, { slug: "x2", donation: { checkout: testCheckout({ apiKey: "nope" }) } }), FACTS), "VALIDATION_ERROR", "apiKey");
});

test("checkout: defaults must be the campaign's own options; inactive campaigns are refused", () => {
  const campaign = fakeCampaign();
  const at = "body.donation.checkout";
  const check = (o: Record<string, unknown>, c = campaign) => campaignProblems(c, testCheckout(o) as never, at).map((p) => p.path);
  assert.deepEqual(check({}), []);
  assert.deepEqual(check({ defaultFrequency: "monthly", defaultAmount: 10 }), []);
  assert.deepEqual(check({ defaultAmount: 100 }), [], "no frequency: the campaign's default frequency's amounts");
  assert.deepEqual(check({ defaultFrequency: "yearly" }), [`${at}.defaultFrequency`]);
  assert.deepEqual(check({ defaultFrequency: "monthly", defaultAmount: 100 }), [`${at}.defaultAmount`]);
  assert.deepEqual(check({ defaultAmount: 2 }), [`${at}.defaultAmount`], "below the minimum");
  assert.deepEqual(check({ defaultAmount: 33 }), [`${at}.defaultAmount`], "an invented amount");
  assert.deepEqual(check({}, fakeCampaign({ status: "inactive" })), [`${at}.campaignId`]);
});

test("checkout: provider failures fail safely — generic messages, nothing approved", async () => {
  for (const [failure, words] of [
    ["unauthorized", "refused the server's credentials"],
    ["unavailable", "unavailable"],
    ["rate-limited", "busy"],
    ["bad-response", "unexpected"],
  ] as const) {
    const { h, image, provider } = setup();
    provider!.fail = failure;
    const draft = await h.appeals.create(owner, testAppeal(image.id, { donation: { checkout: testCheckout() } }), FACTS);
    const error = (await approve(h.appeals, owner, draft.record.id, FACTS).catch((e) => e)) as ApiError;
    assert.equal(error.code, "VALIDATION_ERROR");
    assert.ok(error.details!.some((d) => d.path === "body.donation.checkout.campaignId" && d.message.includes(words)), JSON.stringify(error.details));
    assert.equal((await h.appeals.get(owner, draft.record.id)).record.status, "submitted");
  }
  const { h, image } = setup(null);
  const draft = await h.appeals.create(owner, testAppeal(image.id, { donation: { checkout: testCheckout() } }), FACTS);
  await rejects(approve(h.appeals, owner, draft.record.id, FACTS), "VALIDATION_ERROR", "body.donation.checkout.campaignId");
  // Without a checkout, an appeal is approved with the site's own form.
  assert.equal((await createApproved(h.appeals, owner, testAppeal(image.id, { slug: "no-checkout" }), FACTS)).record.status, "approved");
});

/* ---------------- The general donation page ---------------- */

test("donation page: one per organization — read before it exists, created at revision 0, then revision-checked", async () => {
  const { h, image } = setup();
  assert.deepEqual(await h.donationPage.get(editor), { record: null, revision: 0, updatedAt: null, updatedBy: null, live: false, schedule: null });
  await rejects(h.donationPage.update(editor, { revision: 0, changes: { hero: testPage(image.id).hero } }, FACTS), "VALIDATION_ERROR", "body.changes.donation");
  const created = await h.donationPage.update(editor, { revision: 0, changes: testPage(image.id) }, FACTS);
  assert.equal(created.record!.status, "draft");
  assert.equal(created.record!.orgId, "org-a");
  assert.equal(created.revision, 1);
  assert.equal(created.updatedBy!.isYou, true);
  await rejects(h.donationPage.update(editor, { revision: 0, changes: testPage(image.id) }, FACTS), "CONFLICT");
  await rejects(h.donationPage.update(editor, { revision: 1, changes: { orgId: "org-b" } }, FACTS), "VALIDATION_ERROR", "orgId");
  await rejects(h.donationPage.update(editor, { revision: 1, changes: { hero: { ...testPage(image.id).hero, html: "<b>x</b>" } } }, FACTS), "VALIDATION_ERROR");
  const seo = await h.donationPage.update(editor, { revision: 1, changes: { seo: { title: "Give", description: "Support the work." } } }, FACTS);
  const cleared = await h.donationPage.update(editor, { revision: seo.revision, changes: { seo: null } }, FACTS);
  assert.equal(cleared.record!.seo, undefined);
  const audits = h.audit.filter((e) => e.action === "donation_page.updated");
  assert.equal(audits.length, 3);
  assert.deepEqual(audits[1]!.metadata, { fields: ["seo"], status: "draft", created: false });
  assert.ok(!JSON.stringify(audits).includes("Support the work"), "values are never audited");
});

test("donation page: media, section rules and a verified checkout to approve", async () => {
  const { data, h, image } = setup();
  const pending = addMedia(data, "org-a", "pending");
  await rejects(h.donationPage.update(owner, { revision: 0, changes: testPage(pending.id) }, FACTS), "VALIDATION_ERROR", "body.changes.hero.imageId");
  await h.donationPage.update(owner, { revision: 0, changes: { ...testPage(image.id), sections: [why(), helps()] } }, FACTS);
  await rejects(h.donationPage.update(owner, { revision: 1, changes: { sections: [helps(), helps({ id: "h2" })] } }, FACTS), "VALIDATION_ERROR", "body.changes.sections");
  await rejects(h.donationPage.update(owner, { revision: 1, changes: { status: "published" } }, FACTS), "VALIDATION_ERROR", "status");
  await h.donationPage.update(owner, { revision: 1, changes: { donation: { designation: "where-needed-most", checkout: testCheckout({ campaignId: "404" }) } } }, FACTS);
  await h.donationPage.act(editor, "submit", { revision: 2 }, FACTS);
  await rejects(h.donationPage.act(editor, "approve", { revision: 3 }, FACTS), "FORBIDDEN");
  await rejects(h.donationPage.act(owner, "approve", { revision: 3 }, FACTS), "VALIDATION_ERROR", "donation.checkout.campaignId");
  await h.donationPage.act(editor, "withdraw", { revision: 3 }, FACTS);
  await h.donationPage.update(owner, { revision: 4, changes: { donation: { designation: "where-needed-most", checkout: testCheckout() } } }, FACTS);
  const approved = await approvePage(h.donationPage, owner, FACTS);
  assert.equal(approved.record!.status, "approved");
  assert.equal(approved.record!.publishedAt, undefined, "public only once the website is published");
});

/* ---------------- Snapshot and publish ---------------- */

async function liveSite(h: ReturnType<typeof harness>) {
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  await h.publishing.publish(owner, FACTS);
}

test("snapshot: published appeals and the PUBLISHED donation page only — public fields, nothing internal", async () => {
  const { h, image } = setup();
  await liveSite(h);
  await h.donationPage.update(owner, { revision: 0, changes: testPage(image.id) }, FACTS);
  const status = await h.publishing.status(owner);
  assert.deepEqual(status.changedSections, [], "a draft donation page is not a public change");

  await createApproved(h.appeals, owner, testAppeal(image.id, { title: "Published appeal", donation: { checkout: testCheckout() } }), FACTS);
  await h.appeals.create(owner, testAppeal(image.id, { title: "Draft appeal" }), FACTS);
  const archived = await createApproved(h.appeals, owner, testAppeal(image.id, { title: "Archived appeal" }), FACTS);
  await h.appeals.archive(owner, archived.record.id, FACTS);
  await h.donationPage.update(owner, { revision: 1, changes: { donation: { designation: "where-needed-most", checkout: testCheckout() } } }, FACTS);
  assert.deepEqual((await h.publishing.status(owner)).changedSections, ["appeals"], "a draft page is not a public change");
  await approvePage(h.donationPage, owner, FACTS);
  assert.deepEqual((await h.publishing.status(owner)).changedSections, ["appeals", "generalDonation"]);

  await h.publishing.publish(owner, FACTS);
  const snapshot = (await h.publishing.publicSnapshot())!;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.deepEqual(snapshot.content.appeals!.map((a) => a.title), ["Published appeal"]);
  assert.deepEqual(snapshot.content.appeals![0]!.donation!.checkout, testCheckout());
  assert.equal(snapshot.content.generalDonation!.hero.title, "Test donation page");
  assert.deepEqual(Object.keys(snapshot.media), [image.id]);
  const text = JSON.stringify(snapshot);
  for (const leak of ["Draft appeal", "Archived appeal", "createdBy", "updatedBy", "revision", "slugHistory", "objectKey", "apiKey", "TestAccount0001", "Test Campaign"])
    assert.ok(!text.includes(leak), `leaked: ${leak}`);
  assert.ok(!JSON.stringify(snapshot.content).includes('"createdAt"'), "no editing timestamps");
  assert.deepEqual(h.audit.filter((e) => e.action === "publish.completed").at(-1)!.metadata.counts, { appeals: 1, generalDonation: 1 });

  // Edited, the page is a draft again but its live version stays; archived, it leaves the
  // snapshot and the website returns to its own page.
  const page = await h.donationPage.get(owner);
  const edited = await h.donationPage.update(owner, { revision: page.revision, changes: { seo: { title: "Give" } } }, FACTS);
  assert.deepEqual([edited.record!.status, edited.live], ["draft", true]);
  await rejects(h.publishing.publish(owner, FACTS), "CONFLICT");
  await h.donationPage.update(owner, { revision: edited.revision, changes: { status: "archived" } }, FACTS);
  await h.publishing.publish(owner, FACTS);
  assert.equal((await h.publishing.publicSnapshot())!.content.generalDonation, undefined);
});

test("publish: a campaign that cannot be verified, or a deleted image, blocks the WHOLE publish; the live version stays", async () => {
  const { data, h, image, provider } = setup();
  await liveSite(h);
  await createApproved(h.appeals, owner, testAppeal(image.id, { donation: { checkout: testCheckout() } }), FACTS);
  await h.publishing.publish(owner, FACTS);
  assert.equal((await h.publishing.publicSnapshot())!.version, 2);

  // The campaign closes after the appeal was saved.
  provider!.campaigns.set("900001", fakeCampaign({ status: "ended" }));
  await createApproved(h.appeals, owner, testAppeal(image.id, { title: "Second appeal" }), FACTS);
  await rejects(h.publishing.publish(owner, FACTS), "VALIDATION_ERROR", "donation.checkout.campaignId");
  provider!.campaigns.set("900001", fakeCampaign());
  provider!.fail = "unavailable";
  await rejects(h.publishing.publish(owner, FACTS), "VALIDATION_ERROR", "donation.checkout.campaignId");
  provider!.fail = null;
  data.media.find((m) => m.id === image.id)!.status = "deleted";
  await rejects(h.publishing.publish(owner, FACTS), "VALIDATION_ERROR", "media");

  const live = (await h.publishing.publicSnapshot())!;
  assert.equal(live.version, 2);
  assert.equal(live.content.appeals!.length, 1);
  assert.equal(h.audit.filter((e) => e.action === "publish.rejected").length, 3);
  assert.ok(!JSON.stringify(h.audit).includes("TestAccount0001"));
});

test("approval is an owner's: editors draft, edit and submit, but never approve or publish", async () => {
  const { h, image } = setup();
  await rejects(h.appeals.create(editor, testAppeal(image.id, { status: "published" }), FACTS), "VALIDATION_ERROR", "status");
  const draft = await h.appeals.create(editor, testAppeal(image.id), FACTS);
  assert.equal(draft.record.status, "draft");
  await rejects(h.appeals.update(editor, draft.record.id, { revision: 1, changes: { status: "published" } }, FACTS), "VALIDATION_ERROR", "status");
  await h.appeals.act(editor, draft.record.id, "submit", { revision: 1 }, FACTS);
  await rejects(h.appeals.act(editor, draft.record.id, "approve", { revision: 2 }, FACTS), "FORBIDDEN");
  const approved = await approve(h.appeals, owner, draft.record.id, FACTS);
  assert.equal(approved.record.status, "approved");
  // An editor's edit of an approved appeal returns it to a draft, for approval again.
  const edited = await h.appeals.update(editor, draft.record.id, { revision: 3, changes: { title: "Edited by an editor" } }, FACTS);
  assert.equal(edited.record.status, "draft");
  // Submitting, withdrawing and archiving stay open to editors.
  await h.appeals.act(editor, draft.record.id, "submit", { revision: 4 }, FACTS);
  assert.equal((await h.appeals.act(editor, draft.record.id, "withdraw", { revision: 5 }, FACTS)).record.status, "draft");
  await rejects(h.appeals.update(editor, draft.record.id, { revision: 6, changes: { status: "published" } }, FACTS), "VALIDATION_ERROR", "status");

  await h.donationPage.update(editor, { revision: 0, changes: testPage(image.id) }, FACTS);
  await rejects(h.donationPage.update(editor, { revision: 1, changes: { status: "published" } }, FACTS), "VALIDATION_ERROR", "status");
  await h.donationPage.act(editor, "submit", { revision: 1 }, FACTS);
  await rejects(h.donationPage.act(editor, "approve", { revision: 2 }, FACTS), "FORBIDDEN");
  await h.donationPage.act(owner, "approve", { revision: 2 }, FACTS);
  const pageEdit = await h.donationPage.update(editor, { revision: 3, changes: { seo: { title: "Editor SEO" } } }, FACTS);
  assert.equal(pageEdit.record!.status, "draft");
  assert.equal((await h.publishing.status(editor)).canPublish, false);
  assert.equal((await h.publishing.status(owner)).canPublish, true);
});

test("M2's internal read: published appeals only, contract-checked", async () => {
  const data = sharedData();
  const store = new MemoryContentStore<Appeal>(data.appeals, "org-a");
  const h = harness("org-a", data);
  const image = addMedia(data, "org-a", "ready");
  await createApproved(h.appeals, owner, testAppeal(image.id), FACTS);
  await createApproved(h.appeals, owner, testAppeal(image.id, { slug: "approved-only" }), FACTS);
  await rejects(publishedAppeal(store, "test-appeal"), "NOT_FOUND", undefined);
  await liveSite(h);
  await createApproved(h.appeals, owner, testAppeal(image.id, { slug: "a-draft" }), FACTS).then((v) => h.appeals.update(owner, v.record.id, { revision: v.revision, changes: { title: "Drafted" } }, FACTS));
  assert.equal((await publishedAppeal(store, "test-appeal")).title, "Test appeal");
  await rejects(publishedAppeal(store, "a-draft"), "NOT_FOUND");
  await rejects(publishedAppeal(store, "missing"), "NOT_FOUND");
  data.appeals[0]!.record = { ...data.appeals[0]!.record, kind: "unknown" as never };
  await rejects(publishedAppeal(store, "test-appeal"), "INTERNAL_ERROR");
});
