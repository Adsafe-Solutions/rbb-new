import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.ts";
import { sanitizeMetadata } from "../src/modules/audit/audit.ts";
import { BootstrapRefused, bootstrapOwner } from "../src/modules/auth/bootstrap.ts";
import { clearedSessionCookie, readCookie, sessionCookie } from "../src/modules/auth/cookies.ts";
import { DEFAULT_SCRYPT, hashPassword, verifyPassword } from "../src/modules/auth/password.ts";
import { ROLE_PERMISSIONS, can, permissionsFor, requireAuth, requirePermission, requireRole } from "../src/modules/auth/permissions.ts";
import { LOGIN_LIMITS } from "../src/modules/auth/throttle.ts";
import { hashToken, looksLikeToken, newSessionToken } from "../src/modules/auth/tokens.ts";
import { PERMISSIONS, normalizeEmail, type AuthContext } from "../src/modules/auth/types.ts";
import type { ApiError } from "../src/errors.ts";
import { CHEAP_SCRYPT, addMember, clock, memoryAuth, memoryAuthStores, memoryData } from "./auth/memory.ts";
import { get, jsonOf, testConfig } from "./helpers.ts";

const request = { requestId: "req-test-0001", clientIp: "203.0.113.7", userAgent: "node-test" };
const codeOf = async (p: Promise<unknown>) => ((await p.catch((e) => e)) as ApiError).code;
const PASSWORD = "correct horse battery staple";

/* ---------------- Email, passwords, tokens, cookies ---------------- */

test("emails are normalised consistently", () => {
  assert.equal(normalizeEmail("  Jo.Smith@Example.ORG "), "jo.smith@example.org");
  assert.equal(normalizeEmail("ＪＯ@example.org"), "jo@example.org", "full-width letters fold (NFKC)");
});

test("passwords: scrypt, unique salt, verify right / reject wrong / reject malformed", async () => {
  const a = await hashPassword(PASSWORD, CHEAP_SCRYPT);
  const b = await hashPassword(PASSWORD, CHEAP_SCRYPT);
  assert.match(a, /^scrypt\$1024\$8\$1\$[\w-]{22}\$[\w-]{86}$/);
  assert.notEqual(a, b, "every hash has its own salt");
  assert.ok(!a.includes(PASSWORD));
  assert.equal(await verifyPassword(PASSWORD, a), true);
  assert.equal(await verifyPassword("wrong password", a), false);
  for (const bad of ["", "plain", "scrypt$1$2$3", "md5$abc", "scrypt$x$8$1$abc$def", a.slice(0, -4)]) assert.equal(await verifyPassword(PASSWORD, bad), false);
});

test("the production hashing parameters are OWASP's scrypt baseline and work", async () => {
  assert.deepEqual(DEFAULT_SCRYPT, { N: 2 ** 17, r: 8, p: 1 });
  const hash = await hashPassword(PASSWORD);
  assert.ok(hash.startsWith("scrypt$131072$8$1$"));
  assert.equal(await verifyPassword(PASSWORD, hash), true);
});

test("session tokens are 256-bit random, and only their hash is a lookup key", () => {
  const tokens = new Set(Array.from({ length: 200 }, newSessionToken));
  assert.equal(tokens.size, 200);
  const token = [...tokens][0]!;
  assert.ok(looksLikeToken(token));
  assert.equal(token.length, 43);
  assert.match(hashToken(token), /^[0-9a-f]{64}$/);
  assert.equal(hashToken(token), hashToken(token));
  assert.notEqual(hashToken(token), token);
  for (const bad of ["", "short", "x".repeat(43) + "!", "a b"]) assert.equal(looksLikeToken(bad), false);
});

test("the session cookie is HttpOnly, SameSite, Path=/, host-only; Secure when configured", () => {
  const base = testConfig().auth.cookie;
  const dev = sessionCookie(base, "TOKEN", 3600);
  assert.match(dev, /^cms_session=TOKEN; Path=\/; Max-Age=3600; HttpOnly; SameSite=Strict$/);
  assert.ok(!/Domain=/i.test(dev));
  assert.match(sessionCookie({ ...base, secure: true }, "TOKEN", 60), /; HttpOnly; Secure; SameSite=Strict$/);
  assert.match(clearedSessionCookie(base), /^cms_session=; Path=\/; Max-Age=0; HttpOnly/);
  assert.equal(readCookie("a=1; cms_session=abc; b=2", "cms_session"), "abc");
  assert.equal(readCookie("cms_session_other=abc", "cms_session"), null);
  assert.equal(readCookie(null, "cms_session"), null);
});

/* ---------------- RBAC ---------------- */

