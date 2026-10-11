import { test } from "node:test";
import assert from "node:assert/strict";
import { PublishedSnapshot } from "@rbb/content-schema";
import { ApiError } from "../src/errors.ts";
import { settingsRecord } from "./fixtures/settings.ts";
import { FACTS, member } from "./media/memory.ts";
import { addMedia, harness, sharedData } from "./settings/memory.ts";
import { approvePage, createApproved } from "./support/workflow.ts";

/* Milestone 3 — sharing metadata (SeoOverrides: title, description,
   ogImageId, noIndex) on every content type that has it: validated,
   stored, kept, cleared and published. The contract for an update:
     `seo` absent from the changes  → kept as it is
     `seo: null`                    → cleared
     `seo: { … }`                   → replaces the whole object (the admin
                                      always sends all of it)
   Test records only. */

const owner = member("org-a", "OWNER");
const body = [{ type: "paragraph", children: [{ type: "text", text: "A test paragraph." }] }];
const rejects = async (promise: Promise<unknown>, code: string, path?: string) =>
  assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError, String(error));
    assert.equal(error.code, code, error.message);
    if (path) assert.ok(error.details?.some((d) => d.path.includes(path)), JSON.stringify(error.details));
    return true;
  });
async function site() {
  const data = sharedData();
  const h = harness("org-a", data);
  await h.settings.importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
  const image = addMedia(data, "org-a", "ready", { alt: "A test image" });
  const share = addMedia(data, "org-a", "ready", { alt: "A test share image" });
  const pending = addMedia(data, "org-a", "pending");
  return { data, h, image, share, pending };
}
type H = ReturnType<typeof harness>;
interface Collection {
  create(a: unknown, i: unknown, f: unknown): Promise<{ record: { id: string; seo?: unknown }; revision: number }>;
  update(a: unknown, id: string, i: unknown, f: unknown): Promise<{ record: { id: string; seo?: unknown }; revision: number }>;
}
const COLLECTIONS: [string, (h: H) => Collection, (imageId: string) => Record<string, unknown>][] = [
  ["news", (h) => h.posts as never, () => ({ type: "news", title: "A test news item", body })],
  ["blog", (h) => h.posts as never, () => ({ type: "blog", title: "A test blog post", body })],
  ["event", (h) => h.events as never, (imageId) => ({ title: "A test gathering", summary: "A test summary.", about: body, date: "2026-11-14", startTime: "6:30 PM", endTime: "9:00 PM", timezone: "Europe/London", venue: "Test hall", address: "1 Test Street", imageId })],
  ["story", (h) => h.stories as never, () => ({ title: "A test story", category: "field", body })],
  ["project", (h) => h.projects as never, () => ({ title: "A test project", programId: "education", description: "A test line." })],
  ["program", (h) => h.programs as never, () => ({ title: "A test program", icon: "education", description: "A test line." })],
  ["appeal", (h) => h.appeals as never, (imageId) => ({ kind: "emergency", title: "A test appeal", summary: "A test summary.", imageId, sections: [] })],
];

test("every content type: its sharing metadata is stored as given, kept when the update leaves it out, replaced whole, and cleared with null", async () => {
  for (const [name, service, input] of COLLECTIONS) {
    const { h, image, share } = await site();
    const full = { title: "A test share title", description: "A test share description.", ogImageId: share.id, noIndex: true };
    const created = await service(h).create(owner, { ...input(image.id), seo: full }, FACTS);
    assert.deepEqual(created.record.seo, full, `${name}: stored as given`);
    const kept = await service(h).update(owner, created.record.id, { revision: created.revision, changes: { title: "An edited test title" } }, FACTS);
    assert.deepEqual(kept.record.seo, full, `${name}: an update without seo keeps it`);
    const replaced = await service(h).update(owner, created.record.id, { revision: kept.revision, changes: { seo: { title: "Only a title" } } }, FACTS);
    assert.deepEqual(replaced.record.seo, { title: "Only a title" }, `${name}: seo is replaced as a whole`);
    const notHidden = await service(h).update(owner, created.record.id, { revision: replaced.revision, changes: { seo: { title: "Only a title", noIndex: false } } }, FACTS);
    assert.equal((notHidden.record.seo as { noIndex?: boolean }).noIndex, false, `${name}: noIndex false is kept as sent`);
    const cleared = await service(h).update(owner, created.record.id, { revision: notHidden.revision, changes: { seo: null } }, FACTS);
    assert.equal(cleared.record.seo, undefined, `${name}: null clears it`);
  }
});

test("every content type: an invalid share image or noIndex is refused by name", async () => {
  for (const [, service, input] of COLLECTIONS) {
    const { h, image, pending } = await site();
    for (const [seo, path] of [
      [{ ogImageId: "00000000-0000-4000-8000-000000000000" }, "seo.ogImageId"],
      [{ ogImageId: pending.id }, "seo.ogImageId"],
      [{ ogImageId: "not an id" }, "seo.ogImageId"],
      [{ noIndex: "yes" }, "seo.noIndex"],
      [{ canonical: "https://elsewhere.test/" }, "seo"],
      [{ title: "x".repeat(71) }, "seo.title"],
    ] as const)
      await rejects(service(h).create(owner, { ...input(image.id), seo }, FACTS), "VALIDATION_ERROR", path);
  }
});

