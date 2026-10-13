import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { HOMEPAGE_BLOCK_TYPES } from "@rbb/content-schema/homepage-registry";
import { ABOUT_BLOCK_TYPES } from "@rbb/content-schema/about-registry";
import { CTA_TARGETS, GET_INVOLVED_PAGE_IDS, GET_INVOLVED_ROUTES, IMPACT_BLOCK_TYPES, IMPACT_CHAPTER_TYPES, POLICY_IDS, POLICY_ROUTES, PROGRAM_ICONS } from "@rbb/content-schema";
import { ABOUT_VIEW_TYPES, BY_ID, announcementsFrom, popupFrom, storyStripFrom, CTA_ROUTES, GET_INVOLVED_IDS, IMPACT_PAGE_VIEW_TYPES, IMPACT_VIEW_TYPES, getInvolvedFrom, formsFrom, howWeWorkFrom, impactPagesFrom, POLICY_IDS as ADAPTER_POLICY_IDS, aboutFrom, careersFrom, policiesFrom, impactFrom, metricsFrom, programsFrom, projectsFrom, storiesFrom, transparencyFrom, teamFrom, HOMEPAGE_VIEW_TYPES, SOCIAL_LABELS, SNAPSHOT_TARGETS, appealsFrom, homepageFrom, appendOverrides, collectionsFrom, generalDonationFrom, hasCheckouts, imageOrigins, overridesFrom, structuralProblems } from "../snapshot-adapter.mjs";

/* The published-snapshot adapter (scripts/snapshot-adapter.mjs) and the
   build's fetch step (scripts/published-snapshot.mjs). */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SNAPSHOT_FILE = join(root, "build-meta/published-snapshot.json");
const STATUS_FILE = join(root, "build-meta/published-snapshot-status.json");

const snapshot = (settings = {}) => ({
  version: 4,
  schemaVersion: 1,
  generatedAt: "2026-10-07T10:00:00.000Z",
  organization: { id: "rbb" },
  settings: {
    id: "site-settings", orgId: "rbb", schemaVersion: 1, status: "published",
    general: { shortName: "RBB", name: "Rising Beyond Borders", summary: "A summary." },
    contact: { methods: [] },
    social: [],
    seo: { description: "A description." },
    branding: {}, analytics: {}, engagement: {}, features: {},
    ...settings,
  },
  media: {},
  content: {},
});

test("mapping: general, SEO, contact and social onto the existing view models", () => {
  const o = overridesFrom(snapshot({
    contact: { methods: [{ id: "general", type: "email", label: "Email", value: "hello@example.org" }], office: { address: "1 Test Street", country: "Testland" }, hours: "Mon–Fri" },
    social: [{ platform: "linkedin", url: "https://www.linkedin.com/company/example" }],
  }));
  const contentTargets = ["media.js", "appeals.js", "donation.js", "homepage.js", "about.js", "team.js", "work.js", "impact.js", "transparency.js", "stories.js", "policies.js", "getInvolved.js", "announcements.js", "forms.js"];
  assert.deepEqual(Object.keys(o).sort(), Object.keys(SNAPSHOT_TARGETS).filter((f) => !contentTargets.some((t) => f.endsWith(t))).sort(), "no content → media.js, appeals.js and donation.js untouched");
  assert.deepEqual(o["src/content/brand.js"].BRAND, { name: "RBB", fullName: "Rising Beyond Borders", summary: "A summary." });
  assert.deepEqual(o["src/content/site.js"].SITE, { description: "A description." });
  const contact = o["src/content/contact.js"].ORG_CONTACT;
  assert.deepEqual(contact.methods, [{ id: "general", type: "email", label: "Email", value: "hello@example.org", status: "verified" }]);
  assert.deepEqual(contact.office, { address: "1 Test Street", city: null, region: null, country: "Testland", mapUrl: null, status: "verified" });
  assert.deepEqual(contact.hours, { value: "Mon–Fri", status: "verified" });
  assert.deepEqual(contact.responseTime, { value: null, status: "placeholder" }, "unset → the site's own 'nothing yet' state");
  assert.deepEqual(contact.social, [{ platform: "linkedin", icon: "linkedin", label: "LinkedIn", url: "https://www.linkedin.com/company/example", status: "verified" }]);
});

test("mapping: absent contact details fall back to the placeholder states the site already handles", () => {
  const contact = overridesFrom(snapshot())["src/content/contact.js"].ORG_CONTACT;
  assert.deepEqual(contact.methods, []);
  assert.equal(contact.office.status, "placeholder");
  assert.deepEqual(contact.social, []);
  assert.ok(Object.keys(SOCIAL_LABELS).length === 5);
});

test("the appended code assigns to the module's own export, and refuses a module that changed shape", () => {
  const out = appendOverrides("export const BRAND = { name: 'x' };\nexport default BRAND;", "src/content/brand.js", { BRAND: { name: "RBB" } });
  assert.match(out, /Object\.assign\(BRAND, \{"name":"RBB"\}\);/);
  const module = { exports: {} };
  new Function("module", out.replace(/export const /g, "const ").replace("export default BRAND;", "") + "\nmodule.exports = BRAND;")(module);
  assert.deepEqual(module.exports, { name: "RBB" });
  assert.throws(() => appendOverrides("export let BRAND = {};", "src/content/brand.js", { BRAND: {} }), /no longer declares/);
});

test("structural check: version, schema, organization, required sections", () => {
  assert.deepEqual(structuralProblems(snapshot(), { orgId: "rbb" }), []);
  assert.ok(structuralProblems({ ...snapshot(), organization: { id: "other" } }, { orgId: "rbb" }).some((p) => p.includes("another organization")));
  assert.ok(structuralProblems({ ...snapshot(), schemaVersion: 2 }, { orgId: "rbb" }).length);
  assert.ok(structuralProblems({ ...snapshot(), version: 0 }, { orgId: "rbb" }).length);
  assert.ok(structuralProblems(snapshot(), { orgId: "rbb", minimumVersion: 5 }).some((p) => p.includes("older")));
  assert.ok(structuralProblems(null, { orgId: "rbb" }).length);
  assert.ok(structuralProblems({ ...snapshot(), settings: { ...snapshot().settings, general: undefined } }, { orgId: "rbb" }).length);
});

