import { before, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSource } from "../migration/source.mjs";
import { SOURCE_FIELDS, canonicalJson, planMigration } from "../migration/plan.mjs";
import { cmsRules } from "../migration/rules.mjs";
import { RehearsalRefused, readExistingFrom, readTarget } from "../migration/existing.mjs";
import { parseArgs } from "../migration-rehearsal.mjs";

/* The migration rehearsal (dry run): it plans, never writes. Everything
   here runs on the website's real source content and on fakes — no test
   connects to a database (the CLI cases point at an unroutable address
   and must refuse before trying it). */

const SCRIPTS = fileURLToPath(new URL("..", import.meta.url));
let source, rules;
before(async () => {
  source = await loadSource();
  rules = cmsRules();
});
const plan = (overrides = {}) => planMigration({ source: overrides.source ?? source, existing: overrides.existing ?? { checked: false, source: "none" }, rules });
const record = (manifest, key) => manifest.records.find((r) => r.key === key);
/* A copy of the source with one collection item changed. */
const withItem = (type, index, change) => {
  const copy = structuredClone(source);
  change(copy.collections[type][index], copy);
  return copy;
};

test("dry run by default: nothing existing is assumed, and the manifest says so", () => {
  const m = plan();
  assert.equal(m.mode, "dry-run");
  assert.equal(m.existing.checked, false);
  assert.match(m.existing.note, /NOT checked/);
  assert.ok(m.records.length > 50 && m.media.length > 0);
  assert.equal(parseArgs([]).existing, "none", "the command reads nothing unless asked");
});

test("deterministic: the same inputs give the same manifest, byte for byte — whatever order the source's keys are in", () => {
  const a = JSON.stringify(plan());
  assert.equal(JSON.stringify(plan()), a);
  const shuffled = structuredClone(source);
  for (const items of Object.values(shuffled.collections))
    for (const item of items) item.raw = Object.fromEntries(Object.entries(item.raw).reverse());
  assert.equal(JSON.stringify(plan({ source: shuffled })), a);
  assert.match(plan().sourceHash, /^[0-9a-f]{64}$/);
});

test("every source field is accounted for — sent, set by the API, or withheld with a reason; nothing is dropped silently", () => {
  const m = plan();
  for (const [type, items] of Object.entries(source.collections))
    for (const item of items) {
      const r = record(m, `${type}:${item.slug}`);
      for (const field of Object.keys(item.raw)) {
        const how = SOURCE_FIELDS[type]?.[field];
        assert.ok(how || r.withheld?.some((w) => w.field === field), `${type}:${item.slug}.${field} is accounted for`);
      }
    }
  /* A field the contract lacks is withheld with its reason; an unknown field is reported, never dropped. */
  const member = source.collections.team_member[0];
  const m2 = plan({ source: withItem("team_member", 0, (p) => ((p.raw.approvedAt = "2026-10-01"), (p.raw.mystery = 1))) });
  const r = record(m2, `team_member:${member.slug}`);
  assert.deepEqual(r.withheld.find((w) => w.field === "approvedAt"), { field: "approvedAt", reason: "approval date", decision: "schema-gap" });
  assert.match(r.withheld.find((w) => w.field === "mystery").reason, /not mapped/);
  /* Milestone 6: a project's facts, impact, partners and story are carried; the story by reference, resolved like a story's related stories. */
  const project = source.collections.project[0];
  const story = source.collections.story[0];
  const facts = { location: "A test district", stage: "Ongoing", date: "2026-09-01", impact: [{ value: "120", label: "Children reading weekly" }], partners: ["A test school"] };
  const m4 = plan({ source: withItem("project", 0, (p) => (Object.assign(p.raw, { location: facts.location, status: facts.stage, date: facts.date, impact: facts.impact, partners: facts.partners, story: { title: "x" } }), Object.assign(p.record, facts, { storyId: story.sourceId }))) });
  const p4 = record(m4, `project:${project.slug}`);
  assert.deepEqual(Object.fromEntries(Object.keys(facts).map((k) => [k, p4.payload[k]])), facts);
  assert.equal(p4.payload.storyId, `@story:${story.slug}`, "named by reference; the writer gives it the CMS id, or the website's own while samples stay in code");
  assert.ok(!p4.withheld?.some((w) => Object.keys(facts).includes(w.field) || w.field === "storyId" || w.field === "story"));
  assert.ok(p4.decisions.includes("sample-content") && p4.action === "needs-decision", "a sample project stays a sample");
  /* Milestone 5: a story's quotes and impact are carried, as written — no longer a schema gap. */
  const fields = { quotes: [{ text: "A test quote.", attribution: "A tester" }], impact: ["A test line."] };
  const m3 = plan({ source: withItem("story", 0, (s) => (Object.assign(s.raw, fields), Object.assign(s.record, fields))) });
  const s3 = record(m3, `story:${source.collections.story[0].slug}`);
  assert.deepEqual([s3.payload.quotes, s3.payload.impact], [fields.quotes, fields.impact]);
  assert.ok(!s3.withheld?.some((w) => w.field === "quotes" || w.field === "impact"));
  assert.ok(s3.decisions.includes("sample-content") && s3.action === "needs-decision", "a sample story stays a sample: nothing about it is approved");
});

