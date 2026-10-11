import { test } from "node:test";
import assert from "node:assert/strict";
import { Project, PublishedSnapshot } from "../index.ts";
import * as fx from "../test/fixtures.ts";

/* Project and stories (M12), and both in a published snapshot with their
   relationships: project → program, story → project / program / related
   stories, Impact → stories. Test data only. */

const org = fx.settings().orgId;
const project = (o: Record<string, unknown> = {}) => ({ id: "p1", orgId: org, schemaVersion: 1, status: "published", slug: "a-project", title: "A project", programId: "education", description: "A line.", order: 0, ...o });
const story = (o: Record<string, unknown> = {}) => ({ id: "s1", orgId: org, schemaVersion: 1, status: "published", type: "story", slug: "a-story", title: "A story", category: "field", body: [{ type: "paragraph", children: [{ type: "text", text: "P." }] }], ...o });
const program = (o: Record<string, unknown> = {}) => ({ id: "g1", orgId: org, schemaVersion: 1, status: "published", slug: "education", title: "Education", icon: "education", order: 0, description: "A line.", ...o });
const issues = (schema: { safeParse(v: unknown): { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, value: unknown) => {
  const r = schema.safeParse(value);
  return r.success ? [] : r.error!.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};
const snapshot = (content: Record<string, unknown>, media: Record<string, unknown> = {}) => ({
  version: 1,
  schemaVersion: 1,
  generatedAt: "2026-10-08T10:00:00.000Z",
  organization: { id: org },
  settings: { ...fx.settings(), status: "published" },
  media,
  content,
});
const image = (id: string, alt: string) => ({ [id]: { id, url: `https://media.example.org/rbb/media/u/${id}.png`, mimeType: "image/png", alt } });

test("project: the fields the projects use, typed; nothing invented", () => {
  assert.deepEqual(issues(Project, project({ imageId: "img", context: ["P."], activities: ["A."], approach: ["P."], outcomes: ["O."], featured: true, seo: { title: "T" } })), []);
  for (const [name, value] of [
    ["no program", project({ programId: undefined })],
    ["a program copied in", project({ program: { title: "Education" } })],
    ["no description", project({ description: undefined })],
    // Milestone 6: impact and partners are fields now (project-fields.test.ts); malformed ones are still refused.
    ["an impact figure without its label", project({ impact: [{ value: "100" }] })],
    ["no partners listed", project({ partners: [] })],
    ["HTML", project({ html: "<b>x</b>" })],
    ["empty activities", project({ activities: [] })],
    ["bad slug", project({ slug: "Reading Clubs" })],
    ["negative order", project({ order: -1 })],
  ] as const)
    assert.ok(issues(Project, value).length > 0, name);
});

test("snapshot: projects published, in published programs, described", () => {
  assert.deepEqual(issues(PublishedSnapshot, snapshot({ programs: [program()], projects: [project({ imageId: "img" })] }, image("img", "A described photograph"))), []);
  assert.deepEqual(issues(PublishedSnapshot, snapshot({ projects: [project({ programId: "anything" })] })), [], "no programs key: the website's own programs (its build checks the name)");
  const bad: [string, Record<string, unknown>, Record<string, unknown>?][] = [
    ["empty projects", { projects: [] }],
    ["draft project", { projects: [project({ status: "draft" })] }],
    ["other org", { projects: [project({ orgId: "other" })] }],
    ["sample marker", { projects: [project({ releaseMarker: "Sample project" })] }],
    ["duplicate slug", { projects: [project(), project({ id: "p2" })] }],
    ["unpublished program", { programs: [program()], projects: [project({ programId: "livelihoods" })] }],
    ["undescribed photograph", { projects: [project({ imageId: "img" })] }, image("img", " ")],
    ["photograph missing", { projects: [project({ imageId: "gone" })] }],
  ];
  for (const [name, content, media] of bad) assert.ok(issues(PublishedSnapshot, snapshot(content, media)).length > 0, name);
});

test("snapshot: stories — typed, categorised, one featured; related stories, project and program published", () => {
  const ok = snapshot(
    { programs: [program()], projects: [project()], stories: [story({ projectId: "a-project", programId: "education", relatedPostIds: ["s2"], imageId: "img", galleryIds: ["img"], featured: true }), story({ id: "s2", slug: "b-story", category: "impact" })] },
    image("img", "A described image")
  );
  assert.deepEqual(issues(PublishedSnapshot, ok), []);
  assert.deepEqual(issues(PublishedSnapshot, snapshot({ stories: [story({ projectId: "anything", programId: "anything" })] })), [], "no projects/programs keys: the website's own (its build checks the names)");
  const impact = (storyIds: string[]) => ({ id: "impact", orgId: org, schemaVersion: 1, status: "published", sections: [{ id: "stories", type: "stories", enabled: true, version: 1, data: { heading: "Stories", storyIds } }] });
  assert.deepEqual(issues(PublishedSnapshot, snapshot({ stories: [story()], impact: impact(["s1"]) })), []);
  assert.deepEqual(issues(PublishedSnapshot, snapshot({ impact: impact(["learning-to-read"]) })), [], "no stories key: the website's own stories (its build checks the ids)");
  const bad: [string, Record<string, unknown>, Record<string, unknown>?][] = [
    ["empty stories", { stories: [] }],
    ["a news post among stories", { stories: [story({ type: "news" })] }],
    ["draft story", { stories: [story({ status: "draft" })] }],
    ["other org", { stories: [story({ orgId: "other" })] }],
    ["sample marker", { stories: [story({ releaseMarker: "Sample story" })] }],
    ["no category", { stories: [story({ category: undefined })] }],
    ["unknown category", { stories: [story({ category: "opinion" })] }],
    ["two featured", { stories: [story({ featured: true }), story({ id: "s2", slug: "b", featured: true })] }],
    ["duplicate slug", { stories: [story(), story({ id: "s2" })] }],
    ["related story unpublished", { stories: [story({ relatedPostIds: ["s9"] })] }],
    ["related to itself", { stories: [story({ relatedPostIds: ["s1"] })] }],
    ["unpublished project", { projects: [project()], stories: [story({ projectId: "another-project" })] }],
    ["unpublished program", { programs: [program()], stories: [story({ programId: "livelihoods" })] }],
    ["Impact names an unpublished story", { stories: [story()], impact: impact(["s9"]) }],
    ["undescribed gallery image", { stories: [story({ galleryIds: ["img"] })] }, image("img", "")],
    ["HTML body", { stories: [story({ body: "<p>x</p>" })] }],
  ];
  for (const [name, content, media] of bad) assert.ok(issues(PublishedSnapshot, snapshot(content, media)).length > 0, name);
});
