import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { appealsFrom, generalDonationFrom, overridesFrom } from "../snapshot-adapter.mjs";

/* Milestone 7 — the donation page's and appeals' sections, from a
   published snapshot through the adapter to /appeals and an appeal's page,
   rendered as the pre-render renders them: the "why" statement's own
   heading, kicker, highlight and link; how support helps with its kicker,
   highlight and intro; the page's own trust panel, FAQ and appeal lists —
   each absent (the site's own, as before), switched off (none) or the
   page's own. The source site's appeal pages keep their wording. No
   payment is involved: the form slot is untouched. */

const root = fileURLToPath(new URL("../..", import.meta.url));
const IMG = (id) => ({ id, url: `https://media.test/rbb/media/${id}.png`, mimeType: "image/png", alt: `Alt ${id}` });
const block = (id, type, data, enabled = true) => ({ id, type, enabled, version: 1, data });
const WHY = block("why", "statement", { kicker: "Why give now", heading: "Why your support matters", highlight: "matters", body: ["A test statement.", "A second test paragraph."], cta: { label: "Read about our work", href: "/work" } });
const HELPS = block("helps", "numberedCards", { kicker: "Where it goes", heading: "How your support helps", highlight: "helps", intro: "A test introduction.", items: [{ title: "A test area", description: "A test line." }] });
const LISTS = [block("now", "appealList", { kicker: "Now", heading: "Emergency appeals now", kind: "emergency" }), block("every", "appealList", { heading: "Every appeal we run" })];
const TRUST = block("trust", "trust", { kicker: "Open books", heading: "How we account for every gift", body: "A test trust line.", cta: { label: "See the documents", href: "/about#transparency" } });
const FAQ = block("faq", "faq", { kicker: "Asked often", heading: "Giving, answered", items: [{ question: "A test question?", answer: "A test answer." }] });
const base = { orgId: "rbb", schemaVersion: 1, status: "published" };
const appeal = (slug, kind, extra = {}) => ({ ...base, id: `id-${slug}`, kind, slug, title: `Appeal ${slug}`, summary: "A test summary.", imageId: "img", sections: [], publishedAt: "2026-10-01T00:00:00.000Z", ...extra });
const snapshot = ({ page, appeals = [] }) => ({
  version: 1, schemaVersion: 1, generatedAt: "2026-10-07T10:00:00.000Z", organization: { id: "rbb" },
  settings: { id: "site-settings", orgId: "rbb", schemaVersion: 1, status: "published", general: { shortName: "RBB", name: "Rising Beyond Borders", summary: "A summary." }, contact: { methods: [] }, social: [], seo: { description: "A description." }, branding: {}, analytics: {}, engagement: {}, features: {} },
  media: { img: IMG("img") },
  content: {
    ...(page && { generalDonation: { ...base, id: "general-donation", hero: { eyebrow: "Donate", title: "A test donation page", description: "A test description.", imageId: "img" }, donation: { designation: "where-needed-most" }, sections: page } }),
    appeals,
  },
});

/* The site with a snapshot applied before any page module loads, as the build appends the adapter's assignments. */
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
  return { html: (route) => render(route).html, meta: (route) => render(route).meta, close: () => vite.close() };
}
const text = (html) => html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
const main = (html) => html.slice(html.indexOf("<main"), html.indexOf("</main>"));
/* The section headed `heading`: from its <h2> to the end of its band. */
const band = (html, heading) => {
  const h = html.indexOf(heading);
  if (h < 0) return null;
  const start = html.lastIndexOf("<section", h);
  return html.slice(start, html.indexOf("</section>", h));
};

test("the adapter: each section in the page's terms — absent, switched off (null / []), or the page's own", () => {
  const own = generalDonationFrom(snapshot({ page: [WHY, HELPS, ...LISTS, TRUST, FAQ] }));
  assert.deepEqual(own.why, { id: "why", kicker: "Why give now", heading: "Why your support matters", highlight: "matters", body: WHY.data.body, cta: { label: "Read about our work", to: "/work" } });
  assert.deepEqual([own.impact.kicker, own.impact.highlight, own.impact.intro], ["Where it goes", "helps", "A test introduction."]);
  assert.deepEqual(own.trust, { kicker: "Open books", heading: "How we account for every gift", body: "A test trust line.", cta: { label: "See the documents", to: "/about#transparency" } });
  assert.deepEqual(own.faq, { kicker: "Asked often", heading: "Giving, answered", items: [{ q: "A test question?", a: "A test answer." }] });
  assert.deepEqual(own.lists, [{ id: "now", kicker: "Now", heading: "Emergency appeals now", kind: "emergency" }, { id: "every", heading: "Every appeal we run" }]);
  const off = generalDonationFrom(snapshot({ page: [{ ...TRUST, enabled: false }, { ...FAQ, enabled: false }, { ...LISTS[0], enabled: false }] }));
  assert.deepEqual([off.trust, off.faq, off.lists], [null, null, []]);
  const absent = generalDonationFrom(snapshot({ page: [WHY] }));
  assert.ok(!("trust" in absent) && !("faq" in absent) && !("lists" in absent));
  assert.equal(generalDonationFrom(snapshot({ page: [{ ...WHY, data: { heading: "H", body: ["P."] } }] })).why.kicker, "Why give", "the kicker the page used before is the fallback");
  const [a] = appealsFrom(snapshot({ appeals: [appeal("a", "emergency", { sections: [WHY, HELPS, TRUST] })] }));
  assert.equal(a.source, "cms");
  assert.deepEqual(a.sections.map((s) => s.type), ["statement", "numberedCards"], "the why and how passages; the rest are the page's own bands");
  assert.equal(a.trust.heading, "How we account for every gift");
});

