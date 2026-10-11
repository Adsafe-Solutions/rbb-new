import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { overridesFrom } from "../snapshot-adapter.mjs";

/* Milestone 3 — sharing metadata on the website, from a published snapshot
   through the adapter to each page's meta, rendered by the real routes as
   the pre-render renders them. The precedence of a share image:
     1. the page's own (its SEO image; else the image the page already uses
        as its own — a story's, a project's, an article's, an event's)
     2. else the site-wide default (settings.seo.ogImageId)
     3. else none — and none at all on a page that is not indexed.
   noIndex only ever takes a page out of the index. Approvals are set IN
   MEMORY for a test (release/approvals.mjs is never written). */

const root = fileURLToPath(new URL("../..", import.meta.url));
const IMG = (id) => ({ id, url: `https://media.test/rbb/media/${id}.png`, mimeType: "image/png", alt: `Alt ${id}` });
const snapshot = ({ defaultImage, donationSeo, newsSeo, appealSeo } = {}) => ({
  version: 1, schemaVersion: 1, generatedAt: "2026-10-07T10:00:00.000Z", organization: { id: "rbb" },
  settings: {
    id: "site-settings", orgId: "rbb", schemaVersion: 1, status: "published",
    general: { shortName: "RBB", name: "Rising Beyond Borders", summary: "A summary." },
    contact: { methods: [] }, social: [], seo: { description: "A description.", ...(defaultImage && { ogImageId: "default" }) },
    branding: {}, analytics: {}, engagement: {}, features: {},
  },
  media: { default: IMG("default"), page: IMG("page"), hero: IMG("hero"), news: IMG("news") },
  content: {
    generalDonation: {
      id: "general-donation", orgId: "rbb", schemaVersion: 1, status: "published",
      hero: { eyebrow: "Donate", title: "A test donation page", description: "A test description.", imageId: "hero" },
      sections: [], donation: { designation: "where-needed-most" }, ...(donationSeo && { seo: donationSeo }),
    },
    news: [{ id: "n1", type: "news", slug: "a-test-news-item", title: "A test news item", body: [], imageId: "news", status: "published", publishedAt: "2026-10-01T00:00:00Z", ...(newsSeo && { seo: newsSeo }) }],
    appeals: [{ id: "a1", orgId: "rbb", schemaVersion: 1, status: "published", kind: "emergency", slug: "a-test-appeal", title: "A test appeal", summary: "A test summary.", imageId: "hero", sections: [], ...(appealSeo && { seo: appealSeo }) }],
  },
});

/* The site with a snapshot applied before any page module loads — as the
   build appends the adapter's assignments to the content modules. */
async function siteWith(snap, { approve = [] } = {}) {
  const noSnapshot = { name: "test-no-snapshot", resolveId: (id) => (id === "virtual:rbb-published-snapshot" ? "\0test-no-snapshot" : null), load: (id) => (id === "\0test-no-snapshot" ? "export default null;" : null) };
  /* The source site, always: the published-snapshot plugin reads
     build-meta/published-snapshot.json when Vite loads its config — a file
     published-snapshot.test.mjs writes and removes while other test files
     run in parallel. RBB_SNAPSHOT=off is the plugin's own switch for "no
     snapshot". (ws: false — no WebSocket server, so parallel loaders never
     race for its port.) */
  process.env.RBB_SNAPSHOT = "off";
  const vite = await createServer({ root, logLevel: "error", appType: "custom", server: { middlewareMode: true, hmr: false, ws: false }, plugins: [noSnapshot] });
  if (snap)
    for (const [file, exports] of Object.entries(overridesFrom(snap))) {
      const mod = await vite.ssrLoadModule(`/${file}`);
      for (const [name, value] of Object.entries(exports)) {
        const target = name.split(".").reduce((node, key) => node?.[key], mod);
        if (Array.isArray(target)) target.splice(0, target.length, ...value);
        else if (target && typeof target === "object" && value && typeof value === "object") Object.assign(target, value);
      }
    }
  const { APPROVALS } = await vite.ssrLoadModule("/release/approvals.mjs");
  for (const area of approve) APPROVALS[area] = { ...APPROVALS[area], status: "approved" };
  const { render } = await vite.ssrLoadModule("/src/entry-server.jsx");
  return { meta: (route) => render(route).meta, close: () => vite.close() };
}