/* The fetch step against a local stand-in API. */
async function serve(handler) {
  const server = createServer(handler);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${server.address().port}/api/v1/public/snapshot`, close: () => new Promise((r) => server.close(r)) };
}
/* Asynchronous on purpose: the stand-in API runs in THIS process. */
const fetchStep = (env) =>
  new Promise((done) => {
    const child = spawn(process.execPath, [join(root, "scripts/published-snapshot.mjs")], { env: { PATH: process.env.PATH, ...env } });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (status) => done({ status, stdout, stderr }));
  });
const status = () => JSON.parse(readFileSync(STATUS_FILE, "utf8"));

/* The pages a snapshot must carry (2026-10-13: no built-in copies). */
const PAGES = ["homepage", "about", "howWeWork", "impact", "generalDonation"];
const withPages = (s) => ({ ...s, content: { ...s.content, ...Object.fromEntries(PAGES.map((k) => [k, { id: k, status: "published" }])) } });

test("fetch step: not configured → the saved copy of the live snapshot; RBB_SNAPSHOT=off → none; a stale file never survives", async () => {
  mkdirSync(dirname(SNAPSHOT_FILE), { recursive: true });
  writeFileSync(SNAPSHOT_FILE, "{}");
  let r = await fetchStep({});
  assert.equal(r.status, 0, r.stderr);
  const saved = JSON.parse(readFileSync(join(root, "fixtures/published-snapshot.json"), "utf8"));
  assert.equal(JSON.parse(readFileSync(SNAPSHOT_FILE, "utf8")).version, saved.version);
  assert.deepEqual([status().mode, status().version], ["fixture", saved.version]);
  r = await fetchStep({ RBB_SNAPSHOT: "off" });
  assert.equal(r.status, 0);
  assert.equal(existsSync(SNAPSHOT_FILE), false);
  assert.equal(status().mode, "none");
  assert.equal((await fetchStep({ RBB_SNAPSHOT_REQUIRED: "1" })).status, 1, "required → the API, never the saved copy");
});

test("fetch step: a valid snapshot is written; nothing published, an unreachable API or bad data always fail — there is no built-in content to fall back to", async () => {
  let reply = { status: 200, body: { data: withPages(snapshot()) } };
  const api = await serve((req, res) => {
    res.writeHead(reply.status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(reply.body));
  });
  try {
    let r = await fetchStep({ RBB_SNAPSHOT_URL: api.url });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(JSON.parse(readFileSync(SNAPSHOT_FILE, "utf8")).version, 4);
    assert.deepEqual([status().mode, status().version], ["snapshot", 4]);

    r = await fetchStep({ RBB_SNAPSHOT_URL: api.url, RBB_SNAPSHOT_VERSION: "5" });
    assert.equal(r.status, 1, "older than the version a deploy hook announced");

    reply = { status: 200, body: { data: snapshot() } };
    r = await fetchStep({ RBB_SNAPSHOT_URL: api.url });
    assert.equal(r.status, 1, "a snapshot without the homepage, About, Impact and donation pages");
    assert.match(r.stderr, /the homepage is not published in it/);

    reply = { status: 404, body: { error: { code: "NOT_FOUND" } } };
    r = await fetchStep({ RBB_SNAPSHOT_URL: api.url });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /nothing has been published yet/);
    assert.equal(existsSync(SNAPSHOT_FILE), false);

    reply = { status: 200, body: { data: { ...withPages(snapshot()), organization: { id: "another-org" } } } };
    assert.equal((await fetchStep({ RBB_SNAPSHOT_URL: api.url })).status, 1, "another organization's snapshot is never used");
    reply = { status: 200, body: { data: { version: "x" } } };
    assert.equal((await fetchStep({ RBB_SNAPSHOT_URL: api.url })).status, 1);
    assert.equal(existsSync(SNAPSHOT_FILE), false);
  } finally {
    await api.close();
  }
  assert.equal((await fetchStep({ RBB_SNAPSHOT_URL: "http://unreachable.example/api" })).status, 1, "plain http to another host is refused");
  assert.equal((await fetchStep({ RBB_SNAPSHOT_URL: "http://127.0.0.1:9/api/v1/public/snapshot" })).status, 1, "unreachable");
  await fetchStep({}); // leave build-meta as a plain build would
  rmSync(STATUS_FILE, { force: true });
});

const body = [{ type: "paragraph", children: [{ type: "text", text: "Test." }] }];
const withContent = (content) => ({
  ...snapshot(),
  generatedAt: "2026-10-07T10:00:00.000Z",
  media: { img: { id: "img", url: "https://media.example.org/rbb/media/u/a.png", mimeType: "image/png", width: 48, height: 32, alt: "A test image" } },
  content,
});

test("collections: only the ones the snapshot carries; published records → the pages' view models", () => {
  assert.deepEqual(collectionsFrom(snapshot()), {}, "M5-style snapshot: source collections stay");
  const s = withContent({
    news: [
      { id: "n2", type: "news", slug: "later", title: "Later", body, date: "2026-05-02", imageId: "img", status: "published", publishedAt: "2026-10-01T00:00:00Z" },
      { id: "n1", type: "news", slug: "earlier", title: "Earlier", excerpt: "E.", body, status: "published", publishedAt: "2026-04-01T09:00:00Z", seo: { title: "SEO title" } },
    ],
    events: [{ id: "e1", slug: "gathering", title: "Gathering", summary: "S.", about: body, date: "2026-11-14", startTime: "6:30 PM", endTime: "9:00 PM", timezone: "Europe/London", programId: null, venue: "Hall", address: "1 Street", schedule: [], imageId: "img", registrationUrl: "https://r.example.org", status: "published" }],
  });
  const c = collectionsFrom(s);
  assert.deepEqual(Object.keys(c).sort(), ["EVENTS", "NEWS"], "blogs not carried → source blogs stay");
  assert.deepEqual(c.NEWS.map((n) => n.id), ["earlier", "later"], "news oldest first (the timeline)");
  assert.equal(c.NEWS[0].date, "2026-04-01", "no date → the day it was first published");
  assert.deepEqual(c.NEWS[0].seo, { title: "SEO title" });
  assert.deepEqual(c.NEWS[1].image, { src: "https://media.example.org/rbb/media/u/a.png", alt: "A test image", width: 48, height: 32, mediaId: "img" });
  assert.equal(c.NEWS[0].image, undefined);
  assert.deepEqual(c.NEWS[1].body, body, "rich text stays structured");
  assert.equal(c.NEWS[1].status, "approved");
  assert.deepEqual(
    [c.EVENTS[0].id, c.EVENTS[0].start, c.EVENTS[0].end, c.EVENTS[0].timezone, c.EVENTS[0].program, c.EVENTS[0].mapUrl, c.EVENTS[0].registrationUrl],
    ["gathering", "6:30 PM", "9:00 PM", "Europe/London", "open", null, "https://r.example.org"]
  );
  assert.deepEqual(withContent({ events: [] }).content.events, [], "an empty managed collection replaces the source list with nothing");
  assert.deepEqual(collectionsFrom(withContent({ events: [] })), { EVENTS: [] });
  assert.deepEqual(imageOrigins(s), ["https://media.example.org"]);
  assert.deepEqual(imageOrigins(snapshot()), []);
  const o = overridesFrom(s);
  assert.deepEqual(Object.keys(o["src/content/media.js"]).sort(), ["EVENTS", "NEWS"]);
});

test("a collection's contents are replaced in place (the export stays the same array)", () => {
  const out = appendOverrides("export const NEWS = [{ id: 'sample' }].map((n) => n);", "src/content/media.js", { NEWS: [{ id: "cms" }] });
  assert.match(out, /NEWS\.splice\(0, NEWS\.length, \.\.\.\[\{"id":"cms"\}\]\);/);
  const module = { exports: {} };
  new Function("module", out.replace("export const ", "const ") + "\nmodule.exports = NEWS;")(module);
  assert.deepEqual(module.exports, [{ id: "cms" }]);
});

test("Milestone 1: an absent key keeps the website's own list; a present key — even empty — replaces it", () => {
  /* The API decides presence (a collection that has been on the website —
     publishing/service.ts #collections); the website only obeys it. */
  const targets = { news: ["src/content/media.js", "NEWS"], blogs: ["src/content/media.js", "BLOGS"], events: ["src/content/media.js", "EVENTS"], appeals: ["src/content/appeals.js", "APPEALS"], team: ["src/content/team.js", "TEAM_MEMBERS"] };
  const none = overridesFrom(withContent({}));
  for (const [key, [file, name]] of Object.entries(targets)) {
    assert.equal(none[file]?.[name], undefined, `${key}: absent → the website's own list stays`);
    assert.deepEqual(overridesFrom(withContent({ [key]: [] }))[file]?.[name], [], `${key}: present and empty → replaced with nothing (an intentional empty list)`);
  }
});

