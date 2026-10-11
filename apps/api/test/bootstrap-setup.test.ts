import { test } from "node:test";
import assert from "node:assert/strict";
import { bootstrapTargetProblems, hostOf, isAtlas, passwordSource, setupStateProblems } from "../src/modules/auth/bootstrap-setup.ts";

/* M25.1: the owner setup's guard rails — opt-in, the exact stated target,
   never a test or smoke database, Atlas only; where the password comes
   from; and what stops the setup. Made-up hosts and names only. */

const ATLAS = "mongodb+srv://user:secret@cluster0.abcde.mongodb.net/?retryWrites=true";
const LOCAL = "mongodb://127.0.0.1:27017";
const env = (o: Record<string, string | undefined> = {}) => ({ BOOTSTRAP_OWNER_ENABLED: "true", BOOTSTRAP_TARGET_DB: "risingbeyondborders", BOOTSTRAP_TARGET_ORG: "rbb", ...o });
const target = (o: Partial<{ uri: string; dbName: string; orgId: string }> = {}, e: Record<string, string | undefined> = env()) => bootstrapTargetProblems({ uri: ATLAS, dbName: "risingbeyondborders", orgId: "rbb", ...o, env: e });

test("the real target passes: Atlas, the stated database and organization, opted in", () => {
  assert.deepEqual(target(), []);
});

test("opt-in and the stated target are required; a mismatch refuses", () => {
  for (const [name, problems] of [
    ["not opted in", target({}, env({ BOOTSTRAP_OWNER_ENABLED: undefined }))],
    ["opted in with anything but true", target({}, env({ BOOTSTRAP_OWNER_ENABLED: "yes" }))],
    ["no stated database", target({}, env({ BOOTSTRAP_TARGET_DB: undefined }))],
    ["no stated organization", target({}, env({ BOOTSTRAP_TARGET_ORG: "" }))],
    ["another database resolved", target({ dbName: "risingbeyondborders_old" })],
    ["another organization resolved", target({ orgId: "test-org" })],
  ] as const)
    assert.ok(problems.length > 0, name);
});

test("never a test or smoke database, never off Atlas", () => {
  assert.match(target({ dbName: "risingbeyondborders_test" }, env({ BOOTSTRAP_TARGET_DB: "risingbeyondborders_test" })).join(" "), /test database/);
  assert.match(target({ dbName: "rbb_r2_smoke" }, env({ BOOTSTRAP_TARGET_DB: "rbb_r2_smoke" })).join(" "), /smoke-test database/);
  assert.match(target({ dbName: "rbb_r2_smoke" }, env({ BOOTSTRAP_TARGET_DB: "rbb_r2_smoke", BOOTSTRAP_ALLOW_TEST_TARGET: "true" })).join(" "), /smoke-test database/, "the test flag never opens a smoke database");
  assert.match(target({ uri: LOCAL }).join(" "), /not on an Atlas cluster/);
  assert.match(target({ uri: "mongodb+srv://u:p@db.example.com/" }).join(" "), /not on an Atlas cluster/);
  // Only the API's own tests may target a *_test database.
  assert.deepEqual(target({ dbName: "risingbeyondborders_test", orgId: "test-org" }, env({ BOOTSTRAP_TARGET_DB: "risingbeyondborders_test", BOOTSTRAP_TARGET_ORG: "test-org", BOOTSTRAP_ALLOW_TEST_TARGET: "true" })), []);
});

test("problems name variables and resolved names — never the connection string", () => {
  const all = target({ uri: ATLAS, dbName: "rbb_r2_smoke", orgId: "x" }, {}).join(" ");
  assert.ok(!all.includes("secret") && !all.includes("user:") && !all.includes("abcde"), all);
  assert.equal(hostOf(ATLAS), "cluster0.abcde.mongodb.net");
  assert.ok(isAtlas(ATLAS) && !isAtlas(LOCAL));
});

test("the password: from the environment if set, else the prompt, else refused", () => {
  assert.equal(passwordSource({ fromEnv: "x".repeat(12), isTTY: true }), "env");
  assert.equal(passwordSource({ fromEnv: undefined, isTTY: true }), "prompt");
  assert.equal(passwordSource({ fromEnv: "", isTTY: true }), "prompt");
  assert.equal(passwordSource({ fromEnv: undefined, isTTY: false }), null);
});

test("an existing owner or account stops it; missing indexes only without BOOTSTRAP_ENSURE_INDEXES", () => {
  const fresh = { databaseExists: false, collections: 0, owners: 0, emailTaken: false, uniqueIndexes: false };
  assert.deepEqual(setupStateProblems(fresh, { ensureIndexes: true }), []);
  assert.match(setupStateProblems(fresh, { ensureIndexes: false }).join(" "), /indexes/);
  assert.match(setupStateProblems({ ...fresh, owners: 1 }, { ensureIndexes: true }).join(" "), /already has an owner/);
  assert.match(setupStateProblems({ ...fresh, emailTaken: true }, { ensureIndexes: true }).join(" "), /already exists/);
});
