import { test } from "node:test";
import assert from "node:assert/strict";
import type { ApiError } from "../src/errors.ts";
import { permissionsFor } from "../src/modules/auth/permissions.ts";
import { INVALID_SETUP_LINK, SETUP_LINK_TTL_MS } from "../src/modules/auth/service.ts";
import { LOGIN_LIMITS } from "../src/modules/auth/throttle.ts";
import { hashToken } from "../src/modules/auth/tokens.ts";
import type { AuthContext, User } from "../src/modules/auth/types.ts";
import { teamLock } from "../src/modules/members/lock.ts";
import { MemberService } from "../src/modules/members/service.ts";
import { addMember, clock, memoryAuth, memoryAuthStores, memoryData, memoryLeases, type MemoryData } from "./auth/memory.ts";

/* M17.2 — setup links and password change, at the services, over the
   in-memory stores (organization-scoped like MongoDB's). HTTP, CSRF,
   cookies and the real atomic consume are covered by
   test/integration/account-security.mongo.test.ts. */

const PASSWORD = "an existing long password";
const NEW_PASSWORD = "a brand new long password";
const facts = (ip = "203.0.113.30") => ({ requestId: "req-acct-0001", clientIp: ip, userAgent: "node-test" });
const failure = async (p: Promise<unknown>) => (await p.then(() => assert.fail("expected a refusal"), (e) => e)) as ApiError;

function world(orgId = "org-a", data: MemoryData = memoryData()) {
  const time = clock();
  const stores = memoryAuthStores(data, orgId);
  const { audit, service: auth } = memoryAuth(data, orgId, time.now);
  const members = new MemberService(stores, audit, { orgId, lock: teamLock(memoryLeases(orgId), time.now, { attempts: 50, delayMs: 2 }), now: time.now });
  const as = async (user: User): Promise<AuthContext> => {
    const membership = (await stores.memberships.findForUser(user.id))!;
    const session = { id: crypto.randomUUID(), orgId, userId: user.id, tokenHash: "x", createdAt: "", expiresAt: new Date(time.now().getTime() + 3600_000).toISOString(), lastSeenAt: "", revokedAt: null };
    return { user, membership, organization: { id: orgId }, permissions: permissionsFor(membership.role), session };
  };
  const owner = () => addMember(stores, { orgId, email: `owner@${orgId}.example`, password: PASSWORD, role: "OWNER" });
  /* A member as the owner adds them: no password. */
  const newcomer = async (asOwner: AuthContext, email = `new@${orgId}.example`) => {
    const view = await members.create(asOwner, { email, name: "New Person", role: "EDITOR" }, facts());
    return (await stores.users.findById(view.id))!;
  };
  const setup = (token: string, password = NEW_PASSWORD, ip?: string) => auth.setupPassword({ token, password }, facts(ip));
  const login = (email: string, password: string, ip?: string) => auth.login({ email, password }, facts(ip));
  return { data, time, stores, auth, members, as, owner, newcomer, setup, login };
}

/* ---------------- Issuing a setup link ---------------- */

test("issue: an owner gets a 256-bit token once; only its hash is stored; 72 hours; audited without the token", async () => {
  const w = world();
  const asOwner = await w.as(await w.owner());
  const member = await w.newcomer(asOwner);
  const { token, expiresAt } = await w.members.issueSetupLink(asOwner, member.id, facts());
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(Date.parse(expiresAt) - w.time.now().getTime(), SETUP_LINK_TTL_MS);
  assert.equal(SETUP_LINK_TTL_MS, 72 * 60 * 60 * 1000);
  assert.equal(w.data.setupTokens.length, 1);
  assert.equal(w.data.setupTokens[0]!.tokenHash, hashToken(token));
  assert.ok(!JSON.stringify(w.data.setupTokens).includes(token), "the raw token is never stored");
  const entry = w.data.audit.find((e) => e.action === "users.setup_link_issued")!;
  assert.deepEqual([entry.resourceId, entry.actorUserId, entry.metadata.replaced], [member.id, asOwner.user.id, 0]);
  const text = JSON.stringify(w.data.audit);
  assert.ok(!text.includes(token) && !text.includes(hashToken(token)), "no token or hash in the audit trail");
});

