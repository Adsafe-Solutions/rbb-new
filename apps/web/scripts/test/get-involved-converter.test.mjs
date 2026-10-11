import { before, test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { GetInvolvedHub, GetInvolvedPath } from "@rbb/content-schema";
import { convertGetInvolved } from "../migration/getInvolved.mjs";
import { loadSource } from "../migration/source.mjs";
import { planMigration } from "../migration/plan.mjs";
import { cmsRules } from "../migration/rules.mjs";
import { readExistingFrom } from "../migration/existing.mjs";
import { BY_ID, CTA_ROUTES, overridesFrom } from "../snapshot-adapter.mjs";
import { ineligibility } from "../../../api/test/support/migration/writer.ts";

/* Milestone 9 — the Get Involved converter (scripts/migration/
   getInvolved.mjs) and its place in the offline rehearsal: every page
   converted field for field, in order, nothing dropped silently; release
   markers and what the CMS cannot hold keep a page ineligible; existing
   records are reported, never overwritten; and a converted record,
   published, draws the page the website draws today — byte for byte. */

const root = fileURLToPath(new URL("../..", import.meta.url));
const convert = (paths, hub) => convertGetInvolved({ paths, hub, ctaRoutes: CTA_ROUTES, orgId: "rbb" });
const byId = (out) => new Map(out.map((o) => [o.id, o]));
const path = (id, extra = {}) => ({
  id, slug: id, to: `/get-involved/${id}`, title: `Title ${id}`, icon: id, ctaLabel: `Label ${id}`, status: "pending-review",
  shortDescription: `A test line for ${id}.`, metaDescription: `A test meta description for ${id}.`,
  sections: [
    { id: "why", heading: `Why ${id}`, empty: "Pending.", body: "A test paragraph." },
    { id: "list", heading: "A list", empty: "Pending.", body: "A lead-in:", items: ["One", "Two"] },
    { id: "only-items", heading: "Only items", empty: "Pending.", items: ["Three"] },
    { id: "apply", heading: "How to apply", empty: null, hideWhenEmpty: true },
  ],
  ...extra,
});
const PATHS = ["volunteer", "fellowship", "partner", "travel"].map((id) => path(id));
const HUB = {
  kicker: "Get involved", heading: "A test hub heading", body: "A test introduction.",
  ways: { kicker: "Ways", heading: "Choose a way." },
  choose: { kicker: "Choose", heading: "What each involves", pending: "Pending.", notes: { volunteer: "A note for volunteer.", travel: "A note for travel." }, linkPrefix: "Go to" },
  why: { heading: "Why", body: "The mission." },
  related: {}, questions: {},
  closing: { heading: "A test closing", ctas: { primary: { label: "Appeals", to: "/appeals" }, secondary: { label: "Work", to: "/work" } } },
};

let source;
before(async () => {
  source = await loadSource();
});

test("the hub: heading, introduction, both path headings and the closing by target; 'why' and the site's own copy stay the website's", () => {
  const hub = byId(convert(PATHS, HUB)).get("hub");
  assert.deepEqual(hub.record, {
    id: "hub", orgId: "rbb", schemaVersion: 1, status: "draft",
    heading: "A test hub heading", intro: "A test introduction.",
    ways: { kicker: "Ways", heading: "Choose a way." }, choose: { kicker: "Choose", heading: "What each involves" },
    closing: { heading: "A test closing", primary: { label: "Appeals", target: "appeals" }, secondary: { label: "Work", target: "work" } },
  });
  assert.deepEqual(hub.withheld, []);
  assert.ok(hub.notes.some((n) => /Why get involved/.test(n)) && hub.notes.some((n) => /kicker/.test(n)), "what stays the website's is said, not lost");
  assert.ok(GetInvolvedHub.safeParse(hub.record).success);
});

test("every path: its line, hub note, sections in order (paragraphs, lists), meta description; empty hidden sections left out with a note", () => {
  const out = byId(convert(PATHS, HUB));
  assert.deepEqual([...out.keys()], ["hub", "volunteer", "fellowship", "partner", "travel"], "the contract's page order");
  for (const id of ["volunteer", "fellowship", "partner", "travel"]) {
    const { record, withheld, notes, sourceStatus } = out.get(id);
    assert.deepEqual(withheld, [], id);
    assert.equal(record.shortDescription, `A test line for ${id}.`);
    assert.deepEqual(record.seo, { description: `A test meta description for ${id}.` });
    assert.deepEqual(record.sections, [
      { id: "why", heading: `Why ${id}`, body: ["A test paragraph."] },
      { id: "list", heading: "A list", body: ["A lead-in:"], items: ["One", "Two"] },
      { id: "only-items", heading: "Only items", body: [], items: ["Three"] },
    ], `${id}: in order, words only`);
    assert.ok(notes.some((n) => /Hidden while empty.*apply/.test(n)));
    assert.ok(notes.some((n) => /title, icon, ctaLabel/.test(n)), "the path's identity stays the website's");
    assert.equal(sourceStatus, "pending-review");
    assert.ok(GetInvolvedPath.safeParse(record).success, id);
  }
  assert.equal(out.get("volunteer").record.hubNote, "A note for volunteer.");
  assert.ok(!("hubNote" in out.get("partner").record), "no note: none in the record — the hub's pending line stays");
});

test("optional fields absent stay absent; a section with questions becomes the path's FAQ", () => {
  const bare = convert([{ id: "volunteer", sections: [{ id: "why", heading: "Why", body: ["One.", "Two."] }, { id: "faq", heading: "Questions", faqs: [{ q: "A?", a: "Yes." }] }] }], { heading: "H", body: "B." });
  const hub = bare[0].record;
  assert.deepEqual(Object.keys(hub).sort(), ["heading", "id", "intro", "orgId", "schemaVersion", "status"]);
  const v = bare[1].record;
  assert.ok(!("shortDescription" in v) && !("hubNote" in v) && !("seo" in v));
  assert.deepEqual(v.sections, [{ id: "why", heading: "Why", body: ["One.", "Two."] }]);
  assert.deepEqual(v.faq, { heading: "Questions", items: [{ question: "A?", answer: "Yes." }] });
});

test("what the CMS cannot hold is withheld by name — never dropped — and marks the page ineligible", () => {
  const out = byId(
    convert(
      [
        path("volunteer", { sections: [{ id: "pending", heading: "Roles", empty: "Roles to be provided." }], mystery: 1 }),
        path("fellowship", { sections: [{ id: "q", heading: "Q", faqs: [{ q: "A?", a: "B." }], body: "And words." }] }),
        path("partner", { releaseMarker: "Sample path", sections: [{ id: "why", heading: "Why", body: "Words.", releaseMarker: "Sample section" }] }),
        path("travel", { to: "/somewhere-else" }),
        path("donate"),
      ],
      { ...HUB, extra: true, closing: { heading: "C", ctas: { primary: { label: "Shop", to: "/shop" } } } }
    )
  );
  const fields = (id) => out.get(id).withheld.map((w) => `${w.field}:${w.decision}`);
  assert.deepEqual(fields("volunteer"), ["mystery:schema-gap", "sections.0:schema-gap"], "a pending row and an unknown key");
  assert.match(out.get("volunteer").withheld[1].reason, /pending line/);
  assert.deepEqual(fields("fellowship"), ["sections.0:schema-gap"]);
  assert.deepEqual(fields("partner"), ["releaseMarker:sample-content", "sections.0.releaseMarker:sample-content"]);
  assert.equal(out.get("partner").releaseMarker, "Sample path", "the marker is carried, never stripped");
  assert.deepEqual(fields("travel"), ["to:schema-gap"]);
  assert.deepEqual(fields("donate"), ["id:schema-gap"], "a path the CMS has no page for");
  assert.deepEqual(fields("hub"), ["extra:schema-gap", "closing.primary:schema-gap"]);
  assert.ok(!("closing" in out.get("hub").record), "never half a closing");
});

test("deterministic: the same content gives the same records, byte for byte; the input is never changed", () => {
  const input = structuredClone({ PATHS, HUB });
  assert.equal(JSON.stringify(convert(PATHS, HUB)), JSON.stringify(convert(PATHS, HUB)));
  assert.deepEqual({ PATHS, HUB }, input);
});

test("the source: five pages, each a valid record, planned 'create' — nothing withheld, no marker, no blocker", () => {
  assert.deepEqual(source.getInvolved.map((p) => p.id), ["hub", "volunteer", "fellowship", "partner", "travel"]);
  const m = planMigration({ source, existing: { checked: false, source: "none" }, rules: cmsRules() });
  const gi = m.records.filter((r) => r.type === "get_involved");
  assert.deepEqual(gi.map((r) => [r.key, r.action]), ["hub", "volunteer", "fellowship", "partner", "travel"].map((id) => [`get_involved:${id}`, "create"]));
  for (const r of gi) {
    assert.ok(!r.blockers && !r.withheld && !r.releaseMarker && !r.decisions, r.key);
    assert.equal(ineligibility(r), 'the writer does not write "get_involved" records', "offline plan only: the writer never takes them");
  }
});

test("round trip: the converted records, published, draw /get-involved and the four path pages exactly as the website does today", async () => {
  const pages = source.getInvolved.map((p) => ({ ...p.record, status: "published" }));
  const snapshot = {
    version: 1, schemaVersion: 1, generatedAt: "2026-10-07T10:00:00.000Z", organization: { id: "rbb" },
    settings: { id: "site-settings", orgId: "rbb", schemaVersion: 1, status: "published", general: { shortName: "RBB", name: "Rising Beyond Borders", summary: "A summary." }, contact: { methods: [] }, social: [], seo: { description: "A description." }, branding: {}, analytics: {}, engagement: {}, features: {} },
    media: {},
    content: { getInvolved: pages },
  };
  const render = async (snap) => {
    const noSnapshot = { name: "test-no-snapshot", resolveId: (id) => (id === "virtual:rbb-published-snapshot" ? "\0test-no-snapshot" : null), load: (id) => (id === "\0test-no-snapshot" ? "export default null;" : null) };
    /* The source site, always (see cms-links.test.mjs: RBB_SNAPSHOT=off and ws: false keep parallel loaders apart). */
    process.env.RBB_SNAPSHOT = "off";
    const vite = await createServer({ root, logLevel: "error", appType: "custom", server: { middlewareMode: true, hmr: false, ws: false }, plugins: [noSnapshot] });
    try {
      if (snap) {
        /* As the build appends them (snapshot-adapter.mjs appendOverrides): nested targets; paths merged by id, every id found. */
        const mod = await vite.ssrLoadModule("/src/content/getInvolved.js");
        for (const [name, value] of Object.entries(overridesFrom(snap)["src/content/getInvolved.js"])) {
          const target = name.split(".").reduce((node, key) => node?.[key], mod);
          if (BY_ID in value) {
            for (const id of Object.keys(value[BY_ID])) assert.ok(target.some((item) => item.id === id), `a path "${id}"`);
            for (const item of target) if (value[BY_ID][item.id]) Object.assign(item, value[BY_ID][item.id]);
          } else Object.assign(target, value);
        }
      }
      const { render: r } = await vite.ssrLoadModule("/src/entry-server.jsx");
      return Object.fromEntries(["/get-involved", "/get-involved/volunteer", "/get-involved/fellowship", "/get-involved/partner", "/get-involved/travel"].map((route) => [route, r(route).html]));
    } finally {
      await vite.close();
    }
  };
  const [before, after] = [await render(null), await render(snapshot)];
  for (const route of Object.keys(before)) assert.equal(after[route], before[route], `${route}: identical`);
  /* The control: the records really are what the pages draw — one changed word changes its page, and only its page. */
  const edited = structuredClone(snapshot);
  edited.content.getInvolved.find((p) => p.id === "travel").sections[0].body = ["A changed test paragraph."];
  const changed = await render(edited);
  assert.notEqual(changed["/get-involved/travel"], before["/get-involved/travel"]);
  assert.ok(changed["/get-involved/travel"].includes("A changed test paragraph."));
  assert.equal(changed["/get-involved/volunteer"], before["/get-involved/volunteer"]);
});

test("existing records: the same is 'exists-same', a different one 'exists-differs' with what differs — never planned 'create'", async () => {
  const records = source.getInvolved.map((p) => p.record);
  const changed = structuredClone(records.find((r) => r.id === "volunteer"));
  changed.sections[1].heading = "Edited in the CMS";
  changed.shortDescription = "Edited in the CMS.";
  const docs = [{ orgId: "rbb", pageId: "hub", revision: 3, record: { ...records[0], status: "published" } }, { orgId: "rbb", pageId: "volunteer", revision: 2, record: changed }, { orgId: "other-org", pageId: "travel", revision: 1, record: records[4] }];
  const fakeDb = { collection: (name) => ({ find: (filter) => ({ toArray: async () => (name === "get_involved_pages" ? docs.filter((d) => d.orgId === filter.orgId) : []) }) }) };
  const existing = { checked: true, source: "test", ...(await readExistingFrom(fakeDb, "rbb")) };
  assert.deepEqual(Object.keys(existing.getInvolved).sort(), ["hub", "volunteer"], "this organization's only");
  const m = planMigration({ source, existing, rules: cmsRules() });
  const gi = new Map(m.records.filter((r) => r.type === "get_involved").map((r) => [r.key.split(":")[1], r]));
  assert.equal(gi.get("hub").action, "exists-same");
  assert.equal(gi.get("volunteer").action, "exists-differs");
  assert.deepEqual(gi.get("volunteer").existing.differs, ["shortDescription", "sections.1 (ways)"]);
  assert.equal(gi.get("travel").action, "create", "another organization's record is not this one's");
  assert.ok(gi.get("hub").decisions.includes("existing-record"));
});

test("duplicate keys: two sources for one page are both blocked; a release-marked page waits for a decision", () => {
  const twice = structuredClone(source);
  const dup = structuredClone(twice.getInvolved.find((p) => p.id === "partner"));
  twice.getInvolved.push(dup);
  const marked = twice.getInvolved.find((p) => p.id === "travel");
  marked.releaseMarker = "Sample path";
  marked.withheld = [{ field: "releaseMarker", reason: "release marker", decision: "sample-content" }];
  const m = planMigration({ source: twice, existing: { checked: false, source: "none" }, rules: cmsRules() });
  const partner = m.records.filter((r) => r.key === "get_involved:partner");
  assert.equal(partner.length, 2);
  assert.ok(partner.every((r) => r.action === "blocked" && r.blockers.some((b) => /duplicate key: get_involved:partner appears 2 times/.test(b))));
  const travel = m.records.find((r) => r.key === "get_involved:travel");
  assert.deepEqual([travel.action, travel.releaseMarker], ["needs-decision", "Sample path"]);
  assert.match(ineligibility(travel), /sample content/);
});

test("repeated offline rehearsals give byte-identical manifests", async () => {
  const again = await loadSource();
  const a = planMigration({ source, existing: { checked: false, source: "none" }, rules: cmsRules() });
  const b = planMigration({ source: again, existing: { checked: false, source: "none" }, rules: cmsRules() });
  assert.equal(JSON.stringify(b), JSON.stringify(a));
});
