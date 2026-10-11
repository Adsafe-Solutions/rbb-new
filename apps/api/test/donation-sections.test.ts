import { test } from "node:test";
import assert from "node:assert/strict";
import { PublishedSnapshot } from "@rbb/content-schema";
import { ApiError } from "../src/errors.ts";
import { settingsRecord } from "./fixtures/settings.ts";
import { FACTS, member } from "./media/memory.ts";
import { addMedia, harness, sharedData } from "./settings/memory.ts";
import { approvePage, createApproved } from "./support/workflow.ts";

/* Milestone 7 — the donation page's and appeals' sections: the "why"
   statement with its kicker, highlight and link; how support helps with
   its kicker, highlight and intro; and the trust panel, FAQ and appeal
   lists the API refused before. Validated, stored, kept, replaced and
   published, in memory. Test records only; no payment is involved. */

const owner = member("org-a", "OWNER");
const block = (id: string, type: string, data: Record<string, unknown>, enabled = true) => ({ id, type, enabled, version: 1, data });
const WHY = block("why", "statement", { kicker: "Why give", heading: "Why your support matters", highlight: "matters", body: ["A test paragraph."], cta: { label: "Read about our work", href: "/work" } });
const HELPS = block("helps", "numberedCards", { kicker: "Where it goes", heading: "How your support helps", highlight: "helps", intro: "A test introduction.", items: [{ title: "A test area", description: "A test line." }] });
const LISTS = [block("emergency", "appealList", { kicker: "Now", heading: "Emergency response", kind: "emergency" }), block("all", "appealList", { heading: "Every appeal", cta: { label: "All appeals", href: "/appeals" } })];
const TRUST = block("trust", "trust", { kicker: "Open books", heading: "How we account for every gift", body: "A test line.", cta: { label: "Transparency", href: "/about#transparency" } });
const FAQ = block("faq", "faq", { kicker: "Questions", heading: "Giving, answered", items: [{ question: "A test question?", answer: "A test answer." }] });
const ALL = [WHY, HELPS, ...LISTS, TRUST, FAQ];
const rejects = async (promise: Promise<unknown>, path: string, message?: RegExp) =>
  assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError, String(error));
    assert.equal(error.code, "VALIDATION_ERROR", error.message);
    const d = error.details?.find((x) => x.path === path || x.path.startsWith(`${path}.`));
    assert.ok(d, `${path}: ${JSON.stringify(error.details)}`);
    if (message) assert.match(d.message, message);
    return true;
  });
async function site() {
  const data = sharedData();
  const h = harness("org-a", data);
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  const image = addMedia(data, "org-a", "ready", { alt: "A test image" });
  const share = addMedia(data, "org-a", "ready", { alt: "A test share image" });
  return { data, h, image, share };
}
const hero = (imageId: string) => ({ eyebrow: "Donate", title: "A test donation page", description: "A test description.", imageId });
const appeal = (imageId: string, o: Record<string, unknown> = {}) => ({ kind: "emergency", title: "A test appeal", summary: "A test summary.", imageId, ...o });

test("the donation page: every drawn section stored as written, kept when an update leaves sections out, replaced whole, cleared", async () => {
  const { h, image } = await site();
  const created = await h.donationPage.update(owner, { revision: 0, changes: { hero: hero(image.id), donation: { designation: "where-needed-most" }, sections: ALL } }, FACTS);
  assert.deepEqual(created.record!.sections, ALL);
  const kept = await h.donationPage.update(owner, { revision: created.revision, changes: { hero: { ...hero(image.id), title: "An edited test page" } } }, FACTS);
  assert.deepEqual(kept.record!.sections, ALL, "kept");
  const off = ALL.map((s) => (s.type === "trust" || s.type === "faq" ? { ...s, enabled: false } : s));
  const switched = await h.donationPage.update(owner, { revision: kept.revision, changes: { sections: off } }, FACTS);
  assert.deepEqual(switched.record!.sections.filter((s) => !s.enabled).map((s) => s.type), ["trust", "faq"], "switched off: none on the page, kept in the record");
  const cleared = await h.donationPage.update(owner, { revision: switched.revision, changes: { sections: [] } }, FACTS);
  assert.deepEqual(cleared.record!.sections, [], "the site's own trust panel, FAQ and appeal bands again");
});

test("refused by name: a second trust panel or FAQ, a fourth list, blocks a donation page does not draw, release markers anywhere, malformed sections", async () => {
  const { h, image } = await site();
  const page = (sections: unknown[]) => h.donationPage.update(owner, { revision: 0, changes: { hero: hero(image.id), donation: { designation: "where-needed-most" }, sections } }, FACTS);
  await rejects(page([TRUST, { ...TRUST, id: "trust-2", enabled: false }]), "body.changes.sections", /one trust panel/);
  await rejects(page([FAQ, { ...FAQ, id: "faq-2" }]), "body.changes.sections", /one set of questions/);
  await rejects(page([...LISTS, block("l3", "appealList", { heading: "Three" }), block("l4", "appealList", { heading: "Four" })]), "body.changes.sections", /at most 3 appeal lists/);
  await rejects(page([block("img", "imageText", { heading: "H", body: ["P."], imageId: image.id })]), "body.changes.sections.0.type", /not drawn/);
  await rejects(page([block("stats", "stats", { heading: "H", metricIds: ["m1"] })]), "body.changes.sections.0.type", /not drawn/);
  await rejects(page([block("cta", "cta", { heading: "H", primary: { label: "Go", href: "/work" } })]), "body.changes.sections.0.type");
  await rejects(page([block("faq", "faq", { heading: "Q", items: [{ question: "A?", answer: "A.", releaseMarker: "Sample answer" }] })]), "body.changes.sections.0.data", /release markers/);
  await rejects(page([block("faq", "faq", { heading: "Q", items: [] })]), "body.changes.sections.0.data.items");
  await rejects(page([block("trust", "trust", { heading: "A heading", highlight: "elsewhere" })]), "body.changes.sections.0.data.highlight");
  await rejects(page([block("l", "appealList", { heading: "H", kind: "project" })]), "body.changes.sections.0.data.kind");
  await rejects(page([block("t", "trust", { heading: "H", cta: { label: "Bad", href: "javascript:alert(1)" } })]), "body.changes.sections.0.data.cta.href");
});

