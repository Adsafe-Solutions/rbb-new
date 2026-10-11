import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createApp, type App } from "../../src/app.ts";
import { COLLECTIONS, INDEXES, ensureIndexes } from "../../src/db/collections.ts";
import { createMongoProvider } from "../../src/db/mongo.ts";
import { mongoAuthStores } from "../../src/modules/auth/repository.ts";
import { INVALID_SETUP_LINK } from "../../src/modules/auth/service.ts";
import { LOGIN_LIMITS } from "../../src/modules/auth/throttle.ts";
import { hashToken } from "../../src/modules/auth/tokens.ts";
import { CHEAP_SCRYPT, addMember } from "../auth/memory.ts";
import { captureLogs, jsonOf, testConfig } from "../helpers.ts";
import { testMongo } from "./mongo.ts";

/* M17.2 setup links and password change end to end over HTTP against the
   dedicated test database (MONGODB_TEST_URI + MONGODB_TEST_DB; never the
   application's). Real sessions, cookies, CSRF, throttling and MongoDB's
   atomic consume; two organizations prove isolation. */

const mongo = testMongo();
const ADMIN = "https://admin.example";
const PASSWORD = "an existing long password";
const logs = captureLogs();
const secrets: string[] = [PASSWORD];
const provider = createMongoProvider({ uri: mongo.uri, dbName: mongo.dbName });
const db = () => mongo.db();
const stores = (orgId: string) => mongoAuthStores(db(), orgId);

const appFor = (orgId: string): App =>
  createApp({ config: testConfig({ orgId, mongo: { uri: mongo.uri, dbName: mongo.dbName } }), mongo: provider, scrypt: CHEAP_SCRYPT, write: logs.write });

let ipCounter = 0;
const nextIp = () => `198.18.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;
const call = (app: App, path: string, init: RequestInit = {}, ip = nextIp()) => app.handle(new Request(`https://api.example${path}`, init), { clientIp: ip });
const post = (app: App, path: string, body: unknown, { token, origin = ADMIN, ip }: { token?: string; origin?: string | null; ip?: string } = {}) =>
  call(app, path, { method: "POST", headers: { "Content-Type": "application/json", ...(origin && { Origin: origin }), ...(token && { Cookie: `cms_session=${token}` }) }, body: JSON.stringify(body) }, ip);
const get = (app: App, path: string, token: string) => call(app, path, { headers: { Cookie: `cms_session=${token}` } });
const cookieOf = (res: Response) => {
  const token = /cms_session=([^;]*)/.exec(res.headers.get("set-cookie") ?? "")?.[1] ?? "";
  if (token) secrets.push(token, hashToken(token));
  return token;
};

async function signIn(app: App, email: string, password = PASSWORD) {
  const res = await post(app, "/api/v1/auth/login", { email, password });
  assert.equal(res.status, 200, `login ${email}`);
  return cookieOf(res);
}

let orgA: App;
let orgB: App;
const tokens: Record<string, string> = {};

/* A member as an owner adds them (no password), plus a setup link. */
async function newcomer(email: string) {
  const created = await post(orgA, "/api/v1/members", { email, name: "New Person", role: "EDITOR" }, { token: tokens.owner });
  assert.equal(created.status, 200);
  const id = (await jsonOf(created)).data.id as string;
  const issued = await post(orgA, `/api/v1/members/${id}/setup-link`, {}, { token: tokens.owner });
  assert.equal(issued.status, 200);
  const link = (await jsonOf(issued)).data as { token: string; expiresAt: string };
  secrets.push(link.token);
  return { id, ...link };
}

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
    secrets.push(user.passwordHash);
  }
  tokens.owner = await signIn(orgA, "owner@a.example");
  tokens.editor = await signIn(orgA, "editor@a.example");
  tokens.ownerB = await signIn(orgB, "owner@b.example");
});

after(async () => {
  await provider.close();
  await mongo.cleanup();
});

test("indexes: setup links are looked up by a unique token hash and expire by TTL", async () => {
  const existing = await db().collection(COLLECTIONS.setupTokens).indexes();
  for (const spec of INDEXES.setupTokens) {
    const found = existing.find((i) => i.name === spec.name);
    assert.ok(found, spec.name);
    if (spec.unique) assert.equal(found.unique, true);
    if (spec.expireAfterSeconds !== undefined) assert.equal(found.expireAfterSeconds, 0);
  }
});

