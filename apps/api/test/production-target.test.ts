import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ConfigError, loadConfig } from "../src/config/env.ts";
import { mediaKeyEnv, scriptTargetProblems, targetOf } from "../src/config/target.ts";
import { newObjectKey } from "../src/modules/media/policy.ts";
import { smokeTargetProblem } from "./support/smoke-target.mjs";

/* Phase 0: production is identified by the resources a configuration
   points at — never by NODE_ENV — and only ever used on purpose. No test
   here connects anywhere: the connection string is an unroutable local
   placeholder, and scripts run with a scrubbed environment. */

const API = fileURLToPath(new URL("..", import.meta.url));
const FAKE_URI = "mongodb://127.0.0.1:9/";
const PROD = { MONGODB_URI: FAKE_URI, MONGODB_DB: "risingbeyondborders", RBB_TARGET: "production", ORGANIZATION_ID: "rbb" };
const R2 = (bucket: string) => ({ R2_ACCOUNT_ID: "0123456789abcdef0123456789abcdef", R2_BUCKET: bucket, R2_ACCESS_KEY_ID: "AKIATESTONLY0000", R2_SECRET_ACCESS_KEY: "testonlysecret0000000000000000000000000000", R2_PUBLIC_URL: "https://media.example.org" });
const problemsOf = (env: Record<string, string>) => {
  try {
    loadConfig(env);
    return [];
  } catch (error) {
    assert.ok(error instanceof ConfigError, String(error));
    return error.problems;
  }
};

test("the target is read from the database and bucket names, not NODE_ENV", () => {
  assert.equal(targetOf({ database: "risingbeyondborders" }).kind, "production");
  assert.equal(targetOf({ database: "risingbeyondborders_test" }).kind, "test");
  assert.equal(targetOf({ database: "rbb_r2_smoke" }).kind, "unclassified");
  assert.equal(targetOf({ database: " " }).kind, "none");
  assert.equal(targetOf({ bucket: "rbb" }).productionBucket, true);
  assert.equal(targetOf({ bucket: "rbb-test" }).productionBucket, false);
  /* NODE_ENV=development changes nothing about where it writes. */
  assert.equal(loadConfig({ ...PROD, NODE_ENV: "development" }).target.kind, "production");
  /* …and NODE_ENV=production does not make a test database production. */
  const staging = loadConfig({ NODE_ENV: "production", MONGODB_URI: FAKE_URI, MONGODB_DB: "risingbeyondborders_test", ORGANIZATION_ID: "test-org", AUTH_SECRET: "x".repeat(32) });
  assert.equal(staging.target.kind, "test");
});

test("the production database only on purpose: RBB_TARGET=production and ORGANIZATION_ID=rbb, or refused", () => {
  assert.deepEqual(problemsOf(PROD), [], "the deliberate production configuration loads");
  const cases: [string, Record<string, string>, RegExp][] = [
    ["no RBB_TARGET", { ...PROD, RBB_TARGET: "" }, /RBB_TARGET must be production/],
    ["RBB_TARGET=development", { ...PROD, RBB_TARGET: "development" }, /RBB_TARGET must be production/],
    ["no ORGANIZATION_ID (the development default would apply)", { ...PROD, ORGANIZATION_ID: "" }, /ORGANIZATION_ID is required with the production database/],
    ["another organization", { ...PROD, ORGANIZATION_ID: "test-org" }, /ORGANIZATION_ID must be "rbb"/],
    ["RBB_TARGET=production on another database", { ...PROD, MONGODB_DB: "risingbeyondborders_test" }, /RBB_TARGET is production, but MONGODB_DB is not/],
    ["RBB_TARGET=test on a database that is not a test one", { MONGODB_URI: FAKE_URI, MONGODB_DB: "rbb_r2_smoke", RBB_TARGET: "test" }, /does not end in "_test"/],
    ["an unknown RBB_TARGET", { ...PROD, RBB_TARGET: "prod" }, /RBB_TARGET/],
  ];
  for (const [name, env, expected] of cases) {
    const problems = problemsOf(env);
    assert.ok(problems.some((p) => expected.test(p)), `${name}: ${problems.join(" | ")}`);
    assert.ok(!problems.join(" ").includes(FAKE_URI), `${name}: no connection string in the report`);
  }
});