test("the donation page: its own share image wins over the site default; the default fills in when it has none; none without either", async (t) => {
  const own = await siteWith(snapshot({ defaultImage: true, donationSeo: { ogImageId: "page" } }), { approve: ["donation"] });
  t.after(own.close);
  const a = own.meta("/appeals");
  assert.equal(a.robots, "index, follow", "indexed once its approval area is approved");
  assert.deepEqual([a.ogImage, a.ogImageAlt, a.twitterImage, a.twitterCard], ["https://media.test/rbb/media/page.png", "Alt page", "https://media.test/rbb/media/page.png", "summary_large_image"]);

  const fallback = await siteWith(snapshot({ defaultImage: true }), { approve: ["donation"] });
  t.after(fallback.close);
  assert.deepEqual([fallback.meta("/appeals").ogImage, fallback.meta("/appeals").ogImageAlt], ["https://media.test/rbb/media/default.png", "Alt default"], "the site default");

  const none = await siteWith(snapshot({}), { approve: ["donation"] });
  t.after(none.close);
  assert.deepEqual([none.meta("/appeals").ogImage, none.meta("/appeals").twitterCard], [null, "summary"], "neither: no image, as before");
});

test("noIndex true takes a page out of the index — and takes its share image and canonical with it; false or absent changes nothing", async (t) => {
  const hidden = await siteWith(snapshot({ defaultImage: true, donationSeo: { ogImageId: "page", noIndex: true } }), { approve: ["donation"] });
  t.after(hidden.close);
  const m = hidden.meta("/appeals");
  assert.deepEqual([m.robots, m.ogImage, m.canonical], ["noindex, follow", null, null]);
  const shown = await siteWith(snapshot({ defaultImage: true, donationSeo: { ogImageId: "page", noIndex: false } }), { approve: ["donation"] });
  t.after(shown.close);
  assert.equal(shown.meta("/appeals").robots, "index, follow", "noIndex false never changes the rule");
});

test("news, blogs, events and appeals carry their share image and noIndex — and stay out of the index, as before (no indexing policy is invented)", async (t) => {
  const site = await siteWith(snapshot({ defaultImage: true, newsSeo: { title: "A share title", ogImageId: "page" }, appealSeo: { ogImageId: "page", noIndex: true } }));
  t.after(site.close);
  const news = site.meta("/media/news/a-test-news-item");
  assert.equal(news.title, "A share title");
  assert.deepEqual([news.robots, news.ogImage], ["noindex, follow", null], "never indexed: no share image, not even the default");
  const appeal = site.meta("/appeals/emergency/a-test-appeal");
  assert.deepEqual([appeal.robots, appeal.ogImage], ["noindex, follow", null]);
  /* The adapter hands the pages everything, for when they are indexed. */
  const o = overridesFrom(snapshot({ newsSeo: { title: "T", ogImageId: "page", noIndex: true } }));
  assert.deepEqual(o["src/content/media.js"].NEWS[0].seo, { title: "T", image: "https://media.test/rbb/media/page.png", imageAlt: "Alt page", noIndex: true });
});

test("the site default is only a fallback: never invented, and absent from a build without one — the source site's metadata is unchanged", async (t) => {
  const source = await siteWith(null);
  t.after(source.close);
  for (const route of ["/", "/appeals", "/about", "/work", "/stories", "/get-involved"]) {
    const m = source.meta(route);
    assert.equal(m.ogImage, null, `${route}: no image without one`);
  }
  const o = overridesFrom(snapshot({}));
  assert.deepEqual(o["src/content/site.js"].SITE, { description: "A description." }, "no default: nothing assigned");
  assert.deepEqual(overridesFrom(snapshot({ defaultImage: true }))["src/content/site.js"].SITE.shareImage, { src: "https://media.test/rbb/media/default.png", alt: "Alt default" });
  /* An image id the snapshot does not carry is no image: never a broken one. */
  const broken = snapshot({ donationSeo: { ogImageId: "missing" } });
  assert.equal(overridesFrom(broken)["src/content/donation.js"].PUBLISHED_GENERAL_DONATION.page.seo, undefined);
});

test("a page's own image comes before the default: a story's image without an SEO image; the default only for a story with no image", async (t) => {
  const story = (slug, extra) => ({ id: slug, type: "story", orgId: "rbb", schemaVersion: 1, status: "published", slug, title: `Story ${slug}`, category: "field", body: [], publishedAt: "2026-10-01T00:00:00Z", ...extra });
  const snap = snapshot({ defaultImage: true });
  snap.content.stories = [story("with-seo-image", { imageId: "news", seo: { ogImageId: "page" } }), story("with-image", { imageId: "news" }), story("without-image", {})];
  const site = await siteWith(snap, { approve: ["stories"] });
  t.after(site.close);
  const og = (slug) => site.meta(`/stories/${slug}`).ogImage;
  assert.equal(og("with-seo-image"), "https://media.test/rbb/media/page.png", "its SEO image");
  assert.equal(og("with-image"), "https://media.test/rbb/media/news.png", "its own image, not the default");
  assert.equal(og("without-image"), "https://media.test/rbb/media/default.png", "the default, only when it has none");
});
