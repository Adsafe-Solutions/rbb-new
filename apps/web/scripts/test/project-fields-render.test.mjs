import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { projectsFrom, storiesFrom } from "../snapshot-adapter.mjs";

/* Milestone 6 — a project's location, stage, date, impact, partners and
   story: from a published snapshot through the adapter to the project page
   and the homepage's project timeline, rendered as the pre-render renders
   them; with each field and without it. The story is named by id: a CMS
   story, or a website story while the website's own stories are the
   site's. The website's own sample projects are checked untouched. */

const root = fileURLToPath(new URL("../..", import.meta.url));
let vite, site, work, render, importers, validate;

before(async () => {
  const noSnapshot = { name: "test-no-snapshot", resolveId: (id) => (id === "virtual:rbb-published-snapshot" ? "\0test-no-snapshot" : null), load: (id) => (id === "\0test-no-snapshot" ? "export default null;" : null) };
  /* The source site, always (see cms-links.test.mjs: RBB_SNAPSHOT=off and ws: false keep parallel loaders apart). */
  process.env.RBB_SNAPSHOT = "off";
  vite = await createServer({ root, logLevel: "error", appType: "custom", server: { middlewareMode: true, hmr: false, ws: false }, plugins: [noSnapshot] });
  site = await vite.ssrLoadModule("/src/content/index.js");
  work = await vite.ssrLoadModule("/src/content/work.js");
  ({ render } = await vite.ssrLoadModule("/src/entry-server.jsx"));
  importers = await vite.ssrLoadModule("/src/contract/importers.js");
  ({ validateContent: validate } = await vite.ssrLoadModule("/src/content/validate.js"));
});
after(async () => {
  await vite?.close();
});

const FACTS = { location: "A test district", stage: "Ongoing", date: "2026-09-01", impact: [{ value: "120", label: "Children reading weekly" }, { value: "4", label: "Test schools" }], partners: ["A test school", "A test library"] };
const projectRecord = (slug, extra = {}) => ({ id: `id-${slug}`, orgId: "rbb", schemaVersion: 1, status: "published", slug, title: `Project ${slug}`, programId: "education", description: "A test line.", order: 0, ...extra });
const storyRecord = (id, extra = {}) => ({ id, orgId: "rbb", schemaVersion: 1, type: "story", status: "published", slug: `story-${id}`, title: `Story ${id}`, excerpt: `The excerpt of ${id}.`, category: "field", body: [], ...extra });
const snapshot = (content) => ({ version: 1, schemaVersion: 1, generatedAt: "2026-10-07T10:00:00.000Z", organization: { id: "rbb" }, media: {}, content });
const text = (html) => html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ").trim();
const main = (html) => html.slice(html.indexOf("<main"), html.indexOf("</main>"));
const row = (html, id) => {
  const at = html.indexOf(`id="${id}"`);
  return at < 0 ? null : text(html.slice(at, html.indexOf("</section>", at)));
};

/* Runs `fn` with PROJECTS (and, given, STORIES) replaced, then puts them back. */
async function withContent({ projects, stories }, fn) {
  const saved = { projects: [...site.PROJECTS], records: [...work.PROJECT_RECORDS], stories: [...site.STORIES] };
  site.PROJECTS.splice(0, site.PROJECTS.length, ...projects);
  work.PROJECT_RECORDS.splice(0, work.PROJECT_RECORDS.length, ...projects);
  if (stories) site.STORIES.splice(0, site.STORIES.length, ...stories);
  try {
    return await fn();
  } finally {
    site.PROJECTS.splice(0, site.PROJECTS.length, ...saved.projects);
    work.PROJECT_RECORDS.splice(0, work.PROJECT_RECORDS.length, ...saved.records);
    site.STORIES.splice(0, site.STORIES.length, ...saved.stories);
  }
}

test("the adapter: the source shape — the stage as `status`, figures as { value, label }, the story by id; nothing for a project without them", () => {
  const [full, plain] = projectsFrom(snapshot({ projects: [projectRecord("full", { ...FACTS, storyId: "s1" }), projectRecord("plain", { order: 1 })] }));
  assert.deepEqual(
    { location: full.location, status: full.status, date: full.date, impact: full.impact, partners: full.partners, storyId: full.storyId },
    { location: FACTS.location, status: FACTS.stage, date: FACTS.date, impact: FACTS.impact, partners: FACTS.partners, storyId: "s1" }
  );
  assert.equal(full.editorialStatus, "approved", "the stage never touches the editorial status");
  for (const k of ["location", "status", "date", "impact", "partners", "storyId", "story"]) assert.ok(!(k in plain), k);
});

test("the project page: location and stage in its facts, the impact, partners and story rows — and none of them for a project without", async () => {
  const stories = storiesFrom(snapshot({ stories: [storyRecord("s1")] }));
  const projects = projectsFrom(snapshot({ projects: [projectRecord("full", { ...FACTS, storyId: "s1" }), projectRecord("plain", { order: 1 })], stories: [storyRecord("s1")] }));
  await withContent({ projects, stories }, () => {
    const html = main(render("/work/projects/full").html);
    const facts = text(html.slice(html.indexOf("<dl"), html.indexOf("</dl>")));
    assert.match(facts, /Location A test district/);
    assert.match(facts, /Status Ongoing/);
    assert.deepEqual([...html.slice(html.indexOf('id="impact"'), html.indexOf("</section>", html.indexOf('id="impact"'))).matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map(([, li]) => text(li)), ["120 — Children reading weekly", "4 — Test schools"]);
    assert.match(row(html, "partners"), /A test school.*A test library/);
    assert.match(row(html, "story"), /Story Story s1 The excerpt of s1\./, "the story's own title and excerpt");

    const plain = main(render("/work/projects/plain").html);
    const plainFacts = text(plain.slice(plain.indexOf("<dl"), plain.indexOf("</dl>")));
    assert.doesNotMatch(plainFacts, /Location|Status/, "only the facts the record has");
    for (const id of ["impact", "partners", "story"]) assert.equal(row(plain, id), null, `no ${id} row`);
  });
});

test("the homepage's project timeline: newest date first, the date as its pill; without a date, the stage — as the source does", async () => {
  const projects = projectsFrom(snapshot({ projects: [projectRecord("older", { date: "2026-01-15" }), projectRecord("newer", { order: 1, date: "2026-09-01" }), projectRecord("undated", { order: 2, stage: "Planned" })] }));
  await withContent({ projects }, () => {
    const highlights = site.projectHighlights();
    assert.deepEqual(highlights.map((h) => [h.title, h.dateLabel]), [["Project newer", "1 Sept 2026"], ["Project older", "15 Jan 2026"], ["Project undated", "Planned"]]);
  });
});

test("a story by its id is shown; a story the site does not show fails loudly — never left out", async () => {
  const stories = storiesFrom(snapshot({ stories: [storyRecord("s1")] }));
  const sample = stories[0];
  const projects = projectsFrom(snapshot({ projects: [projectRecord("names-a-website-story", { storyId: sample.id }), projectRecord("names-nothing-shown", { order: 1, storyId: "no-such-story" })] }));
  await withContent({ projects, stories }, () => {
    assert.match(row(main(render("/work/projects/names-a-website-story").html), "story"), new RegExp(sample.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.throws(() => render("/work/projects/names-nothing-shown"), /no story "no-such-story"/);
    const { errors } = validate({ preview: false });
    assert.ok(errors.some((e) => /storyId` "no-such-story" is not an approved story/.test(e)), "the content check names it first");
    assert.ok(!errors.some((e) => e.includes(`storyId\` "${sample.id}"`)), "a shown story is fine");
  });
});