test("OWNER has every permission; EDITOR only editorial ones", () => {
  assert.deepEqual([...permissionsFor("OWNER")].sort(), [...PERMISSIONS].sort());
  const editor = permissionsFor("EDITOR");
  for (const p of ["users:read", "users:write", "settings:write", "publish:execute"] as const) assert.ok(!editor.includes(p), `EDITOR must not have ${p}`);
  for (const p of ["content:read", "content:create", "content:update", "content:delete", "media:write", "appeals:write", "settings:read"] as const)
    assert.ok(editor.includes(p), `EDITOR needs ${p}`);
  assert.ok(editor.every((p) => ROLE_PERMISSIONS.OWNER.includes(p)), "EDITOR is a subset of OWNER");
});

test("guards: 401 without a session, 403 without the permission or role", () => {
  const editor = { permissions: permissionsFor("EDITOR"), membership: { role: "EDITOR" } } as unknown as AuthContext;
  const owner = { permissions: permissionsFor("OWNER"), membership: { role: "OWNER" } } as unknown as AuthContext;
  assert.throws(() => requireAuth(null), (e: ApiError) => e.code === "UNAUTHENTICATED");
  assert.throws(() => requirePermission(editor, "users:write"), (e: ApiError) => e.code === "FORBIDDEN");
  assert.equal(requirePermission(owner, "users:write"), owner);
  assert.throws(() => requireRole(editor, "OWNER"), (e: ApiError) => e.code === "FORBIDDEN");
  assert.equal(can(null, "content:read"), false);
});

/* ---------------- Login and sessions (in-memory stores) ---------------- */

const setup = async () => {
  const data = memoryData();
  const time = clock();
  const a = memoryAuth(data, "org-a", time.now);
  const storesA = memoryAuthStores(data, "org-a");
  const owner = await addMember(storesA, { orgId: "org-a", email: "Owner@Example.org", password: PASSWORD, role: "OWNER" });
  return { data, time, a, storesA, owner };
};

test("login: a session with only a token HASH stored, and a view without secrets", async () => {
  const { data, a, owner } = await setup();
  const { token, view, maxAgeSeconds } = await a.service.login({ email: " owner@example.ORG ", password: PASSWORD }, request);
  assert.ok(looksLikeToken(token));
  assert.equal(maxAgeSeconds, 7 * 24 * 3600);
  assert.equal(view.user.id, owner.id);
  assert.equal(view.membership.role, "OWNER");
  const text = JSON.stringify(view);
  for (const leak of [token, hashToken(token), "passwordHash", owner.passwordHash, "scrypt$"]) assert.ok(!text.includes(leak), `view leaked ${leak.slice(0, 12)}`);
  assert.equal(data.sessions.length, 1);
  assert.equal(data.sessions[0]!.tokenHash, hashToken(token));
  assert.ok(!JSON.stringify(data.sessions).includes(token), "the raw token is never stored");
});

test("every login failure is the same 401 — unknown email, wrong password, disabled user or membership", async () => {
  const { a, storesA } = await setup();
  await addMember(storesA, { orgId: "org-a", email: "off@example.org", password: PASSWORD, userStatus: "disabled" });
  await addMember(storesA, { orgId: "org-a", email: "gone@example.org", password: PASSWORD, membershipStatus: "disabled" });
  const attempts = [
    { email: "nobody@example.org", password: PASSWORD },
    { email: "owner@example.org", password: "wrong password!" },
    { email: "off@example.org", password: PASSWORD },
    { email: "gone@example.org", password: PASSWORD },
  ];
  const errors = await Promise.all(attempts.map((input, i) => a.service.login(input, { ...request, clientIp: `198.51.100.${i}` }).catch((e) => e)));
  for (const error of errors) {
    assert.equal(error.code, "UNAUTHENTICATED");
    assert.equal(error.message, "Email or password is incorrect.");
  }
});

test("malformed login input is a validation error that echoes nothing", async () => {
  const { a } = await setup();
  for (const input of [null, {}, { email: "x" }, { email: "a@b.c", password: "" }, { email: "a@b.c", password: "p", orgId: "org-b" }]) {
    const error = await a.service.login(input, request).catch((e) => e);
    assert.equal(error.code, "VALIDATION_ERROR", JSON.stringify(input));
  }
});

test("a session resolves until it is revoked or expires", async () => {
  const { time, a } = await setup();
  const { token } = await a.service.login({ email: "owner@example.org", password: PASSWORD }, request);
  const auth = await a.service.resolveSession(token);
  assert.equal(auth?.membership.role, "OWNER");
  assert.equal(await a.service.resolveSession("x".repeat(43)), null, "unknown token");
  assert.equal(await a.service.resolveSession("not a token"), null, "malformed token");
  assert.equal(await a.service.resolveSession(null), null);

  time.advance(7 * 24 * 3600 * 1000 - 1000);
  assert.ok(await a.service.resolveSession(token), "still valid just before the absolute lifetime");
  time.advance(2000);
  assert.equal(await a.service.resolveSession(token), null, "expired");
});