test("pages: the About page and the donation page keep, replace and clear their sharing metadata the same way", async () => {
  const { h, image, share } = await site();
  const hero = { id: "intro", type: "pageHero", enabled: true, version: 1, data: { title: "About a test organization", body: "A test line." } };
  const about = await h.about.create(owner, { sections: [hero], seo: { ogImageId: share.id, noIndex: true } }, FACTS);
  assert.deepEqual(about.record!.seo, { ogImageId: share.id, noIndex: true });
  const aboutKept = await h.about.update(owner, { revision: about.revision, changes: { sections: [hero] } }, FACTS);
  assert.deepEqual(aboutKept.record!.seo, { ogImageId: share.id, noIndex: true }, "kept");
  const aboutCleared = await h.about.update(owner, { revision: aboutKept.revision, changes: { seo: null } }, FACTS);
  assert.equal(aboutCleared.record!.seo, undefined, "cleared");

  const page = await h.donationPage.update(owner, { revision: 0, changes: { hero: { eyebrow: "Donate", title: "A test donation page", description: "A test description.", imageId: image.id }, donation: { designation: "where-needed-most" }, seo: { title: "Give", ogImageId: share.id, noIndex: true } } }, FACTS);
  assert.deepEqual(page.record!.seo, { title: "Give", ogImageId: share.id, noIndex: true });
  const pageKept = await h.donationPage.update(owner, { revision: page.revision, changes: { hero: { ...page.record!.hero, title: "An edited test page" } } }, FACTS);
  assert.deepEqual(pageKept.record!.seo, { title: "Give", ogImageId: share.id, noIndex: true }, "kept");
  await rejects(h.donationPage.update(owner, { revision: pageKept.revision, changes: { seo: { ogImageId: "00000000-0000-4000-8000-000000000000" } } }, FACTS), "VALIDATION_ERROR", "seo.ogImageId");
  const pageCleared = await h.donationPage.update(owner, { revision: pageKept.revision, changes: { seo: null } }, FACTS);
  assert.equal(pageCleared.record!.seo, undefined, "cleared");
});

test("Careers: noIndex is stored; it has no share image (its contract has none) — refused, not dropped", async () => {
  const { h, share } = await site();
  const careers = { title: "Test careers", intro: "A test intro.", why: { heading: "Why", body: ["A test paragraph."] }, opportunities: { heading: "Open", empty: "None at the moment.", roles: [] }, closing: { heading: "Explore.", primary: { label: "About Us", href: "/about" }, secondary: { label: "Contact", href: "/contact" } } };
  const created = await h.careers.create(owner, { ...careers, seo: { description: "A test line.", noIndex: true } }, FACTS);
  assert.deepEqual(created.record!.seo, { description: "A test line.", noIndex: true });
  await rejects(h.careers.update(owner, { revision: created.revision, changes: { seo: { ogImageId: share.id } } }, FACTS), "VALIDATION_ERROR", "seo");
});

test("settings: the site-wide default share image is validated, and published with the image it names", async () => {
  const { h, share, pending } = await site();
  const v = (await h.settings.get(owner))!;
  await rejects(h.settings.update(owner, { revision: v.revision, changes: { seo: { description: "A test description.", ogImageId: pending.id } } }, FACTS), "VALIDATION_ERROR", "ogImageId");
  await h.settings.update(owner, { revision: v.revision, changes: { seo: { description: "A test description.", ogImageId: share.id } } }, FACTS);
  await h.publishing.publish(owner, FACTS);
  const snapshot = (await h.publishing.publicSnapshot())!;
  assert.equal(snapshot.settings.seo.ogImageId, share.id);
  assert.equal(snapshot.media[share.id]!.alt, "A test share image");
});

test("publishing: each type's sharing metadata — noIndex included — and its share image reach the snapshot", async () => {
  const { h, image, share } = await site();
  const seo = { title: "A test share title", ogImageId: share.id, noIndex: true };
  for (const [name, service, input] of COLLECTIONS) if (name !== "project" && name !== "program") await createApproved(service(h) as never, owner, { ...input(image.id), slug: `seo-${name}`, ...(name === "story" || name === "news" || name === "blog" ? { title: `A test ${name}` } : {}), seo }, FACTS);
  await h.donationPage.update(owner, { revision: 0, changes: { hero: { eyebrow: "Donate", title: "A test donation page", description: "A test description.", imageId: image.id }, donation: { designation: "where-needed-most" }, seo } }, FACTS);
  await approvePage(h.donationPage as never, owner, FACTS);
  await h.publishing.publish(owner, FACTS);
  const snapshot = (await h.publishing.publicSnapshot())!;
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  for (const [key, list] of [["news", snapshot.content.news], ["blogs", snapshot.content.blogs], ["events", snapshot.content.events], ["stories", snapshot.content.stories], ["appeals", snapshot.content.appeals]] as const)
    assert.deepEqual((list as { seo?: unknown }[] | undefined)?.[0]?.seo, seo, key);
  assert.deepEqual(snapshot.content.generalDonation!.seo, seo, "donation page");
  assert.ok(snapshot.media[share.id], "the share image is published with them");
});
