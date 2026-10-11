import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { overridesFrom } from "../snapshot-adapter.mjs";

/* Milestone 4 — a news item's program, a blog post's category, an event's
   program, schedule and time zone: from a published snapshot through the
   adapter to the real routes, rendered as the pre-render renders them.
   With each field and without it: a record that leaves one out renders as
   such records always have. The website's own sample records are checked
   untouched, release markers included. */

const root = fileURLToPath(new URL("../..", import.meta.url));
const IMG = { id: "m1", url: "https://media.test/rbb/media/m1.png", mimeType: "image/png", alt: "A test photograph" };
const body = [{ type: "paragraph", children: [{ type: "text", text: "A test paragraph." }] }];
const base = { orgId: "rbb", schemaVersion: 1, status: "published", publishedAt: "2026-10-01T00:00:00.000Z" };
const event = (slug, extra) => ({ ...base, id: slug, slug, title: `Event ${slug}`, summary: "A test summary.", about: body, date: "2026-11-14", startTime: "6:30 PM", endTime: "9:00 PM", programId: null, venue: "Test hall", address: "1 Test Street", schedule: [], imageId: "m1", ...extra });
const snapshot = {
  version: 1, schemaVersion: 1, generatedAt: "2026-10-07T10:00:00.000Z", organization: { id: "rbb" },
  settings: {
    id: "site-settings", orgId: "rbb", schemaVersion: 1, status: "published",
    general: { shortName: "RBB", name: "Rising Beyond Borders", summary: "A summary." },
    contact: { methods: [] }, social: [], seo: { description: "A description." }, branding: {}, analytics: {}, engagement: {}, features: {},
  },
  media: { m1: IMG },
  content: {
    news: [
      { ...base, id: "n1", type: "news", slug: "news-with-program", title: "A news item with a program", date: "2026-10-01", body, programId: "education" },
      { ...base, id: "n2", type: "news", slug: "news-without-program", title: "A news item without one", date: "2026-10-02", body },
    ],
    blogs: [
      { ...base, id: "b1", type: "blog", slug: "blog-with-category", title: "A blog post with a category", date: "2026-10-01", body, category: "field-notes" },
      { ...base, id: "b2", type: "blog", slug: "blog-without-category", title: "A blog post without one", date: "2026-10-02", body },
    ],
    events: [
      event("full", { programId: "education", timezone: "Asia/Kolkata", schedule: [{ time: "6:30 PM", item: "Welcome and introductions" }, { item: "The main session" }, { time: "9:00 PM", item: "Close" }] }),
      event("bare", {}),
    ],
  },
};

let vite, render, media;
before(async () => {
  const noSnapshot = { name: "test-no-snapshot", resolveId: (id) => (id === "virtual:rbb-published-snapshot" ? "\0test-no-snapshot" : null), load: (id) => (id === "\0test-no-snapshot" ? "export default null;" : null) };
  /* The source site, always (see cms-links.test.mjs: RBB_SNAPSHOT=off and ws: false keep parallel loaders apart). */
  process.env.RBB_SNAPSHOT = "off";
  vite = await createServer({ root, logLevel: "error", appType: "custom", server: { middlewareMode: true, hmr: false, ws: false }, plugins: [noSnapshot] });
  media = await vite.ssrLoadModule("/src/content/media.js");
  ({ render } = await vite.ssrLoadModule("/src/entry-server.jsx"));
});
after(async () => {
  await vite?.close();
});

const main = (html) => html.slice(html.indexOf("<main"), html.indexOf("</main>"));
const text = (html) => html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");

/* The source site first, before the snapshot is applied to the shared modules. */
test("the source site: sample news, blogs and events keep their release markers and render as before — times with no zone", () => {
  for (const list of [media.NEWS, media.BLOGS, media.EVENTS]) assert.ok(list.length > 0 && list.every((item) => item.releaseMarker), "every sample keeps its marker");
  const dinner = media.EVENTS.find((e) => e.id === "community-dinner-november");
  const page = text(main(render(`/media/events/${dinner.id}`).html));
  assert.match(page, /6:30 PM–9:00 PM(?! \()/, "a source event states no zone, so none is shown");
  assert.match(page, /Welcome and introductions/, "its schedule");
  assert.match(render(`/media/events/${dinner.id}`).html, /data-release-marker=/, "the release marker is still on the page");
  assert.ok(media.BLOGS.every((b) => media.BLOG_CATEGORIES.some((c) => c.id === b.category)) && media.NEWS.every((n) => n.program));
});

test("the adapter hands the pages each field as the source shape has it — and leaves out what a record leaves out", () => {
  const o = overridesFrom(snapshot)["src/content/media.js"];
  const news = new Map(o.NEWS.map((n) => [n.id, n]));
  assert.equal(news.get("news-with-program").program, "education");
  assert.ok(!("program" in news.get("news-without-program")));
  const blogs = new Map(o.BLOGS.map((b) => [b.id, b]));
  assert.equal(blogs.get("blog-with-category").category, "field-notes");
  assert.ok(!("category" in blogs.get("blog-without-category")));
  const events = new Map(o.EVENTS.map((e) => [e.id, e]));
  assert.deepEqual(
    (({ start, end, timezone, program, schedule }) => ({ start, end, timezone, program, schedule }))(events.get("full")),
    { start: "6:30 PM", end: "9:00 PM", timezone: "Asia/Kolkata", program: "education", schedule: [{ time: "6:30 PM", item: "Welcome and introductions" }, { time: "", item: "The main session" }, { time: "9:00 PM", item: "Close" }] },
    "times as written, never converted; an untimed step as the source writes it"
  );
  assert.deepEqual([events.get("bare").program, events.get("bare").schedule, "timezone" in events.get("bare")], ["open", [], false]);
});

test("rendered: news shows its program, a blog post its category, an event its program, schedule and zone — and nothing for an absent one", () => {
  /* Apply the snapshot as the build appends it to media.js. */
  for (const [name, value] of Object.entries(overridesFrom(snapshot)["src/content/media.js"])) media[name].splice(0, media[name].length, ...value);
  const article = (path) => text(main(render(path).html));
  /* The header's label, before the body (the "More" cards below name the other record's). */
  const header = (path) => article(path).split("A test paragraph.")[0];
  assert.match(header("/media/news/news-with-program"), /Education/, "the program's name");
  assert.doesNotMatch(header("/media/news/news-without-program"), /Education|Health|Livelihoods|Community Support/, "no program: no label");
  assert.match(header("/media/blogs/blog-with-category"), /Field notes/);
  assert.doesNotMatch(header("/media/blogs/blog-without-category"), /Reflections|Field notes|How to help/);
  assert.match(text(main(render("/media/blogs").html)), /Field notes/, "the category is offered as a filter");

  const full = article("/media/events/full");
  assert.match(full, /6:30 PM–9:00 PM \(Asia\/Kolkata\)/, "the times as written, naming their zone");
  assert.match(full, /How the day runs/);
  for (const step of ["6:30 PM Welcome and introductions", "The main session", "9:00 PM Close"]) assert.ok(full.includes(step), step);
  assert.match(full, /More about Education/, "the program it belongs to");
  const bare = article("/media/events/bare");
  assert.match(bare, /6:30 PM–9:00 PM(?! \()/, "no zone: none shown");
  assert.doesNotMatch(bare, /How the day runs/, "no schedule: no schedule section");
  assert.doesNotMatch(bare, /More about/, "open to all: no program link");
  assert.match(text(main(render("/media/events").html)), /Open to all/, "the open-to-all group, as the source names it");
});
