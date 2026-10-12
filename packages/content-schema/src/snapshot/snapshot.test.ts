import { test } from "node:test";
import assert from "node:assert/strict";
import { PublishedSnapshot } from "../index.ts";
import * as fx from "../test/fixtures.ts";

const snapshot = (overrides: Record<string, unknown> = {}) => ({
  version: 3,
  schemaVersion: 1,
  generatedAt: "2026-10-07T10:00:00.000Z",
  organization: { id: fx.settings().orgId },
  settings: { ...fx.settings(), status: "published", branding: { logoId: "logo-mark" } },
  media: { "logo-mark": { id: "logo-mark", url: "https://media.example.org/rbb/media/u/logo.png", mimeType: "image/png", width: 128, height: 128, alt: "" } },
  content: {},
  ...overrides,
});

const issues = (value: unknown) => {
  const r = PublishedSnapshot.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};

test("a published snapshot: settings, referenced media, empty content", () => {
  assert.deepEqual(issues(snapshot()), []);
});

test("only published, own-organization settings; nothing internal", () => {
  const s = snapshot();
  assert.ok(issues({ ...s, settings: { ...s.settings, status: "draft" } }).some((i) => i.startsWith("settings.status")));
  assert.ok(issues({ ...s, organization: { id: "other-org" } }).some((i) => i.startsWith("settings.orgId")));
  assert.ok(issues({ ...s, settings: { ...s.settings, releaseMarker: "sample" } }).some((i) => i.startsWith("settings.releaseMarker")));
});

test("strict: no unlisted key can travel — users, sessions, secrets, drafts", () => {
  for (const extra of [{ users: [] }, { sessions: [] }, { audit: [] }, { drafts: {} }, { apiKey: "x" }])
    assert.ok(issues(snapshot(extra)).length > 0, Object.keys(extra)[0]);
  const s = snapshot();
  assert.ok(issues({ ...s, content: { posts: [] } }).length > 0, "content types join only when their module defines them");
  assert.ok(issues({ ...s, settings: { ...s.settings, resendApiKey: "re_123" } }).length > 0);
  assert.ok(issues({ ...s, media: { "logo-mark": { ...s.media["logo-mark"], objectKey: "rbb/media/u/logo.png" } } }).length > 0, "no storage internals");
});

test("media: every reference present, nothing unreferenced, public URLs only", () => {
  const s = snapshot();
  assert.ok(issues({ ...s, media: {} }).some((i) => i.startsWith("media.logo-mark")), "missing referenced media");
  assert.ok(issues({ ...s, media: { ...s.media, stray: { ...s.media["logo-mark"], id: "stray" } } }).some((i) => i.startsWith("media.stray")), "unreferenced media");
  for (const url of ["http://media.example.org/x.png", "javascript:alert(1)", "https://user:pw@media.example.org/x.png"])
    assert.ok(issues({ ...s, media: { "logo-mark": { ...s.media["logo-mark"], url } } }).length > 0, url);
  assert.deepEqual(issues({ ...s, media: { "logo-mark": { ...s.media["logo-mark"], url: "http://127.0.0.1:4566/public/x.png" } } }), [], "local development storage");
});

test("version is a positive integer; schemaVersion is pinned", () => {
  for (const version of [0, -1, 1.5, "3"]) assert.ok(issues(snapshot({ version })).length > 0, String(version));
  assert.ok(issues(snapshot({ schemaVersion: 2 })).length > 0);
});

test("content: published news, blogs and events, typed per collection, unique addresses", () => {
  const s = snapshot();
  const post = (o: Record<string, unknown> = {}) => ({ ...fx.post(), type: "news", status: "published", imageId: "logo-mark", ...o });
  const event = (o: Record<string, unknown> = {}) => ({ ...fx.event(), status: "published", imageId: "logo-mark", ...o });
  assert.deepEqual(issues({ ...s, content: { news: [post()], blogs: [], events: [event()] } }), []);
  assert.deepEqual(issues({ ...s, content: {} }), [], "no key = collection not managed in the CMS");
  const bad: [string, unknown][] = [
    ["draft", { news: [post({ status: "draft" })] }],
    ["archived", { events: [event({ status: "archived" })] }],
    ["other org", { news: [post({ orgId: "other-org" })] }],
    ["release marker", { news: [post({ releaseMarker: "sample" })] }],
    ["wrong type", { blogs: [post({ type: "news" })] }],
    ["duplicate slug", { news: [post(), post({ id: "another-id" })] }],
    ["duplicate id", { news: [post(), post({ slug: "another-slug" })] }],
    ["unpublished related", { news: [post({ relatedPostIds: ["not-published"] })] }],
    ["stories not yet", { stories: [] }],
    ["unknown media", { news: [post({ imageId: "missing-media" })] }],
    ["bad rich text", { news: [post({ body: [{ type: "html", html: "<script>alert(1)</script>" }] })] }],
    ["event ends before it starts", { events: [event({ startTime: "6:30 PM", endTime: "6:00 PM" })] }],
  ];
  for (const [name, content] of bad) assert.ok(issues({ ...s, content }).length > 0, name);
});