test("the production bucket only with the production database, and the production database only with it", () => {
  assert.deepEqual(problemsOf({ ...PROD, ...R2("rbb") }), []);
  assert.ok(problemsOf({ ...PROD, ...R2("rbb-test") }).some((p) => /R2_BUCKET must be the production bucket/.test(p)));
  const elsewhere: Record<string, string>[] = [
    { MONGODB_URI: FAKE_URI, MONGODB_DB: "risingbeyondborders_test", ...R2("rbb") },
    { MONGODB_URI: FAKE_URI, MONGODB_DB: "rbb_local", ...R2("rbb") },
    { NODE_ENV: "test", ...R2("rbb") },
  ];
  for (const env of elsewhere)
    assert.ok(problemsOf(env).some((p) => /R2_BUCKET is the production bucket/.test(p)), env.MONGODB_DB ?? "no database");
  assert.deepEqual(problemsOf({ MONGODB_URI: FAKE_URI, MONGODB_DB: "risingbeyondborders_test", ...R2("rbb-test") }), []);
});

test("new media for the production database is never filed under _development/", () => {
  const production = loadConfig({ ...PROD, ...R2("rbb"), NODE_ENV: "development" });
  const key = newObjectKey({ orgId: "rbb", filename: "photo.jpg", mimeType: "image/jpeg", env: mediaKeyEnv(production.env, production.target) });
  assert.match(key, /^rbb\/media\/[0-9a-f-]{36}\/photo\.jpg$/);
  const test = loadConfig({ MONGODB_URI: FAKE_URI, MONGODB_DB: "risingbeyondborders_test", NODE_ENV: "development" });
  assert.match(newObjectKey({ orgId: "test-org", filename: "photo.jpg", mimeType: "image/jpeg", env: mediaKeyEnv(test.env, test.target) }), /^_development\/test-org\/media\//);
});

test("maintenance commands: production needs the typed database name — a generic --confirm never does", () => {
  const production = targetOf({ database: "risingbeyondborders" });
  assert.match(scriptTargetProblems(production, "maintenance", []).join(), /PRODUCTION database.*--production=risingbeyondborders/);
  assert.equal(scriptTargetProblems(production, "maintenance", ["--confirm"]).length, 1, "--confirm is not enough");
  assert.equal(scriptTargetProblems(production, "maintenance", ["--production=rbb"]).length, 1, "only the database's own name");
  assert.deepEqual(scriptTargetProblems(production, "maintenance", ["--production=risingbeyondborders"]), []);
  assert.deepEqual(scriptTargetProblems(targetOf({ database: "risingbeyondborders_test" }), "maintenance", []), []);
});

test("test tooling: the test database only — production never, whatever the flags", () => {
  const flags = ["--confirm", "--production=risingbeyondborders", "--apply"];
  assert.ok(scriptTargetProblems(targetOf({ database: "risingbeyondborders" }), "test", flags).length > 0);
  assert.ok(scriptTargetProblems(targetOf({ database: "rbb_r2_smoke" }), "test", flags).length > 0, "unclassified is refused");
  assert.ok(scriptTargetProblems(targetOf({ database: null }), "test", flags).length > 0, "no database is refused");
  assert.ok(scriptTargetProblems(targetOf({ database: "risingbeyondborders_test", bucket: "rbb" }), "test", []).length > 0, "never the production bucket");
  assert.deepEqual(scriptTargetProblems(targetOf({ database: "risingbeyondborders_test" }), "test", []), []);
});

/* The commands themselves, run as an operator would — with a scrubbed
   environment and an unroutable placeholder database. Each must refuse
   at once, before connecting: a connection attempt would take seconds
   and end in a different error. */
const run = (script: string, args: string[], env: Record<string, string>) =>
  spawnSync(process.execPath, [script, ...args], { cwd: API, env: { PATH: process.env.PATH ?? "", ...env }, encoding: "utf8", timeout: 20_000 });

test("every maintenance command refuses the production database without --production=<database>", () => {
  const commands: [string, string[], Record<string, string>][] = [
    ["src/scripts/ensure-indexes.ts", [], {}],
    ["src/scripts/media-cleanup.ts", [], {}],
    ["src/scripts/media-cleanup.ts", ["--apply"], {}],
    ["src/scripts/settings-import.ts", ["--file", "/nonexistent/site-settings.json"], {}],
    ["src/scripts/scheduler-run.ts", [], { CRON_SECRET: "c".repeat(40) }],
  ];
  for (const [script, args, extra] of commands)
    for (const flags of [[], ["--confirm"]]) {
      const started = Date.now();
      const r = run(script, [...args, ...flags], { ...PROD, ...extra });
      const name = `${script} ${[...args, ...flags].join(" ")}`;
      assert.equal(r.status, 1, `${name}: exit ${r.status}\n${r.stderr}`);
      assert.match(r.stderr, /Refusing: this is the PRODUCTION database\. .*--production=risingbeyondborders.*Nothing was changed\./, name);
      assert.ok(Date.now() - started < 10_000, `${name}: refused before trying to connect`);
      assert.ok(!(r.stdout + r.stderr).includes(FAKE_URI), `${name}: no connection string printed`);
    }
});

test("a command run with the production database but no RBB_TARGET refuses the whole configuration", () => {
  const r = run("src/scripts/ensure-indexes.ts", ["--production=risingbeyondborders"], { ...PROD, RBB_TARGET: "" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /RBB_TARGET must be production/);
});

test("the smoke-test API server starts only on a test database", () => {
  for (const database of ["risingbeyondborders", "rbb_r2_smoke"]) {
    const r = run("test/support/dev-server-fake-storage.ts", [], { MONGODB_URI: FAKE_URI, MONGODB_DB: database, RBB_TARGET: database === "risingbeyondborders" ? "production" : "", ORGANIZATION_ID: "rbb", PORT: "0", FAKE_R2_PORT: "0" });
    assert.equal(r.status, 1, `${database}: ${r.stdout}${r.stderr}`);
    assert.match(r.stderr, /Refusing to start the test API/, database);
  }
});

test("smoke tests ask the API what it writes to, and run only on a test database", async () => {
  const answering = (body: unknown) => (async () => new Response(JSON.stringify(body))) as unknown as typeof fetch;
  assert.equal(await smokeTargetProblem("http://admin.local", { fetch: answering({ data: { target: "test" } }) }), null);
  assert.match((await smokeTargetProblem("http://admin.local", { fetch: answering({ data: { target: "production" } }) }))!, /PRODUCTION/);
  assert.match((await smokeTargetProblem("http://admin.local", { fetch: answering({ data: { target: "unclassified" } }) }))!, /not a test database/);
  assert.match((await smokeTargetProblem("http://admin.local", { fetch: answering({ data: { status: "ok" } }) }))!, /not stated/, "an older API that does not say is refused");
  const down = (async () => {
    throw new TypeError("fetch failed");
  }) as unknown as typeof fetch;
  assert.match((await smokeTargetProblem("http://admin.local", { fetch: down }))!, /refusing rather than guessing/);
  let asked = "";
  await smokeTargetProblem("http://site.local/", { fetch: (async (url: string) => ((asked = url), new Response("{}"))) as unknown as typeof fetch, apiUrl: "http://api.local" });
  assert.equal(asked, "http://api.local/api/v1/health/ready", "SMOKE_API_URL is asked instead");
});

test("every browser smoke script asks before it opens a browser or writes anything", () => {
  const scripts = [
    ...readFileSync(new URL("../../admin/package.json", import.meta.url), "utf8")
      .match(/scripts\/smoke-[a-z-]+\.mjs/g)!
      .map((path) => new URL(`../../admin/${path}`, import.meta.url)),
    new URL("../../web/scripts/smoke-forms.mjs", import.meta.url),
  ];
  assert.ok(scripts.length >= 23, `${scripts.length} smoke scripts`);
  for (const url of scripts) {
    const source = readFileSync(url, "utf8");
    const guard = source.indexOf("await requireTestTarget(base);");
    const name = url.pathname.split("/").slice(-3).join("/");
    assert.ok(guard > 0, `${name} asks the API's target`);
    for (const write of [".launch(", "signIn(", "apiCall(", "client.connect("]) {
      const at = source.indexOf(write);
      if (at >= 0) assert.ok(guard < at, `${name}: asks before ${write}`);
    }
  }
});
