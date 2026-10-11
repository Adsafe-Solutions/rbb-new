import { test } from "node:test";
import assert from "node:assert/strict";
import type { ApiError } from "../src/errors.ts";
import { permissionsFor } from "../src/modules/auth/permissions.ts";
import type { AuthStores } from "../src/modules/auth/repository.ts";
import type { AuthContext, Membership, User } from "../src/modules/auth/types.ts";
import { TEAM_BUSY, teamLock } from "../src/modules/members/lock.ts";
import { CONFLICT_MESSAGE, LAST_OWNER_MESSAGE, MemberService } from "../src/modules/members/service.ts";
import { addMember, clock, memoryAuth, memoryAuthStores, memoryData, memoryLeases, type MemoryData } from "./auth/memory.ts";

/* M17.1 — team management, at the service, over the in-memory stores
   (organization-scoped like MongoDB's). HTTP, CSRF and the real lock are
   covered by test/integration/members.mongo.test.ts. */

const facts = { requestId: "req-members-01", clientIp: "203.0.113.9", userAgent: "node-test" };
const PASSWORD = "a long enough password";
const FAST = { attempts: 400, delayMs: 2 };
const failure = async (p: Promise<unknown>) => (await p.then(() => assert.fail("expected a refusal"), (e) => e)) as ApiError;

function world(orgId = "org-a", data: MemoryData = memoryData()) {
  const time = clock();
  const stores = memoryAuthStores(data, orgId);
  const { audit, service: auth } = memoryAuth(data, orgId, time.now);
  const leases = memoryLeases(orgId);
  const members = new MemberService(stores, audit, { orgId, lock: teamLock(leases, time.now, FAST), now: time.now });
  /* A session's view of a member, as resolveSession builds it — taken NOW,
     so a test can hold a stale one. */
  const as = async (user: User): Promise<AuthContext> => {
    const membership = (await stores.memberships.findForUser(user.id))!;
    const session = { id: crypto.randomUUID(), orgId, userId: user.id, tokenHash: "x", createdAt: "", expiresAt: "", lastSeenAt: "", revokedAt: null };
    return { user, membership, organization: { id: orgId }, permissions: permissionsFor(membership.role), session };
  };
  const add = (email: string, role: "OWNER" | "EDITOR" = "EDITOR") => addMember(stores, { orgId, email, password: PASSWORD, role });
  const login = (email: string) => auth.login({ email, password: PASSWORD }, facts);
  const revisionOf = async (userId: string) => (await stores.memberships.findForUser(userId))!.revision;
  return { data, time, stores, auth, audit, leases, members, as, add, login, revisionOf };
}

test("list: owners see the team — role, effective status, sessions, password set — and nothing secret", async () => {
  const w = world();
  const owner = await w.add("owner@a.example", "OWNER");
  const editor = await w.add("editor@a.example");
  await w.login("editor@a.example");
  await w.login("editor@a.example");
  const team = await w.members.list(await w.as(owner));
  assert.deepEqual(
    team.map((m) => [m.email, m.role, m.status, m.activeSessions, m.passwordSet, m.isYou]),
    [
      ["owner@a.example", "OWNER", "active", 0, true, true],
      ["editor@a.example", "EDITOR", "active", 2, true, false],
    ]
  );
  assert.deepEqual(Object.keys(team[1]!).sort(), ["activeSessions", "createdAt", "email", "id", "isYou", "name", "passwordSet", "revision", "role", "status", "updatedAt"]);
  assert.equal(team[1]!.id, editor.id);
  const text = JSON.stringify(team);
  for (const leak of [editor.passwordHash, owner.passwordHash, "tokenHash", "orgId"]) assert.ok(!text.includes(leak));
});