test("logout revokes server-side; the old token no longer works; logout again is harmless", async () => {
  const { data, a } = await setup();
  const { token } = await a.service.login({ email: "owner@example.org", password: PASSWORD }, request);
  const auth = await a.service.resolveSession(token);
  await a.service.logout(auth, request);
  assert.ok(data.sessions[0]!.revokedAt);
  assert.equal(await a.service.resolveSession(token), null);
  await a.service.logout(null, request);
});

test("disabling a user or membership ends their existing sessions immediately", async () => {
  const { data, a } = await setup();
  const { token } = await a.service.login({ email: "owner@example.org", password: PASSWORD }, request);
  data.users[0]!.status = "disabled";
  assert.equal(await a.service.resolveSession(token), null);
  data.users[0]!.status = "active";
  data.memberships[0]!.status = "disabled";
  assert.equal(await a.service.resolveSession(token), null);
});

test("lastSeenAt is written at most every 5 minutes", async () => {
  const { data, time, a } = await setup();
  const { token } = await a.service.login({ email: "owner@example.org", password: PASSWORD }, request);
  const first = data.sessions[0]!.lastSeenAt;
  time.advance(60_000);
  await a.service.resolveSession(token);
  assert.equal(data.sessions[0]!.lastSeenAt, first, "no write after one minute");
  time.advance(5 * 60_000);
  await a.service.resolveSession(token);
  assert.notEqual(data.sessions[0]!.lastSeenAt, first);
});

test("organization isolation: another organization's session, user or id gets nothing", async () => {
  const { data, time } = await setup();
  const b = memoryAuth(data, "org-b", time.now);
  const storesB = memoryAuthStores(data, "org-b");
  await addMember(storesB, { orgId: "org-b", email: "owner@example.org", password: "org b's own password", role: "OWNER" });
  const a = memoryAuth(data, "org-a", time.now);

  const { token: tokenB } = await b.service.login({ email: "owner@example.org", password: "org b's own password" }, request);
  assert.equal(await a.service.resolveSession(tokenB), null, "org-b's session does not exist for org-a");
  assert.equal(await codeOf(a.service.login({ email: "owner@example.org", password: "org b's own password" }, request)), "UNAUTHENTICATED");

  const { token: tokenA } = await a.service.login({ email: "owner@example.org", password: PASSWORD }, request);
  const authA = (await a.service.resolveSession(tokenA))!;
  const sessionB = data.sessions.find((s) => s.orgId === "org-b")!;
  assert.equal(await codeOf(a.service.revokeSession(authA, sessionB.id, request)), "NOT_FOUND");
  assert.equal(sessionB.revokedAt, null);
});

test("revoking: your own session always; another member's only with users:write", async () => {
  const { data, a, storesA } = await setup();
  await addMember(storesA, { orgId: "org-a", email: "editor@example.org", password: PASSWORD, role: "EDITOR" });
  const owner = (await a.service.resolveSession((await a.service.login({ email: "owner@example.org", password: PASSWORD }, request)).token))!;
  const editorToken = (await a.service.login({ email: "editor@example.org", password: PASSWORD }, request)).token;
  const editor = (await a.service.resolveSession(editorToken))!;

  assert.equal(await codeOf(a.service.revokeSession(editor, owner.session.id, request)), "FORBIDDEN");
  assert.equal(data.sessions.find((s) => s.id === owner.session.id)!.revokedAt, null);
  await a.service.revokeSession(owner, editor.session.id, request);
  assert.equal(await a.service.resolveSession(editorToken), null);
  assert.deepEqual(await a.service.revokeSession(owner, owner.session.id, request), { current: true });
});

test("throttling: 5 failures lock the account for the window — even the right password", async () => {
  const { a } = await setup();
  for (let i = 0; i < LOGIN_LIMITS.perAccount; i++)
    assert.equal(await codeOf(a.service.login({ email: "owner@example.org", password: "wrong!" }, request)), "UNAUTHENTICATED");
  const error = (await a.service.login({ email: "owner@example.org", password: PASSWORD }, request).catch((e) => e)) as ApiError;
  assert.equal(error.code, "RATE_LIMITED");
  assert.ok(Number(error.headers?.["Retry-After"]) > 0);
});

test("throttling: one IP gets at most 20 attempts per window, across any accounts", async () => {
  const { a } = await setup();
  const ip = { ...request, clientIp: "192.0.2.50" };
  for (let i = 0; i < LOGIN_LIMITS.perIp; i++) await a.service.login({ email: `probe${i}@example.org`, password: "x" }, ip).catch(() => {});
  assert.equal(await codeOf(a.service.login({ email: "owner@example.org", password: PASSWORD }, ip)), "RATE_LIMITED");
  assert.equal(await codeOf(a.service.login({ email: "owner@example.org", password: PASSWORD }, { ...request, clientIp: "192.0.2.51" })), undefined);
});

