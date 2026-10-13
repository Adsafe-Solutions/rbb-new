import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { aboutFrom, homepageFrom, overridesFrom } from "../snapshot-adapter.mjs";

/* Milestone 8 — the homepage and About fields the CMS stored and the
   website dropped, now drawn: from a published snapshot through the
   adapter to / and /about, as the pre-render renders them. With each field
   and without it (no band disappears, none gains anything). The source
   site keeps its pages, sections and release markers. */

const root = fileURLToPath(new URL("../..", import.meta.url));
const IMG = { id: "img", url: "https://media.test/rbb/media/img.png", mimeType: "image/png", alt: "A test photograph" };
const block = (id, type, data) => ({ id, type, enabled: true, version: 1, data });
const HOME = [
  block("programs", "programs", { kicker: "Our work", heading: "Four areas of work", body: "A test line under the programs.", cta: { label: "See every program", href: "/work" } }),
  block("approach", "approach", { heading: "How we work together", highlight: "together", body: "A test statement." }),
  block("timeline", "timeline", { heading: "Our progress so far", body: "A test line under the timeline.", items: [{ id: "t1", date: "2026-09-01", programId: "education", title: "A test milestone", summary: "A test line.", youtubeId: "QP5Fs3AYuWE", videoTitle: "A test film", posterId: "img" }] }),
  block("stories", "stories", { heading: "Stories of change here", body: "A test line under the stories.", count: 3 }),
  block("get-involved", "getInvolved", { heading: "Ways to take part", body: "A test line under the ways in.", cta: { label: "All the ways", href: "/get-involved" }, imageIds: { volunteer: "img" } }),
  block("appeals", "appealList", { heading: "Appeals open now", highlight: "now" }),
  block("closing", "cta", { heading: "A test closing ask", primary: { label: "Give", href: "/appeals" }, imageId: "img", cardImageId: "img" }),
];
const ABOUT = [
  block("intro", "pageHero", { title: "About a test organization", body: "A test line." }),
  block("who-we-are", "statement", { heading: "Who we are", body: ["A test paragraph."], cta: { label: "Meet the team", href: "/about/team" } }),
  block("mission-vision", "missionVision", { heading: "What guides us", highlight: "guides", mission: { label: "Our Mission", statement: "A test mission." }, vision: { label: "Our Vision", statement: "A test vision." } }),
  block("values", "numberedCards", { heading: "Our values", intro: "A test introduction to the values.", items: [{ title: "A test value" }] }),
  block("how-we-work", "approach", { heading: "How we work", highlight: "work" }),
];
const plainHome = HOME.map((s) => ({ ...s, data: Object.fromEntries(Object.entries(s.data).filter(([k]) => !(["programs", "getInvolved"].includes(s.type) && ["body", "cta"].includes(k)) && !(["timeline", "stories"].includes(s.type) && k === "body") && !(["approach", "appealList"].includes(s.type) && k === "highlight"))) }));
const plainAbout = ABOUT.map((s) => ({ ...s, data: Object.fromEntries(Object.entries(s.data).filter(([k]) => !(s.type === "statement" && k === "cta") && !(["missionVision", "approach"].includes(s.type) && k === "highlight") && !(s.type === "numberedCards" && k === "intro"))) }));
const snapshot = ({ home, about }) => ({
  version: 1, schemaVersion: 1, generatedAt: "2026-10-07T10:00:00.000Z", organization: { id: "rbb" },
  settings: { id: "site-settings", orgId: "rbb", schemaVersion: 1, status: "published", general: { shortName: "RBB", name: "Rising Beyond Borders", summary: "A summary." }, contact: { methods: [] }, social: [], seo: { description: "A description." }, branding: {}, analytics: {}, engagement: {}, features: {} },
  media: { img: IMG },
  content: {
    /* One published appeal and one story, so their bands have something
       to show (2026-10-13: the website has no built-in ones). */
    appeals: [{ id: "id-a-test-appeal", orgId: "rbb", schemaVersion: 1, status: "published", publishedAt: "2026-10-01T00:00:00.000Z", kind: "emergency", slug: "a-test-appeal", title: "A test appeal", summary: "A test summary.", imageId: "img", sections: [] }],
    stories: [{ id: "s1", orgId: "rbb", schemaVersion: 1, status: "published", publishedAt: "2026-10-01T00:00:00.000Z", type: "story", slug: "a-test-story", title: "A test story", excerpt: "A test excerpt.", date: "2026-10-01", category: "field", body: [{ type: "paragraph", children: [{ type: "text", text: "A test paragraph." }] }] }],
    ...(home && { homepage: { id: "homepage", orgId: "rbb", schemaVersion: 1, status: "published", sections: home } }),
    ...(about && { about: { id: "about", orgId: "rbb", schemaVersion: 1, status: "published", sections: about } }),
  },
});

