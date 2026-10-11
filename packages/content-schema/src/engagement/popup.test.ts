import { test } from "node:test";
import assert from "node:assert/strict";
import { Popup, PublishedSnapshot, popupCmsProblems } from "../index.ts";
import * as fx from "../test/fixtures.ts";

/* The popup as the CMS manages it (M22): the Popup contract, and what the
   website's popup can draw. Test wording only. */

const org = fx.settings().orgId;
const IMAGE = "img-popup";
const popup = (o: Record<string, unknown> = {}) => ({
  id: "site-popup", orgId: org, schemaVersion: 1, status: "published",
  key: "test-popup-1", heading: "A test heading.", body: "A test line.", imageId: IMAGE,
  cta: { label: "See events", href: "/media/events" }, dismissLabel: "Not now", delayMs: 6000, frequency: "session", excludePaths: ["/contact"], ...o,
});
const media = (alt = "Two people at a stall") => ({ [IMAGE]: { id: IMAGE, url: "https://media.rbb.test/a.jpg", mimeType: "image/jpeg", width: 800, height: 600, alt } });
const snapshot = (p: unknown, m = media()) => ({ version: 1, schemaVersion: 1, generatedAt: "2026-10-10T10:00:00.000Z", organization: { id: org }, settings: { ...fx.settings(), status: "published" }, media: m, content: { popup: p } });
const issues = (schema: { safeParse(v: unknown): { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, value: unknown) => {
  const r = schema.safeParse(value);
  return r.success ? [] : r.error!.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};

test("popup: the contract's shape; the website's rules on top", () => {
  assert.deepEqual(issues(Popup, popup()), []);
  assert.deepEqual(popupCmsProblems(popup() as never), []);
  for (const [name, o, path] of [
    ["an external call to action", { cta: { label: "Go", href: "https://partner.rbb.test" } }, "cta.href"],
    ["a mailto call to action", { cta: { label: "Write", href: "mailto:a@b.co" } }, "cta.href"],
    ["a page allow-list (not drawn)", { includePaths: ["/"] }, "includePaths"],
    ["a time window (not drawn)", { startsAt: "2026-10-10T00:00:00Z" }, "startsAt"],
    ["a release marker", { releaseMarker: "Sample" }, "releaseMarker"],
    ["working text", { body: "Demo — not real." }, "body"],
    ["a placeholder address in the label", { cta: { label: "Write to hello@example.org", href: "/contact" } }, "cta.label"],
  ] as const)
    assert.deepEqual(popupCmsProblems(popup(o) as never).map((p) => p.path), [path], name);
  for (const [name, value] of [["HTML", popup({ body: "<b>x</b>" })], ["a highlight not in the heading", popup({ highlight: "absent" })], ["a key that is not a slug", popup({ key: "Not A Key" })], ["a URL as the image", popup({ imageId: "https://x.test/a.jpg" })], ["javascript: link", popup({ cta: { label: "x", href: "javascript:alert(1)" } })], ["a long delay", popup({ delayMs: 60001 })], ["an unknown frequency", popup({ frequency: "always" })]] as const)
    assert.ok(issues(Popup, value).length > 0, name);
});

test("snapshot: the popup only while published, complete with its described photograph", () => {
  assert.deepEqual(issues(PublishedSnapshot, snapshot(popup())), []);
  for (const [name, p, m] of [
    ["draft", popup({ status: "draft" }), media()],
    ["approved", popup({ status: "approved" }), media()],
    ["another organization", popup({ orgId: "other" }), media()],
    ["an external call to action", popup({ cta: { label: "Go", href: "https://partner.rbb.test" } }), media()],
    ["a time window", popup({ endsAt: "2026-12-01T00:00:00Z" }), media()],
    ["a photograph without alt text", popup(), media(" ")],
    ["a photograph missing from the snapshot", popup(), {}],
  ] as const)
    assert.ok(issues(PublishedSnapshot, snapshot(p, m as never)).length > 0, name);
});