test("/appeals from the CMS: its own why, how, appeal lists, trust panel and questions — the transparency documents still listed", async (t) => {
  const site = await siteWith(snapshot({ page: [WHY, HELPS, ...LISTS, TRUST, FAQ], appeals: [appeal("first-emergency", "emergency"), appeal("first-campaign", "campaign")] }));
  t.after(site.close);
  const html = main(site.html("/appeals"));
  const why = band(html, "Why your support ");
  assert.match(text(why), /Why give now/, "its kicker");
  assert.match(why, /<span class="hl">matters<\/span>/, "its highlight");
  assert.match(why, /href="\/work"[^>]*>[\s\S]*?Read about our work/, "its link");
  const how = band(html, "How your support ");
  assert.match(text(how), /Where it goes.*A test introduction\./);
  assert.match(how, /<span class="hl">helps<\/span>/);
  assert.match(text(band(html, "Emergency appeals now")), /Appeal first-emergency/);
  assert.doesNotMatch(text(band(html, "Emergency appeals now")), /Appeal first-campaign/, "a list of one kind");
  assert.match(text(band(html, "Every appeal we run")), /Appeal first-emergency.*Appeal first-campaign|Appeal first-campaign.*Appeal first-emergency/);
  assert.doesNotMatch(html, /<h2[^>]*>(Campaigns|Emergency Response)<\/h2>/, "the built-in bands give way to the page's own lists");
  const trust = band(html, "How we account for every gift");
  assert.match(text(trust), /Open books.*A test trust line\./);
  assert.match(trust, /href="\/about#transparency"/);
  assert.ok(!html.includes("Transparency matters."), "the site's wording gives way");
  assert.match(text(band(html, "Giving, answered")), /Asked often.*A test question\? A test answer\./);
  assert.ok(!html.includes("Frequently asked questions"), "the site's FAQ heading gives way");
  assert.ok(!html.includes("sample FAQ answer"), "and its sample answers");
});

test("/appeals from the CMS without them: the site's own trust panel and appeal bands, no questions (none built in since 2026-10-13); switched off: none", async (t) => {
  const absent = await siteWith(snapshot({ page: [WHY], appeals: [appeal("first-emergency", "emergency")] }));
  t.after(absent.close);
  const a = main(absent.html("/appeals"));
  assert.ok(a.includes("Transparency matters."), "the site's own trust panel");
  assert.ok(!a.includes("Frequently asked questions"), "no built-in questions: the FAQ is the published page's own");
  assert.match(a, /<h2[^>]*>Emergency Response<\/h2>/, "the built-in appeal band of the kind with an appeal open");
  // A kind with nothing open is not shown (2026-10-17, RBB's request).
  assert.doesNotMatch(a, /<h2[^>]*>(Campaigns|Special Appeals)<\/h2>/, "no band for a kind with no appeal");
  const off = await siteWith(snapshot({ page: [WHY, { ...TRUST, enabled: false }, { ...FAQ, enabled: false }, { ...LISTS[0], enabled: false }], appeals: [appeal("first-emergency", "emergency")] }));
  t.after(off.close);
  const o = main(off.html("/appeals"));
  assert.ok(!o.includes("Transparency matters.") && !o.includes("How we account for every gift"), "no trust panel");
  assert.ok(!o.includes("Frequently asked questions") && !o.includes("Giving, answered"), "no questions");
  assert.ok(!band(o, ">Emergency Response<") && !o.includes("Appeal first-emergency"), "no appeal bands");
  assert.match(o, /Donate/, "the closing band, as always");
});

test("an appeal from the CMS: its own why heading, kicker and link; its own sections; its lists never name itself — 'Support …' stays the page's title", async (t) => {
  const site = await siteWith(snapshot({ appeals: [appeal("cms-appeal", "emergency", { sections: [WHY, HELPS, LISTS[0], TRUST, FAQ] }), appeal("another-emergency", "emergency")] }));
  t.after(site.close);
  const html = main(site.html("/appeals/emergency/cms-appeal"));
  assert.match(text(html), /Support Appeal cms-appeal/);
  const why = band(html, "Why your support ");
  assert.match(text(why), /Why give now/);
  assert.ok(!html.includes("Why this response matters"), "the CMS heading, not the page's");
  assert.match(why, /href="\/work"/);
  assert.match(text(band(html, "How your support ")), /Where it goes/);
  const list = text(band(html, "Emergency appeals now"));
  assert.match(list, /Appeal another-emergency/);
  assert.doesNotMatch(list, /Appeal cms-appeal/, "never itself");
  assert.ok(html.includes("How we account for every gift") && html.includes("Giving, answered"));
  const plain = await siteWith(snapshot({ appeals: [appeal("plain-appeal", "emergency", { sections: [{ ...WHY, data: { heading: "The situation", body: ["A test paragraph."] } }] }), appeal("another-emergency", "emergency")] }));
  t.after(plain.close);
  const p = main(plain.html("/appeals/emergency/plain-appeal"));
  assert.ok(p.includes("The situation") && p.includes("Transparency matters."), "its own heading; the site's trust panel without its own");
  assert.ok(!p.includes("Frequently asked questions"), "no questions without its own, as before");
  assert.match(text(band(p, "Other appeals") ?? ""), /Appeal another-emergency/, "the page's own band without lists");
});

test("Milestone 3 still holds: an appeal's SEO description and noIndex; appeal pages are never indexed", async (t) => {
  const site = await siteWith(snapshot({ appeals: [appeal("seo-appeal", "emergency", { sections: [WHY, TRUST], seo: { description: "A test share description.", noIndex: true } })] }));
  t.after(site.close);
  const m = site.meta("/appeals/emergency/seo-appeal");
  assert.equal(m.description, "A test share description.");
  assert.equal(m.robots, "noindex, follow");
});
