import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createApp, type App } from "../../src/app.ts";
import { COLLECTIONS, INDEXES, ensureIndexes } from "../../src/db/collections.ts";
import { DuplicateKeyError, createMongoProvider } from "../../src/db/mongo.ts";
import { AuditService, mongoAuditStore } from "../../src/modules/audit/audit.ts";
import { bootstrapOwner } from "../../src/modules/auth/bootstrap.ts";
import { mongoAuthStores } from "../../src/modules/auth/repository.ts";
import { hashToken } from "../../src/modules/auth/tokens.ts";
import { LOGIN_LIMITS } from "../../src/modules/auth/throttle.ts";
import type { Config } from "../../src/config/env.ts";
import { CHEAP_SCRYPT, addMember, silentLog } from "../auth/memory.ts";
import { captureLogs, jsonOf, testConfig } from "../helpers.ts";
import { testMongo } from "./mongo.ts";

/* Authentication end to end over HTTP against the test database
   (MONGODB_TEST_URI; never the deployment's database). Two organizations
   share the database to prove isolation. */

const mongo = testMongo();
const ADMIN = "https://admin.example";
const PASSWORD = "a correct long password";
const logs = captureLogs();
const secrets: string[] = [PASSWORD];
const provider = createMongoProvider({ uri: mongo.uri, dbName: mongo.dbName });
const db = () => mongo.db();
const stores = (orgId: string) => mongoAuthStores(db(), orgId);

const appFor = (orgId: string, overrides: Partial<Config> = {}): App =>
  createApp({
    config: testConfig({ orgId, mongo: { uri: mongo.uri, dbName: mongo.dbName }, ...overrides }),
    mongo: provider,
    scrypt: CHEAP_SCRYPT,
    write: logs.write,
  });

const call = (app: App, path: string, init: RequestInit & { ip?: string } = {}) =>
  app.handle(new Request(`https://api.example${path}`, init), { clientIp: init.ip ?? "203.0.113.10" });

const login = (app: App, email: string, password: string, ip?: string) =>
  call(app, "/api/v1/auth/login", {
    method: "POST",
    headers: { Origin: ADMIN, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    ...(ip && { ip }),
  });

/* The session token from a login response's Set-Cookie. */
const tokenOf = (response: Response) => {
  const token = /cms_session=([^;]*)/.exec(response.headers.get("set-cookie") ?? "")?.[1] ?? "";
  if (token) secrets.push(token, hashToken(token));
  return token;
};
const withSession = (token: string, init: RequestInit = {}) => ({ ...init, headers: { Origin: ADMIN, Cookie: `cms_session=${token}`, ...(init.headers ?? {}) } });

let orgA: App;
let orgB: App;
const ids: Record<string, string> = {};

before(async () => {
  await mongo.connect();
  await ensureIndexes(db());
  orgA = appFor("org-a");
  orgB = appFor("org-b");
  for (const [orgId, email, role] of [
    ["org-a", "owner@a.example", "OWNER"],
    ["org-a", "editor@a.example", "EDITOR"],
    ["org-b", "owner@b.example", "OWNER"],
  ] as const) {
    const user = await addMember(stores(orgId), { orgId, email, password: PASSWORD, role });
    ids[email] = user.id;
    secrets.push(user.passwordHash);
  }
  await addMember(stores("org-a"), { orgId: "org-a", email: "disabled@a.example", password: PASSWORD, userStatus: "disabled" });
  await addMember(stores("org-a"), { orgId: "org-a", email: "nomember@a.example", password: PASSWORD, membershipStatus: "disabled" });
});

after(async () => {
  await provider.close();
  await mongo.cleanup();
});

test("indexes: every auth index exists, including the TTL ones, and creation is idempotent", async () => {
  await ensureIndexes(db());
  for (const key of ["users", "memberships", "sessions", "auditLogs", "authThrottle"] as const) {
    const existing = await db().collection(COLLECTIONS[key]).indexes();
    for (const spec of INDEXES[key]) {
      const found = existing.find((i) => i.name === spec.name);
      assert.ok(found, `${COLLECTIONS[key]}.${spec.name}`);
      if (spec.unique) assert.equal(found.unique, true);
      if (spec.expireAfterSeconds !== undefined) assert.equal(found.expireAfterSeconds, 0);
    }
  }
});

test("duplicates: one account per email per organization, one membership per user", async () => {
  await assert.rejects(addMember(stores("org-a"), { orgId: "org-a", email: "OWNER@a.example", password: PASSWORD }), DuplicateKeyError);
  await addMember(stores("org-b"), { orgId: "org-b", email: "owner@a.example", password: PASSWORD }); // same email, other org: allowed
  const membership = { id: crypto.randomUUID(), orgId: "org-a", userId: ids["owner@a.example"]!, role: "EDITOR" as const, status: "active" as const, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), revision: 1 };
  await assert.rejects(stores("org-a").memberships.insert(membership), (e: DuplicateKeyError) => e.field === "userId");
});