const checkout = (o: Record<string, unknown> = {}) => ({ provider: "givebutter", campaignId: "758500", widgetId: "jNKkQk", widgetType: "form", ...o });
const appealRecord = (o: Record<string, unknown> = {}) => {
  const { releaseMarker: _r, ...a } = fx.appeal();
  return { ...a, status: "published", imageId: "logo-mark", donation: { checkout: checkout() }, ...o };
};
const donationPage = (o: Record<string, unknown> = {}) => ({
  id: "general-donation",
  orgId: fx.settings().orgId,
  schemaVersion: 1,
  status: "published",
  hero: { title: "Support our work", description: "Where support is needed most.", imageId: "logo-mark" },
  sections: [],
  donation: { designation: "where-needed-most", checkout: checkout() },
  ...o,
});

test("content: published appeals and the general donation page", () => {
  const s = snapshot();
  assert.deepEqual(issues({ ...s, content: { appeals: [appealRecord()], generalDonation: donationPage() } }), []);
  assert.deepEqual(issues({ ...s, content: { appeals: [] } }), [], "an empty collection: the CMS manages appeals, none is published");
  const bad: [string, unknown][] = [
    ["draft appeal", { appeals: [appealRecord({ status: "draft" })] }],
    ["archived appeal", { appeals: [appealRecord({ status: "archived" })] }],
    ["other org appeal", { appeals: [appealRecord({ orgId: "other-org" })] }],
    ["sample appeal", { appeals: [appealRecord({ releaseMarker: "sample" })] }],
    ["duplicate appeal slug", { appeals: [appealRecord(), appealRecord({ id: "another" })] }],
    ["duplicate appeal id", { appeals: [appealRecord(), appealRecord({ slug: "another" })] }],
    ["appeal image missing", { appeals: [appealRecord({ imageId: "missing-media" })] }],
    ["appeal share image missing", { appeals: [appealRecord({ seo: { ogImageId: "missing-media" } })] }],
    ["draft donation page", { generalDonation: donationPage({ status: "draft" }) }],
    ["other org donation page", { generalDonation: donationPage({ orgId: "other-org" }) }],
    ["donation hero image missing", { generalDonation: donationPage({ hero: { title: "T", description: "D", imageId: "missing-media" } }) }],
    ["unknown checkout provider", { appeals: [appealRecord({ donation: { checkout: checkout({ provider: "stripe" }) } })] }],
    ["checkout with a key", { generalDonation: donationPage({ donation: { designation: "x", checkout: checkout({ apiKey: "secret" }) } }) }],
  ];
  for (const [name, content] of bad) assert.ok(issues({ ...s, content }).length > 0, name);
});

test("team templates: a member carrying a release marker is never published; members without one — every stored snapshot — still pass", () => {
  const member = (o: Record<string, unknown> = {}) => ({ id: "m1", orgId: fx.settings().orgId, schemaVersion: 1, status: "published", publishedAt: "2026-10-07T10:00:00.000Z", slug: "executive-director", name: "Executive Director", role: "Leadership", group: "leadership", order: 0, ...o });
  assert.deepEqual(issues(snapshot({ content: { team: [member()] } })), [], "a published member as the publish copy writes it");
  const marked = issues(snapshot({ content: { team: [member({ releaseMarker: "Sample profile — a role, not a real person." })] } }));
  assert.ok(marked.some((i) => i.startsWith("content.team.0.releaseMarker: a template")), marked.join(" | "));
});
