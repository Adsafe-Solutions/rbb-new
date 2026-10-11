import { test } from "node:test";
import assert from "node:assert/strict";
import { PublishedSnapshot } from "@rbb/content-schema";
import { settingsRecord } from "./fixtures/settings.ts";
import { member } from "./media/memory.ts";
import { addMedia, harness, sharedData } from "./settings/memory.ts";
import { previewSnapshot } from "./support/migration/fidelity.ts";
import { serviceClient } from "./support/migration/services.ts";
import { REHEARSAL_DATABASE, REHEARSAL_ORGANIZATION, databaseProblems, rehearsalTargetProblems } from "./support/migration/target.ts";
import { COLLECTION_TYPES, PAGE_TYPES, manifestProblems, newLedger, replay, type Ledger, type Manifest } from "./support/migration/writer.ts";
import { main, parseArgs } from "./support/migration-writer.ts";

/* The TEST-ONLY migration writer: it replays a rehearsal manifest's
   eligible records as drafts through the API's services. Everything here
   runs on the in-memory harness — no database, no storage — and the
   command's refusals are proven with an unroutable address and a manifest
   path that does not exist (so they cannot have read or connected). */

const ORG = REHEARSAL_ORGANIZATION;
const body = [{ type: "paragraph", children: [{ type: "text", text: "A test paragraph." }] }];
const pageHero = { id: "intro", type: "pageHero", enabled: true, version: 1, data: { title: "About a test organization", body: "A test line." } };
const intro = { id: "intro", type: "intro", enabled: true, version: 1, data: { kicker: "Our impact", title: "Test Impact", highlight: "Impact", body: "A test line." } };
const storiesBlock = (storyIds: string[]) => ({ id: "stories", type: "stories", enabled: true, version: 1, data: { heading: "Stories of change", storyIds } });

