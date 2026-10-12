import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.ts";
import { vercelHandlers } from "../src/vercelHandlers.ts";
import { captureLogs, jsonOf, testConfig } from "./helpers.ts";

/* The Vercel Function entry (src/vercel.ts → vercelHandlers). vercel.json
   rewrites every path to the one function; Vercel hands it the request as
   the client made it — the original URL, path and method — so each route
   keeps its own path and method. These tests drive the very handlers
   Vercel calls, with the requests Vercel passes. */

const ORIGIN = "https://api.risingbeyondborders.org";
const call = (handlers: ReturnType<typeof vercelHandlers>, method: keyof ReturnType<typeof vercelHandlers>, path: string, init: RequestInit = {}) =>
  handlers[method](new Request(`${ORIGIN}${path}`, { method, ...init }));

test("every method Vercel calls is one handler over the app", () => {
  const handlers = vercelHandlers(createApp({ config: testConfig(), mongo: null, write: () => {} }));
  assert.deepEqual(Object.keys(handlers).sort(), ["DELETE", "GET", "OPTIONS", "PATCH", "POST", "PUT"]);
  assert.equal(new Set(Object.values(handlers)).size, 1);
});

test("health: /api/v1/health and its live and ready routes answer on their own paths", async () => {
  const handlers = vercelHandlers(createApp({ config: testConfig(), mongo: null, write: () => {} }));
  const live = await call(handlers, "GET", "/api/v1/health");
  assert.equal(live.status, 200);
  assert.deepEqual(await jsonOf(live), { data: { status: "ok" } });
  assert.equal((await call(handlers, "GET", "/api/v1/health/live")).status, 200);
  assert.equal((await call(handlers, "GET", "/health")).status, 200);
  const ready = await call(handlers, "GET", "/api/v1/health/ready");
  assert.equal(ready.status, 503, "no database in this test: the readiness route itself answers");
  assert.equal((await jsonOf(ready)).data.configuration, "ok");
});

test("the public snapshot: /api/v1/public/snapshot and /:version reach their handler — never 'route not found'", async () => {
  /* No database here, so the handler answers that it is unavailable: proof the route matched. */
  const handlers = vercelHandlers(createApp({ config: testConfig(), mongo: null, write: () => {} }));
  for (const path of ["/api/v1/public/snapshot", "/api/v1/public/snapshot/4", "/api/v1/public/snapshot?fresh=1"]) {
    const res = await call(handlers, "GET", path);
    const body = await jsonOf(res);
    assert.equal(res.status, 503, path);
    assert.equal(body.error.code, "SERVICE_UNAVAILABLE", path);
    assert.match(body.error.message, /database is not configured/, `${path}: the snapshot handler, not the router`);
  }
  /* Methods keep their meaning: the route is GET only. */
  const post = await call(handlers, "POST", "/api/v1/public/snapshot", { headers: { origin: "https://site.example" } });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("allow"), "GET");
  /* A path no route has is still a 404 — the configured app's router is unchanged. */
  const unknown = await call(handlers, "GET", "/api/v1/public/no-such-route");
  assert.equal(unknown.status, 404);
  assert.match((await jsonOf(unknown)).error.message, /route was not found/);
  /* The rewrite's own destination is not a route: the app never relies on it. */
  assert.equal((await call(handlers, "GET", "/api")).status, 404);
});

test("the client address Vercel's edge recorded (x-real-ip) reaches the app", async () => {
  const seen: (string | null | undefined)[] = [];
  const handlers = vercelHandlers({ handle: async (_request, info) => (seen.push(info?.clientIp), new Response(null, { status: 204 })) });
  await call(handlers, "GET", "/api/v1/health", { headers: { "x-real-ip": "203.0.113.7" } });
  await call(handlers, "GET", "/api/v1/health");
  assert.deepEqual(seen, ["203.0.113.7", null]);
});

test("an invalid configuration (the production database without RBB_TARGET): liveness up, readiness says why, every other route 503 — not a misleading 404", async () => {
  const logs = captureLogs();
  const broken = vercelHandlers(
    createApp({ env: { NODE_ENV: "production", MONGODB_URI: "mongodb://u:hidden-pass@h/", MONGODB_DB: "risingbeyondborders", ORGANIZATION_ID: "rbb" }, write: logs.write })
  );
  assert.equal((await call(broken, "GET", "/api/v1/health")).status, 200);
  const ready = await call(broken, "GET", "/api/v1/health/ready");
  assert.equal(ready.status, 503);
  assert.equal((await jsonOf(ready)).data.configuration, "invalid");
  for (const path of ["/api/v1/public/snapshot", "/api/v1/settings", "/api/v1/auth/me", "/api/v1/anything-at-all"]) {
    const res = await call(broken, "GET", path);
    assert.equal(res.status, 503, path);
    const text = await res.text();
    assert.ok(!/route was not found/.test(text), `${path}: not "route not found"`);
    assert.ok(!text.includes("RBB_TARGET") && !text.includes("hidden-pass"), "configuration details are not for the public");
  }
  const preflight = await call(broken, "OPTIONS", "/api/v1/public/snapshot", { headers: { origin: "https://site.example", "access-control-request-method": "GET" } });
  assert.equal(preflight.status, 503);
  assert.ok(logs.text().includes("RBB_TARGET"), "the reason is logged, by name");
  assert.ok(!logs.text().includes("hidden-pass"));
});
