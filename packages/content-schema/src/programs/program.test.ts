import { test } from "node:test";
import assert from "node:assert/strict";
import { Program, PublishedSnapshot } from "../index.ts";
import * as fx from "../test/fixtures.ts";

/* Program (M10), and programs in a published snapshot. Test data only. */

const program = (o: Record<string, unknown> = {}) => ({ id: "p1", orgId: fx.settings().orgId, schemaVersion: 1, status: "published", slug: "a-program", title: "A program", icon: "education", order: 0, description: "A line.", ...o });
const issues = (schema: { safeParse(v: unknown): { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, value: unknown) => {
  const r = schema.safeParse(value);
  return r.success ? [] : r.error!.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};

test("program: the fields the program pages draw, typed; nothing else", () => {
  assert.deepEqual(issues(Program, program({ missingNote: "To be provided.", why: ["P."], activities: ["A."], impact: ["I."], stories: ["S."], seo: { title: "T" } })), []);
  for (const [name, value] of [
    ["unknown icon", program({ icon: "rocket" })],
    ["HTML field", program({ html: "<b>x</b>" })],
    ["image (not drawn)", program({ imageId: "img" })],
    ["empty activities", program({ activities: [] })],
    ["bad slug", program({ slug: "Health & Wellbeing" })],
    ["negative order", program({ order: -1 })],
    ["no description", program({ description: undefined })],
  ] as const)
    assert.ok(issues(Program, value).length > 0, name);
});

test("snapshot: published programs, unique addresses; CMS records must name a published program", () => {
  const snapshot = (content: Record<string, unknown>) => ({
    version: 1,
    schemaVersion: 1,
    generatedAt: "2026-10-07T10:00:00.000Z",
    organization: { id: fx.settings().orgId },
    settings: { ...fx.settings(), status: "published", branding: { logoId: "logo-mark" } },
    media: { "logo-mark": { id: "logo-mark", url: "https://media.example.org/rbb/media/u/logo.png", mimeType: "image/png", alt: "" } },
    content,
  });
  const post = (o: Record<string, unknown>) => ({ ...fx.post(), type: "news", status: "published", imageId: "logo-mark", ...o });
  const event = (o: Record<string, unknown>) => ({ ...fx.event(), status: "published", imageId: "logo-mark", ...o });
  assert.deepEqual(issues(PublishedSnapshot, snapshot({ programs: [program(), program({ id: "p2", slug: "another", order: 1 })], news: [post({ programId: "a-program" })] })), []);
  assert.deepEqual(issues(PublishedSnapshot, snapshot({ news: [post({ programId: "anything" })] })), [], "no programs key: the website's own programs (its build checks references)");
  const bad: [string, Record<string, unknown>][] = [
    ["empty programs", { programs: [] }],
    ["draft program", { programs: [program({ status: "draft" })] }],
    ["archived program", { programs: [program({ status: "archived" })] }],
    ["other org", { programs: [program({ orgId: "other" })] }],
    ["sample marker", { programs: [program({ releaseMarker: "sample" })] }],
    ["duplicate slug", { programs: [program(), program({ id: "p2" })] }],
    ["post names an unpublished program", { programs: [program()], news: [post({ programId: "livelihoods" })] }],
    ["event names an unpublished program", { programs: [program()], events: [event({ programId: "livelihoods" })] }],
    ["share image missing", { programs: [program({ seo: { ogImageId: "missing" } })] }],
  ];
  for (const [name, content] of bad) assert.ok(issues(PublishedSnapshot, snapshot(content)).length > 0, name);
});
