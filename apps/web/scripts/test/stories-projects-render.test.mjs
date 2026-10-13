import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { applySnapshot } from "./support/saved-snapshot.mjs";

/* M48: the project and story pages, and the /stories hub's empty and
   featured-only states, rendered through Vite's SSR loader as the
   prerender renders them — with the saved copy of the live snapshot
   (fixtures/published-snapshot.json) applied, as a build applies it:
   since 2026-10-13 the website has no built-in projects or stories. */

const root = fileURLToPath(new URL("../..", import.meta.url));
let vite, site, render;

before(async () => {
  const noSnapshot = { name: "test-no-snapshot", resolveId: (id) => (id === "virtual:rbb-published-snapshot" ? "\0test-no-snapshot" : null), load: (id) => (id === "\0test-no-snapshot" ? "export default null;" : null) };
  /* The source site, always: the published-snapshot plugin reads
     build-meta/published-snapshot.json when Vite loads its config — a file
     published-snapshot.test.mjs writes and removes while other test files
     run in parallel. RBB_SNAPSHOT=off is the plugin's own switch for "no
     snapshot". (ws: false — no WebSocket server, so parallel loaders never
     race for its port.) */
  process.env.RBB_SNAPSHOT = "off";
  vite = await createServer({ root, logLevel: "error", appType: "custom", server: { middlewareMode: true, hmr: false, ws: false }, plugins: [noSnapshot] });
  /* The saved live snapshot, applied as the build applies it. */
  await applySnapshot(vite);
  site = await vite.ssrLoadModule("/src/content/index.js");
  ({ render } = await vite.ssrLoadModule("/src/entry-server.jsx"));
});
after(async () => {
  await vite?.close();
});

const text = (html) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
const h1 = (html) => text(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? "");
/* One band of the page, by its id. */
const band = (html, id) => {
  const start = html.indexOf(`id="${id}"`);
  assert.ok(start >= 0, `the page has #${id}`);
  return html.slice(start, html.indexOf("</section>", start));
};
const ERROR_BOUNDARY = /Something went wrong/;

/* Runs `fn` with STORIES holding only `stories`, then puts the list back:
   the build appends assignments to this exported array, so the pages read
   it at render time. */
async function withStories(stories, fn) {
  const saved = [...site.STORIES];
  site.STORIES.splice(0, site.STORIES.length, ...stories);
  try {
    return await fn();
  } finally {
    site.STORIES.splice(0, site.STORIES.length, ...saved);
  }
}

test("every project page renders its project: title, program, description", () => {
  assert.ok(site.PROJECTS.length > 0, "there are projects to render");
  for (const project of site.PROJECTS) {
    const route = site.projectPath(project);
    const { html, meta } = render(route);
    assert.doesNotMatch(html, ERROR_BOUNDARY, route);
    assert.equal(h1(html), project.title, `${route}: its heading`);
    assert.ok(text(html).includes(project.description), `${route}: its description`);
    const program = site.programBySlug(project.program);
    assert.ok(program, `${route}: its program exists`);
    assert.ok(html.includes(`href="${program.to}"`), `${route}: links to its program`);
    assert.ok(meta.title.includes(project.title), `${route}: its title`);
    assert.equal(h1(render(`${route}/`).html), project.title, `${route}/: the same page`);
  }
});

test("every story page renders its story: title, type, body, links to its program and related stories", () => {
  const stories = site.published();
  assert.ok(stories.length > 0, "there are stories to render");
  for (const story of stories) {
    const route = site.storyPath(story);
    const { html, meta } = render(route);
    assert.doesNotMatch(html, ERROR_BOUNDARY, route);
    assert.equal(h1(html), story.title, `${route}: its heading`);
    assert.ok(text(html).includes(site.categoryById(story.category).label), `${route}: its type`);
    const opening = story.body?.find((block) => typeof block === "string");
    if (opening) assert.ok(text(html).includes(opening.slice(0, 40)), `${route}: its body`);
    const program = story.programId && site.programBySlug(story.programId);
    if (program) assert.ok(html.includes(`href="${program.to}"`), `${route}: links to its program`);
    for (const related of (story.relatedStoryIds ?? []).map(site.storyBySlug).filter(Boolean))
      assert.ok(html.includes(`href="${site.storyPath(related)}"`), `${route}: links to related story ${related.slug}`);
    assert.ok(meta.title.includes(story.title), `${route}: its title`);
    assert.equal(h1(render(`${route}/`).html), story.title, `${route}/: the same page`);
  }
});

test("an unknown or unapproved project or story address is the 404 page, never indexed", () => {
  const missing = h1(render("/no-such-page").html);
  for (const route of ["/work/projects/no-such-project", "/stories/no-such-story", "/stories/no-such-story/"]) {
    const { html, meta } = render(route);
    assert.equal(h1(html), missing, route);
    assert.equal(meta.robots, "noindex, nofollow", route);
  }
  const unapproved = site.STORIES.find((story) => story.status !== "approved");
  if (unapproved) assert.equal(h1(render(site.storyPath(unapproved)).html), missing, "an unapproved story has no page");
});

test("/stories with its stories: the featured story leads and the list holds the others", async () => {
  const [first, ...rest] = site.published();
  assert.ok(first && rest.length, "there are stories to list");
  const featured = { ...first, featured: true };
  await withStories([featured, ...rest], () => {
    const { html } = render("/stories");
    assert.doesNotMatch(html, ERROR_BOUNDARY);
    const list = text(band(html, "all-stories"));
    assert.ok(!list.includes(featured.title), "the featured story is not listed again");
    for (const story of rest) assert.ok(list.includes(story.title), `lists ${story.slug}`);
    assert.ok(!list.includes(site.STORIES_PAGES.hub.browse.empty), "no empty panel");
  });
});

test("/stories with only a featured story: it leads, and the list shows it instead of saying stories are to come", async () => {
  const only = { ...site.published()[0], featured: true };
  await withStories([only], () => {
    const { html } = render("/stories");
    assert.doesNotMatch(html, ERROR_BOUNDARY);
    assert.ok(text(html).includes(only.title), "the featured story is shown");
    assert.ok(!text(html).includes(site.STORIES_PAGES.hub.featured.empty), "no featured empty state");
    const list = text(band(html, "all-stories"));
    assert.ok(!list.includes(site.STORIES_PAGES.hub.browse.empty), "no 'to be provided' panel under a story");
    assert.ok(list.includes(only.title), "the list shows the one story");
  });
});

test("/stories with no stories: both empty states, unchanged", async () => {
  await withStories([], () => {
    const { html, meta } = render("/stories");
    assert.doesNotMatch(html, ERROR_BOUNDARY);
    assert.ok(text(html).includes(site.STORIES_PAGES.hub.featured.empty), "the featured empty state");
    assert.ok(text(band(html, "all-stories")).includes(site.STORIES_PAGES.hub.browse.empty), "the list's empty panel");
    assert.match(meta.robots, /^noindex/, "an empty hub is not indexed");
  });
});