test("login → HttpOnly cookie, safe body, session stored by token hash only", async () => {
  const res = await login(orgA, "Owner@A.example", PASSWORD);
  assert.equal(res.status, 200);
  const cookie = res.headers.get("set-cookie")!;
  assert.match(cookie, /^cms_session=[\w-]{43}; Path=\/; Max-Age=604800; HttpOnly; SameSite=Strict$/);
  const token = tokenOf(res);
  const body = await res.text();
  for (const leak of secrets) assert.ok(!body.includes(leak), "response leaked a secret");
  assert.ok(!/passwordHash|tokenHash|_id|revision/.test(body));
  const { data } = JSON.parse(body);
  assert.deepEqual(Object.keys(data).sort(), ["membership", "organization", "permissions", "session", "user"]);
  assert.equal(data.organization.id, "org-a");

  const stored = await db().collection(COLLECTIONS.sessions).findOne({ tokenHash: hashToken(token) });
  assert.ok(stored, "session stored under the token's hash");
  assert.equal(await db().collection(COLLECTIONS.sessions).countDocuments({ tokenHash: token }), 0, "never under the raw token");
  assert.ok(stored.expiresAt instanceof Date);
});

test("/auth/me with the cookie; 401 without it, with garbage, or after logout", async () => {
  const token = tokenOf(await login(orgA, "editor@a.example", PASSWORD));
  const me = await call(orgA, "/api/v1/auth/me", withSession(token));
  assert.equal(me.status, 200);
  const { data } = await jsonOf(me);
  assert.equal(data.user.email, "editor@a.example");
  assert.equal(data.membership.role, "EDITOR");
  assert.ok(!data.permissions.includes("users:write"));

  assert.equal((await call(orgA, "/api/v1/auth/me")).status, 401);
  assert.equal((await call(orgA, "/api/v1/auth/me", withSession("A".repeat(43)))).status, 401);

  const out = await call(orgA, "/api/v1/auth/logout", withSession(token, { method: "POST" }));
  assert.equal(out.status, 200);
  assert.match(out.headers.get("set-cookie")!, /^cms_session=; Path=\/; Max-Age=0; HttpOnly/);
  assert.equal((await call(orgA, "/api/v1/auth/me", withSession(token))).status, 401, "revoked server-side");
  assert.equal((await call(orgA, "/api/v1/auth/logout", withSession(token, { method: "POST" }))).status, 200, "idempotent");
  assert.equal((await call(orgA, "/api/v1/auth/logout", { method: "POST", headers: { Origin: ADMIN } })).status, 200, "without a session too");
});

test("an expired session is refused even before MongoDB's TTL sweep deletes it", async () => {
  const token = tokenOf(await login(orgA, "editor@a.example", PASSWORD));
  await db().collection(COLLECTIONS.sessions).updateOne({ tokenHash: hashToken(token) }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await call(orgA, "/api/v1/auth/me", withSession(token))).status, 401);
});

test("disabled users and disabled memberships cannot log in", async () => {
  for (const email of ["disabled@a.example", "nomember@a.example"]) {
    const res = await login(orgA, email, PASSWORD, `198.51.100.${email.length}`);
    assert.equal(res.status, 401);
    assert.equal((await jsonOf(res)).error.message, "Email or password is incorrect.");
    assert.equal(res.headers.get("set-cookie"), null);
  }
});