test("appeals and the general donation page: published records → the donation pages' view models", () => {
  const checkout = { provider: "givebutter", campaignId: "900001", widgetId: "TestW1", widgetType: "form", defaultFrequency: "monthly" };
  const sections = [
    { id: "why", type: "richText", enabled: true, version: 1, data: { heading: "Why it matters", content: body } },
    { id: "old", type: "statement", enabled: false, version: 1, data: { heading: "Hidden", body: ["Not drawn."] } },
    { id: "helps", type: "numberedCards", enabled: true, version: 1, data: { heading: "How it helps", items: [{ title: "One", description: "First." }, { title: "Two" }] } },
  ];
  const appeal = (o) => ({ id: "a1", orgId: "rbb", schemaVersion: 1, status: "published", kind: "campaign", slug: "test-campaign", title: "Test campaign", summary: "A summary.", imageId: "img", sections, publishedAt: "2026-10-02T00:00:00Z", ...o });
  const page = { id: "general-donation", orgId: "rbb", schemaVersion: 1, status: "published", hero: { title: "Give", description: "Where needed most.", imageId: "img", context: { body: ["Context."] } }, sections, donation: { designation: "where-needed-most", checkout }, seo: { description: "SEO description." } };
  assert.equal(appealsFrom(snapshot()), undefined, "no appeals key: the source appeals stay");
  assert.equal(generalDonationFrom(snapshot()), undefined, "no page: the source donation page stays");

  const s = withContent({ appeals: [appeal({ id: "a0", slug: "older", kind: "emergency", publishedAt: "2026-09-01T00:00:00Z", highlight: { label: "Short" } }), appeal({ donation: { checkout }, seo: { title: "SEO" } })], generalDonation: page });
  const views = appealsFrom(s);
  assert.deepEqual(views.map((a) => [a.id, a.kind]), [["test-campaign", "campaigns"], ["older", "emergency"]], "newest first; kinds as the site names them");
  assert.deepEqual(views[0].sections.map((x) => x.type), ["richText", "numberedCards"], "disabled blocks are left out");
  assert.deepEqual(views[0].sections[1].cards, [{ title: "One", description: "First." }, { title: "Two" }]);
  assert.deepEqual(views[0].checkout, { provider: "givebutter", widgetType: "form", widgetId: "TestW1", frequency: "monthly" }, "the checkout the integration draws — no campaign data, no key");
  assert.deepEqual(views[0].seo, { title: "SEO", description: "A summary." });
  assert.deepEqual(views[1].story, { label: "Short" });
  assert.equal(views[1].checkout, undefined, "no checkout: the site's own form");
  assert.equal(views[0].releaseMarker, undefined);
  assert.deepEqual(withContent({ appeals: [] }).content.appeals, []);
  assert.deepEqual(appealsFrom(withContent({ appeals: [] })), [], "managed but none published: the site shows no appeals");

  const general = generalDonationFrom(s);
  assert.equal(general.title, "Give");
  assert.deepEqual(general.why, { id: "why", kicker: "Why give", heading: "Why it matters", content: body });
  assert.deepEqual(general.impact.items, [{ title: "One", description: "First." }, { title: "Two" }]);
  assert.deepEqual(general.context, { body: ["Context."] });
  assert.equal(general.designation, "where-needed-most");
  assert.equal(generalDonationFrom(withContent({ generalDonation: { ...page, status: "draft" } })), undefined, "only a PUBLISHED page");
  assert.equal(hasCheckouts(s), true);
  assert.equal(hasCheckouts(snapshot()), false);
  assert.deepEqual(imageOrigins(withContent({ appeals: [appeal()] })), ["https://media.example.org"]);

  const o = overridesFrom(s);
  assert.equal(o["src/content/appeals.js"].APPEALS.length, 2);
  assert.equal(o["src/content/donation.js"].PUBLISHED_GENERAL_DONATION.page.title, "Give");
  assert.ok(!JSON.stringify(o).includes("900001"), "the campaign id is the API's to verify; the page needs only the widget");
});

test("homepage: the published homepage's enabled blocks, in order, references as addresses — never copies", () => {
  const block = (id, type, data, enabled = true) => ({ id, type, enabled, version: 1, data });
  const post = { id: "p1", type: "news", slug: "a-news-item", title: "Referenced news title", body, status: "published" };
  const blog = { id: "b1", type: "blog", slug: "a-blog-post", title: "Referenced blog title", body, status: "published" };
  const event = { id: "e1", slug: "an-event", title: "Event", status: "published" };
  const appeal = { id: "a1", slug: "an-appeal", title: "Appeal", status: "published" };
  const home = (sections, o = {}) => ({ id: "homepage", orgId: "rbb", schemaVersion: 1, status: "published", sections, ...o });
  const sections = [
    block("hero", "hero", { slides: [{ id: "one", headline: ["A line."], cta: { label: "Go", href: "/work" }, imageId: "img", insetId: "img" }], secondaryCta: { label: "More", href: "/get-involved" }, intervalMs: 7000 }),
    block("faq", "faq", { heading: "Questions", items: [{ question: "Q?", answer: "A." }] }, false),
    block("news", "postList", { heading: "News", postIds: ["b1", "p1"] }),
    block("events", "eventList", { heading: "Events", eventIds: ["e1"] }),
    block("appeals", "appealList", { heading: "Appeals", appealIds: ["a1"] }),
    block("who", "imageText", { heading: "Who", body: ["P."], imageId: "img", imagePosition: "left" }),
  ];
  assert.equal(homepageFrom(snapshot()), undefined, "no homepage: the source homepage stays");
  const s = withContent({ news: [post], blogs: [blog], events: [event], appeals: [appeal], homepage: home(sections, { seo: { title: "Home", ogImageId: "img" } }) });
  const page = homepageFrom(s);
  assert.deepEqual(page.sections.map((b) => b.id), ["hero", "news", "events", "appeals", "who"], "order kept; the disabled block left out");
  assert.deepEqual(page.sections[0].data.slides[0].cta, { label: "Go", to: "/work" });
  assert.equal(page.sections[0].data.slides[0].image.src, "https://media.example.org/rbb/media/u/a.png");
  assert.deepEqual(page.sections[1].data.posts, [{ collection: "blogs", slug: "a-blog-post" }, { collection: "news", slug: "a-news-item" }]);
  assert.deepEqual(page.sections[2].data.events, ["an-event"]);
  assert.deepEqual(page.sections[3].data.appeals, ["an-appeal"]);
  assert.equal(page.sections[4].data.imagePosition, "left");
  assert.deepEqual(page.seo, { title: "Home", image: "https://media.example.org/rbb/media/u/a.png", imageAlt: "A test image" });
  assert.ok(!/Referenced (news|blog) title/.test(JSON.stringify(page)), "no copy of a referenced record");
  assert.equal(homepageFrom(withContent({ homepage: home(sections, { status: "draft" }) })), undefined, "only a PUBLISHED homepage");
  assert.throws(() => homepageFrom(withContent({ homepage: home([block("x", "carousel", {})]) })), /cannot draw/);
  assert.throws(() => homepageFrom(withContent({ homepage: home([block("n", "postList", { heading: "N", postIds: ["missing"] })]) })), /does not carry/);
  assert.deepEqual(imageOrigins(withContent({ homepage: home([sections[0]]) })), ["https://media.example.org"], "homepage images join the page policy");
  assert.equal(homepageFrom(s) && overridesFrom(withContent({ homepage: home([sections[0]]) }))["src/content/homepage.js"].PUBLISHED_HOMEPAGE.page.sections.length, 1);
});

test("homepage: every block type in the contract's registry has a view, a renderer and a tone rule", () => {
  const cms = readFileSync(join(root, "src/pages/Home/CmsHome.jsx"), "utf8");
  const keys = (name) => [...cms.slice(cms.indexOf(`const ${name} = {`), cms.indexOf("};", cms.indexOf(`const ${name} = {`))).matchAll(/^  (\w+):/gm)].map((m) => m[1]).sort();
  const types = [...HOMEPAGE_BLOCK_TYPES].sort();
  assert.deepEqual([...HOMEPAGE_VIEW_TYPES].sort(), types, "snapshot adapter views");
  assert.deepEqual(keys("RENDERERS"), types, "CmsHome renderers");
  assert.deepEqual(keys("TONES"), types, "CmsHome tones");
});

test("about: the published About page's enabled chapters, in order; team members in team order, in team.js's shape", () => {
  const block = (id, type, data, enabled = true) => ({ id, type, enabled, version: 1, data });
  const about = (sections, o = {}) => ({ id: "about", orgId: "rbb", schemaVersion: 1, status: "published", sections, ...o });
  const sections = [
    block("intro", "pageHero", { title: "About", body: "A line.", cta: { label: "Explore", href: "/work" } }),
    block("values", "numberedCards", { heading: "Values", items: [{ title: "A" }] }, false),
    block("who", "statement", { heading: "Who", body: ["One."] }),
    block("how", "approach", { heading: "How", body: "Intro.", cta: { label: "More", href: "/impact/our-approach" } }),
    block("transparency", "transparency", {}),
  ];
  assert.equal(aboutFrom(snapshot()), undefined, "no About page: the source page stays");
  const page = aboutFrom(withContent({ about: about(sections, { seo: { description: "About SEO." } }) }));
  assert.deepEqual(page.sections.map((b) => b.type), ["pageHero", "statement", "approach", "transparency"], "order kept; the hidden chapter left out");
  assert.deepEqual(page.sections[0].data.cta, { label: "Explore", to: "/work" });
  assert.equal(page.sections[2].data.intro, "Intro.", "the approach's body is ApproachFlow's intro");
  assert.deepEqual(page.seo, { description: "About SEO." });
  assert.equal(aboutFrom(withContent({ about: about(sections, { status: "draft" }) })), undefined, "only a PUBLISHED About page");
  assert.throws(() => aboutFrom(withContent({ about: about([block("x", "carousel", {})]) })), /cannot draw/);

  const member = (o) => ({ orgId: "rbb", schemaVersion: 1, status: "published", role: "Area", group: "team", ...o });
  assert.equal(teamFrom(snapshot()), undefined, "no team key: the source team stays");
  const team = teamFrom(withContent({ team: [member({ id: "b", slug: "b-role", name: "B", order: 1 }), member({ id: "a", slug: "a-role", name: "A", order: 1, group: "leadership", imageId: "img", relatedLinks: [{ label: "Transparency", href: "/about#transparency" }] })] }));
  assert.deepEqual(team.map((m) => m.slug), ["a-role", "b-role"], "order, then id");
  assert.deepEqual([team[0].status, team[0].category, team[0].image, team[0].imageAlt, team[0].imageId], ["approved", "leadership", "https://media.example.org/rbb/media/u/a.png", "A test image", "img"]);
  assert.deepEqual(team[0].relatedLinks, [{ label: "Transparency", to: "/about#transparency" }]);
  assert.deepEqual(teamFrom(withContent({ team: [] })), [], "managed, nobody published: the team page shows its empty state");
  assert.deepEqual(imageOrigins(withContent({ team: [member({ id: "a", slug: "a", name: "A", order: 0, imageId: "img" })] })), ["https://media.example.org"]);
  const o = overridesFrom(withContent({ about: about(sections), team: [] }));
  assert.equal(o["src/content/about.js"].PUBLISHED_ABOUT.page.sections.length, 4);
  assert.deepEqual(o["src/content/team.js"].TEAM_MEMBERS, []);
});

