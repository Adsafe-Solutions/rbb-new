import { test } from "node:test";
import assert from "node:assert/strict";
import { ConfigError, describeEnvironment, loadConfig } from "../src/config/env.ts";

const SECRET_URI = "mongodb+srv://someone:very-secret-password@cluster.example.net/";

const problemsOf = (env: Record<string, string | undefined>) => {
  try {
    loadConfig(env);
  } catch (error) {
    assert.ok(error instanceof ConfigError);
    return error.problems;
  }
  assert.fail("expected a configuration error");
};

test("development works with nothing set — no database, the development organization", () => {
  const config = loadConfig({});
  assert.equal(config.env, "development");
  assert.equal(config.mongo, null);
  assert.equal(config.orgId, "rbb");
  assert.deepEqual(config.cors.origins, []);
});

test("a valid production configuration loads", () => {
  const config = loadConfig({
    NODE_ENV: "production",
    ORGANIZATION_ID: "rbb",
    MONGODB_URI: SECRET_URI,
    MONGODB_DB: "rbb_production",
    WEB_ORIGIN: "https://www.example.org",
    ADMIN_ORIGIN: "https://admin.example.org",
  });
  assert.equal(config.env, "production");
  assert.deepEqual(config.mongo, { uri: SECRET_URI, dbName: "rbb_production" });
  assert.deepEqual(config.cors.origins, ["https://www.example.org", "https://admin.example.org"]);
});

test("production refuses to start on development defaults", () => {
  const problems = problemsOf({ NODE_ENV: "production" });
  for (const name of ["ORGANIZATION_ID", "MONGODB_URI", "MONGODB_DB"])
    assert.ok(problems.some((p) => p.startsWith(`${name} `)), `${name} should be required in production`);
});

test("production origins must be https", () => {
  const problems = problemsOf({
    NODE_ENV: "production",
    ORGANIZATION_ID: "rbb",
    MONGODB_URI: SECRET_URI,
    MONGODB_DB: "rbb",
    WEB_ORIGIN: "http://www.example.org",
  });
  assert.deepEqual(problems, ["WEB_ORIGIN must be an https:// origin in production"]);
});

test("malformed values are refused, and no message repeats a value", () => {
  const env = {
    NODE_ENV: "staging",
    MONGODB_URI: "postgres://someone:very-secret-password@db",
    MONGODB_DB: "bad name!",
    WEB_ORIGIN: "https://www.example.org/path",
    ORGANIZATION_ID: "Not A Slug",
  };
  const problems = problemsOf(env);
  assert.equal(problems.length, 5);
  for (const value of Object.values(env)) assert.ok(!problems.join("\n").includes(value), "a problem message repeated a value");
});

test("an Atlas URI still holding <placeholders> is caught", () => {
  const problems = problemsOf({ MONGODB_URI: "mongodb+srv://<db_username>:<db_password>@cluster.example.net/", MONGODB_DB: "rbb" });
  assert.deepEqual(problems, ["MONGODB_URI still contains <placeholders> instead of real credentials"]);
});

test("a database needs both its URI and its name", () => {
  assert.deepEqual(problemsOf({ MONGODB_URI: SECRET_URI }), ["MONGODB_DB is required when MONGODB_URI is set"]);
  assert.deepEqual(problemsOf({ MONGODB_DB: "rbb" }), ["MONGODB_URI is required when MONGODB_DB is set"]);
});

test("empty values count as unset", () => {
  assert.equal(loadConfig({ MONGODB_URI: "", MONGODB_DB: "  ", NODE_ENV: "" }).mongo, null);
});

test("the environment report names variables, never values", () => {
  const report = describeEnvironment({ MONGODB_URI: SECRET_URI, MONGODB_DB: "rbb" });
  assert.ok(report.present.includes("MONGODB_URI"));
  assert.ok(report.missing.includes("ORGANIZATION_ID"));
  assert.ok(!JSON.stringify(report).includes("very-secret-password"));
});