async function siteWith(snap) {
  const noSnapshot = { name: "test-no-snapshot", resolveId: (id) => (id === "virtual:rbb-published-snapshot" ? "\0test-no-snapshot" : null), load: (id) => (id === "\0test-no-snapshot" ? "export default null;" : null) };
  /* The source site, always (see cms-links.test.mjs: RBB_SNAPSHOT=off and ws: false keep parallel loaders apart). */
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
  const { render } = await vite.ssrLoadModule("/src/entry-server.jsx");
  return { html: (route) => render(route).html, close: () => vite.close() };
}
const main = (html) => html.slice(html.indexOf("<main"), html.indexOf("</main>"));
const text = (html) => html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ").trim();
/* The band whose heading is `heading`. */
const band = (html, heading) => {
  const at = html.indexOf(heading);
  assert.ok(at >= 0, `the page has "${heading}"`);
  const start = html.lastIndexOf("<section", at);
  return html.slice(start, html.indexOf("</section>", at));
};

test("the adapter carries each field; it never carries the photographs no band draws", () => {
  const blocks = new Map(homepageFrom(snapshot({ home: HOME })).sections.map((s) => [s.type, s.data]));
  assert.deepEqual([blocks.get("programs").body, blocks.get("programs").cta], ["A test line under the programs.", { label: "See every program", to: "/work" }]);
  assert.equal(blocks.get("timeline").body, "A test line under the timeline.");
  assert.equal(blocks.get("stories").body, "A test line under the stories.");
  assert.deepEqual([blocks.get("getInvolved").body, blocks.get("getInvolved").cta], ["A test line under the ways in.", { label: "All the ways", to: "/get-involved" }]);
  assert.ok(!("imageIds" in blocks.get("getInvolved")) && !("images" in blocks.get("getInvolved")), "the ways in stay icon boxes");
  assert.ok(!JSON.stringify(blocks.get("cta")).includes("media.test"), "the closing band draws no photograph");
  const about = new Map(aboutFrom(snapshot({ about: ABOUT })).sections.map((s) => [s.type, s.data]));
  assert.deepEqual(about.get("statement").cta, { label: "Meet the team", to: "/about/team" });
  assert.equal(about.get("missionVision").highlight, "guides");
  assert.equal(about.get("numberedCards").intro, "A test introduction to the values.");
  const plain = new Map(homepageFrom(snapshot({ home: plainHome })).sections.map((s) => [s.type, s.data]));
  for (const [type, keys] of [["programs", ["body", "cta"]], ["getInvolved", ["body", "cta"]], ["timeline", ["body"]], ["stories", ["body"]], ["approach", ["highlight"]], ["appealList", ["highlight"]]]) for (const k of keys) assert.ok(!(k in plain.get(type)), `${type}.${k}`);
});

test("the homepage from the CMS draws each line, link and highlight; without them every band is there as before", async (t) => {
  const full = await siteWith(snapshot({ home: HOME }));
  t.after(full.close);
  const html = main(full.html("/"));
  const programs = band(html, "Four areas of work");
  assert.match(text(programs), /A test line under the programs\./);
  assert.match(programs, /href="\/work"[^>]*>[\s\S]*?See every program/);
  assert.match(band(html, "How we work "), /<span class="hl">together<\/span>/);
  assert.match(text(band(html, "Our progress so far")), /A test line under the timeline\./);
  assert.match(text(band(html, "Stories of change here")), /A test line under the stories\./);
  const ways = band(html, "Ways to take part");
  assert.match(text(ways), /A test line under the ways in\./);
  assert.match(ways, /href="\/get-involved"[^>]*>[\s\S]*?All the ways/);
  assert.match(band(html, "Appeals open "), /<span class="hl">now<\/span>/);
  assert.doesNotMatch(band(html, "A test closing ask"), /<img/, "the closing band: no photograph, as on the source homepage");

  const plain = await siteWith(snapshot({ home: plainHome }));
  t.after(plain.close);
  const p = main(plain.html("/"));
  for (const heading of ["Four areas of work", "How we work together", "Our progress so far", "Stories of change here", "Ways to take part", "Appeals open now", "A test closing ask"]) assert.ok(p.includes(heading), `${heading}: still there`);
  assert.ok(!/A test line under|See every program|All the ways/.test(p), "nothing added without the fields");
  assert.doesNotMatch(band(p, "How we work together"), /class="hl"/);
});

test("About from the CMS draws the statement's link, the highlights and the values' intro; without them every chapter is there as before", async (t) => {
  const full = await siteWith(snapshot({ about: ABOUT }));
  t.after(full.close);
  const html = main(full.html("/about"));
  assert.match(band(html, "Who we are"), /href="\/about\/team"[^>]*>[\s\S]*?Meet the team/);
  assert.match(band(html, "What "), /<span class="hl">guides<\/span>/);
  assert.match(text(band(html, "Our values")), /A test introduction to the values\./);
  assert.match(band(html, "How we "), /<span class="hl">work<\/span>/);

  const plain = await siteWith(snapshot({ about: plainAbout }));
  t.after(plain.close);
  const p = main(plain.html("/about"));
  for (const heading of ["Who we are", "What guides us", "Our values", "How we work"]) assert.ok(p.includes(heading), heading);
  assert.ok(!/Meet the team|A test introduction to the values|class="hl"/.test(p.slice(p.indexOf("Who we are"))), "nothing added without the fields");
});

