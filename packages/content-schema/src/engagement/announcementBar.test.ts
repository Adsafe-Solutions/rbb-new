import { test } from "node:test";
import assert from "node:assert/strict";
import { AnnouncementBar, PublishedSnapshot, announcementBarApprovalProblems } from "../index.ts";
import * as fx from "../test/fixtures.ts";

/* The announcement bar (M21): one record, its messages in order, links
   to this site only. Test wording only. */

const org = fx.settings().orgId;
const item = (o: Record<string, unknown> = {}) => ({ id: "m1", text: "A test message.", ...o });
const bar = (o: Record<string, unknown> = {}) => ({ id: "announcement-bar", orgId: org, schemaVersion: 1, status: "published", items: [item(), item({ id: "m2", link: { label: "See it", href: "/media/events" } })], ...o });
const issues = (schema: { safeParse(v: unknown): { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, value: unknown) => {
  const r = schema.safeParse(value);
  return r.success ? [] : r.error!.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};

test("announcement bar: messages in order, an optional link to a page of this site; an empty draft is valid", () => {
  assert.deepEqual(issues(AnnouncementBar, bar()), []);
  assert.deepEqual(issues(AnnouncementBar, bar({ status: "draft", items: [] })), []);
  for (const [name, value] of [
    ["another id", bar({ id: "bar" })],
    ["an external link", bar({ items: [item({ link: { label: "Go", href: "https://example.net" } })] })],
    ["a link with a query", bar({ items: [item({ link: { label: "Go", href: "/appeals?x=1" } })] })],
    ["a link without a label", bar({ items: [item({ link: { href: "/appeals" } })] })],
    ["HTML", bar({ items: [item({ text: "<b>x</b>" })] })],
    ["working text", bar({ items: [item({ text: "Demo — x" })] })],
    ["too long for one line", bar({ items: [item({ text: "x".repeat(141) })] })],
    ["a time window (not supported)", bar({ items: [item({ startsAt: "2026-10-10T00:00:00Z" })] })],
    ["a release marker", bar({ releaseMarker: "Sample" })],
    ["duplicate ids", bar({ items: [item(), item()] })],
    ["eleven messages", bar({ items: Array.from({ length: 11 }, (_, i) => item({ id: `m${i}` })) })],
  ] as const)
    assert.ok(issues(AnnouncementBar, value).length > 0, name);
  assert.deepEqual(announcementBarApprovalProblems({ items: [] }).map((p) => p.path), ["items"]);
});

test("snapshot: the bar only while published, this organization's, with a message", () => {
  const snapshot = (b: unknown) => ({ version: 1, schemaVersion: 1, generatedAt: "2026-10-10T10:00:00.000Z", organization: { id: org }, settings: { ...fx.settings(), status: "published" }, media: {}, content: { announcementBar: b } });
  assert.deepEqual(issues(PublishedSnapshot, snapshot(bar())), []);
  for (const [name, b] of [["draft", bar({ status: "draft" })], ["approved", bar({ status: "approved" })], ["other org", bar({ orgId: "other" })], ["no message", bar({ items: [] })], ["revision travelling", bar({ revision: 2 })]] as const)
    assert.ok(issues(PublishedSnapshot, snapshot(b)).length > 0, name);
});