test("RBAC: editors can neither see nor change the team; another organization's context is refused", async () => {
  const w = world();
  const owner = await w.add("owner@a.example", "OWNER");
  const editor = await w.add("editor@a.example");
  const asEditor = await w.as(editor);
  for (const attempt of [
    () => w.members.list(asEditor),
    () => w.members.get(asEditor, owner.id),
    () => w.members.create(asEditor, { email: "x@a.example", name: "X", role: "EDITOR" }, facts),
    () => w.members.changeRole(asEditor, owner.id, { revision: 1, role: "EDITOR" }, facts),
    () => w.members.deactivate(asEditor, owner.id, { revision: 1 }, facts),
    () => w.members.revokeSessions(asEditor, owner.id, facts),
  ])
    assert.equal((await failure(attempt())).code, "FORBIDDEN");
  const foreign = { ...(await w.as(owner)), organization: { id: "org-b" } };
  assert.equal((await failure(w.members.list(foreign))).code, "FORBIDDEN");
});

test("create: a member with no password (cannot sign in yet), unique email per organization, strict input, audited without the email", async () => {
  const w = world();
  const owner = await w.add("owner@a.example", "OWNER");
  const asOwner = await w.as(owner);
  const created = await w.members.create(asOwner, { email: "  New.Person@A.example ", name: " New Person ", role: "EDITOR" }, facts);
  assert.deepEqual([created.email, created.name, created.role, created.status, created.passwordSet, created.revision], ["New.Person@A.example", "New Person", "EDITOR", "active", false, 1]);
  assert.equal(w.data.users.find((u) => u.id === created.id)!.passwordHash, null);
  // No password: login is the ordinary "incorrect" refusal, whatever is typed.
  for (const password of ["", PASSWORD, "null"]) assert.equal((await failure(w.auth.login({ email: "new.person@a.example", password: password || "x" }, facts))).code, "UNAUTHENTICATED");

  const duplicate = await failure(w.members.create(asOwner, { email: "NEW.person@a.example", name: "Again", role: "OWNER" }, facts));
  assert.deepEqual([duplicate.code, duplicate.message], ["CONFLICT", "An account with this email already exists."]);
  for (const bad of [
    { email: "not-an-email", name: "X", role: "EDITOR" },
    { email: "x@a.example", name: "  ", role: "EDITOR" },
    { email: "x@a.example", name: "X", role: "ADMIN" },
    { email: "x@a.example", name: "X", role: "EDITOR", password: "chosen-by-owner" },
    { email: "x@a.example", name: "X", role: "EDITOR", orgId: "org-b" },
  ])
    assert.equal((await failure(w.members.create(asOwner, bad, facts))).code, "VALIDATION_ERROR");

  const entry = w.data.audit.find((e) => e.action === "users.created")!;
  assert.deepEqual([entry.resourceType, entry.resourceId, entry.actorUserId, entry.metadata], ["user", created.id, owner.id, { role: "EDITOR" }]);
  assert.ok(!JSON.stringify(w.data.audit).toLowerCase().includes("new.person"), "no email in the audit trail");
});

test("role change: revision-checked, audited from → to, effective on the member's very next request", async () => {
  const w = world();
  const owner = await w.add("owner@a.example", "OWNER");
  const editor = await w.add("editor@a.example");
  const { token } = await w.login("editor@a.example");
  assert.equal((await w.auth.resolveSession(token))!.membership.role, "EDITOR");

  const promoted = await w.members.changeRole(await w.as(owner), editor.id, { revision: 1, role: "OWNER" }, facts);
  assert.deepEqual([promoted.role, promoted.revision], ["OWNER", 2]);
  const resolved = (await w.auth.resolveSession(token))!;
  assert.equal(resolved.membership.role, "OWNER");
  assert.ok(resolved.permissions.includes("users:write"), "the existing session got the new permissions at once");

  const stale = await failure(w.members.changeRole(await w.as(owner), editor.id, { revision: 1, role: "EDITOR" }, facts));
  assert.deepEqual([stale.code, stale.message], ["CONFLICT", CONFLICT_MESSAGE]);
  const same = await w.members.changeRole(await w.as(owner), editor.id, { revision: 2, role: "OWNER" }, facts);
  assert.equal(same.revision, 2, "already that role: no write");
  assert.deepEqual(
    w.data.audit.filter((e) => e.action === "users.role_changed").map((e) => e.metadata),
    [{ from: "EDITOR", to: "OWNER", revision: 2 }]
  );
  for (const bad of [{ role: "OWNER" }, { revision: 0, role: "OWNER" }, { revision: 2, role: "SUPERUSER" }, { revision: "2", role: "EDITOR" }])
    assert.equal((await failure(w.members.changeRole(await w.as(owner), editor.id, bad, facts))).code, "VALIDATION_ERROR");
});