test("issue over HTTP: owners only, CSRF-checked, never cached; the database holds only the hash", async () => {
  const created = await post(orgA, "/api/v1/members", { email: "issue@a.example", name: "Issue Test", role: "EDITOR" }, { token: tokens.owner });
  const id = (await jsonOf(created)).data.id;
  const path = `/api/v1/members/${id}/setup-link`;
  assert.equal((await post(orgA, path, {}, { token: tokens.editor })).status, 403, "editors");
  assert.equal((await post(orgA, path, {})).status, 401, "no session");
  assert.equal((await post(orgA, path, {}, { token: tokens.owner, origin: null })).status, 403, "no Origin");
  assert.equal((await post(orgB, path, {}, { token: tokens.ownerB })).status, 404, "another organization's member");

  const res = await post(orgA, path, {}, { token: tokens.owner });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(res.headers.get("referrer-policy"), "no-referrer");
  const { token, expiresAt } = (await jsonOf(res)).data;
  secrets.push(token);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.ok(Date.parse(expiresAt) > Date.now() + 71 * 3600_000);
  const stored = await db().collection(COLLECTIONS.setupTokens).find({ orgId: "org-a", userId: id }).toArray();
  assert.equal(stored.length, 1);
  assert.equal(stored[0]!.tokenHash, hashToken(token));
  assert.ok(!JSON.stringify(stored).includes(token), "never the raw token");
});

test("setup over HTTP: CSRF-checked; sets the first password; single use; a generic answer for every bad link", async () => {
  const link = await newcomer("setup@a.example");
  const body = { token: link.token, password: "the member's own long password" };
  secrets.push(body.password);
  assert.equal((await post(orgA, "/api/v1/auth/setup-password", body, { origin: null })).status, 403, "no Origin");
  assert.equal((await post(orgA, "/api/v1/auth/setup-password", body, { origin: "https://evil.example" })).status, 403);

  const done = await post(orgA, "/api/v1/auth/setup-password", body);
  assert.equal(done.status, 200);
  assert.deepEqual((await jsonOf(done)).data, { passwordSet: true });
  assert.equal(done.headers.get("set-cookie"), null, "it does not sign the member in");
  const session = await signIn(orgA, "setup@a.example", body.password);
  assert.equal((await jsonOf(await get(orgA, "/api/v1/auth/me", session))).data.user.id, link.id);

  for (const bad of [body, { ...body, token: "A".repeat(43) }, { ...body, token: "nope" }]) {
    const res = await post(orgA, "/api/v1/auth/setup-password", bad);
    assert.equal(res.status, 400);
    assert.equal((await jsonOf(res)).error.message, INVALID_SETUP_LINK);
  }
  const weak = await post(orgA, "/api/v1/auth/setup-password", { token: "A".repeat(43), password: "short" });
  assert.deepEqual((await jsonOf(weak)).error.details.map((d: { path: string }) => d.path), ["password"]);
});

test("concurrency on real MongoDB: five simultaneous uses of one link — exactly one sets the password", async () => {
  const link = await newcomer("race@a.example");
  const passwords = Array.from({ length: 5 }, (_, i) => `racer number ${i} long password`);
  secrets.push(...passwords);
  const results = await Promise.all(passwords.map((password) => post(orgA, "/api/v1/auth/setup-password", { token: link.token, password })));
  const statuses = results.map((r) => r.status);
  assert.equal(statuses.filter((s) => s === 200).length, 1, `exactly one wins (${statuses})`);
  assert.ok(statuses.every((s) => s === 200 || s === 400), `${statuses}`);
  const signedIn = [];
  for (const password of passwords) signedIn.push((await post(orgA, "/api/v1/auth/login", { email: "race@a.example", password })).status);
  assert.equal(signedIn.filter((s) => s === 200).length, 1, "only the winner's password works");
  const link0 = await db().collection(COLLECTIONS.setupTokens).findOne({ orgId: "org-a", userId: link.id });
  assert.ok(link0!.usedAt instanceof Date);
});

