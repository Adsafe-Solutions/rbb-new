import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createApp, type App } from "../../src/app.ts";
import { COLLECTIONS, ensureIndexes } from "../../src/db/collections.ts";
import { createMongoProvider } from "../../src/db/mongo.ts";
import { AuditService, mongoAuditStore } from "../../src/modules/audit/audit.ts";
import { mongoAuthStores } from "../../src/modules/auth/repository.ts";
import { MongoMediaStore } from "../../src/modules/media/repository.ts";
import { MongoSettingsStore } from "../../src/modules/settings/repository.ts";
import { SettingsService } from "../../src/modules/settings/service.ts";
import { CHEAP_SCRYPT, addMember, silentLog } from "../auth/memory.ts";
import { settingsRecord } from "../fixtures/settings.ts";
import { captureLogs, jsonOf, testConfig } from "../helpers.ts";
import { MemoryStorage } from "../media/memory.ts";
import { testMongo } from "./mongo.ts";

/* M36: GET /api/v1/publish/preview over HTTP on the dedicated test
   database — real sessions and RBAC, two organizations in ONE database.
   Owners only; never cached or indexed; names its target; reads only. */

const mongo = testMongo();
const provider = createMongoProvider({ uri: mongo.uri, dbName: mongo.dbName });
const ADMIN = "https://admin.example";
const PASSWORD = "a correct long password";
const logs = captureLogs();
const appFor = (orgId: string): App => createApp({ config: testConfig({ orgId, mongo: { uri: mongo.uri, dbName: mongo.dbName } }), mongo: provider, scrypt: CHEAP_SCRYPT, write: logs.write, storage: new MemoryStorage() });
let appA: App, appB: App;
const tokens: Record<string, string> = {};
const call = (app: App, path: string, init: RequestInit = {}) => app.handle(new Request(`https://api.example${path}`, init), { clientIp: "203.0.113.41" });
const as = (who: string) => ({ headers: { Origin: ADMIN, Cookie: `cms_session=${tokens[who]}` } });
const preview = (app: App, who?: string) => call(app, "/api/v1/publish/preview", who ? as(who) : {});
async function login(app: App, email: string) {
  const res = await call(app, "/api/v1/auth/login", { method: "POST", headers: { Origin: ADMIN, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) });
  return /cms_session=([^;]*)/.exec(res.headers.get("set-cookie") ?? "")![1]!;
}

before(async () => {
  await mongo.connect();
  await ensureIndexes(mongo.db());
  appA = appFor("org-a");
  appB = appFor("org-b");
  for (const [orgId, email, role] of [["org-a", "owner@a.example", "OWNER"], ["org-a", "editor@a.example", "EDITOR"], ["org-b", "owner@b.example", "OWNER"]] as const)
    await addMember(mongoAuthStores(mongo.db(), orgId), { orgId, email, password: PASSWORD, role, name: email.split("@")[0]! });
  tokens.ownerA = await login(appA, "owner@a.example");
  tokens.editorA = await login(appA, "editor@a.example");
  tokens.ownerB = await login(appB, "owner@b.example");
  const audit = new AuditService(mongoAuditStore(mongo.db(), "org-a"), { orgId: "org-a", secret: "test-only-auth-secret-0123456789abcdef", log: silentLog });
  await new SettingsService(new MongoSettingsStore(mongo.db(), "org-a"), new MongoMediaStore(mongo.db(), "org-a"), audit, { orgId: "org-a" }).importInitial(settingsRecord("org-a"), { id: null, name: "Settings import" });
});
after(async () => {
  await provider.close();
  await mongo.cleanup();
});

test("anonymous 401, editor 403 — the preview is an owner's", async () => {
  assert.equal((await preview(appA)).status, 401);
  assert.equal((await preview(appA, "editorA")).status, 403);
});

test("owner: the would-be snapshot of THIS organization, never cached or indexed, naming its target", async () => {
  const res = await preview(appA, "ownerA");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(res.headers.get("x-robots-tag"), "noindex, nofollow");
  const { data } = await jsonOf(res);
  assert.equal(data.preview, true);
  assert.deepEqual(data.target, { organization: "org-a", database: mongo.dbName });
  assert.deepEqual(data.problems, []);
  assert.equal(data.snapshot.organization.id, "org-a");
  assert.equal(data.snapshot.settings.general.name, "Test Organization");
});

test("isolation and read only: another organization's owner never sees org-a; nothing was published", async () => {
  const b = await preview(appB, "ownerB");
  assert.equal(b.status, 409, "org-b has no settings of its own — org-a's are never used");
  assert.equal((await preview(appA, "ownerB")).status, 401, "a session belongs to its own organization");
  assert.equal((await call(appA, "/api/v1/public/snapshot")).status, 404, "still nothing public");
  assert.equal(await mongo.db().collection(COLLECTIONS.publishedSnapshots).countDocuments({ orgId: "org-a" }), 0);
});
