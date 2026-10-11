import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { COLLECTIONS, ensureIndexes } from "../../src/db/collections.ts";
import { verifyPassword } from "../../src/modules/auth/password.ts";
import { mongoAuthStores } from "../../src/modules/auth/repository.ts";
import { addMember } from "../auth/memory.ts";
import { testMongo } from "./mongo.ts";

/* M25.1: the one-time owner setup (src/scripts/bootstrap-owner.ts) run as
   the operator runs it — a child process, no terminal — against the
   DEDICATED TEST DATABASE only (BOOTSTRAP_ALLOW_TEST_TARGET is a test-only
   flag; the real command clears it). Reserved test organizations only,
   removed afterwards. The password is random per run and must appear in no
   output. */

const mongo = testMongo();
const API_DIR = new URL("../../", import.meta.url).pathname;
const PASSWORD = `test-${randomBytes(12).toString("base64url")}`;
const EMAIL = "owner-setup@test-org.example";

const run = (args: string[], overrides: Record<string, string | undefined> = {}) =>
  new Promise<{ code: number | null; out: string }>((resolve) => {
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries({
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      MONGODB_URI: mongo.uri,
      MONGODB_DB: mongo.dbName,
      ORGANIZATION_ID: "test-org",
      BOOTSTRAP_OWNER_ENABLED: "true",
      BOOTSTRAP_OWNER_EMAIL: EMAIL,
      BOOTSTRAP_OWNER_NAME: "Test Owner",
      BOOTSTRAP_OWNER_PASSWORD: PASSWORD,
      BOOTSTRAP_TARGET_DB: mongo.dbName,
      BOOTSTRAP_TARGET_ORG: "test-org",
      BOOTSTRAP_ALLOW_TEST_TARGET: "true",
      BOOTSTRAP_ENSURE_INDEXES: "true",
      ...overrides,
    }))
      if (v !== undefined) env[k] = v;
    const child = spawn("node", ["src/scripts/bootstrap-owner.ts", ...args], { cwd: API_DIR, env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code, out }));
  });
const users = (orgId: string) => mongo.db().collection(COLLECTIONS.users).find({ orgId }).toArray();
const outputs: string[] = [];

before(async () => {
  await mongo.connect();
  await ensureIndexes(mongo.db());
});
after(async () => {
  await mongo.cleanup();
  await mongo.client.close();
});

test("the real command: .env then .env.bootstrap, never .env.local; inherited targets and passwords cleared", () => {
  const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  const cmd: string = pkg.scripts["owner:setup"];
  assert.match(cmd, /--env-file=\.env --env-file=\.env\.bootstrap /);
  assert.ok(!cmd.includes(".env.local"));
  for (const v of ["MONGODB_URI", "MONGODB_DB", "ORGANIZATION_ID", "NODE_ENV", "BOOTSTRAP_OWNER_PASSWORD", "BOOTSTRAP_ALLOW_TEST_TARGET"]) assert.ok(cmd.includes(`-u ${v} `), v);
  assert.match(cmd, /bootstrap-owner\.ts --confirm$/);
});

test("refusals change nothing: no opt-in, no --confirm, a wrong or test or smoke target", async () => {
  for (const [name, args, overrides, expected] of [
    ["not opted in", ["--confirm"], { BOOTSTRAP_OWNER_ENABLED: undefined }, /opt-in/],
    ["no --confirm", [], {}, /--confirm/],
    ["another stated database", ["--confirm"], { BOOTSTRAP_TARGET_DB: "risingbeyondborders" }, /not BOOTSTRAP_TARGET_DB/],
    ["another stated organization", ["--confirm"], { BOOTSTRAP_TARGET_ORG: "rbb" }, /not BOOTSTRAP_TARGET_ORG/],
    ["a test database without the test-only flag", ["--confirm"], { BOOTSTRAP_ALLOW_TEST_TARGET: undefined }, /test database/],
    ["the smoke database", ["--confirm"], { MONGODB_DB: "rbb_r2_smoke", BOOTSTRAP_TARGET_DB: "rbb_r2_smoke" }, /smoke-test database/],
  ] as const) {
    const r = await run([...args], overrides);
    outputs.push(r.out);
    assert.equal(r.code, 1, `${name}: ${r.out}`);
    assert.match(r.out, expected, name);
    assert.match(r.out, /Nothing was changed/, name);
  }
  assert.equal((await users("test-org")).length, 0, "no account was created");
});

test("--check is read-only: the target and its state, nothing written", async () => {
  const r = await run(["--check", "--confirm"]);
  outputs.push(r.out);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, new RegExp(`Target: mode=development organization=test-org database=${mongo.dbName} host=Atlas`));
  assert.match(r.out, /owners in "test-org": 0, account for this email: no/);
  assert.match(r.out, /Check passed \(read-only, nothing was changed\)/);
  assert.equal((await users("test-org")).length, 0);
});

test("the setup: indexes, then one owner — hashed with scrypt, audited, the password nowhere in the output", async () => {
  const r = await run(["--confirm"]);
  outputs.push(r.out);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Indexes ensured on \d+ collection\(s\)/);
  assert.match(r.out, /Owner created for organization "test-org"/);
  const [user] = await users("test-org");
  assert.equal(user!.emailNormalized, EMAIL);
  assert.match(user!.passwordHash, /^scrypt\$/);
  assert.ok(!JSON.stringify(user).includes(PASSWORD), "never stored in plain text");
  assert.ok(await verifyPassword(PASSWORD, user!.passwordHash));
  const membership = await mongo.db().collection(COLLECTIONS.memberships).findOne({ orgId: "test-org", userId: user!.id });
  assert.equal(membership!.role, "OWNER");
  const audit = await mongo.db().collection(COLLECTIONS.auditLogs).findOne({ orgId: "test-org", action: "auth.owner.bootstrapped" });
  assert.ok(audit && !JSON.stringify(audit).includes(PASSWORD));
});

test("a second run stops before writing: the owner exists; the account is never reset", async () => {
  const before = (await users("test-org"))[0]!;
  const r = await run(["--confirm"], { BOOTSTRAP_OWNER_PASSWORD: `other-${randomBytes(12).toString("base64url")}` });
  outputs.push(r.out);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /already has an owner/);
  const now = await users("test-org");
  assert.equal(now.length, 1);
  assert.equal(now[0]!.passwordHash, before.passwordHash, "the password is untouched");
});

test("an email that already has an account — in any organization — stops it", async () => {
  await addMember(mongoAuthStores(mongo.db(), "org-a"), { orgId: "org-a", email: "taken@test-org.example", password: "a correct long password", role: "EDITOR" });
  const r = await run(["--confirm"], { ORGANIZATION_ID: "org-b", BOOTSTRAP_TARGET_ORG: "org-b", BOOTSTRAP_OWNER_EMAIL: "taken@test-org.example" });
  outputs.push(r.out);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /an account with this email already exists/);
  assert.equal((await users("org-b")).length, 0);
});

test("the password never appears in any output", () => {
  assert.ok(outputs.length >= 9);
  assert.ok(!outputs.join("\n").includes(PASSWORD));
  assert.ok(!outputs.join("\n").includes(mongo.uri));
});