test("issue: owners only; never yourself, a member with a password, or a deactivated member", async () => {
  const w = world();
  const owner = await w.owner();
  const asOwner = await w.as(owner);
  const editor = await addMember(w.stores, { orgId: "org-a", email: "editor@org-a.example", password: PASSWORD });
  const member = await w.newcomer(asOwner);
  assert.equal((await failure(w.members.issueSetupLink(await w.as(editor), member.id, facts()))).code, "FORBIDDEN");
  assert.equal((await failure(w.members.issueSetupLink(asOwner, owner.id, facts()))).code, "FORBIDDEN");
  assert.equal((await failure(w.members.issueSetupLink(asOwner, editor.id, facts()))).code, "CONFLICT", "already has a password");
  assert.equal((await failure(w.members.issueSetupLink(asOwner, crypto.randomUUID(), facts()))).code, "NOT_FOUND");
  await w.members.deactivate(asOwner, member.id, { revision: 1 }, facts());
  assert.equal((await failure(w.members.issueSetupLink(asOwner, member.id, facts()))).code, "CONFLICT", "deactivated");
  assert.equal(w.data.setupTokens.length, 0);
});

test("issue again: the earlier open link is revoked — only the newest works", async () => {
  const w = world();
  const asOwner = await w.as(await w.owner());
  const member = await w.newcomer(asOwner);
  const first = await w.members.issueSetupLink(asOwner, member.id, facts());
  const second = await w.members.issueSetupLink(asOwner, member.id, facts());
  assert.equal(w.data.audit.filter((e) => e.action === "users.setup_link_issued").at(-1)!.metadata.replaced, 1);
  const refused = await failure(w.setup(first.token));
  assert.deepEqual([refused.code, refused.message], ["BAD_REQUEST", INVALID_SETUP_LINK]);
  await w.setup(second.token);
  assert.ok((await w.login("new@org-a.example", NEW_PASSWORD)).token);
});

/* ---------------- Using a setup link ---------------- */

test("setup: sets the first password, so the member can sign in; the link is spent; audited; nothing secret stored", async () => {
  const w = world();
  const asOwner = await w.as(await w.owner());
  const member = await w.newcomer(asOwner);
  assert.equal((await failure(w.login("new@org-a.example", NEW_PASSWORD))).code, "UNAUTHENTICATED", "no password yet");
  const { token } = await w.members.issueSetupLink(asOwner, member.id, facts());
  await w.setup(token);
  const signedIn = await w.login("new@org-a.example", NEW_PASSWORD);
  assert.equal(signedIn.view.user.id, member.id);
  assert.ok(w.data.setupTokens[0]!.usedAt);
  const reused = await failure(w.setup(token, "another long password!"));
  assert.deepEqual([reused.code, reused.message], ["BAD_REQUEST", INVALID_SETUP_LINK], "single use");
  assert.equal((await failure(w.login("new@org-a.example", "another long password!"))).code, "UNAUTHENTICATED", "the reuse changed nothing");
  const done = w.data.audit.find((e) => e.action === "auth.password_setup.completed")!;
  assert.deepEqual([done.resourceId, done.actorUserId], [member.id, member.id]);
  assert.deepEqual(w.data.audit.filter((e) => e.action === "auth.password_setup.refused").map((e) => e.metadata), [{ reason: "used" }]);
  const text = JSON.stringify(w.data);
  for (const leak of [token, NEW_PASSWORD]) assert.ok(!text.includes(leak), "no token or password anywhere in storage or audit");
});

test("setup: expires after 72 hours", async () => {
  const w = world();
  const asOwner = await w.as(await w.owner());
  const early = await w.newcomer(asOwner, "early@org-a.example");
  const late = await w.newcomer(asOwner, "late@org-a.example");
  const a = await w.members.issueSetupLink(asOwner, early.id, facts());
  const b = await w.members.issueSetupLink(asOwner, late.id, facts());
  w.time.advance(SETUP_LINK_TTL_MS - 1000);
  await w.setup(a.token);
  w.time.advance(1000);
  const expired = await failure(w.setup(b.token));
  assert.deepEqual([expired.code, expired.message], ["BAD_REQUEST", INVALID_SETUP_LINK]);
  assert.deepEqual(w.data.audit.filter((e) => e.action === "auth.password_setup.refused").map((e) => e.metadata), [{ reason: "expired" }]);
});

test("setup: malformed and unknown tokens get the same answer, cost no lookup of anyone, and are not attributed", async () => {
  const w = world();
  await w.as(await w.owner());
  for (const token of ["", "short", "x".repeat(43) + "!", "a b".repeat(15), "A".repeat(43)]) {
    const refused = await failure(w.setup(token));
    assert.deepEqual([refused.code, refused.message], ["BAD_REQUEST", INVALID_SETUP_LINK], JSON.stringify(token));
  }
  assert.equal(w.data.audit.filter((e) => e.action.startsWith("auth.password_setup")).length, 0);
  for (const bad of [{ token: "A".repeat(43) }, { token: "A".repeat(43), password: "short" }, { token: "A".repeat(43), password: NEW_PASSWORD, extra: 1 }, { token: 7, password: NEW_PASSWORD }])
    assert.equal((await failure(w.auth.setupPassword(bad, facts()))).code, "VALIDATION_ERROR");
});