test("expiry and organization boundary: an expired link and another organization's link are refused", async () => {
  const expired = await newcomer("expired@a.example");
  await db().collection(COLLECTIONS.setupTokens).updateOne({ orgId: "org-a", userId: expired.id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  const late = await post(orgA, "/api/v1/auth/setup-password", { token: expired.token, password: "a perfectly long password" });
  assert.equal(late.status, 400);

  const foreign = await newcomer("foreign@a.example");
  const res = await post(orgB, "/api/v1/auth/setup-password", { token: foreign.token, password: "a perfectly long password" });
  assert.equal(res.status, 400);
  assert.equal((await db().collection(COLLECTIONS.setupTokens).findOne({ orgId: "org-a", userId: foreign.id }))!.usedAt, null, "untouched");
});

test("throttling: a link refused 5 times is locked for the window (429 + Retry-After)", async () => {
  const link = await newcomer("throttle@a.example");
  const body = { token: link.token, password: "a perfectly long password" };
  assert.equal((await post(orgA, "/api/v1/auth/setup-password", body)).status, 200);
  for (let i = 0; i < LOGIN_LIMITS.perAccount; i++) assert.equal((await post(orgA, "/api/v1/auth/setup-password", body)).status, 400);
  const blocked = await post(orgA, "/api/v1/auth/setup-password", body);
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("retry-after")) > 0);
});

test("password change over HTTP: CSRF-checked; every session revoked; a fresh cookie with the remaining lifetime", async () => {
  const other = await signIn(orgA, "editor@a.example");
  const current = tokens.editor!;
  const newPassword = "the editor's new long password";
  secrets.push(newPassword);
  const body = { currentPassword: PASSWORD, newPassword };
  assert.equal((await post(orgA, "/api/v1/auth/password", body)).status, 401, "no session");
  assert.equal((await post(orgA, "/api/v1/auth/password", body, { token: current, origin: null })).status, 403, "no Origin");
  const wrong = await post(orgA, "/api/v1/auth/password", { ...body, currentPassword: "certainly not my password" }, { token: current });
  assert.equal(wrong.status, 400);
  assert.equal((await get(orgA, "/api/v1/auth/me", current)).status, 200, "a wrong current password signs nobody out");

  const before = (await jsonOf(await get(orgA, "/api/v1/auth/me", current))).data.session.expiresAt;
  const remainingBefore = (Date.parse(before) - Date.now()) / 1000; // measured BEFORE the (slow) request
  const res = await post(orgA, "/api/v1/auth/password", body, { token: current });
  assert.equal(res.status, 200);
  const fresh = cookieOf(res);
  assert.ok(fresh && fresh !== current);
  const maxAge = Number(/Max-Age=(\d+)/.exec(res.headers.get("set-cookie")!)![1]);
  assert.ok(maxAge > 0 && maxAge <= remainingBefore + 1, `never longer than the old session had left (${maxAge} vs ${remainingBefore})`);
  assert.match(res.headers.get("set-cookie")!, /HttpOnly; SameSite=Strict$/);
  for (const old of [current, other]) assert.equal((await get(orgA, "/api/v1/auth/me", old)).status, 401, "revoked");
  const me = (await jsonOf(await get(orgA, "/api/v1/auth/me", fresh))).data;
  assert.equal(me.session.expiresAt, before, "same absolute expiry");
  assert.equal((await post(orgA, "/api/v1/auth/login", { email: "editor@a.example", password: PASSWORD })).status, 401, "old password");
  tokens.editor = await signIn(orgA, "editor@a.example", newPassword);
});

test("audit: issuance, setup and change persisted with actors; no password, token or hash; logs clean", async () => {
  const entries = await db().collection(COLLECTIONS.auditLogs).find({ orgId: "org-a", action: /^(users\.setup_link_issued|auth\.password)/ }).toArray();
  const actions = new Set(entries.map((e) => e.action));
  for (const action of ["users.setup_link_issued", "auth.password_setup.completed", "auth.password_setup.refused", "auth.password.changed", "auth.password.change_failed"]) assert.ok(actions.has(action), action);
  assert.ok(entries.filter((e) => e.action !== "auth.password_setup.refused").every((e) => e.actorUserId));
  const text = JSON.stringify(entries) + logs.text();
  for (const leak of secrets) assert.ok(!text.includes(leak), "a secret reached the audit trail or the log");
  for (const field of ["tokenHash", "passwordHash"]) assert.ok(!JSON.stringify(entries).includes(field));
});