/* ---------------- Audit ---------------- */

test("audit: events carry the server-resolved actor and never an email, token or password", async () => {
  const { data, a, owner } = await setup();
  const { token } = await a.service.login({ email: "owner@example.org", password: PASSWORD }, request);
  await a.service.login({ email: "owner@example.org", password: "wrong password!" }, request).catch(() => {});
  await a.service.logout(await a.service.resolveSession(token), request);

  assert.deepEqual(data.audit.map((e) => e.action), ["auth.login.success", "auth.login.failure", "auth.logout"]);
  const [success, failure] = data.audit;
  assert.equal(success!.actorUserId, owner.id);
  assert.equal(success!.requestId, "req-test-0001");
  assert.match(success!.ipHash!, /^[0-9a-f]{32}$/);
  assert.equal(failure!.actorUserId, null);
  assert.equal(failure!.metadata.reason, "invalid_credentials");
  const text = JSON.stringify(data.audit);
  for (const leak of [token, hashToken(token), PASSWORD, "wrong password!", "owner@example.org", "203.0.113.7", owner.passwordHash]) assert.ok(!text.includes(leak));
});

test("audit metadata can never persist a secret", () => {
  const clean = sanitizeMetadata({
    password: "p",
    passwordHash: "scrypt$...",
    token: "t",
    sessionToken: "t",
    cookie: "c",
    authorization: "Bearer x",
    apiKey: "k",
    nested: { secret: "s", note: "uri mongodb+srv://u:p@h/x", deep: { deeper: { deepest: 1 } } },
    list: Array.from({ length: 50 }, (_, i) => i),
    fn: () => 1,
    ok: "kept",
  }) as Record<string, unknown>;
  assert.deepEqual(Object.keys(clean).sort(), ["list", "nested", "ok"]);
  assert.deepEqual(clean.nested, { note: "uri [redacted-uri]", deep: {} });
  assert.equal((clean.list as unknown[]).length, 20);
});

/* ---------------- Bootstrap ---------------- */

test("bootstrap creates the first OWNER once, refuses after, and never stores the password", async () => {
  const data = memoryData();
  const stores = memoryAuthStores(data, "org-new");
  const { audit } = memoryAuth(data, "org-new", () => new Date());
  const input = { email: "First.Owner@Example.org", name: "First Owner", password: "a long enough password" };

  await assert.rejects(bootstrapOwner(stores, audit, { orgId: "org-new", input: { ...input, password: "short" }, scrypt: CHEAP_SCRYPT }), BootstrapRefused);
  const { userId } = await bootstrapOwner(stores, audit, { orgId: "org-new", input, scrypt: CHEAP_SCRYPT });
  assert.equal(data.memberships[0]!.role, "OWNER");
  assert.equal(data.users[0]!.id, userId);
  assert.equal(data.users[0]!.emailNormalized, "first.owner@example.org");
  assert.ok(!JSON.stringify(data).includes(input.password), "the password is stored only as a hash");
  assert.equal(data.audit[0]!.action, "auth.owner.bootstrapped");

  await assert.rejects(bootstrapOwner(stores, audit, { orgId: "org-new", input: { ...input, email: "second@example.org" }, scrypt: CHEAP_SCRYPT }), /already has an owner/);
  assert.equal(data.users.length, 1, "nothing changed on the second run");
});

/* ---------------- HTTP: CSRF and auth gates without a database ---------------- */

const noDbApp = () => createApp({ config: testConfig(), mongo: null, write: () => {} });

test("CSRF: a state-changing request without an allowed Origin is refused before anything runs", async () => {
  const post = (headers: Record<string, string>) =>
    get(noDbApp(), "/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: "{}" });
  for (const headers of [{}, { Origin: "https://evil.example" }, { Origin: "null" }] as Record<string, string>[]) {
    const res = await post(headers);
    assert.equal(res.status, 403, JSON.stringify(headers));
    assert.equal((await jsonOf(res)).error.code, "FORBIDDEN");
  }
});

test("a protected route without a session is 401 — no database needed to refuse", async () => {
  const res = await get(noDbApp(), "/api/v1/auth/me");
  assert.equal(res.status, 401);
  assert.equal((await jsonOf(res)).error.code, "UNAUTHENTICATED");
});

test("there is no registration, signup or password-reset route", async () => {
  for (const path of ["/api/v1/auth/register", "/api/v1/auth/signup", "/api/v1/auth/password-reset", "/register"])
    assert.equal((await get(noDbApp(), path, { method: "POST", headers: { Origin: "https://admin.example" } })).status, 404, path);
});