test("appeals: the same sections, the same rules — stored, kept, replaced", async () => {
  const { h, image } = await site();
  const created = await h.appeals.create(owner, appeal(image.id, { sections: ALL }), FACTS);
  assert.deepEqual(created.record.sections, ALL);
  const kept = await h.appeals.update(owner, created.record.id, { revision: created.revision, changes: { summary: "An edited test summary." } }, FACTS);
  assert.deepEqual(kept.record.sections, ALL);
  await rejects(h.appeals.update(owner, created.record.id, { revision: kept.revision, changes: { sections: [TRUST, { ...TRUST, id: "t2" }] } }, FACTS), "body.sections", /one trust panel/);
  await rejects(h.appeals.create(owner, appeal(image.id, { sections: [block("faq", "faq", { heading: "Q", items: [{ question: "A?", answer: "A.", releaseMarker: "x" }] })] }), FACTS), "body.sections.0.data", /release markers/);
});

test("records saved before Milestone 7 — a why and a how, nothing else — stay valid, editable and approvable", async () => {
  const { h, image } = await site();
  const old = [block("why", "richText", { heading: "Why", content: [{ type: "paragraph", children: [{ type: "text", text: "A test paragraph." }] }] }), block("helps", "numberedCards", { heading: "How", items: [{ title: "A test area" }] })];
  const a = await createApproved(h.appeals, owner, appeal(image.id, { sections: old }), FACTS);
  assert.deepEqual(a.record.sections, old);
  const page = await h.donationPage.update(owner, { revision: 0, changes: { hero: hero(image.id), donation: { designation: "where-needed-most" }, sections: old } }, FACTS);
  assert.equal((await approvePage(h.donationPage, owner, FACTS)).record!.status, "approved");
  assert.deepEqual(page.record!.sections, old);
});

test("published: the sections reach the snapshot as written; drafts and archived appeals stay out (Milestone 1); SEO and share images as Milestone 3 left them", async () => {
  const { h, image, share } = await site();
  const seo = { title: "A share title", ogImageId: share.id, noIndex: true };
  await createApproved(h.appeals, owner, appeal(image.id, { slug: "live-appeal", sections: ALL, seo }), FACTS);
  await h.appeals.create(owner, appeal(image.id, { slug: "draft-appeal", title: "A draft test appeal", sections: [TRUST] }), FACTS);
  const gone = await createApproved(h.appeals, owner, appeal(image.id, { slug: "archived-appeal", title: "An archived test appeal" }), FACTS);
  await h.appeals.archive(owner, gone.record.id, FACTS);
  await h.donationPage.update(owner, { revision: 0, changes: { hero: hero(image.id), donation: { designation: "where-needed-most" }, sections: ALL, seo } }, FACTS);
  await approvePage(h.donationPage, owner, FACTS);
  await h.publishing.publish(owner, FACTS);
  const snapshot = (await h.publishing.publicSnapshot())!;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.deepEqual(snapshot.content.appeals!.map((a) => a.slug), ["live-appeal"], "the draft and the archived appeal stay out");
  assert.deepEqual(snapshot.content.appeals![0]!.sections, ALL);
  assert.deepEqual(snapshot.content.generalDonation!.sections, ALL);
  assert.deepEqual([snapshot.content.appeals![0]!.seo, snapshot.content.generalDonation!.seo], [seo, seo]);
  assert.ok(snapshot.media[share.id], "the share image is published with them");
});

test("the snapshot refuses a release marker inside a donation page's or an appeal's sections", () => {
  const settings = { ...settingsRecord("rbb"), status: "published" };
  const base = { id: "x", orgId: "rbb", schemaVersion: 1, status: "published" };
  const marked = [block("faq", "faq", { heading: "Q", items: [{ question: "A?", answer: "A.", releaseMarker: "Sample answer" }] })];
  const snap = (content: Record<string, unknown>) => ({ version: 1, schemaVersion: 1, generatedAt: "2026-10-07T10:00:00.000Z", organization: { id: "rbb" }, settings, media: { m: { id: "m", url: "https://media.test/m.png", mimeType: "image/png", alt: "A" } }, content });
  const issues = (v: unknown) => {
    const r = PublishedSnapshot.safeParse(v);
    return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
  };
  assert.deepEqual(issues(snap({ generalDonation: { ...base, id: "general-donation", hero: hero("m"), sections: marked, donation: { designation: "where-needed-most" } } })), ["content.generalDonation.sections"]);
  assert.deepEqual(issues(snap({ appeals: [{ ...base, kind: "emergency", slug: "a", title: "A", summary: "S.", imageId: "m", sections: marked }] })), ["content.appeals.0.sections"]);
});