test("about: every block type in the contract's registry has a view, a renderer and a tone rule", () => {
  const cms = readFileSync(join(root, "src/pages/About/CmsAbout.jsx"), "utf8");
  const keys = (name) => [...cms.slice(cms.indexOf(`const ${name} = {`), cms.indexOf("};", cms.indexOf(`const ${name} = {`))).matchAll(/^  (\w+):/gm)].map((m) => m[1]).sort();
  const types = [...ABOUT_BLOCK_TYPES].sort();
  assert.deepEqual([...ABOUT_VIEW_TYPES].sort(), types, "snapshot adapter views");
  assert.deepEqual(keys("RENDERERS"), types, "CmsAbout renderers");
  assert.deepEqual(keys("TONES"), types, "CmsAbout tones");
});

test("programs: published programs → PROGRAMS in work.js's shape, in order; only when the snapshot carries them", () => {
  const program = (o) => ({ orgId: "rbb", schemaVersion: 1, status: "published", icon: "education", description: "A line.", ...o });
  assert.equal(programsFrom(snapshot()), undefined, "no programs key: the source programs stay");
  const list = programsFrom(
    withContent({
      programs: [
        program({ id: "b", slug: "health-wellbeing", title: "Health & Wellbeing", icon: "health", order: 1 }),
        program({ id: "a", slug: "education", title: "Education", order: 0, missingNote: "To be provided.", why: ["Why."], activities: ["A."], seo: { title: "Learning", ogImageId: "img" } }),
      ],
    })
  );
  assert.deepEqual(list.map((p) => [p.slug, p.to]), [["education", "/work/education"], ["health-wellbeing", "/work/health-wellbeing"]], "in order; the address from the slug");
  assert.equal(list[0].missing, "To be provided.", "the template's own name for the note");
  assert.deepEqual(list[0].seo, { title: "Learning", image: "https://media.example.org/rbb/media/u/a.png", imageAlt: "A test image" });
  assert.equal(list[1].seo, undefined);
  assert.ok(!("status" in list[0]) && !("order" in list[0]), "no editing fields reach the page");
  const o = overridesFrom(withContent({ programs: [program({ id: "a", slug: "education", title: "Education", order: 0 })] }));
  assert.equal(o["src/content/work.js"].PROGRAMS.length, 1);
});

