import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.ts";
import { readJson } from "../src/http/body.ts";
import { ApiError } from "../src/errors.ts";
import { captureLogs, downMongo, get, jsonOf, testConfig } from "./helpers.ts";

const app = (options = {}) => createApp({ config: testConfig(), mongo: null, write: () => {}, ...options });

/* ---------------- Request ids ---------------- */

test("every response carries a request id; a safe incoming one is kept", async () => {
  const fresh = await get(app(), "/api/v1/health");
  assert.match(fresh.headers.get("x-request-id")!, /^[0-9a-f-]{36}$/);
  const kept = await get(app(), "/api/v1/health", { headers: { "X-Request-Id": "trace-abc-123" } });
  assert.equal(kept.headers.get("x-request-id"), "trace-abc-123");
  const unsafe = await get(app(), "/api/v1/health", { headers: { "X-Request-Id": "<script>x</script>" } });
  assert.match(unsafe.headers.get("x-request-id")!, /^[0-9a-f-]{36}$/);
});

/* ---------------- Error model ---------------- */

test("errors share one shape that carries the request id", async () => {
  const res = await get(app(), "/api/v1/nothing-here");
  assert.equal(res.status, 404);
  const body = await jsonOf(res);
  assert.deepEqual(Object.keys(body), ["error"]);
  assert.equal(body.error.code, "NOT_FOUND");
  assert.equal(body.error.requestId, res.headers.get("x-request-id"));
  assert.equal(typeof body.error.message, "string");
});

test("a known path with the wrong method is 405 with Allow", async () => {
  const res = await get(app(), "/api/v1/health", { method: "DELETE" });
  assert.equal(res.status, 405);
  assert.equal(res.headers.get("allow"), "GET");
  assert.equal((await jsonOf(res)).error.code, "METHOD_NOT_ALLOWED");
});

test("invalid path parameters are a VALIDATION_ERROR naming the parameter", async () => {
  const res = await get(app(), "/api/v1/internal/appeals/Not%20A%20Slug");
  assert.equal(res.status, 400);
  const { error } = await jsonOf(res);
  assert.equal(error.code, "VALIDATION_ERROR");
  assert.equal(error.details[0].path, "params.slug");
  assert.ok(!JSON.stringify(error).includes("Not A Slug"), "the error echoed the input");
});

test("a malformed path escape is a bad request, not a crash", async () => {
  const res = await get(app(), "/api/v1/internal/appeals/%E0%A4%A");
  assert.equal(res.status, 400);
  assert.equal((await jsonOf(res)).error.code, "BAD_REQUEST");
});

test("an unexpected failure is a generic 500: no message, stack or credential leaks", async () => {
  const logs = captureLogs();
  const failing = {
    db: async () => {
      throw new TypeError("Cannot read properties of undefined at /srv/app/node_modules/mongodb/lib/x.js using mongodb://u:p4ss@h");
    },
    ping: async () => {},
    close: async () => {},
  };
  const res = await get(createApp({ config: testConfig(), mongo: failing, write: logs.write }), "/api/v1/internal/appeals/some-appeal");
  assert.equal(res.status, 500);
  const text = await res.text();
  assert.deepEqual(JSON.parse(text).error.code, "INTERNAL_ERROR");
  for (const leak of ["Cannot read", "node_modules", "p4ss", "stack", "TypeError"]) assert.ok(!text.includes(leak), `response leaked "${leak}"`);
  assert.ok(logs.text().includes("TypeError"), "the details belong in the log");
  assert.ok(!logs.text().includes("p4ss"), "but never the credential");
});

test("a database outage is 503, never 500", async () => {
  const res = await get(createApp({ config: testConfig(), mongo: downMongo(), write: () => {} }), "/api/v1/internal/appeals/some-appeal");
  assert.equal(res.status, 503);
  const text = await res.text();
  assert.equal(JSON.parse(text).error.code, "SERVICE_UNAVAILABLE");
  assert.ok(!text.includes("secret") && !text.includes("db.internal"));
});

test("with no database configured, database routes are 503", async () => {
  const res = await get(app(), "/api/v1/internal/appeals/some-appeal");
  assert.equal(res.status, 503);
});

/* ---------------- Headers ---------------- */

test("every response has the API security headers and no-store", async () => {
  for (const path of ["/api/v1/health", "/missing"]) {
    const res = await get(app(), path);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("x-frame-options"), "DENY");
    assert.equal(res.headers.get("content-security-policy"), "default-src 'none'; frame-ancestors 'none'");
    assert.equal(res.headers.get("referrer-policy"), "no-referrer");
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.match(res.headers.get("content-type")!, /^application\/json/);
  }
});

/* ---------------- CORS ---------------- */

