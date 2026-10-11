import { test } from "node:test";
import assert from "node:assert/strict";
import { PROJECT_IMPACT_MAX, PROJECT_PARTNERS_MAX, Project, PublishedSnapshot } from "../index.ts";
import * as fx from "../test/fixtures.ts";

/* Milestone 6 — a project's location, stage, date, impact, partners and
   story, as the contract states them. Test data only. */

const org = fx.settings().orgId;
const project = (o: Record<string, unknown> = {}) => ({ id: "p1", orgId: org, schemaVersion: 1, status: "published", slug: "a-project", title: "A project", programId: "education", description: "A line.", order: 0, ...o });
const story = (o: Record<string, unknown> = {}) => ({ id: "s1", orgId: org, schemaVersion: 1, status: "published", type: "story", slug: "a-story", title: "A story", category: "field", body: [{ type: "paragraph", children: [{ type: "text", text: "P." }] }], ...o });
const paths = (schema: { safeParse(v: unknown): { success: boolean; error?: { issues: { path: PropertyKey[] }[] } } }, value: unknown) => {
  const r = schema.safeParse(value);
  return r.success ? [] : r.error!.issues.map((i) => i.path.join("."));
};

test("every field optional: a project without them is valid, as every project before", () => {
  assert.deepEqual(paths(Project, project()), []);
  const full = { location: "A test district", stage: "Ongoing", date: "2026-09-01", impact: [{ value: "120", label: "Children reading weekly" }], partners: ["A test school"], storyId: "learning-to-read" };
  assert.deepEqual(paths(Project, project(full)), []);
});

test("location, stage and date: plain text within limits; a real calendar date", () => {
  for (const [o, path] of [
    [{ location: "" }, "location"], [{ location: "x".repeat(121) }, "location"], [{ location: "<b>Here</b>" }, "location"],
    [{ stage: "  " }, "stage"], [{ stage: "x".repeat(61) }, "stage"],
    [{ date: "2026-02-30" }, "date"], [{ date: "2026-09" }, "date"], [{ date: "1 Sept 2026" }, "date"],
  ] as const)
    assert.deepEqual(paths(Project, project(o)), [path], JSON.stringify(o));
  assert.deepEqual(paths(Project, project({ status: "Ongoing" })), ["status"], "the stage is never written into the editorial status");
});

test("impact: verified figures, { value, label } each, one to eight, distinct", () => {
  const m = (value: string, label: string) => ({ value, label });
  assert.deepEqual(paths(Project, project({ impact: Array.from({ length: PROJECT_IMPACT_MAX }, (_, i) => m(String(i), "Label")) })), []);
  assert.deepEqual(paths(Project, project({ impact: Array.from({ length: PROJECT_IMPACT_MAX + 1 }, (_, i) => m(String(i), "Label")) })), ["impact"]);
  assert.deepEqual(paths(Project, project({ impact: [] })), ["impact"]);
  assert.deepEqual(paths(Project, project({ impact: [m("120", "Children"), m("120", "Children")] })), ["impact.1"]);
  assert.deepEqual(paths(Project, project({ impact: [m("", "Children")] })), ["impact.0.value"]);
  assert.deepEqual(paths(Project, project({ impact: [m("120", "")] })), ["impact.0.label"]);
  assert.deepEqual(paths(Project, project({ impact: [m("x".repeat(41), "Children")] })), ["impact.0.value"]);
  assert.deepEqual(paths(Project, project({ impact: ["120 children"] })), ["impact.0"], "a figure, not a sentence");
  assert.deepEqual(paths(Project, project({ impact: [{ ...m("120", "Children"), verifiedBy: "someone" }] })), ["impact.0"]);
});

test("partners: one name per line, one to twelve, distinct", () => {
  assert.deepEqual(paths(Project, project({ partners: Array.from({ length: PROJECT_PARTNERS_MAX }, (_, i) => `Partner ${i}`) })), []);
  assert.deepEqual(paths(Project, project({ partners: Array.from({ length: PROJECT_PARTNERS_MAX + 1 }, (_, i) => `Partner ${i}`) })), ["partners"]);
  assert.deepEqual(paths(Project, project({ partners: ["A school", "A school"] })), ["partners.1"]);
  assert.deepEqual(paths(Project, project({ partners: [""] })), ["partners.0"]);
});

test("story: by id — never a copy of its title or excerpt", () => {
  assert.deepEqual(paths(Project, project({ storyId: "Not an id!" })), ["storyId"]);
  assert.deepEqual(paths(Project, project({ story: { title: "A copied title", excerpt: "A copied line." } })), [""], "a copied story is refused");
});

test("snapshot: once the CMS's stories are carried, a project's story is one of them; without them it names the website's own", () => {
  const snapshot = (content: Record<string, unknown>) => ({ version: 1, schemaVersion: 1, generatedAt: "2026-10-08T10:00:00.000Z", organization: { id: org }, settings: { ...fx.settings(), status: "published" }, media: {}, content });
  const issues = (value: unknown) => paths(PublishedSnapshot, value);
  assert.deepEqual(issues(snapshot({ projects: [project({ storyId: "s1" })], stories: [story()] })), []);
  assert.deepEqual(issues(snapshot({ projects: [project({ storyId: "s9" })], stories: [story()] })), ["content.projects.0.storyId"], "not published");
  assert.deepEqual(issues(snapshot({ projects: [project({ storyId: "learning-to-read" })] })), [], "no stories key: the website's own story, by its id (the website build checks it)");
  assert.deepEqual(issues(snapshot({ projects: [project({ storyId: "s1" })], stories: [story({ projectId: "a-project" })] })), [], "a story and its project may name each other");
});