test("self-protection: nobody changes their own role or status, or revokes their own sessions here", async () => {
  const w = world();
  const owner = await w.add("owner@a.example", "OWNER");
  await w.add("second@a.example", "OWNER");
  const asOwner = await w.as(owner);
  for (const attempt of [
    () => w.members.changeRole(asOwner, owner.id, { revision: 1, role: "EDITOR" }, facts),
    () => w.members.deactivate(asOwner, owner.id, { revision: 1 }, facts),
    () => w.members.reactivate(asOwner, owner.id, { revision: 1 }, facts),
    () => w.members.revokeSessions(asOwner, owner.id, facts),
  ])
    assert.equal((await failure(attempt())).code, "FORBIDDEN");
  assert.equal(await w.revisionOf(owner.id), 1, "nothing changed");
});

test("deactivate: membership disabled, every session revoked at once, login refused; reactivate restores sign-in (not old sessions)", async () => {
  const w = world();
  const owner = await w.add("owner@a.example", "OWNER");
  const editor = await w.add("editor@a.example");
  const first = await w.login("editor@a.example");
  await w.login("editor@a.example");

  const off = await w.members.deactivate(await w.as(owner), editor.id, { revision: 1 }, facts);
  assert.deepEqual([off.status, off.activeSessions, off.revision], ["disabled", 0, 2]);
  assert.equal(await w.auth.resolveSession(first.token), null, "an open session stops working immediately");
  assert.equal((await failure(w.login("editor@a.example"))).code, "UNAUTHENTICATED");
  const again = await w.members.deactivate(await w.as(owner), editor.id, { revision: 2 }, facts);
  assert.equal(again.revision, 2, "already disabled: no write");

  const on = await w.members.reactivate(await w.as(owner), editor.id, { revision: 2 }, facts);
  assert.deepEqual([on.status, on.revision], ["active", 3]);
  assert.equal(await w.auth.resolveSession(first.token), null, "revoked sessions stay revoked");
  assert.ok((await w.login("editor@a.example")).token);
  assert.deepEqual(
    w.data.audit.filter((e) => e.action.startsWith("users.")).map((e) => [e.action, e.metadata]),
    [
      ["users.deactivated", { revision: 2, sessionsRevoked: 2 }],
      ["users.reactivated", { revision: 3 }],
    ]
  );
});

test("revoke sessions: signs a member out everywhere, counted and audited", async () => {
  const w = world();
  const owner = await w.add("owner@a.example", "OWNER");
  const editor = await w.add("editor@a.example");
  const { token } = await w.login("editor@a.example");
  await w.login("editor@a.example");
  assert.deepEqual(await w.members.revokeSessions(await w.as(owner), editor.id, facts), { revoked: 2 });
  assert.equal(await w.auth.resolveSession(token), null);
  assert.deepEqual(await w.members.revokeSessions(await w.as(owner), editor.id, facts), { revoked: 0 });
  assert.deepEqual(w.data.audit.filter((e) => e.action === "users.sessions_revoked").map((e) => e.metadata), [{ count: 2 }, { count: 0 }]);
  assert.equal((await failure(w.members.revokeSessions(await w.as(owner), crypto.randomUUID(), facts))).code, "NOT_FOUND");
});

test("organization isolation: one organization's owner cannot see or touch another's members, even by id", async () => {
  const data = memoryData();
  const a = world("org-a", data);
  const b = world("org-b", data);
  const ownerA = await a.add("owner@a.example", "OWNER");
  const editorA = await a.add("editor@a.example");
  const ownerB = await b.add("owner@b.example", "OWNER");
  const asB = await b.as(ownerB);
  assert.deepEqual((await b.members.list(asB)).map((m) => m.email), ["owner@b.example"]);
  for (const attempt of [
    () => b.members.get(asB, editorA.id),
    () => b.members.changeRole(asB, ownerA.id, { revision: 1, role: "EDITOR" }, facts),
    () => b.members.deactivate(asB, editorA.id, { revision: 1 }, facts),
    () => b.members.revokeSessions(asB, editorA.id, facts),
  ])
    assert.equal((await failure(attempt())).code, "NOT_FOUND");
  // Same email in another organization is a different account.
  await b.members.create(asB, { email: "editor@a.example", name: "Other", role: "EDITOR" }, facts);
  assert.equal(await a.revisionOf(editorA.id), 1);
  assert.deepEqual((await a.members.list(await a.as(ownerA))).map((m) => m.email), ["owner@a.example", "editor@a.example"]);
});