test("setup: a password that breaks the policy is refused WITHOUT spending the link", async () => {
  const w = world();
  const asOwner = await w.as(await w.owner());
  const member = await w.newcomer(asOwner);
  const { token } = await w.members.issueSetupLink(asOwner, member.id, facts());
  for (const weak of ["short", "x".repeat(257)]) assert.equal((await failure(w.setup(token, weak))).code, "VALIDATION_ERROR");
  assert.equal(w.data.setupTokens[0]!.usedAt, null);
  await w.setup(token);
});

test("setup: two simultaneous uses of one link — exactly one sets the password", async () => {
  const w = world();
  const asOwner = await w.as(await w.owner());
  const member = await w.newcomer(asOwner);
  const { token } = await w.members.issueSetupLink(asOwner, member.id, facts());
  const results = await Promise.allSettled([w.setup(token, "first racer long password"), w.setup(token, "second racer long password")]);
  assert.deepEqual(results.map((r) => r.status).sort(), ["fulfilled", "rejected"]);
  const winner = results[0]!.status === "fulfilled" ? "first racer long password" : "second racer long password";
  const loser = winner.startsWith("first") ? "second racer long password" : "first racer long password";
  assert.ok((await w.login("new@org-a.example", winner)).token);
  assert.equal((await failure(w.login("new@org-a.example", loser))).code, "UNAUTHENTICATED");
  assert.equal(w.data.audit.filter((e) => e.action === "auth.password_setup.completed").length, 1);
});

test("setup: deactivating the member revokes the link; it stays revoked after reactivation", async () => {
  const w = world();
  const asOwner = await w.as(await w.owner());
  const member = await w.newcomer(asOwner);
  const { token } = await w.members.issueSetupLink(asOwner, member.id, facts());
  const off = await w.members.deactivate(asOwner, member.id, { revision: 1 }, facts());
  assert.deepEqual(w.data.audit.find((e) => e.action === "users.deactivated")!.metadata, { revision: 2, sessionsRevoked: 0, setupLinksRevoked: 1 });
  await w.members.reactivate(asOwner, member.id, { revision: off.revision }, facts());
  assert.equal((await failure(w.setup(token))).message, INVALID_SETUP_LINK);
  const fresh = await w.members.issueSetupLink(asOwner, member.id, facts());
  await w.setup(fresh.token);
});

test("setup: another organization's link does not exist from here", async () => {
  const data = memoryData();
  const a = world("org-a", data);
  const b = world("org-b", data);
  const asOwnerA = await a.as(await a.owner());
  const member = await a.newcomer(asOwnerA);
  const { token } = await a.members.issueSetupLink(asOwnerA, member.id, facts());
  const refused = await failure(b.setup(token));
  assert.deepEqual([refused.code, refused.message], ["BAD_REQUEST", INVALID_SETUP_LINK]);
  assert.equal(data.setupTokens[0]!.usedAt, null, "untouched");
  await a.setup(token);
});

test("setup throttling: refusals count per link (5), every attempt per IP (shared with login, 20)", async () => {
  const w = world();
  const asOwner = await w.as(await w.owner());
  const member = await w.newcomer(asOwner);
  const { token } = await w.members.issueSetupLink(asOwner, member.id, facts());
  await w.setup(token, NEW_PASSWORD, "198.51.100.1");
  for (let i = 0; i < LOGIN_LIMITS.perAccount; i++) assert.equal((await failure(w.setup(token, NEW_PASSWORD, `198.51.100.${10 + i}`))).code, "BAD_REQUEST");
  assert.equal((await failure(w.setup(token, NEW_PASSWORD, "198.51.100.99"))).code, "RATE_LIMITED", "this link is locked for the window");

  const ip = "198.51.100.200";
  for (let i = 0; i < LOGIN_LIMITS.perIp; i++) await failure(w.setup("B".repeat(42) + String.fromCharCode(65 + (i % 26)), NEW_PASSWORD, ip));
  assert.equal((await failure(w.setup("C".repeat(43), NEW_PASSWORD, ip))).code, "RATE_LIMITED");
  assert.equal((await failure(w.login("owner@org-a.example", PASSWORD, ip))).code, "RATE_LIMITED", "the IP budget is login's");
});

/* ---------------- Changing your password ---------------- */