test("release markers stay in the manifest, and sample content waits for a decision", () => {
  const m = plan();
  const story = record(m, `story:${source.collections.story[0].slug}`);
  assert.equal(story.releaseMarker, source.collections.story[0].raw.releaseMarker);
  assert.equal(story.action, "needs-decision");
  assert.ok(story.decisions.includes("sample-content"));
  assert.ok(!("releaseMarker" in story.payload), "never in what the API would be sent");
  const home = record(m, "homepage:homepage");
  assert.ok(home.withheld.some((w) => /releaseMarker$/.test(w.field) && w.decision === "sample-content"), "a page's markers are listed by path");
  assert.ok(m.decisions.find((d) => d.id === "sample-content").count > 0);
});

test("unsupported fields are reported with the work they need", () => {
  const m = plan();
  const events = m.records.filter((r) => r.type === "event");
  /* Milestone 4: the time zone is never inferred — every source event
     states none, so each stays blocked on it, and on nothing else. */
  assert.ok(events.every((e) => e.action === "blocked" && canonicalJson(e.blockers) === canonicalJson(['missing required field "timezone"'])), "every source event lacks a time zone, and only that");
  assert.ok(events.every((e) => !("timezone" in e.payload)), "no zone is supplied for it");
  /* Milestone 4: news programs, blog categories, event programs and schedules are accepted — no API gap left in posts or events. */
  const posts = m.records.filter((r) => ["news", "blog", "event"].includes(r.type));
  assert.deepEqual(posts.flatMap((r) => (r.withheld ?? []).filter((w) => w.decision === "api-gap")), []);
  assert.ok(m.records.filter((r) => r.type === "news").every((r) => /^@program:/.test(r.payload.programId)), "news: the program, as a reference");
  assert.ok(m.records.filter((r) => r.type === "blog").every((r) => ["reflections", "field-notes", "how-to"].includes(r.payload.category)), "blogs: the category");
  assert.ok(events.every((e) => e.payload.schedule.length > 0 && (e.payload.programId === null || /^@program:/.test(e.payload.programId))), "events: the schedule, and the program or open to all");
  /* Accepting the fields approves nothing: every one is still sample content waiting for a decision. */
  assert.ok(posts.every((r) => r.releaseMarker && r.decisions.includes("sample-content")));
  const donation = record(m, "general_donation:general-donation");
  /* Milestone 7: the donation page's FAQ, trust and appeal-list sections are drawn and accepted — no API gap; its sample FAQ answers keep it waiting on the sample-content decision. */
  assert.ok(!donation.withheld.some((w) => w.decision === "api-gap"), "no section is refused any more");
  assert.ok(donation.withheld.some((w) => /^sections\.\d+\.data\.items\.\d+\.releaseMarker$/.test(w.field) && w.decision === "sample-content"), "the sample FAQ answers are named, by path");
  assert.equal(donation.action, "needs-decision");
  assert.ok(!m.decisions.some((d) => d.id === "api-gap"), "no API gap left anywhere");
  /* Milestone 2: a photograph's focal point goes to the media library with it — no longer withheld. */
  assert.ok(m.media.some((x) => x.focal && !x.withheld), "focal points travel with the upload");
  assert.ok(!m.decisions.some((d) => d.id === "media-gap"), "nothing about an image is withheld any more");
  /* Milestone 9: Get Involved has a converter now — no longer listed as not mapped. */
  assert.deepEqual(m.notMapped.map((n) => n.type).slice(0, 2), ["policy", "story_strip"]);
  assert.ok(!m.notMapped.some((n) => n.type === "get_involved"));
});