test("OWNER may revoke another member's session; EDITOR may not", async () => {
  const ownerToken = tokenOf(await login(orgA, "owner@a.example", PASSWORD));
  const editorToken = tokenOf(await login(orgA, "editor@a.example", PASSWORD));
  const ownerSession = (await jsonOf(await call(orgA, "/api/v1/auth/me", withSession(ownerToken)))).data.session.id;
  const editorSession = (await jsonOf(await call(orgA, "/api/v1/auth/me", withSession(editorToken)))).data.session.id;

  const denied = await call(orgA, `/api/v1/auth/sessions/${ownerSession}`, withSession(editorToken, { method: "DELETE" }));
  assert.equal(denied.status, 403);
  assert.equal((await call(orgA, "/api/v1/auth/me", withSession(ownerToken))).status, 200, "owner unaffected");

  const allowed = await call(orgA, `/api/v1/auth/sessions/${editorSession}`, withSession(ownerToken, { method: "DELETE" }));
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get("set-cookie"), null, "revoking someone else's session leaves your cookie alone");
  assert.equal((await call(orgA, "/api/v1/auth/me", withSession(editorToken))).status, 401);

  const list = await jsonOf(await call(orgA, "/api/v1/auth/sessions", withSession(ownerToken)));
  assert.ok(list.data.some((s: { current: boolean }) => s.current));
  assert.ok(!JSON.stringify(list).includes("tokenHash"));
});

test("cross-organization: no session, login, id, query or body crosses organizations", async () => {
  const tokenB = tokenOf(await login(orgB, "owner@b.example", PASSWORD));
  assert.equal((await call(orgB, "/api/v1/auth/me", withSession(tokenB))).status, 200);
  assert.equal((await call(orgA, "/api/v1/auth/me", withSession(tokenB))).status, 401, "org-b's cookie means nothing to org-a");
  assert.equal((await login(orgA, "owner@b.example", PASSWORD)).status, 401, "org-b's account cannot log into org-a");

  const sessionB = (await jsonOf(await call(orgB, "/api/v1/auth/me", withSession(tokenB)))).data.session.id;
  const tokenA = tokenOf(await login(orgA, "owner@a.example", PASSWORD));
  assert.equal((await call(orgA, `/api/v1/auth/sessions/${sessionB}`, withSession(tokenA, { method: "DELETE" }))).status, 404, "an OWNER of org-a cannot touch org-b");
  assert.equal((await call(orgB, "/api/v1/auth/me", withSession(tokenB))).status, 200, "org-b's session survives");

  const me = await jsonOf(await call(orgA, "/api/v1/auth/me?orgId=org-b", withSession(tokenA)));
  assert.equal(me.data.organization.id, "org-a", "a query orgId changes nothing");
  const smuggled = await call(orgA, "/api/v1/auth/login", {
    method: "POST",
    headers: { Origin: ADMIN, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "owner@b.example", password: PASSWORD, orgId: "org-b" }),
  });
  assert.equal(smuggled.status, 400, "a body orgId is refused outright");
});

test("audit: login, failure, logout and revocation are persisted with request ids and no secrets", async () => {
  const entries = await mongoAuditStore(db(), "org-a").listRecent(500);
  const actions = new Set(entries.map((e) => e.action));
  for (const action of ["auth.login.success", "auth.login.failure", "auth.logout", "auth.session.revoked"]) assert.ok(actions.has(action), action);
  assert.ok(entries.every((e) => e.orgId === "org-a" && e.requestId));
  const failure = entries.find((e) => e.action === "auth.login.failure")!;
  assert.equal(failure.actorUserId, null);
  const text = JSON.stringify(entries);
  for (const leak of [...secrets, "disabled@a.example", "nomember@a.example", "203.0.113.10"]) assert.ok(!text.includes(leak), "audit leaked a secret or identifier");
  assert.equal((await mongoAuditStore(db(), "org-b").listRecent(500)).some((e) => e.orgId !== "org-b"), false);
});

test("rate limiting: the 6th attempt on one account is 429 with Retry-After, even with the right password", async () => {
  await addMember(stores("org-a"), { orgId: "org-a", email: "target@a.example", password: PASSWORD });
  for (let i = 0; i < LOGIN_LIMITS.perAccount; i++) assert.equal((await login(orgA, "target@a.example", "wrong password", `192.0.2.${i}`)).status, 401);
  const blocked = await login(orgA, "target@a.example", PASSWORD, "192.0.2.99");
  assert.equal(blocked.status, 429);
  assert.equal((await jsonOf(blocked)).error.code, "RATE_LIMITED");
  assert.ok(Number(blocked.headers.get("retry-after")) > 0);
  assert.ok(await db().collection(COLLECTIONS.authThrottle).countDocuments({ orgId: "org-a" }) > 0);
  assert.equal(await db().collection(COLLECTIONS.authThrottle).countDocuments({ _id: { $regex: "target" } } as never), 0, "no email in throttle keys");
});