test("CORS allows the configured origins only, and never *", async () => {
  const allowed = await get(app(), "/api/v1/health", { headers: { Origin: "https://admin.example" } });
  assert.equal(allowed.headers.get("access-control-allow-origin"), "https://admin.example");
  assert.equal(allowed.headers.get("access-control-expose-headers"), "X-Request-Id, Retry-After");
  assert.equal(allowed.headers.get("access-control-allow-credentials"), "true");
  const other = await get(app(), "/api/v1/health", { headers: { Origin: "https://evil.example" } });
  assert.equal(other.headers.get("access-control-allow-origin"), null);
  assert.equal(other.headers.get("access-control-allow-credentials"), null, "credentials never for an unlisted origin");
  assert.equal(other.headers.get("vary"), "Origin");
});

test("preflight succeeds for an allowed origin and is refused for any other", async () => {
  const preflight = (origin: string) =>
    get(app(), "/api/v1/health", { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "GET" } });
  const yes = await preflight("https://site.example");
  assert.equal(yes.status, 204);
  assert.equal(yes.headers.get("access-control-allow-origin"), "https://site.example");
  assert.equal(yes.headers.get("access-control-allow-methods"), "GET, OPTIONS");
  const no = await preflight("https://evil.example");
  assert.equal(no.status, 403);
  assert.equal(no.headers.get("access-control-allow-origin"), null);
});

/* ---------------- Bodies ---------------- */

test("a request declaring an oversized body is refused before routing", async () => {
  const res = await get(app(), "/api/v1/health", { headers: { "Content-Length": String(10 * 1024 * 1024) } });
  assert.equal(res.status, 413);
  assert.equal((await jsonOf(res)).error.code, "PAYLOAD_TOO_LARGE");
});

test("readJson: JSON only, within its limit, parsed", async () => {
  const req = (body: string, type = "application/json") =>
    new Request("http://api.test/x", { method: "POST", headers: { "Content-Type": type }, body });
  assert.deepEqual(await readJson(req('{"a":1}')), { a: 1 });
  const code = async (p: Promise<unknown>) => ((await p.catch((e) => e)) as ApiError).code;
  assert.equal(await code(readJson(req("a=1", "application/x-www-form-urlencoded"))), "UNSUPPORTED_MEDIA_TYPE");
  assert.equal(await code(readJson(req("{not json"))), "BAD_REQUEST");
  assert.equal(await code(readJson(req("   "))), "BAD_REQUEST");
  assert.equal(await code(readJson(req(JSON.stringify({ a: "x".repeat(200) })), 100)), "PAYLOAD_TOO_LARGE");
  // An optional body (M14: POST /api/v1/publish): none, or empty, is undefined; anything else is checked as ever.
  assert.equal(await readJson(new Request("http://api.test/x", { method: "POST" }), 100, { optional: true }), undefined);
  // A Node adapter gives every POST a body stream: an empty one, untyped, is still "no body".
  const untyped = (b: string) => new Request("http://api.test/x", { method: "POST", body: new Blob([b]).stream(), duplex: "half" } as RequestInit);
  const emptyStream = untyped("");
  emptyStream.headers.delete("content-type");
  assert.equal(await readJson(emptyStream, 100, { optional: true }), undefined);
  const textStream = untyped('{"a":1}');
  textStream.headers.delete("content-type");
  assert.equal(await code(readJson(textStream, 100, { optional: true })), "UNSUPPORTED_MEDIA_TYPE", "a body still needs its JSON type");
  assert.equal(await readJson(req("  "), 100, { optional: true }), undefined);
  assert.deepEqual(await readJson(req('{"a":1}'), 100, { optional: true }), { a: 1 });
  assert.equal(await code(readJson(req("{not json"), 100, { optional: true })), "BAD_REQUEST");
  assert.equal(await code(readJson(req("a=1", "text/plain"), 100, { optional: true })), "UNSUPPORTED_MEDIA_TYPE");
});

/* ---------------- Configuration ---------------- */

test("an invalid configuration keeps liveness up and turns everything else away", async () => {
  const logs = captureLogs();
  const broken = createApp({ env: { NODE_ENV: "production", MONGODB_URI: "mongodb://u:hidden-pass@h/" }, write: logs.write });
  assert.equal((await get(broken, "/api/v1/health/live")).status, 200);
  const res = await get(broken, "/api/v1/internal/appeals/some-appeal");
  assert.equal(res.status, 503);
  assert.ok(!(await res.text()).includes("ORGANIZATION_ID"), "configuration details are not for the public");
  assert.ok(logs.text().includes("ORGANIZATION_ID"), "but they are logged, by name");
  assert.ok(!logs.text().includes("hidden-pass"));
});

test("every request is logged once with method, path, status and duration — no query string", async () => {
  const logs = captureLogs();
  await get(createApp({ config: testConfig(), mongo: null, write: logs.write }), "/api/v1/health?email=someone@example.org");
  const entry = JSON.parse(logs.lines.find((l) => l.includes('"msg":"request"'))!);
  assert.equal(entry.method, "GET");
  assert.equal(entry.path, "/api/v1/health");
  assert.equal(entry.status, 200);
  assert.equal(typeof entry.durationMs, "number");
  assert.ok(entry.requestId);
  assert.ok(!logs.text().includes("someone@example.org"));
});