test("duplicate keys are blocked — within a collection and across stories, news and blogs (one address space)", () => {
  const story = source.collections.story[0];
  const m = plan({ source: withItem("news", 0, (n) => ((n.slug = story.slug), (n.record.slug = story.slug))) });
  assert.match(record(m, `story:${story.slug}`).blockers.join(), /duplicate key: story:.*news:/);
  assert.equal(m.records.filter((r) => r.key.endsWith(`:${story.slug}`) && r.action === "blocked").length, 2);
});

test("unresolved references and missing media are blocked, by field", () => {
  const p = source.collections.project[0];
  const m = plan({ source: withItem("project", 0, (x) => ((x.record.programId = "no-such-program"), (x.record.imageId = "working-no-such-photo"))) });
  const r = record(m, `project:${p.slug}`);
  assert.equal(r.action, "blocked");
  assert.ok(r.blockers.some((b) => /programId refers to program "no-such-program"/.test(b)));
  assert.ok(r.blockers.some((b) => /imageId names media "working-no-such-photo"/.test(b)));
  assert.deepEqual(r.references.find((x) => x.field === "programId"), { field: "programId", to: "@program:no-such-program", resolved: "missing" });
  /* A related story that does not exist. */
  const m2 = plan({ source: withItem("story", 0, (s) => (s.record.relatedPostIds = ["missing:gone"])) });
  assert.ok(record(m2, `story:${source.collections.story[0].slug}`).blockers.some((b) => /story "gone"/.test(b)));
});

test("existing records are matched by slug in the organization and reported, never planned for creation", () => {
  const program = source.collections.program[0];
  const same = { id: "cms-1", slug: program.slug, status: "published", revision: 3, record: { ...program.record } };
  const existing = (rec) => ({ checked: true, source: "file", collections: { program: [rec] }, pages: {}, media: [] });
  const m = plan({ existing: existing(same) });
  const r = record(m, `program:${program.slug}`);
  assert.equal(r.action, "exists-same");
  assert.deepEqual(r.existing, { id: "cms-1", status: "published", revision: 3, differs: [] });
  const changed = plan({ existing: existing({ ...same, record: { ...program.record, title: "Changed in the CMS" } }) });
  assert.deepEqual(record(changed, `program:${program.slug}`).existing.differs, ["title"]);
  assert.equal(record(changed, `program:${program.slug}`).action, "exists-differs");
  /* Another slug is not a match; a CMS-only record is listed and kept. */
  const other = plan({ existing: existing({ ...same, slug: "only-in-the-cms" }) });
  assert.equal(record(other, `program:${program.slug}`).action, "create");
  assert.deepEqual(other.cmsOnly, [{ type: "program", slug: "only-in-the-cms", id: "cms-1", status: "published" }]);
  /* A reference resolves against existing records too. */
  assert.equal(record(m, `project:${source.collections.project[0].slug}`).references.find((x) => x.field === "programId").resolved, program.slug === source.collections.project[0].record.programId ? "existing" : "source");
});

test("existing media is matched by file name and size, never re-uploaded blindly", () => {
  const first = plan().media[0];
  const name = first.file.split("/").pop();
  const m = plan({ existing: { checked: true, source: "file", collections: {}, pages: {}, media: [{ id: "m-1", originalFilename: name, size: first.bytes, status: "ready" }] } });
  assert.deepEqual([m.media[0].action, m.media[0].existing], ["possible-existing", ["m-1"]]);
});