test("rate limiting: one IP is cut off after 20 attempts across accounts", async () => {
  for (let i = 0; i < LOGIN_LIMITS.perIp; i++) await login(orgA, `nobody${i}@a.example`, "x", "192.0.2.200");
  assert.equal((await login(orgA, "owner@a.example", PASSWORD, "192.0.2.200")).status, 429);
  assert.equal((await login(orgA, "owner@a.example", PASSWORD, "192.0.2.201")).status, 200, "other addresses unaffected");
});

test("production cookies are Secure", async () => {
  const base = testConfig().auth;
  const prod = appFor("org-a", { auth: { ...base, cookie: { ...base.cookie, secure: true } } });
  const res = await login(prod, "owner@a.example", PASSWORD, "192.0.2.150");
  assert.match(res.headers.get("set-cookie")!, /; HttpOnly; Secure; SameSite=Strict$/);
  tokenOf(res);
});

test("CSRF/CORS: only the configured origin gets credentials; others are refused", async () => {
  const token = tokenOf(await login(orgA, "owner@a.example", PASSWORD));
  const evil = await call(orgA, "/api/v1/auth/logout", { method: "POST", headers: { Origin: "https://evil.example", Cookie: `cms_session=${token}` } });
  assert.equal(evil.status, 403, "a cross-site logout is refused");
  assert.equal((await call(orgA, "/api/v1/auth/me", withSession(token))).status, 200, "and the session survives it");
  const readable = await call(orgA, "/api/v1/auth/me", withSession(token));
  assert.equal(readable.headers.get("access-control-allow-origin"), ADMIN);
  assert.equal(readable.headers.get("access-control-allow-credentials"), "true");
  const preflight = await call(orgA, "/api/v1/auth/login", { method: "OPTIONS", headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "POST" } });
  assert.equal(preflight.status, 403);
});

test("malformed auth requests get safe errors", async () => {
  const post = (body: string, type = "application/json") => call(orgA, "/api/v1/auth/login", { method: "POST", headers: { Origin: ADMIN, "Content-Type": type }, body });
  assert.equal((await post("{not json")).status, 400);
  assert.equal((await post("email=a&password=b", "application/x-www-form-urlencoded")).status, 415);
  assert.equal((await post(JSON.stringify({ email: "a@b.c", password: "x".repeat(5000) }))).status, 413);
  const invalid = await jsonOf(await post(JSON.stringify({ email: 1, password: [] })));
  assert.equal(invalid.error.code, "VALIDATION_ERROR");
  assert.equal((await call(orgA, "/api/v1/auth/sessions/not-a-uuid", withSession("x".repeat(43), { method: "DELETE" }))).status, 401);
});

test("bootstrap against MongoDB: the first owner once, then refusal", async () => {
  const audit = new AuditService(mongoAuditStore(db(), "org-fresh"), { orgId: "org-fresh", secret: "test-only-auth-secret-0123456789abcdef", log: silentLog });
  const input = { email: "first@fresh.example", name: "First Owner", password: "a long enough password" };
  await bootstrapOwner(stores("org-fresh"), audit, { orgId: "org-fresh", input, scrypt: CHEAP_SCRYPT });
  await assert.rejects(bootstrapOwner(stores("org-fresh"), audit, { orgId: "org-fresh", input: { ...input, email: "again@fresh.example" }, scrypt: CHEAP_SCRYPT }), /already has an owner/);
  assert.equal(await db().collection(COLLECTIONS.memberships).countDocuments({ orgId: "org-fresh", role: "OWNER" }), 1);
  const fresh = appFor("org-fresh");
  assert.equal((await login(fresh, "first@fresh.example", "a long enough password", "192.0.2.160")).status, 200);
  assert.ok((await mongoAuditStore(db(), "org-fresh").listRecent(10)).some((e) => e.action === "auth.owner.bootstrapped"));
});

test("logs never contain a password, token, token hash or password hash", () => {
  const text = logs.text();
  assert.ok(text.length > 0);
  for (const secret of secrets) assert.ok(!text.includes(secret), "a secret reached the log");
  assert.ok(!/scrypt\$/.test(text));
});
