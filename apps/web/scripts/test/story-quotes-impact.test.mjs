import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { storiesFrom } from "../snapshot-adapter.mjs";

/* Milestone 5 — a story's quotes and impact: from a published snapshot
   through the adapter to the story page (pull-quotes after the body; the
   "Impact" row), rendered as the pre-render renders it. The listings (the
   hub, the homepage, related stories) draw neither, so a story's card is
   the same with or without them. The website's own sample stories are
   checked untouched, release markers included. */

const root = fileURLToPath(new URL("../..", import.meta.url));
let vite, site, render;

before(async () => {
  const noSnapshot = { name: "test-no-snapshot", resolveId: (id) => (id === "virtual:rbb-published-snapshot" ? "\0test-no-snapshot" : null), load: (id) => (id === "\0test-no-snapshot" ? "export default null;" : null) };
  /* The source site, always (see cms-links.test.mjs: RBB_SNAPSHOT=off and ws: false keep parallel loaders apart). */
  process.env.RBB_SNAPSHOT = "off";
  vite = await createServer({ root, logLevel: "error", appType: "custom", server: { middlewareMode: true, hmr: false, ws: false }, plugins: [noSnapshot] });
  site = await vite.ssrLoadModule("/src/content/index.js");
  ({ render } = await vite.ssrLoadModule("/src/entry-server.jsx"));
});
after(async () => {
  await vite?.close();
});

const body = [{ type: "paragraph", children: [{ type: "text", text: "A test paragraph." }] }];
const QUOTES = [{ text: "We read together now.", attribution: "A parent at the test club" }, { text: "Another test line.", attribution: "A test volunteer" }];
const IMPACT = ["Children borrow books to read at home.", "Parents stay to listen."];
const storyRecord = (id, extra = {}) => ({ id, orgId: "rbb", schemaVersion: 1, type: "story", status: "published", slug: id, title: `Story ${id}`, category: "field", body, date: "2026-10-01", ...extra });
const snapshot = (stories) => ({ version: 1, schemaVersion: 1, generatedAt: "2026-10-07T10:00:00.000Z", organization: { id: "rbb" }, media: {}, content: { stories } });
const text = (html) => html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
const main = (html) => html.slice(html.indexOf("<main"), html.indexOf("</main>"));

async function withStories(stories, fn) {
  const saved = [...site.STORIES];
  site.STORIES.splice(0, site.STORIES.length, ...stories);
  try {
    return await fn();
  } finally {
    site.STORIES.splice(0, site.STORIES.length, ...saved);
  }
}

test("the adapter: quotes and impact exactly as published, in the source shape; a story without them has neither key", () => {
  const [withFields, without] = storiesFrom(snapshot([storyRecord("with-fields", { quotes: QUOTES, impact: IMPACT }), storyRecord("without-fields")]));
  assert.deepEqual([withFields.quotes, withFields.impact], [QUOTES, IMPACT]);
  assert.ok(!("quotes" in without) && !("impact" in without));
});

test("the story page: each quote as a pull-quote with who said it, after the body; the impact lines in the Impact row — and nothing for a story without them", async () => {
  const stories = storiesFrom(snapshot([storyRecord("with-fields", { quotes: QUOTES, impact: IMPACT }), storyRecord("without-fields")]));
  await withStories(stories, () => {
    const html = main(render("/stories/with-fields").html);
    const quotes = [...html.matchAll(/<figure[^>]*>[\s\S]*?<blockquote[^>]*>([\s\S]*?)<\/blockquote>[\s\S]*?<figcaption[^>]*>([\s\S]*?)<\/figcaption>[\s\S]*?<\/figure>/g)].map(([, words, by]) => [text(words), text(by)]);
    assert.deepEqual(quotes, QUOTES.map((q) => [q.text, `— ${q.attribution}`]), "in order, each attributed");
    assert.ok(html.indexOf("A test paragraph.") < html.indexOf("<blockquote"), "after the body");
    const impact = html.slice(html.indexOf('id="impact"'), html.indexOf("</section>", html.indexOf('id="impact"')));
    assert.match(text(impact), /^.*Impact/, "the row's heading");
    assert.deepEqual([...impact.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map(([, li]) => text(li)), IMPACT, "each line, as written, in order");

    const plain = main(render("/stories/without-fields").html);
    assert.doesNotMatch(plain, /<blockquote|<figcaption[^>]*>—/, "no quotes");
    assert.doesNotMatch(plain, /id="impact"/, "no impact row");
  });
});

test("listings draw neither: the hub, the homepage and related-story cards are the same with or without quotes and impact", async () => {
  const plain = storiesFrom(snapshot([storyRecord("a-story", { relatedPostIds: ["b-story"] }), storyRecord("b-story")]));
  const full = storiesFrom(snapshot([storyRecord("a-story", { relatedPostIds: ["b-story"] }), storyRecord("b-story", { quotes: QUOTES, impact: IMPACT })]));
  const pages = async (stories) => withStories(stories, () => ({ hub: render("/stories").html, home: render("/").html, related: main(render("/stories/a-story").html) }));
  const [a, b] = [await pages(plain), await pages(full)];
  assert.equal(b.hub, a.hub, "/stories");
  assert.equal(b.home, a.home, "/");
  assert.equal(b.related, a.related, "a related-story card");
  assert.doesNotMatch(b.hub, /We read together now|Children borrow books/);
});
