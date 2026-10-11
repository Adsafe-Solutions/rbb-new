import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createApp, type App } from "../../src/app.ts";
import { COLLECTIONS, INDEXES, ensureIndexes } from "../../src/db/collections.ts";
import { createMongoProvider } from "../../src/db/mongo.ts";
import { mongoAuthStores } from "../../src/modules/auth/repository.ts";
import { hashToken } from "../../src/modules/auth/tokens.ts";
import { CHEAP_SCRYPT, addMember } from "../auth/memory.ts";
import { captureLogs, jsonOf, testConfig } from "../helpers.ts";
import { testMongo } from "./mongo.ts";

/* M17.1 team management end to end over HTTP against the dedicated test
   database (MONGODB_TEST_URI + MONGODB_TEST_DB; never the application's).
   Two organizations share it to prove isolation; the team lock is the real
   one (member_state). */

const mongo = testMongo();
const ADMIN = "https://admin.example";
const PASSWORD = "a correct long password";
const logs = captureLogs();
const secrets: string[] = [PASSWORD];
const provider = createMongoProvider({ uri: mongo.uri, dbName: mongo.dbName });
const db = () => mongo.db();
const stores = (orgId: string) => mongoAuthStores(db(), orgId);

const appFor = (orgId: string): App =>
  createApp({ config: testConfig({ orgId, mongo: { uri: mongo.uri, dbName: mongo.dbName } }), mongo: provider, scrypt: CHEAP_SCRYPT, write: logs.write });

const call = (app: App, path: string, init: RequestInit = {}) => app.handle(new Request(`https://api.example${path}`, init), { clientIp: "203.0.113.20" });

async function signIn(app: App, email: string) {
  const res = await call(app, "/api/v1/auth/login", { method: "POST", headers: { Origin: ADMIN, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) });
  assert.equal(res.status, 200, `login ${email}`);
  const token = /cms_session=([^;]*)/.exec(res.headers.get("set-cookie") ?? "")![1]!;
  secrets.push(token, hashToken(token));
  return token;
}

