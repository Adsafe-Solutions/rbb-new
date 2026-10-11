import { test } from "node:test";
import assert from "node:assert/strict";
import { storyProjectReference } from "../../src/lib/storyProjects.js";

/* M31.1: a story's project reference, for each source of stories and
   projects. Made-up slugs only. */

const check = (projectId, approved, { storiesFromCms, projectsFromCms }) =>
  storyProjectReference({ projectId, approvedProjectSlugs: new Set(approved), storiesFromCms, projectsFromCms });

test("website projects + website stories: unchanged — a story's project must be on the site", () => {
  const source = { storiesFromCms: false, projectsFromCms: false };
  assert.equal(check("sample-project", ["sample-project"], source), "ok");
  assert.equal(check("gone-project", ["sample-project"], source), "missing", "still an error, as before");
  assert.equal(check(undefined, [], source), "ok", "no project named");
});

test("CMS projects + website stories: the website stories' old references are obsolete, never an error", () => {
  const mixed = { storiesFromCms: false, projectsFromCms: true };
  assert.equal(check("sample-project", ["real-project"], mixed), "obsolete");
  assert.equal(check(undefined, ["real-project"], mixed), "ok");
});

test("CMS projects + CMS stories: a missing project still fails", () => {
  assert.equal(check("unpublished-project", ["real-project"], { storiesFromCms: true, projectsFromCms: true }), "missing");
});

test("CMS projects + CMS stories: a published project passes", () => {
  assert.equal(check("real-project", ["real-project"], { storiesFromCms: true, projectsFromCms: true }), "ok");
});

test("CMS stories + website projects: a CMS story naming a project the site lacks still fails", () => {
  assert.equal(check("real-project", ["sample-project"], { storiesFromCms: true, projectsFromCms: false }), "missing");
});