test("programs: every icon the contract allows is one of the site's line glyphs", () => {
  const icons = readFileSync(join(root, "src/components/LineIcon/LineIcon.jsx"), "utf8");
  const glyphs = [...icons.slice(icons.indexOf("const PATHS = {")).matchAll(/^  (\w+): \(/gm)].map((m) => m[1]);
  for (const icon of PROGRAM_ICONS) assert.ok(glyphs.includes(icon), `${icon} is not a LineIcon glyph`);
});

test("impact: published figures → IMPACT.metrics by key, in order; the published Impact page's enabled blocks, names not copies", () => {
  const record = { orgId: "rbb", schemaVersion: 1, status: "published" };
  assert.equal(metricsFrom(snapshot()), undefined, "no metrics key: the source figures stay");
  assert.equal(impactFrom(snapshot()), undefined, "no impact key: the source page stays");
  const figures = metricsFrom(withContent({ metrics: [{ ...record, id: "b", slug: "countries", value: "25", label: "Countries", verification: "verified", order: 1 }, { ...record, id: "a", slug: "lives", value: "50K+", label: "Lives", verification: "pending-review", order: 0 }] }));
  assert.deepEqual(figures, [{ id: "lives", value: "50K+", label: "Lives", status: "pending-review" }, { id: "countries", value: "25", label: "Countries", status: "verified" }]);
  const block = (id, type, data, enabled = true) => ({ id, type, enabled, version: 1, data });
  const page = impactFrom(
    withContent({
      impact: {
        ...record,
        id: "impact",
        sections: [
          block("intro", "intro", { kicker: "Our impact", title: "Our Impact", highlight: "Impact", body: "B." }),
          block("glance", "stats", { heading: "H.", metricIds: ["lives"], cta: { label: "More", href: "/impact" } }),
          block("teasers", "teasers", { items: [{ heading: "A", body: "a", cta: { label: "A", href: "/a" } }, { kicker: "K", heading: "B", body: "b", cta: { label: "B", href: "/b" } }] }),
          block("closing", "cta", { heading: "C.", primary: { label: "Go", href: "/get-involved" }, imageId: "img" }),
          block("off", "measurement", { heading: "Hidden", items: [] }, false),
        ],
        seo: { title: "T", ogImageId: "img", noIndex: true },
      },
    })
  );
  assert.deepEqual(page.sections.map((s) => s.type), ["intro", "stats", "teasers", "cta"], "enabled blocks only, in order");
  assert.deepEqual(page.sections[1].data, { heading: "H.", metricIds: ["lives"], cta: { label: "More", to: "/impact" } }, "figures named, links as the site's");
  assert.deepEqual(page.sections[2].data, { first: { heading: "A", body: "a", cta: { label: "A", to: "/a" } }, second: { kicker: "K", heading: "B", body: "b", cta: { label: "B", to: "/b" } } });
  assert.equal(page.sections[3].data.image.src, "https://media.example.org/rbb/media/u/a.png");
  assert.deepEqual(page.seo, { title: "T", image: "https://media.example.org/rbb/media/u/a.png", imageAlt: "A test image", noIndex: true });
  assert.throws(() => impactFrom(withContent({ impact: { ...record, id: "impact", sections: [block("x", "carousel", {})] } })), /cannot draw/);
  const o = overridesFrom(withContent({ metrics: [{ ...record, id: "a", slug: "lives", value: "1", label: "L", verification: "verified", order: 0 }] }));
  assert.deepEqual(Object.keys(o["src/content/impact.js"]), ["IMPACT"], "figures only: the source page stays");
  assert.deepEqual(imageOrigins(withContent({ impact: { ...record, id: "impact", sections: [], seo: { ogImageId: "img" } } })), ["https://media.example.org"]);
});

test("impact: every block type in the contract's registry has a view, a renderer and a tone rule", () => {
  const cms = readFileSync(join(root, "src/pages/Impact/CmsImpact.jsx"), "utf8");
  const keys = (name) => [...cms.slice(cms.indexOf(`const ${name} = {`), cms.indexOf("};", cms.indexOf(`const ${name} = {`))).matchAll(/^  (\w+):/gm)].map((m) => m[1]).sort();
  const types = [...IMPACT_CHAPTER_TYPES].sort();
  assert.deepEqual([...IMPACT_VIEW_TYPES].sort(), types, "snapshot adapter views");
  assert.deepEqual(keys("RENDERERS"), types, "CmsImpact renderers");
  assert.deepEqual(keys("TONES"), types, "CmsImpact tones");
  assert.deepEqual([...IMPACT_VIEW_TYPES, ...IMPACT_PAGE_VIEW_TYPES].sort(), [...IMPACT_BLOCK_TYPES].sort(), "every block: drawn on /impact, or feeding a sub-page");
});

test("impact sub-pages (#5, #6): approach → IMPACT.approach, geography → IMPACT.geography; never drawn on /impact; empty approves nothing", () => {
  const record = { orgId: "rbb", schemaVersion: 1, status: "published" };
  const block = (id, type, data, enabled = true) => ({ id, type, enabled, version: 1, data });
  const impact = (sections, o = {}) => withContent({ impact: { ...record, id: "impact", sections, ...o } });
  const intro = block("intro", "intro", { title: "Our Impact", body: "B." });
  const approach = block("approach", "approach", { intro: "How.", principles: ["One.", "Two."] });
  const geography = block("where", "geography", { summary: "S.", regions: [{ id: "r", name: "Region", countries: ["A", "B"] }], countries: ["C"] });
  const both = impact([intro, approach, geography]);
  assert.deepEqual(impactFrom(both).sections.map((s) => s.type), ["intro"], "not chapters of /impact");
  assert.deepEqual(impactPagesFrom(both), {
    "IMPACT.approach": { intro: "How.", principles: ["One.", "Two."], status: "approved" },
    "IMPACT.geography": { summary: "S.", regions: [{ id: "r", name: "Region", countries: ["A", "B"] }], countries: ["C"], status: "verified" },
  });
  assert.deepEqual(Object.keys(overridesFrom(both)["src/content/impact.js"]), ["PUBLISHED_IMPACT", "IMPACT.approach", "IMPACT.geography"]);
  assert.deepEqual(impactPagesFrom(impact([intro, block("a", "approach", { principles: [] }), block("g", "geography", { regions: [], countries: [] })])), {
    "IMPACT.approach": { intro: null, principles: [], status: "placeholder" },
    "IMPACT.geography": { summary: null, regions: [], countries: [], status: "placeholder" },
  });
  assert.equal(impactPagesFrom(impact([intro, { ...approach, enabled: false }])), undefined, "a disabled block: the source stays");
  assert.equal(impactPagesFrom(impact([intro, approach], { status: "draft" })), undefined, "an unpublished page: the source stays");
  const code = appendOverrides("export const IMPACT = { approach: { intro: 'x', principles: [], status: 'approved', note: 'kept' }, geography: { summary: null, regions: [], countries: [], status: 'placeholder' } };", "src/content/impact.js", impactPagesFrom(both));
  const IMPACT = new Function(`${code.replace("export const IMPACT", "const IMPACT")}; return IMPACT;`)();
  assert.equal(IMPACT.approach.note, "kept", "the rest of the object stays the site's");
  assert.equal(IMPACT.geography.status, "verified");
});

test("how we work (#7): the published page → HOW_WE_WORK in its own shape; the posters and closing ask stay the site's; only while published", () => {
  const record = { orgId: "rbb", schemaVersion: 1, status: "published", id: "how_we_work" };
  const page = { ...record, heading: "H", body: "B.", practices: { heading: "P.", items: [{ title: "T", description: "D.", icon: "community" }] }, rows: [{ id: "a", heading: "A", body: "Ab.", items: ["One."] }, { id: "b", heading: "B", body: "Bb." }] };
  assert.equal(howWeWorkFrom(snapshot()), undefined, "no key: the source page stays");
  assert.equal(howWeWorkFrom(withContent({ howWeWork: { ...page, status: "draft" } })), undefined);
  const o = howWeWorkFrom(withContent({ howWeWork: page }));
  assert.deepEqual(o, {
    HOW_WE_WORK: { kicker: null, heading: "H", body: "B.", rows: [{ id: "a", heading: "A", body: "Ab.", items: ["One."] }, { id: "b", heading: "B", body: "Bb." }] },
    "HOW_WE_WORK.practices": { kicker: null, heading: "P.", items: [{ title: "T", description: "D.", icon: "community" }] },
  });
  assert.deepEqual(Object.keys(overridesFrom(withContent({ howWeWork: page }))["src/content/about.js"]), ["HOW_WE_WORK", "HOW_WE_WORK.practices"], "the About page itself stays the source's");
  const code = appendOverrides("export const HOW_WE_WORK = { kicker: 'K', heading: 'x', body: 'y', practices: { heading: 'p', items: [] }, rows: [], related: { approach: {} }, closing: { heading: 'c' } };", "src/content/about.js", o);
  const HOW_WE_WORK = new Function(`${code.replace("export const HOW_WE_WORK", "const HOW_WE_WORK")}; return HOW_WE_WORK;`)();
  assert.deepEqual(HOW_WE_WORK.closing, { heading: "c" }, "the closing ask stays the site's");
  assert.deepEqual(HOW_WE_WORK.related, { approach: {} }, "the posters stay the site's");
  assert.equal(HOW_WE_WORK.practices.items.length, 1);
});

test("transparency: the published record and documents → transparency.js's own shape; each part only when carried", () => {
  const record = { orgId: "rbb", schemaVersion: 1, status: "published" };
  assert.equal(transparencyFrom(snapshot()), undefined, "neither key: the source transparency stays");
  const t = { ...record, id: "transparency", heading: "Transparency", intro: "An intro.", financialOverview: { year: 2027, verification: "verified", items: [{ id: "a", label: "A", percentage: 100 }] }, accountability: ["P."] };
  const only = transparencyFrom(withContent({ transparency: t }));
  assert.deepEqual(only.TRANSPARENCY.financialOverview, { year: 2027, status: "verified", items: [{ id: "a", label: "A", percentage: 100, status: "verified" }] });
  assert.deepEqual(only.TRANSPARENCY.governance, { intro: null, sections: [], status: "placeholder" }, "no governance: the pending line");
  assert.deepEqual(only.TRANSPARENCY.accountability, { intro: ["P."], status: "verified" });
  assert.deepEqual(only.TRANSPARENCY_COPY, { kicker: null, heading: "Transparency", body: "An intro." });
  assert.ok(!("annualReports" in only.TRANSPARENCY), "no documents key: the source lists stay");
  const doc = (o) => ({ ...record, title: "D", fileUrl: "https://files.example.org/d.pdf", ...o });
  const docs = transparencyFrom(withContent({ reports: [doc({ id: "2", slug: "b", category: "annualReport", order: 1, year: 2025 }), doc({ id: "1", slug: "a", category: "annualReport", order: 0, type: "PDF" }), doc({ id: "3", slug: "g", category: "governance", order: 2 })] }));
  assert.deepEqual(Object.keys(docs), ["TRANSPARENCY"], "documents only: the chapter's words stay");
  assert.deepEqual(docs.TRANSPARENCY.annualReports, [{ id: "a", title: "D", type: "PDF", fileUrl: "https://files.example.org/d.pdf", status: "verified" }, { id: "b", title: "D", year: 2025, fileUrl: "https://files.example.org/d.pdf", status: "verified" }]);
  assert.deepEqual(docs.TRANSPARENCY.financialDocuments, []);
  assert.deepEqual(docs.TRANSPARENCY.governanceDocuments.map((d) => d.id), ["g"]);
});

test("stories and projects: published records → stories.js and work.js shapes; related stories as addresses; only when carried", () => {
  const record = { orgId: "rbb", schemaVersion: 1, status: "published" };
  assert.equal(storiesFrom(snapshot()), undefined, "no stories key: the source stories stay");
  assert.equal(projectsFrom(snapshot()), undefined, "no projects key: the source projects stay");
  const body = [{ type: "paragraph", children: [{ type: "text", text: "P." }] }];
  const stories = storiesFrom(
    withContent({
      stories: [
        { ...record, id: "s2", type: "story", slug: "newer", title: "Newer", category: "field", date: "2026-09-01", body, imageId: "img", galleryIds: ["img"], relatedPostIds: ["s1"], projectId: "p", programId: "education", seo: { title: "T", ogImageId: "img" } },
        { ...record, id: "s1", type: "story", slug: "older", title: "Older", category: "impact", body },
      ],
    })
  );
  assert.deepEqual(stories.map((s) => s.slug), ["newer", "older"], "the snapshot's order");
  assert.deepEqual([stories[0].status, stories[0].image.src, stories[0].image.mediaId, stories[0].media[0].alt, stories[0].relatedStoryIds[0], stories[0].projectId], ["approved", "https://media.example.org/rbb/media/u/a.png", "img", "A test image", "older", "p"]);
  assert.deepEqual(stories[0].body, body, "rich text stays structured");
  assert.deepEqual(stories[0].seo, { title: "T", image: "https://media.example.org/rbb/media/u/a.png", imageAlt: "A test image" });
  assert.ok(!("type" in stories[0]) && !("relatedPostIds" in stories[0]), "no contract-only fields reach the page");
  assert.throws(() => storiesFrom(withContent({ stories: [{ ...record, id: "s1", type: "story", slug: "a", title: "A", category: "field", body, relatedPostIds: ["gone"] }] })), /does not carry/);
  const projects = projectsFrom(withContent({ projects: [{ ...record, id: "b", slug: "second", title: "B", programId: "health-wellbeing", description: "D.", order: 1 }, { ...record, id: "a", slug: "first", title: "A", programId: "education", description: "D.", order: 0, imageId: "img", activities: ["A."], featured: true }] }));
  assert.deepEqual(projects.map((p) => [p.slug, p.program, p.editorialStatus]), [["first", "education", "approved"], ["second", "health-wellbeing", "approved"]]);
  assert.equal(projects[0].image.alt, "A test image");
  const o = overridesFrom(withContent({ projects: [{ ...record, id: "a", slug: "first", title: "A", programId: "education", description: "D.", order: 0 }], stories: [{ ...record, id: "s1", type: "story", slug: "a", title: "A", category: "field", body }] }));
  assert.deepEqual(Object.keys(o["src/content/work.js"]).sort(), ["PROJECTS", "PROJECT_RECORDS", "PROJECT_SOURCE"], "projects only: the source programs stay");
  assert.deepEqual(o["src/content/work.js"].PROJECT_SOURCE, { cms: true }, "M31.1: the CMS's projects say so — the only projects");
  assert.equal(overridesFrom(withContent({ programs: [{ ...record, id: "p", slug: "education", title: "Education", icon: "education", description: "D.", order: 0 }] }))["src/content/work.js"].PROJECT_SOURCE, undefined, "programs alone: the projects stay the website's own");
  assert.equal(o["src/content/stories.js"].STORIES.length, 1);
  assert.deepEqual(o["src/content/stories.js"].STORY_SOURCE, { cms: true }, "M15: the CMS's stories say so — the only stories");
  assert.equal(overridesFrom(withContent({ projects: [{ ...record, id: "a", slug: "first", title: "A", programId: "education", description: "D.", order: 0 }] }))["src/content/stories.js"], undefined, "no published CMS story: the website's own stories (and its Impact page's references) stay");
  assert.deepEqual(imageOrigins(withContent({ stories: [{ ...record, id: "s1", type: "story", slug: "a", title: "A", category: "field", body, galleryIds: ["img"] }] })), ["https://media.example.org"]);
});

test("M15: the story and project sources are declared where the snapshot sets them; the CMS's Impact page names no story the site does not show", () => {
  const stories = readFileSync(join(root, "src/content/stories.js"), "utf8");
  assert.match(stories, /export const STORY_SOURCE = \{ cms: false \};/);
  assert.deepEqual(SNAPSHOT_TARGETS["src/content/stories.js"], "STORIES, STORY_SOURCE");
  const work = readFileSync(join(root, "src/content/work.js"), "utf8");
  assert.match(work, /export const PROJECT_SOURCE = \{ cms: false \};/, "M31.1: the project source, declared where the snapshot sets it");
  assert.deepEqual(SNAPSHOT_TARGETS["src/content/work.js"], "PROGRAMS, PROJECT_RECORDS, PROJECTS, PROJECT_SOURCE");
  const cms = readFileSync(join(root, "src/pages/Impact/CmsImpact.jsx"), "utf8");
  assert.match(cms, /is not published`\)/, "the CMS page names no story the site does not show — never silently dropped");
});

test("stories: the contract's story types are the site's", async () => {
  const { STORY_CATEGORY_IDS } = await import("@rbb/content-schema");
  // content/stories.js imports photographs, so its category list is read as text.
  const source = readFileSync(join(root, "src/content/stories.js"), "utf8");
  const block = source.slice(source.indexOf("export const STORY_CATEGORIES = ["), source.indexOf("];", source.indexOf("export const STORY_CATEGORIES = [")));
  assert.deepEqual([...block.matchAll(/\{ id: "([a-z-]+)"/g)].map((m) => m[1]), [...STORY_CATEGORY_IDS]);
});

test("careers: the published page → CAREERS in contact.js's shape; absent sections left out; only while published", () => {
  const record = { orgId: "rbb", schemaVersion: 1, status: "published", id: "careers" };
  assert.equal(careersFrom(snapshot()), undefined, "no careers key: the source page stays");
  const page = { ...record, title: "Careers", intro: "An intro.", why: { heading: "Why", body: ["P."] }, opportunities: { heading: "Open", empty: "None.", roles: [{ title: "Role B" }, { title: "Role A" }] }, closing: { heading: "E.", primary: { label: "About Us", href: "/about" } } };
  const c = careersFrom(withContent({ careers: page }));
  assert.deepEqual(c.sections.map((s) => s.id), ["why", "opportunities"], "no apply section: left out");
  assert.deepEqual(c.roles, [{ title: "Role B", status: "verified" }, { title: "Role A", status: "verified" }], "roles in order, as the site's verified roles");
  assert.deepEqual(c.closing, { heading: "E.", ctas: { primary: { label: "About Us", to: "/about" } } });
  assert.deepEqual([c.kicker, c.metaDescription, c.seoTitle, c.noIndex], [null, null, null, false], "no own SEO: the site's defaults");
  assert.ok(!("to" in c), "the address stays the site's own");
  assert.equal(careersFrom(withContent({ careers: { ...page, status: "draft" } })), undefined);
  const o = overridesFrom(withContent({ careers: { ...page, seo: { title: "T", description: "D.", noIndex: true } } }));
  assert.deepEqual([o["src/content/contact.js"].CAREERS.seoTitle, o["src/content/contact.js"].CAREERS.metaDescription, o["src/content/contact.js"].CAREERS.noIndex], ["T", "D.", true]);
  assert.ok(o["src/content/contact.js"].ORG_CONTACT, "contact details still set from the settings");
});

/* Policies (M19). Test wording only — never legal text. */
const policyRecord = (id, o = {}) => ({ id, orgId: "rbb", schemaVersion: 1, status: "published", title: `Test ${id}`, effectiveDate: "2026-09-01", lastUpdated: "2026-09-15", intro: ["Test intro."], sections: [{ id: "first", heading: "First", body: ["Test paragraph."] }], relatedPolicies: [], ...o });

test("policies: each published policy merges into its POLICIES record by id, in policies.js's shape; the site's id and route kept", () => {
  assert.equal(policiesFrom(snapshot()), undefined, "no policies key: every source record stays");
  const o = overridesFrom(withContent({ policies: [policyRecord("privacy", { contactReference: "privacy-mail", relatedPolicies: ["terms"], sections: [{ id: "first", heading: "First", body: [], items: ["One.", "Two."] }], seo: { description: "Test description." } }), policyRecord("donation")] }));
  const p = o["src/content/policies.js"].POLICIES[BY_ID];
  assert.deepEqual(Object.keys(p), ["privacy", "donation"], "terms is not carried: its source record stays");
  assert.deepEqual(p.privacy, {
    title: "Test privacy", status: "approved", effectiveDate: "2026-09-01", lastUpdated: "2026-09-15", intro: ["Test intro."],
    sections: [{ id: "first", heading: "First", body: [], items: ["One.", "Two."] }], contactReference: "privacy-mail", relatedPolicies: ["terms"], metaDescription: "Test description.",
  });
  assert.equal(p.donation.contactReference, null, "no contact clears the source's");
  assert.ok(!("metaDescription" in p.donation), "no own description: the site's stays");
  for (const leak of ["id", "route", "orgId", "schemaVersion", "publishedAt", "pending", "outline"]) assert.ok(!(leak in p.privacy), `not set: ${leak}`);
});

test("policies: an unknown, duplicated, unpublished, incomplete or working-text policy fails the build with its reason", () => {
  for (const [policies, reason] of [
    [[policyRecord("cookies")], /"cookies" this site has no page for/],
    [[policyRecord("privacy"), policyRecord("privacy")], /"privacy" twice/],
    [[policyRecord("terms", { status: "approved" })], /"terms" is not published/],
    [[policyRecord("terms", { lastUpdated: undefined })], /both dates/],
    [[policyRecord("terms", { sections: [] })], /at least one section/],
    [[policyRecord("terms", { intro: ["Demo — not the real text."] })], /working-placeholder text \(demo prefix\)/],
    [{ privacy: policyRecord("privacy") }, /must be a list/],
  ])
    assert.throws(() => overridesFrom(withContent({ policies })), reason);
});

test("policies: merged by id in place — the module's own objects, every id required — and the adapter knows the contract's policies", async () => {
  assert.deepEqual(ADAPTER_POLICY_IDS, [...POLICY_IDS]);
  const code = readFileSync(join(root, "src/content/policies.js"), "utf8");
  for (const [id, route] of Object.entries(POLICY_ROUTES)) assert.match(code, new RegExp(`id: "${id}",\\n    route: "${route.replace("/", "\\/")}",`), `${id} is at ${route} in the source`);
  const source = "export const POLICIES = [{ id: 'privacy', title: 'Source', pending: 'p' }, { id: 'cookies', title: 'Cookies' }];\nconst first = POLICIES[0];";
  const out = appendOverrides(source, "src/content/policies.js", { POLICIES: { [BY_ID]: { privacy: { title: "CMS", status: "approved" } } } });
  const run = (code) => new Function(code.replace(/export const /g, "const ") + "\nreturn { POLICIES, first };")();
  const { POLICIES, first } = run(out);
  assert.equal(first, POLICIES[0], "the same object, changed in place");
  assert.deepEqual(POLICIES, [{ id: "privacy", title: "CMS", pending: "p", status: "approved" }, { id: "cookies", title: "Cookies" }]);
  assert.throws(() => run(appendOverrides(source, "src/content/policies.js", { POLICIES: { [BY_ID]: { terms: { title: "x" } } } })), /POLICIES has no record "terms"/);
});

/* Get Involved (M20). Test wording only. */
const giBase = { orgId: "rbb", schemaVersion: 1, status: "published" };
const giPath = (id, o = {}) => ({ ...giBase, id, shortDescription: `Line ${id}.`, sections: [{ id: "first", heading: "First", body: ["Paragraph."] }], ...o });
const giHub = (o = {}) => ({ ...giBase, id: "hub", heading: "Hub heading", intro: "Hub intro.", ...o });

test("get involved: published pages → nested targets in getInvolved.js; what a page leaves out stays the site's", () => {
  assert.equal(getInvolvedFrom(snapshot()), undefined, "no key: nothing is set");
  const o = overridesFrom(withContent({ getInvolved: [giHub({ closing: { heading: "Close.", primary: { label: "Appeals", target: "appeals" } } }), giPath("volunteer", { hubNote: "Note.", seo: { description: "Meta." }, sections: [{ id: "first", heading: "First", body: [], items: ["A", "B"] }], faq: { heading: "Questions", items: [{ question: "Q?", answer: "A." }] } }), giPath("travel")] }))["src/content/getInvolved.js"];
  assert.deepEqual(Object.keys(o), ["GET_INVOLVED_PAGES.hub", "GET_INVOLVED_PAGES.hub.closing", "GET_INVOLVED.paths", "GET_INVOLVED_PAGES.hub.choose.notes"]);
  assert.deepEqual(o["GET_INVOLVED_PAGES.hub"], { heading: "Hub heading", body: "Hub intro." });
  assert.deepEqual(o["GET_INVOLVED_PAGES.hub.closing"], { heading: "Close.", ctas: { primary: { label: "Appeals", to: "/appeals" } } }, "no secondary: the source one is dropped with the closing");
  assert.deepEqual(o["GET_INVOLVED.paths"][BY_ID].volunteer, { shortDescription: "Line volunteer.", metaDescription: "Meta.", sections: [{ id: "first", heading: "First", body: [], items: ["A", "B"] }, { id: "faq", heading: "Questions", faqs: [{ q: "Q?", a: "A." }] }] });
  assert.deepEqual(o["GET_INVOLVED.paths"][BY_ID].travel, { shortDescription: "Line travel.", sections: [{ id: "first", heading: "First", body: ["Paragraph."] }] }, "no own description: the site's stays");
  assert.deepEqual(o["GET_INVOLVED_PAGES.hub.choose.notes"], { volunteer: "Note." });
  for (const fixed of ["title", "to", "icon", "ctaLabel", "featured", "slug", "id"]) assert.ok(!(fixed in o["GET_INVOLVED.paths"][BY_ID].volunteer), `fixed: ${fixed}`);
  assert.ok(!("why" in o) && !("GET_INVOLVED_PAGES.hub.why" in o), "no why: the mission paragraph stays");
});

test("get involved: unknown, duplicated, unpublished, incomplete, untargetable or working-text pages fail the build", () => {
  for (const [pages, reason] of [
    [[giPath("fundraise")], /"fundraise" this site has no page for/],
    [[giPath("volunteer"), giPath("volunteer")], /"volunteer" twice/],
    [[giPath("partner", { status: "approved" })], /"partner" is not published/],
    [[giPath("partner", { shortDescription: undefined })], /short description and at least one section/],
    [[giPath("partner", { sections: [] })], /short description and at least one section/],
    [[giHub({ intro: undefined })], /heading and introduction/],
    [[giHub({ closing: { heading: "H", primary: { label: "Go", target: "donate" } } })], /target "donate"/],
    [[giPath("travel", { hubNote: "Sample story." })], /working-placeholder text \(sample story\)/],
    [{ hub: giHub() }, /must be a list/],
  ])
    assert.throws(() => overridesFrom(withContent({ getInvolved: pages })), reason);
});

test("get involved: the adapter knows the contract's pages and targets; every target is a page of this site", () => {
  assert.deepEqual(GET_INVOLVED_IDS, [...GET_INVOLVED_PAGE_IDS]);
  assert.deepEqual(Object.keys(CTA_ROUTES), [...CTA_TARGETS]);
  const nav = readFileSync(join(root, "src/content/nav.js"), "utf8");
  for (const to of Object.values(CTA_ROUTES)) assert.ok(nav.includes(`to: "${to}"`), `${to} is a sitemap page`);
  const code = readFileSync(join(root, "src/content/getInvolved.js"), "utf8");
  for (const [id, to] of Object.entries(GET_INVOLVED_ROUTES)) if (id !== "hub") assert.ok(code.includes(`id: "${id}",`) && code.includes(`to: "${to}",`), `${id} at ${to}`);
});

test("nested targets: assigned in place after the module loads; a missing or wrong-kind target fails loudly", () => {
  const source = "export const PAGES = { hub: { heading: 'S', choose: { notes: { a: 'x' } } } };\nexport const LIST = { paths: [{ id: 'a', t: 1 }, { id: 'b', t: 2 }] };\nconst held = LIST.paths[0];";
  const run = (code) => new Function(code.replace(/export const /g, "const ") + "\nreturn { PAGES, LIST, held };")();
  const out = appendOverrides(source, "src/content/x.js", { "PAGES.hub": { heading: "CMS" }, "PAGES.hub.choose.notes": { b: "y" }, "LIST.paths": { [BY_ID]: { a: { t: 9 } } } });
  const { PAGES, LIST, held } = run(out);
  assert.deepEqual(PAGES, { hub: { heading: "CMS", choose: { notes: { a: "x", b: "y" } } } });
  assert.equal(held.t, 9, "the same object, changed in place");
  assert.deepEqual(LIST.paths.map((p) => p.t), [9, 2]);
  assert.throws(() => run(appendOverrides(source, "src/content/x.js", { "PAGES.hub.missing": { a: 1 } })), /PAGES\.hub\.missing is not the object the snapshot sets/);
  assert.throws(() => run(appendOverrides(source, "src/content/x.js", { "PAGES.hub": { [BY_ID]: { a: {} } } })), /is not the object the snapshot sets/);
  assert.throws(() => run(appendOverrides(source, "src/content/x.js", { "LIST.paths": { [BY_ID]: { c: {} } } })), /LIST\.paths has no record "c"/);
  assert.throws(() => appendOverrides(source, "src/content/x.js", { "OTHER.x": {} }), /no longer declares "export const OTHER"/);
  assert.throws(() => appendOverrides(source, "src/content/x.js", { "PAGES.hub;alert(1)": {} }), /is not a target/);
});

/* The announcement bar (M21). Test wording only. */
const barRecord = (o = {}) => ({ id: "announcement-bar", orgId: "rbb", schemaVersion: 1, status: "published", items: [{ id: "a", text: "First message." }, { id: "b", text: "Second message.", link: { label: "See events", href: "/media/events" } }], ...o });

test("announcement bar: settings drive on/off and the interval in every snapshot build; published messages replace the site's", () => {
  assert.equal(announcementsFrom(snapshot()), undefined, "no engagement settings, no bar: nothing set");
  const settingsOnly = announcementsFrom(snapshot({ engagement: { announcementBar: { enabled: false, intervalMs: 8000 } } }));
  assert.deepEqual(settingsOnly, { "ANNOUNCEMENTS.bar": { enabled: false, interval: 8000 } }, "no published bar: the site's own messages stay");
  const o = overridesFrom({ ...withContent({ announcementBar: barRecord() }), settings: { ...snapshot().settings, engagement: { announcementBar: { enabled: true, intervalMs: 5000 } } } })["src/content/announcements.js"];
  assert.deepEqual(o, { "ANNOUNCEMENTS.bar": { enabled: true, interval: 5000, items: [{ id: "a", text: "First message." }, { id: "b", text: "Second message.", link: { label: "See events", to: "/media/events" } }] } });
});

test("announcement bar: unpublished, empty, external-link or working-text bars fail the build", () => {
  for (const [bar, reason] of [
    [barRecord({ status: "approved" }), /not published/],
    [barRecord({ items: [] }), /at least one message/],
    [barRecord({ items: [{ id: "a", text: "x", link: { label: "Go", href: "https://rbb-partner.test" } }] }), /not a path on this site/],
    [barRecord({ items: [{ id: "a", text: "Demo — x" }] }), /working-placeholder text/],
  ])
    assert.throws(() => overridesFrom(withContent({ announcementBar: bar })), reason);
});

test("announcement bar: the target is an object in announcements.js the snapshot can set", () => {
  const code = readFileSync(join(root, "src/content/announcements.js"), "utf8");
  assert.match(code, /export const ANNOUNCEMENTS = \{\n  bar: \{\n    enabled: true,\n    \/\* How long each message stays, in ms\. \*\/\n    interval: 5000,/);
  assert.doesNotThrow(() => appendOverrides(code, "src/content/announcements.js", { "ANNOUNCEMENTS.bar": { enabled: true } }));
});

/* The site popup (M22). Test wording only. */
const POPUP_IMAGE = "img-popup";
const popupRecord = (o = {}) => ({ id: "site-popup", orgId: "rbb", schemaVersion: 1, status: "published", key: "test-popup-2", heading: "A test heading.", body: "A test line.", imageId: POPUP_IMAGE, cta: { label: "See events", href: "/media/events" }, dismissLabel: "Not now", delayMs: 4000, frequency: "once", excludePaths: ["/contact"], ...o });
const withPopup = (p, settings = {}) => ({ ...withContent({ popup: p }), media: { [POPUP_IMAGE]: { id: POPUP_IMAGE, url: "https://media.rbb.test/popup.jpg", mimeType: "image/jpeg", width: 800, height: 600, alt: "Two people at a stall" } }, settings: { ...snapshot().settings, ...settings } });

test("popup: the settings switch in every snapshot build; the published popup replaces the site's, clearing what it leaves out", () => {
  assert.equal(popupFrom(snapshot()), undefined, "no settings switch, no popup: nothing set");
  assert.deepEqual(popupFrom(snapshot({ engagement: { popup: { enabled: false } } })), { "ANNOUNCEMENTS.popup": { enabled: false } }, "no published popup: the site's own popup stays");
  const o = overridesFrom(withPopup(popupRecord(), { engagement: { announcementBar: { enabled: true, intervalMs: 5000 }, popup: { enabled: true } } }))["src/content/announcements.js"];
  assert.deepEqual(Object.keys(o), ["ANNOUNCEMENTS.bar", "ANNOUNCEMENTS.popup"], "the bar and the popup are both set in announcements.js");
  assert.deepEqual(o["ANNOUNCEMENTS.popup"], {
    enabled: true, id: "test-popup-2", kicker: null, heading: "A test heading.", highlight: null, body: "A test line.",
    image: { src: "https://media.rbb.test/popup.jpg", alt: "Two people at a stall", width: 800, height: 600, mediaId: POPUP_IMAGE },
    cta: { label: "See events", to: "/media/events" }, dismiss: "Not now", delayMs: 4000, frequency: "once", excludePaths: ["/contact"], releaseMarker: null,
  });
  assert.ok(!("close" in o["ANNOUNCEMENTS.popup"]), "the close label stays the site's");
  assert.ok(imageOrigins(withPopup(popupRecord())).includes("https://media.rbb.test"), "its photograph's origin is allowed");
});

test("popup: unpublished, undrawable, external, image-less or working-text popups fail the build", () => {
  for (const [p, media, reason] of [
    [popupRecord({ status: "approved" }), true, /not published/],
    [popupRecord({ includePaths: ["/"] }), true, /"includePaths"/],
    [popupRecord({ endsAt: "2026-12-01T00:00:00Z" }), true, /"endsAt"/],
    [popupRecord({ cta: { label: "Go", href: "https://partner.rbb.test" } }), true, /not a path on this site/],
    [popupRecord(), false, /not in the snapshot's media/],
    [popupRecord({ body: "Demo — x" }), true, /working-placeholder text/],
  ])
    assert.throws(() => overridesFrom(media ? withPopup(p) : withContent({ popup: p })), reason);
});

/* Highlights — the story strip (M23). Test data only. */
const stripAppeal = (id, o = {}) => ({ id: `rec-${id}`, orgId: "rbb", schemaVersion: 1, status: "published", kind: "campaign", slug: id, title: `Appeal ${id}`, summary: "S.", imageId: "img", publishedAt: `2026-10-0${id.length}T00:00:00.000Z`, sections: [], ...o });
const withStrip = (appealIds, appeals = [stripAppeal("a", { highlight: { label: "Short A" } }), stripAppeal("bb"), stripAppeal("ccc", { highlight: {} })], settings = {}) => ({
  ...withContent({ appeals, storyStrip: { id: "story-strip", orgId: "rbb", schemaVersion: 1, status: "published", appealIds } }),
  settings: { ...snapshot().settings, ...settings },
});

test("highlights: the strip's appeals by address, in its order; each gets a circle; the switch in every snapshot build", () => {
  assert.equal(storyStripFrom(snapshot()), undefined);
  assert.deepEqual(overridesFrom(snapshot({ engagement: { storyStrip: { enabled: false } } }))["src/content/appeals.js"], { APPEAL_STORIES: { enabled: false } }, "the switch alone");
  const snap = withStrip(["rec-bb", "rec-a"], undefined, { engagement: { storyStrip: { enabled: true } } });
  assert.deepEqual(storyStripFrom(snap), ["bb", "a"]);
  const o = overridesFrom(snap)["src/content/appeals.js"];
  assert.deepEqual(o.APPEAL_STORIES, { enabled: true, order: ["bb", "a"] });
  const story = Object.fromEntries(o.APPEALS.map((a) => [a.id, a.story]));
  assert.deepEqual(story, { a: { label: "Short A" }, bb: {}, ccc: {} }, "listed appeals get a circle (bb: its title and photo); others keep their own");
  assert.deepEqual(o.APPEALS.map((a) => a.id), ["ccc", "bb", "a"], "the appeal lists keep their own order (newest first)");
});

test("highlights: an unpublished strip, or one naming an unpublished appeal, fails the build", () => {
  assert.throws(() => overridesFrom({ ...withStrip(["rec-a"]), content: { ...withStrip(["rec-a"]).content, storyStrip: { ...withStrip(["rec-a"]).content.storyStrip, status: "approved" } } }), /not published/);
  assert.throws(() => overridesFrom(withStrip(["rec-zzz"])), /appeal "rec-zzz", which is not published/);
  assert.throws(() => overridesFrom(withStrip(["rec-a"], [stripAppeal("a", { status: "draft" })])), /not published/);
  assert.throws(() => overridesFrom(withStrip([])), /at least one appeal/);
});

/* How the order is applied — storyAppeals() in content/appeals.js reads
   APPEAL_STORIES.order — is exercised on the real module in
   runtime-snapshot-render.test.mjs. */

test("forms (2026-10-13): saved forms → PUBLISHED_FORMS.items without organization or dates; none → the built-in forms stay", () => {
  const definition = { id: "contact", orgId: "rbb", kind: "contact", title: "Contact Us", heading: "Write to us", submitLabel: "Send", successMessage: "Thanks.", errorMessage: "Sorry.", fields: [{ id: "name", type: "text", label: "Name", required: true }, { id: "email", type: "email", label: "Email", required: true }], updatedAt: "2026-10-13T10:00:00.000Z" };
  assert.equal(formsFrom(snapshot()), undefined);
  assert.deepEqual(formsFrom(withContent({ forms: [definition] })), [{ id: "contact", kind: "contact", title: "Contact Us", heading: "Write to us", submitLabel: "Send", successMessage: "Thanks.", errorMessage: "Sorry.", fields: definition.fields }]);
  assert.deepEqual(Object.keys(overridesFrom(withContent({ forms: [definition] }))["src/content/forms.js"]), ["PUBLISHED_FORMS"]);
});