test("the existing-record read uses find() only, on the organization", async () => {
  const calls = [];
  const db = {
    collection: (name) =>
      new Proxy({}, {
        get: (_, method) => {
          if (method !== "find") throw new Error(`refused: ${method} on ${name}`);
          return (filter) => (calls.push([name, filter.orgId]), { toArray: async () => [] });
        },
      }),
  };
  const read = await readExistingFrom(db, "rbb");
  assert.ok(calls.length > 10 && calls.every(([, org]) => org === "rbb"));
  assert.deepEqual(read.collections.story, []);
  /* No module of the rehearsal can write: none calls a write method. */
  for (const file of ["migration-rehearsal.mjs", ...readdirSync(join(SCRIPTS, "migration")).map((f) => `migration/${f}`)]) {
    const text = readFileSync(join(SCRIPTS, file), "utf8");
    assert.doesNotMatch(text, /\.(insertOne|insertMany|updateOne|updateMany|replaceOne|deleteOne|deleteMany|bulkWrite|createIndex(es)?|drop(Collection|Database)?|findOneAnd\w+|command)\(|\bfetch\(/, file);
  }
});

test("the target is identified before connecting, and anything not positively identified is refused", () => {
  const dir = mkdtempSync(join(tmpdir(), "rbb-rehearsal-"));
  const envFile = (text) => {
    const path = join(dir, `env-${Math.random().toString(36).slice(2)}`);
    writeFileSync(path, text);
    return path;
  };
  const FAKE = "MONGODB_URI=mongodb://127.0.0.1:9/\n";
  const refuses = (fn, pattern) => assert.throws(fn, (e) => e instanceof RehearsalRefused && pattern.test(e.message));
  refuses(() => readTarget("production", { apiEnvFile: envFile(`${FAKE}MONGODB_DB=risingbeyondborders_test\n`) }), /reads only the production database/);
  refuses(() => readTarget("production", { apiEnvFile: envFile(`${FAKE}MONGODB_DB=risingbeyondborders\n`) }), /RBB_TARGET must be production/);
  refuses(() => readTarget("production", { apiEnvFile: join(dir, "missing") }), /could not be read/);
  refuses(() => readTarget("production", { apiEnvFile: envFile(`${FAKE}MONGODB_DB=risingbeyondborders\nRBB_TARGET=production\nORGANIZATION_ID=rbb\n`), org: "test-org" }), /serves "rbb"/);
  refuses(() => readTarget("test", { env: { MONGODB_TEST_URI: "mongodb://127.0.0.1:9/", MONGODB_TEST_DB: "risingbeyondborders" } }), /only a test database/);
  refuses(() => readTarget("test", { env: {} }), /needs MONGODB_TEST_URI/);
  refuses(() => readTarget("anything", {}), /unknown/);
  const ok = readTarget("production", { apiEnvFile: envFile(`${FAKE}MONGODB_DB=risingbeyondborders\nRBB_TARGET=production\nORGANIZATION_ID=rbb\n`) });
  assert.deepEqual([ok.kind, ok.database, ok.organization], ["production", "risingbeyondborders", "rbb"]);
});

/* The command, as an operator runs it. */
const run = (args, env = {}) => spawnSync(process.execPath, [join(SCRIPTS, "migration-rehearsal.mjs"), ...args], { env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", ...env }, encoding: "utf8", timeout: 120_000 });

test("the command refuses every write, apply or publish flag — and any unknown one — before reading anything", () => {
  for (const flag of ["--apply", "--write", "--publish", "--confirm", "--production=risingbeyondborders", "--execute", "--upload", "--whatever=1"]) {
    const started = Date.now();
    const r = run([flag]);
    assert.equal(r.status, 2, `${flag}: ${r.stdout}${r.stderr}`);
    assert.match(r.stderr, /refused/, flag);
    assert.ok(Date.now() - started < 5_000, `${flag}: refused at once`);
  }
});

test("the command fails closed on a target it cannot identify, before connecting", () => {
  const dir = mkdtempSync(join(tmpdir(), "rbb-rehearsal-cli-"));
  const env = join(dir, "api.env");
  writeFileSync(env, "MONGODB_URI=mongodb://127.0.0.1:9/\nMONGODB_DB=rbb_local\n");
  const r = run(["--existing=production"], { RBB_REHEARSAL_API_ENV: env });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Refused: --existing=production reads only the production database/);
  assert.ok(!(r.stdout + r.stderr).includes("127.0.0.1"), "no connection string printed");
});

test("the command's default run is a dry run that reads no database and writes only the manifest it is asked for", () => {
  const dir = mkdtempSync(join(tmpdir(), "rbb-rehearsal-out-"));
  const out = join(dir, "manifest.json");
  /* A database in the environment is ignored unless --existing asks for it. */
  const r = run([`--out=${out}`], { MONGODB_URI: "mongodb://127.0.0.1:9/", MONGODB_DB: "risingbeyondborders", MONGODB_TEST_URI: "mongodb://127.0.0.1:9/", MONGODB_TEST_DB: "risingbeyondborders_test" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Existing records: NOT checked/);
  const written = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(canonicalJson(written), canonicalJson(JSON.parse(JSON.stringify(plan()))), "the file is the planner's manifest");
  assert.deepEqual(readdirSync(dir), ["manifest.json"]);
});