test("change: current password required; every session revoked; a fresh session with the SAME expiry; old password dead", async () => {
  const w = world();
  await w.owner();
  const editor = await addMember(w.stores, { orgId: "org-a", email: "editor@org-a.example", password: PASSWORD });
  const first = await w.login("editor@org-a.example", PASSWORD);
  const other = await w.login("editor@org-a.example", PASSWORD);
  const current = (await w.auth.resolveSession(first.token))!;
  w.time.advance(60_000);

  const changed = await w.auth.changePassword(current, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }, facts());
  assert.notEqual(changed.token, first.token);
  assert.equal(await w.auth.resolveSession(first.token), null, "the current session is rotated");
  assert.equal(await w.auth.resolveSession(other.token), null, "every other session is revoked");
  const fresh = (await w.auth.resolveSession(changed.token))!;
  assert.equal(fresh.user.id, editor.id);
  assert.equal(fresh.session.expiresAt, current.session.expiresAt, "absolute lifetime kept, never extended");
  assert.equal(changed.maxAgeSeconds, (Date.parse(current.session.expiresAt) - w.time.now().getTime()) / 1000);
  assert.equal(changed.view.session.id, fresh.session.id);
  assert.equal((await failure(w.login("editor@org-a.example", PASSWORD))).code, "UNAUTHENTICATED");
  assert.ok((await w.login("editor@org-a.example", NEW_PASSWORD)).token);
  assert.deepEqual(w.data.audit.find((e) => e.action === "auth.password.changed")!.metadata, { otherSessionsRevoked: 1 });
  const text = JSON.stringify(w.data);
  for (const leak of [PASSWORD, NEW_PASSWORD, changed.token]) assert.ok(!text.includes(leak));
});

test("change: wrong current password, same password, weak password; nothing changes", async () => {
  const w = world();
  await addMember(w.stores, { orgId: "org-a", email: "editor@org-a.example", password: PASSWORD });
  const ctx = (await w.auth.resolveSession((await w.login("editor@org-a.example", PASSWORD)).token))!;
  const wrong = await failure(w.auth.changePassword(ctx, { currentPassword: "not my password at all", newPassword: NEW_PASSWORD }, facts()));
  assert.deepEqual([wrong.code, wrong.details], ["VALIDATION_ERROR", [{ path: "currentPassword", message: "is incorrect" }]]);
  const same = await failure(w.auth.changePassword(ctx, { currentPassword: PASSWORD, newPassword: PASSWORD }, facts()));
  assert.deepEqual(same.details, [{ path: "newPassword", message: "must differ from the current password" }]);
  for (const bad of [{ currentPassword: PASSWORD, newPassword: "short" }, { currentPassword: PASSWORD }, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD, password: "x" }])
    assert.equal((await failure(w.auth.changePassword(ctx, bad, facts()))).code, "VALIDATION_ERROR");
  assert.ok(await w.auth.resolveSession((await w.login("editor@org-a.example", PASSWORD)).token), "old password still works");
  assert.deepEqual(w.data.audit.filter((e) => e.action === "auth.password.change_failed").map((e) => e.metadata), [{ reason: "invalid_current", lockedOut: false }]);
});

test("change throttling: wrong current passwords count as failed logins — the 6th try is 429, and login is locked too", async () => {
  const w = world();
  await addMember(w.stores, { orgId: "org-a", email: "editor@org-a.example", password: PASSWORD });
  const ctx = (await w.auth.resolveSession((await w.login("editor@org-a.example", PASSWORD)).token))!;
  for (let i = 0; i < LOGIN_LIMITS.perAccount; i++)
    assert.equal((await failure(w.auth.changePassword(ctx, { currentPassword: `wrong guess number ${i}`, newPassword: NEW_PASSWORD }, facts(`192.0.2.${i}`)))).code, "VALIDATION_ERROR");
  assert.equal((await failure(w.auth.changePassword(ctx, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }, facts("192.0.2.50")))).code, "RATE_LIMITED", "even with the right one");
  assert.equal((await failure(w.login("editor@org-a.example", PASSWORD, "192.0.2.51"))).code, "RATE_LIMITED");
  assert.equal(w.data.audit.filter((e) => e.action === "auth.password.change_failed").at(-1)!.metadata.lockedOut, true);
});

test("change: two simultaneous changes from one password — one wins, the other is refused", async () => {
  const w = world();
  await addMember(w.stores, { orgId: "org-a", email: "editor@org-a.example", password: PASSWORD });
  const ctx = (await w.auth.resolveSession((await w.login("editor@org-a.example", PASSWORD)).token))!;
  const results = await Promise.allSettled([
    w.auth.changePassword(ctx, { currentPassword: PASSWORD, newPassword: "first racer long password" }, facts()),
    w.auth.changePassword(ctx, { currentPassword: PASSWORD, newPassword: "second racer long password" }, facts()),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), ["fulfilled", "rejected"]);
  assert.equal(((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason as ApiError).code, "CONFLICT");
  assert.equal(w.data.audit.filter((e) => e.action === "auth.password.changed").length, 1);
});