const send = (app: App, token: string, method: string, path: string, body?: unknown, origin: string | null = ADMIN) =>
  call(app, path, {
    method,
    headers: { Cookie: `cms_session=${token}`, ...(origin && { Origin: origin }), ...(body !== undefined && { "Content-Type": "application/json" }) },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

let orgA: App;
let orgB: App;
const ids: Record<string, string> = {};
const tokens: Record<string, string> = {};

before(async () => {
  await mongo.connect();
  await ensureIndexes(db());
  orgA = appFor("org-a");
  orgB = appFor("org-b");
  for (const [orgId, email, role] of [
    ["org-a", "owner@a.example", "OWNER"],
    ["org-a", "second@a.example", "OWNER"],
    ["org-a", "editor@a.example", "EDITOR"],
    ["org-b", "owner@b.example", "OWNER"],
  ] as const) {
    const user = await addMember(stores(orgId), { orgId, email, password: PASSWORD, role });
    ids[email] = user.id;
    secrets.push(user.passwordHash);
  }
  for (const email of ["owner@a.example", "second@a.example", "editor@a.example"]) tokens[email] = await signIn(orgA, email);
  tokens["owner@b.example"] = await signIn(orgB, "owner@b.example");
});

after(async () => {
  await provider.close();
  await mongo.cleanup();
});

test("indexes: the team lock collection has its one-per-organization index", async () => {
  const existing = await db().collection(COLLECTIONS.memberState).indexes();
  for (const spec of INDEXES.memberState) assert.equal(existing.find((i) => i.name === spec.name)?.unique, true);
});

test("owners list their own organization's team; editors are refused; nothing secret is returned", async () => {
  const res = await send(orgA, tokens["owner@a.example"]!, "GET", "/api/v1/members");
  assert.equal(res.status, 200);
  const body = await res.text();
  const team = JSON.parse(body).data as { email: string; isYou: boolean; activeSessions: number }[];
  assert.deepEqual(team.map((m) => m.email).sort(), ["editor@a.example", "owner@a.example", "second@a.example"]);
  assert.equal(team.find((m) => m.isYou)!.email, "owner@a.example");
  assert.ok(team.every((m) => m.activeSessions >= 1));
  for (const leak of secrets) assert.ok(!body.includes(leak), "response leaked a secret");
  for (const field of ["passwordHash", "tokenHash", "orgId", "_id"]) assert.ok(!body.includes(field));

  assert.equal((await send(orgA, tokens["editor@a.example"]!, "GET", "/api/v1/members")).status, 403);
  assert.equal((await send(orgA, tokens["editor@a.example"]!, "POST", "/api/v1/members", { email: "x@a.example", name: "X", role: "OWNER" })).status, 403);
  assert.equal((await call(orgA, "/api/v1/members")).status, 401);
});

test("create over HTTP: CSRF-checked, no password, duplicate refused, validation by field", async () => {
  const owner = tokens["owner@a.example"]!;
  const input = { email: "new@a.example", name: "New Person", role: "EDITOR" };
  assert.equal((await send(orgA, owner, "POST", "/api/v1/members", input, null)).status, 403, "no Origin: refused before anything runs");
  assert.equal((await send(orgA, owner, "POST", "/api/v1/members", input, "https://evil.example")).status, 403);
  assert.equal(await db().collection(COLLECTIONS.users).countDocuments({ orgId: "org-a", emailNormalized: "new@a.example" }), 0);

  const created = await send(orgA, owner, "POST", "/api/v1/members", input);
  assert.equal(created.status, 200);
  const member = (await jsonOf(created)).data;
  assert.deepEqual([member.role, member.status, member.passwordSet, member.revision], ["EDITOR", "active", false, 1]);
  const stored = await db().collection(COLLECTIONS.users).findOne({ orgId: "org-a", id: member.id });
  assert.equal(stored!.passwordHash, null);
  const noPassword = await call(orgA, "/api/v1/auth/login", { method: "POST", headers: { Origin: ADMIN, "Content-Type": "application/json" }, body: JSON.stringify({ email: "new@a.example", password: PASSWORD }) });
  assert.equal(noPassword.status, 401, "no password set: cannot sign in");

  const duplicate = await send(orgA, owner, "POST", "/api/v1/members", { ...input, email: "NEW@a.example" });
  assert.equal(duplicate.status, 409);
  const invalid = await jsonOf(await send(orgA, owner, "POST", "/api/v1/members", { email: "nope", name: "", role: "ROOT" }));
  assert.deepEqual(invalid.error.details.map((d: { path: string }) => d.path).sort(), ["body.email", "body.name", "body.role"]);
  // Same email in another organization: a separate account.
  assert.equal((await send(orgB, tokens["owner@b.example"]!, "POST", "/api/v1/members", input)).status, 200);
});

test("role changes: revision-checked, self refused, effective on the member's next request", async () => {
  const owner = tokens["owner@a.example"]!;
  const editorId = ids["editor@a.example"]!;
  assert.equal((await send(orgA, owner, "POST", `/api/v1/members/${ids["owner@a.example"]}/role`, { revision: 1, role: "EDITOR" })).status, 403, "own role");
  assert.equal((await send(orgA, owner, "POST", `/api/v1/members/not-a-uuid/role`, { revision: 1, role: "OWNER" })).status, 400);

  const promoted = await send(orgA, owner, "POST", `/api/v1/members/${editorId}/role`, { revision: 1, role: "OWNER" });
  assert.equal(promoted.status, 200);
  assert.equal((await jsonOf(promoted)).data.revision, 2);
  const me = await jsonOf(await send(orgA, tokens["editor@a.example"]!, "GET", "/api/v1/auth/me"));
  assert.equal(me.data.membership.role, "OWNER", "the open session has the new role at once");
  assert.equal((await send(orgA, owner, "POST", `/api/v1/members/${editorId}/role`, { revision: 1, role: "EDITOR" })).status, 409, "stale revision");
  const demoted = await send(orgA, owner, "POST", `/api/v1/members/${editorId}/role`, { revision: 2, role: "EDITOR" });
  assert.equal(demoted.status, 200);
  assert.equal((await send(orgA, tokens["editor@a.example"]!, "GET", "/api/v1/members")).status, 403, "and loses it at once");
});

test("deactivate signs the member out everywhere at once; reactivate lets them sign in again", async () => {
  const owner = tokens["owner@a.example"]!;
  const id = ids["editor@a.example"]!;
  const extra = await signIn(orgA, "editor@a.example");
  const revision = (await jsonOf(await send(orgA, owner, "GET", `/api/v1/members/${id}`))).data.revision;
  const off = await jsonOf(await send(orgA, owner, "POST", `/api/v1/members/${id}/deactivate`, { revision }));
  assert.deepEqual([off.data.status, off.data.activeSessions], ["disabled", 0]);
  for (const token of [tokens["editor@a.example"]!, extra]) assert.equal((await send(orgA, token, "GET", "/api/v1/auth/me")).status, 401);
  const refused = await call(orgA, "/api/v1/auth/login", { method: "POST", headers: { Origin: ADMIN, "Content-Type": "application/json" }, body: JSON.stringify({ email: "editor@a.example", password: PASSWORD }) });
  assert.equal(refused.status, 401);

  const on = await send(orgA, owner, "POST", `/api/v1/members/${id}/reactivate`, { revision: off.data.revision });
  assert.equal((await jsonOf(on)).data.status, "active");
  tokens["editor@a.example"] = await signIn(orgA, "editor@a.example");
});

test("revoke sessions: a member signed out everywhere; your own are refused here", async () => {
  const owner = tokens["owner@a.example"]!;
  const res = await send(orgA, owner, "POST", `/api/v1/members/${ids["editor@a.example"]}/sessions/revoke`);
  assert.deepEqual((await jsonOf(res)).data, { revoked: 1 });
  assert.equal((await send(orgA, tokens["editor@a.example"]!, "GET", "/api/v1/auth/me")).status, 401);
  assert.equal((await send(orgA, owner, "POST", `/api/v1/members/${ids["owner@a.example"]}/sessions/revoke`)).status, 403);
  tokens["editor@a.example"] = await signIn(orgA, "editor@a.example");
});

test("organization isolation: another organization's ids do not exist from here", async () => {
  const ownerB = tokens["owner@b.example"]!;
  const victim = ids["editor@a.example"]!;
  assert.equal((await send(orgB, ownerB, "GET", `/api/v1/members/${victim}`)).status, 404);
  assert.equal((await send(orgB, ownerB, "POST", `/api/v1/members/${victim}/deactivate`, { revision: 1 })).status, 404);
  assert.equal((await send(orgB, ownerB, "POST", `/api/v1/members/${victim}/sessions/revoke`)).status, 404);
  // An org A session is not a session in org B.
  assert.equal((await send(orgB, tokens["owner@a.example"]!, "GET", "/api/v1/members")).status, 401);
  assert.equal((await send(orgA, tokens["editor@a.example"]!, "GET", "/api/v1/auth/me")).status, 200, "untouched");
});

test("concurrency on real MongoDB: two owners demoting each other at once leave exactly one active owner", async () => {
  const [a, b] = [ids["owner@a.example"]!, ids["second@a.example"]!];
  const revisionOf = async (id: string) => (await stores("org-a").memberships.findForUser(id))!.revision;
  const [ra, rb] = [await revisionOf(a), await revisionOf(b)];
  const results = await Promise.all([
    send(orgA, tokens["owner@a.example"]!, "POST", `/api/v1/members/${b}/role`, { revision: rb, role: "EDITOR" }),
    send(orgA, tokens["second@a.example"]!, "POST", `/api/v1/members/${a}/role`, { revision: ra, role: "EDITOR" }),
  ]);
  const statuses = results.map((r) => r.status).sort();
  assert.equal(statuses[0], 200, `one succeeds (${statuses})`);
  assert.ok([403, 409].includes(statuses[1]!), `the other is refused (${statuses})`);
  const owners = await db().collection(COLLECTIONS.memberships).countDocuments({ orgId: "org-a", role: "OWNER", status: "active" });
  assert.equal(owners, 1);
  const lock = await db().collection(COLLECTIONS.memberState).findOne({ orgId: "org-a" });
  assert.equal(lock?.lockId, null, "the lease was released");
});

test("audit: every change persisted with actor and request facts, no secrets or emails; nothing ever deleted", async () => {
  const entries = await db().collection(COLLECTIONS.auditLogs).find({ orgId: "org-a", action: /^users\./ }).toArray();
  const actions = new Set(entries.map((e) => e.action));
  for (const action of ["users.created", "users.role_changed", "users.deactivated", "users.reactivated", "users.sessions_revoked"]) assert.ok(actions.has(action), action);
  assert.ok(entries.every((e) => e.actorUserId && e.resourceType === "user" && e.resourceId));
  const text = JSON.stringify(entries);
  for (const leak of [...secrets, "editor@a.example", "new@a.example", "203.0.113.20"]) assert.ok(!text.includes(leak), "audit leaked a secret or identifier");
  assert.equal(await db().collection(COLLECTIONS.users).countDocuments({ orgId: "org-a" }), 4, "members are deactivated, never deleted");
});

test("logs: no secret reached the log", () => {
  const text = logs.text();
  assert.ok(text.length > 0);
  for (const secret of secrets) assert.ok(!text.includes(secret), "a secret reached the log");
});