test("concurrency: two owners demoting each other at once — the second runs after the first and is refused; one owner remains", async () => {
  const w = world();
  const alice = await w.add("alice@a.example", "OWNER");
  const bob = await w.add("bob@a.example", "OWNER");
  // Both sessions were resolved while both were owners.
  const [asAlice, asBob] = [await w.as(alice), await w.as(bob)];
  let open!: () => void;
  const held = new Promise<void>((resolve) => (open = resolve));
  w.leases.gate = async () => {
    w.leases.gate = null; // only the first acquirer waits
    await held;
  };
  const first = w.members.changeRole(asAlice, bob.id, { revision: 1, role: "EDITOR" }, facts);
  await new Promise((r) => setTimeout(r, 10));
  const second = w.members.changeRole(asBob, alice.id, { revision: 1, role: "EDITOR" }, facts);
  await new Promise((r) => setTimeout(r, 30)); // bob is now waiting for the lease
  open();
  const [one, two] = await Promise.allSettled([first, second]);
  assert.equal(one.status, "fulfilled");
  assert.equal(two.status, "rejected");
  assert.equal((two as PromiseRejectedResult).reason.code, "FORBIDDEN", "bob is no longer an owner when his turn comes");
  const owners = w.data.memberships.filter((m) => m.role === "OWNER" && m.status === "active");
  assert.deepEqual(owners.map((m) => m.userId), [alice.id]);
});

test("the last active owner is kept even if the acting owner was changed outside the lock", async () => {
  const w = world();
  const alice = await w.add("alice@a.example", "OWNER");
  const bob = await w.add("bob@a.example", "OWNER");
  const asAlice = await w.as(alice);
  // Alice's membership disabled by something that did not take the team lock:
  // her own lookups still pass, but the owner count does not include her.
  const stores: AuthStores = { ...w.stores, memberships: { ...w.stores.memberships, list: async () => (await w.stores.memberships.list()).filter((m: Membership) => m.userId !== alice.id) } };
  const members = new MemberService(stores, w.audit, { orgId: "org-a", lock: teamLock(w.leases, w.time.now, FAST), now: w.time.now });
  for (const attempt of [() => members.changeRole(asAlice, bob.id, { revision: 1, role: "EDITOR" }, facts), () => members.deactivate(asAlice, bob.id, { revision: 1 }, facts)]) {
    const refused = await failure(attempt());
    assert.deepEqual([refused.code, refused.message], ["CONFLICT", LAST_OWNER_MESSAGE]);
  }
  assert.equal(await w.revisionOf(bob.id), 1);
  assert.deepEqual(
    w.data.audit.filter((e) => e.action === "users.change_refused").map((e) => e.metadata),
    [
      { reason: "last_owner", change: "users.role_changed" },
      { reason: "last_owner", change: "users.deactivated" },
    ]
  );
});

test("the team lock: a held lease makes others wait, then 409; it is always released", async () => {
  const leases = memoryLeases("org-a");
  const lock = teamLock(leases, () => new Date(), { attempts: 3, delayMs: 1 });
  await assert.rejects(lock.exclusive(async () => assert.fail("boom")), /boom/);
  assert.equal(leases.state.holders.get("org-a"), null, "released after a failure");
  await lock.exclusive(async () => {
    const busy = await failure(lock.exclusive(async () => "never"));
    assert.deepEqual([busy.code, busy.message], ["CONFLICT", TEAM_BUSY]);
  });
  assert.equal(await lock.exclusive(async () => "ran"), "ran");
});