/* A small rehearsal manifest, in the rehearsal tool's shape and order. */
const manifest = (): Manifest =>
  ({
    manifestVersion: 1,
    mode: "dry-run",
    organization: "rbb",
    sourceHash: "a".repeat(64),
    existing: { checked: false, source: "none" },
    records: [
      { key: "program:education", type: "program", sourceId: "education", action: "create", payload: { title: "Education", slug: "education", icon: "education", description: "A test line." } },
      { key: "program:health", type: "program", sourceId: "health", action: "create", payload: { title: "Health", slug: "health", icon: "health", description: "A test line." } },
      { key: "metric:lives", type: "metric", sourceId: "lives", action: "create", payload: { value: "50K+", label: "Lives", slug: "lives", verification: "pending-review" } },
      { key: "project:clubs", type: "project", sourceId: "clubs", action: "create", payload: { title: "Reading clubs", slug: "clubs", programId: "@program:education", description: "A test line.", imageId: "@media:club-photo" } },
      { key: "project:sample", type: "project", sourceId: "sample", action: "needs-decision", releaseMarker: "Sample project", decisions: ["sample-content"], payload: { title: "Sample", slug: "sample", programId: "@program:education", description: "x" } },
      { key: "story:a-sample-story", type: "story", sourceId: "sample-story", action: "needs-decision", releaseMarker: "Sample story", decisions: ["sample-content"], payload: { title: "Sample", slug: "a-sample-story", category: "field", body } },
      { key: "event:dinner", type: "event", sourceId: "dinner", action: "blocked", blockers: ['missing required field "timezone"'], payload: { title: "Dinner" } },
      { key: "news:with-gap", type: "news", sourceId: "with-gap", action: "create", withheld: [{ field: "programId", reason: "api", decision: "api-gap" }], payload: { type: "news", title: "N", slug: "with-gap", body } },
      { key: "appeal:x", type: "appeal", sourceId: "x", action: "create", payload: { title: "Appeal" } },
      { key: "settings:site-settings", type: "settings", action: "create", payload: { ...settingsRecord(ORG) } },
      { key: "about:about", type: "about", action: "create", payload: { id: "about", orgId: "rbb", schemaVersion: 1, status: "published", sections: [pageHero] } },
      { key: "impact:impact", type: "impact", action: "create", payload: { id: "impact", orgId: "rbb", schemaVersion: 1, status: "published", sections: [intro, storiesBlock(["@story:a-sample-story"])] } },
    ],
    media: [{ key: "club-photo", action: "upload", file: "apps/web/src/assets/club.jpg", bytes: 3, sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", mimeType: "image/jpeg", alt: "Children reading", usedBy: ["project:clubs"] }],
  }) as unknown as Manifest;

function setup() {
  const data = sharedData();
  const h = harness(ORG, data);
  const owner = member(ORG, "OWNER");
  const uploads: string[] = [];
  const client = serviceClient(h as never, owner, {
    library: async () => data.media.filter((m) => m.orgId === ORG && !m.deletedAt).map((m) => ({ id: m.id, originalFilename: m.originalFilename, size: m.size })),
    upload: async ({ filename, bytes, alt }) => {
      uploads.push(filename);
      return { id: addMedia(data, ORG, "ready", { originalFilename: filename, size: bytes.length, alt }).id };
    },
  });
  const ledger = newLedger({ database: REHEARSAL_DATABASE, organization: ORG }, manifest());
  /* "abc": the 3 bytes whose SHA-256 the manifest names. */
  const readFile = async () => Buffer.from("abc");
  return { data, h, owner, client, ledger, readFile, uploads };
}
const keys = (l: Ledger) => l.created.map((c) => c.key);

test("the target: exactly the reserved test database and organization — production and anything unclassified are refused", () => {
  assert.deepEqual(rehearsalTargetProblems({ database: "risingbeyondborders_test", organization: "test-org" }), []);
  assert.match(rehearsalTargetProblems({ database: "risingbeyondborders", organization: "test-org" }).join(), /PRODUCTION/);
  assert.match(rehearsalTargetProblems({ database: "rbb_r2_smoke", organization: "test-org" }).join(), /unclassified/);
  assert.match(rehearsalTargetProblems({ database: "another_test", organization: "test-org" }).join(), /only to "risingbeyondborders_test"/);
  assert.match(rehearsalTargetProblems({ database: undefined, organization: "test-org" }).join(), /no database/);
  assert.match(rehearsalTargetProblems({ database: "risingbeyondborders_test", organization: "rbb" }).join(), /only as the organization "test-org"/);
});

test("the command refuses options and targets before reading the manifest or connecting", async () => {
  const quiet = console.error;
  const errors: string[] = [];
  console.error = (m: string) => errors.push(m);
  try {
    const nowhere = { MONGODB_TEST_URI: "mongodb://127.0.0.1:9/" };
    const args = ["--manifest=/nonexistent/manifest.json", "--report=/nonexistent/report.json"];
    for (const extra of ["--confirm", "--production=risingbeyondborders", "--org=rbb", "--database=risingbeyondborders", "--apply", "--publish"])
      assert.equal(await main([...args, extra], { ...nowhere, MONGODB_TEST_DB: REHEARSAL_DATABASE }), 2, extra);
    assert.equal(await main(args, { ...nowhere, MONGODB_TEST_DB: "risingbeyondborders" }), 2);
    assert.equal(await main(args, { ...nowhere, MONGODB_TEST_DB: "rbb_local" }), 2);
    assert.equal(await main(args, { MONGODB_TEST_DB: REHEARSAL_DATABASE }), 2, "no URI");
    assert.equal(await main(["--manifest=/nonexistent/manifest.json"], nowhere), 2, "no report path");
  } finally {
    console.error = quiet;
  }
  assert.ok(errors.some((e) => /PRODUCTION/.test(e)) && errors.some((e) => /unclassified/.test(e)));
  assert.ok(errors.every((e) => !e.includes("127.0.0.1")), "no connection string printed");
  assert.throws(() => parseArgs(["--manifest=m", "--report=r", "--confirm"]), /refused/);
});

test("after connecting, a database is confirmed read-only: it exists and holds reserved test records only", async () => {
  const fake = (collections: Record<string, number>) => ({
    listCollections: () => ({ toArray: async () => Object.keys(collections).map((name) => ({ name })) }),
    collection: (name: string) => ({ countDocuments: async () => collections[name]! }),
  });
  assert.match((await databaseProblems(fake({}))).join(), /does not exist/);
  assert.match((await databaseProblems(fake({ programs: 0, posts: 2 }))).join(), /posts holds 2 record\(s\) of an organization that is not a reserved test organization/);
  assert.deepEqual(await databaseProblems(fake({ programs: 0, posts: 0 })), []);
});

test("the manifest is validated: version, dry-run mode, source hash, unique keys", () => {
  assert.deepEqual(manifestProblems(manifest()), []);
  const m = manifest() as unknown as Record<string, unknown>;
  assert.ok(manifestProblems({ ...m, mode: "apply" }).some((p) => /dry-run/.test(p)));
  assert.ok(manifestProblems({ ...m, manifestVersion: 2 }).some((p) => /manifestVersion/.test(p)));
  const dup = manifest();
  dup.records.push({ ...dup.records[0]! });
  assert.ok(manifestProblems(dup).some((p) => /duplicate key in the manifest: program:education/.test(p)));
});

test("only eligible records are written — as drafts, in dependency order; everything else is skipped with its reason", async () => {
  const { h, owner, client, ledger, readFile, uploads, data } = setup();
  const result = await replay({ manifest: manifest(), client, ledger, readFile });
  assert.equal(result.complete, true);
  assert.deepEqual(keys(result), ["program:education", "program:health", "metric:lives", "project:clubs", "settings:site-settings", "about:about", "impact:impact"]);
  const reasons = Object.fromEntries(result.skipped.map((s) => [s.key, s.reason]));
  assert.match(reasons["project:sample"]!, /release marker stays in the website's code/);
  assert.match(reasons["story:a-sample-story"]!, /release marker/);
  assert.match(reasons["event:dinner"]!, /blocked.*timezone/);
  assert.match(reasons["news:with-gap"]!, /cannot take as they stand/);
  assert.match(reasons["appeal:x"]!, /does not write "appeal"/);
  /* Drafts only — nothing submitted, approved or published. */
  for (const p of (await h.programs.list(owner, { pageSize: 100 })).items) assert.equal(p.record.status, "draft");
  assert.equal((await h.about.get(owner)).record!.status, "draft");
  assert.equal((await h.settings.get(owner))!.settings.status, "draft");
  assert.ok(!h.audit.some((e) => /\.(submitted|approved|published|scheduled)$|^publish\./.test(e.action)), "no workflow step, no publish");
  /* References resolved to what the test organization holds. */
  const project = (await h.projects.list(owner, { pageSize: 100 })).items[0]!.record;
  assert.equal(project.programId, "education");
  assert.deepEqual(uploads, ["club.jpg"], "media to test storage, once");
  assert.equal(project.imageId, data.media.find((m) => m.originalFilename === "club.jpg")!.id);
  /* A story kept in the website's code, while the CMS has none: the impact page names the website's own. */
  assert.deepEqual(result.resolved.find((r) => r.key === "impact:impact"), { key: "impact:impact", field: "sections.1.data.storyIds.0", ref: "@story:a-sample-story", to: "sample-story", how: "website" });
  /* …kept with the created record for good, not only for the latest run. */
  assert.deepEqual(result.created.find((c) => c.key === "project:clubs")!.resolved!.map((r) => [r.field, r.how]), [["programId", "created"], ["imageId", "created"]]);
});

test("a reference nothing can satisfy is skipped, never guessed", async () => {
  const { client, ledger, readFile } = setup();
  const m = manifest();
  (m.records[3]!.payload as Record<string, unknown>).programId = "@program:nowhere";
  const result = await replay({ manifest: m, client, ledger, readFile });
  assert.match(result.skipped.find((s) => s.key === "project:clubs")!.reason, /unresolved reference — programId: @program:nowhere/);
  assert.ok(!keys(result).includes("project:clubs"));
});

test("media that changed since the manifest is not uploaded", async () => {
  const { client, ledger, uploads } = setup();
  const result = await replay({ manifest: manifest(), client, ledger, readFile: async () => Buffer.from("changed") });
  assert.match(result.skipped.find((s) => s.key === "project:clubs")!.reason, /changed since the manifest/);
  assert.deepEqual(uploads, []);
});

test("rerun-safe: a second run creates nothing, finds every record by key and reports it as the rehearsal's own", async () => {
  const { h, owner, client, ledger, readFile, uploads } = setup();
  await replay({ manifest: manifest(), client, ledger, readFile });
  const second = await replay({ manifest: manifest(), client, ledger, readFile });
  assert.equal(second.runs, 2);
  assert.equal(second.created.filter((c) => c.run === 2).length, 0, "nothing created again");
  assert.equal(second.existing.length, 7);
  assert.ok(second.existing.every((e) => e.createdByRehearsal && e.differs.length === 0), JSON.stringify(second.existing));
  assert.equal((await h.programs.list(owner, { pageSize: 100 })).items.length, 2, "no duplicates");
  assert.deepEqual(uploads, ["club.jpg"], "no second upload");
});

test("interrupted: the ledger is true after every create, and a rerun finishes without duplicates", async () => {
  const { h, owner, client, ledger, readFile } = setup();
  const saved: string[] = [];
  await assert.rejects(replay({ manifest: manifest(), client, ledger, readFile, failAfter: 2, onProgress: async (l) => void saved.push(JSON.stringify(l)) }), /interrupted after 2/);
  const afterCrash = JSON.parse(saved.at(-1)!) as Ledger;
  assert.deepEqual(keys(afterCrash), ["program:education", "program:health"]);
  assert.equal(afterCrash.complete, false);
  const resumed = await replay({ manifest: manifest(), client, ledger: afterCrash, readFile });
  assert.equal(resumed.complete, true);
  assert.deepEqual(keys(resumed), ["program:education", "program:health", "metric:lives", "project:clubs", "settings:site-settings", "about:about", "impact:impact"]);
  assert.equal((await h.programs.list(owner, { pageSize: 100 })).items.length, 2);
});

test("never overwrites: a record that already exists is reported with its differences and left as it is", async () => {
  const { h, owner, client, ledger, readFile } = setup();
  await h.programs.create(owner, { title: "Education (edited in the CMS)", slug: "education", icon: "education", description: "A test line." }, { requestId: "t", clientIp: null, userAgent: null });
  const result = await replay({ manifest: manifest(), client, ledger, readFile });
  const existing = result.existing.find((e) => e.key === "program:education")!;
  assert.deepEqual([existing.createdByRehearsal, existing.differs], [false, ["title"]]);
  assert.ok(!keys(result).includes("program:education"));
  const programs = (await h.programs.list(owner, { pageSize: 100 })).items;
  assert.equal(programs.find((p) => p.record.slug === "education")!.record.title, "Education (edited in the CMS)", "untouched");
  assert.equal(result.resolved.find((r) => r.key === "project:clubs" && r.field === "programId")!.how, "existing");
});

test("the in-memory preview: the drafts, approved only in memory, make a snapshot the contract accepts", async () => {
  const { h, owner, client, ledger, readFile, data } = setup();
  await replay({ manifest: manifest(), client, ledger, readFile });
  const collections = Object.fromEntries(await Promise.all(COLLECTION_TYPES.map(async (t) => [t, await client.list(t)])));
  const pages = Object.fromEntries(await Promise.all(PAGE_TYPES.map(async (t) => [t, await client.page(t)])));
  const { snapshot, problems } = await previewSnapshot({ collections, pages, media: data.media.filter((m) => m.orgId === ORG) }, ORG);
  assert.deepEqual(problems, []);
  assert.ok(PublishedSnapshot.safeParse(snapshot).success);
  assert.deepEqual(snapshot!.content.programs!.map((p) => p.slug), ["education", "health"]);
  assert.deepEqual((snapshot!.content.impact!.sections[1]!.data as { storyIds: string[] }).storyIds, ["sample-story"]);
  /* The rehearsal's own records are still drafts: the approval happened only in memory. */
  assert.ok((await h.programs.list(owner, { pageSize: 100 })).items.every((p) => p.record.status === "draft"));
  assert.equal(await h.publishing.publicSnapshot(), null);
});
