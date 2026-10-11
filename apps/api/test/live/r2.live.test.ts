import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { loadConfig } from "../../src/config/env.ts";
import { isProductionBucket } from "../../src/config/target.ts";
import { ensureIndexes } from "../../src/db/collections.ts";
import { AuditService } from "../../src/modules/audit/audit.ts";
import { MEDIA_POLICY, newObjectKey } from "../../src/modules/media/policy.ts";
import { R2Storage } from "../../src/modules/media/r2.ts";
import { MongoMediaStore } from "../../src/modules/media/repository.ts";
import { MediaService } from "../../src/modules/media/service.ts";
import { sniffImage } from "../../src/modules/media/sniff.ts";
import { memoryAuditStore, memoryData, silentLog } from "../auth/memory.ts";
import { testMongo } from "../integration/mongo.ts";
import { FACTS, fixture, member } from "../media/memory.ts";

/* LIVE: against the real R2 bucket, with the R2_* variables from the
   environment (pnpm api:test:r2 loads apps/api/.env, then .env.local; the
   shell wins over both). Skipped when none are set; a partial set fails
   with the missing names (never values), like the API itself.

   Safe by construction: NODE_ENV=test keys start with "_test/", under a
   one-off organization id ("live-<random>"), so nothing touches the
   production namespace; every object written is deleted in `after`,
   and the run fails if one survives. Nothing is printed but outcomes.

   Phase 0: never the PRODUCTION bucket, prefix or not — a test writes
   and deletes objects, and the website's media lives there. Point the
   R2_* variables at a separate test bucket; there is no override. */
if (isProductionBucket(process.env.R2_BUCKET?.trim()))
  throw new Error("Refusing: R2_BUCKET is the production bucket. The live R2 test runs only against a separate test bucket. Nothing was written.");

const R2_NAMES = ["R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_PUBLIC_URL"];
const env: Record<string, string | undefined> = { NODE_ENV: "test", ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith("R2_"))) };
const config = R2_NAMES.some((name) => env[name]?.trim()) ? loadConfig(env) : null;
const skip = !config?.storage ? `R2 variables not set: ${R2_NAMES.join(", ")}` : !process.env.MONGODB_TEST_URI ? "MONGODB_TEST_URI not set" : false;

const orgId = `live-${randomBytes(4).toString("hex")}`;
const created = new Set<string>();
const png = fixture("sample.png");
let storage: R2Storage;
let mongo: ReturnType<typeof testMongo> | null = null;

before(async () => {
  if (skip) return;
  const s = config!.storage!;
  storage = new R2Storage({ endpoint: s.endpoint, bucket: s.bucket, credentials: { accessKeyId: s.accessKeyId, secretAccessKey: s.secretAccessKey }, publicBaseUrl: s.publicBaseUrl });
  mongo = testMongo();
  await mongo.connect();
  await ensureIndexes(mongo.db());
});

after(async () => {
  if (skip) return;
  const survivors: string[] = [];
  try {
    for (const key of created) {
      // A failed delete or check counts as a possible survivor, never crashes cleanup.
      const gone = await storage.delete(key).then(() => storage.head(key)).then((h) => h === null, () => false);
      if (!gone) survivors.push(key);
    }
  } finally {
    await mongo?.cleanup();
  }
  assert.deepEqual(survivors, [], "every test object was deleted (or none could be written)");
});

/* R2 answers 403 AccessDenied when the key exists but its token may not
   touch this bucket — say so plainly instead of a bare status. */
const expectAccepted = (status: number) =>
  assert.equal(status, 200, status === 403 ? "R2 refused the credentials (403 AccessDenied): the R2 API token needs Object Read & Write on R2_BUCKET" : `R2 answered ${status}`);

const key = () => {
  const k = newObjectKey({ orgId, filename: "live-smoke.png", mimeType: "image/png", env: "test" });
  created.add(k);
  return k;
};
const put = (url: string, body: Uint8Array, contentType: string) => fetch(url, { method: "PUT", body, headers: { "Content-Type": contentType }, signal: AbortSignal.timeout(20_000) });

test("presigned PUT → object exists with the declared size and type → readable → deleted", { skip }, async () => {
  const k = key();
  assert.ok(k.startsWith(`_test/${orgId}/media/`), "test namespace only");
  const target = await storage.createUploadTarget({ key: k, contentType: "image/png", contentLength: png.byteLength, expiresInSeconds: MEDIA_POLICY.uploadUrlTtlSeconds });
  expectAccepted((await put(target.url, png, "image/png")).status);
  assert.deepEqual(await storage.head(k), { size: png.byteLength, contentType: "image/png" });
  const start = await storage.readStart(k, 64 * 1024);
  assert.deepEqual(sniffImage(start!), { mimeType: "image/png", width: 48, height: 32 });
  await storage.delete(k);
  assert.equal(await storage.head(k), null);
  await storage.delete(k); // idempotent
});

test("the signature binds type, length and time; the bucket refuses unsigned writes", { skip }, async () => {
  const k = key();
  const target = await storage.createUploadTarget({ key: k, contentType: "image/png", contentLength: png.byteLength, expiresInSeconds: 300 });
  // First prove these credentials CAN write here, so the 403s below mean "refused by the signature".
  const probe = key();
  const ok = await storage.createUploadTarget({ key: probe, contentType: "image/png", contentLength: png.byteLength, expiresInSeconds: 300 });
  expectAccepted((await put(ok.url, png, "image/png")).status);
  assert.equal((await put(target.url, png, "text/html")).status, 403, "another Content-Type is refused");
  assert.equal((await put(target.url, new Uint8Array([...png, 0]), "image/png")).status, 403, "another length is refused");
  const unsigned = target.url.split("?")[0]!;
  // R2 answers a request with no auth at all 400 InvalidArgument, not 403; both are refusals, and the head() below proves nothing landed.
  const unsignedRes = await put(unsigned, png, "image/png");
  assert.ok([400, 403].includes(unsignedRes.status), `no signature, no write (R2 answered ${unsignedRes.status})`);
  const short = await storage.createUploadTarget({ key: k, contentType: "image/png", contentLength: png.byteLength, expiresInSeconds: 1 });
  await new Promise((r) => setTimeout(r, 2500));
  assert.equal((await put(short.url, png, "image/png")).status, 403, "an expired URL is refused");
  assert.equal(await storage.head(k), null, "none of those wrote anything");
});

test("the media service end to end on real R2 + disposable MongoDB", { skip }, async () => {
  const data = memoryData();
  const audit = new AuditService(memoryAuditStore(data, orgId), { orgId, secret: "test-only-auth-secret-0123456789abcdef", log: silentLog });
  const throttle = { hit: async () => 1, peek: async () => 0 };
  const service = new MediaService(new MongoMediaStore(mongo!.db(), orgId), storage, audit, throttle, { orgId, env: "test", log: silentLog });
  const who = member(orgId, "OWNER");

  const intent = await service.createUploadIntent(who, { filename: "Live Smoke.png", mimeType: "image/png", size: png.byteLength }, FACTS);
  created.add(intent.objectKey);
  expectAccepted((await put(intent.uploadUrl, png, intent.uploadHeaders["Content-Type"]!)).status);
  const ready = await service.complete(who, intent.mediaId, FACTS);
  assert.equal(ready.status, "ready");
  assert.deepEqual([ready.width, ready.height], [48, 32]);
  assert.ok(ready.publicUrl!.startsWith(config!.storage!.publicBaseUrl + "/_test/"));

  // The public origin serves it (Cloudflare's public bucket access).
  const publicRes = await fetch(ready.publicUrl!, { signal: AbortSignal.timeout(20_000) });
  console.log(`# public URL answered ${publicRes.status} (${publicRes.headers.get("content-type")})`);
  assert.equal(publicRes.status, 200);
  assert.deepEqual(new Uint8Array(await publicRes.arrayBuffer()), png);

  const edited = await service.updateMetadata(who, ready.id, { version: ready.version, alt: "Flat blue test square" }, FACTS);
  assert.equal(edited.alt, "Flat blue test square");
  assert.deepEqual(await service.delete(who, ready.id, FACTS), { deleted: true, storage: "removed" });
  assert.equal(await storage.head(intent.objectKey), null, "object removed from R2");
  assert.ok(!JSON.stringify(data.audit).includes("X-Amz"), "no presigned URL in the audit trail");
});

/* M16: the bucket's CORS rule, as a browser meets it — the admin origins
   may PUT with Content-Type and nothing else; any other origin, method or
   header gets no allowance. Preflights carry no credentials, so this runs
   even before the token works.
     R2_CORS_ORIGINS          the admin origins the rule must allow
                              (default: the production admin and the local one)
     R2_CORS_REFUSED_ORIGINS  origins it must NOT allow, besides a foreign one
                              (default: the public website — it never uploads) */
const csv = (value: string) => value.split(",").map((o) => o.trim()).filter(Boolean);
test("CORS: the admin origins may PUT with Content-Type only; other origins, methods and headers are refused", { skip }, async () => {
  const origins = csv(process.env.R2_CORS_ORIGINS ?? "https://admin.risingbeyondborders.org,http://localhost:5174");
  const refusedOrigins = ["https://example.com", ...csv(process.env.R2_CORS_REFUSED_ORIGINS ?? "https://risingbeyondborders.org,https://www.risingbeyondborders.org")];
  const url = `${config!.storage!.endpoint.replace(/\/+$/, "")}/${config!.storage!.bucket}/_test/${orgId}/cors-preflight.png`;
  const preflight = (origin: string, method: string, headers?: string) =>
    fetch(url, { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": method, ...(headers ? { "Access-Control-Request-Headers": headers } : {}) }, signal: AbortSignal.timeout(20_000) });
  for (const origin of origins) {
    const res = await preflight(origin, "PUT", "content-type");
    assert.ok(res.ok && res.headers.get("access-control-allow-origin") === origin, `the bucket's CORS rule does not allow ${origin} to PUT with Content-Type (preflight ${res.status})`);
    assert.match(res.headers.get("access-control-allow-methods") ?? "", /PUT/);
    assert.doesNotMatch(res.headers.get("access-control-allow-methods") ?? "", /DELETE|POST|GET/, "only PUT is allowed");
    for (const [method, headers] of [["DELETE", undefined], ["POST", "content-type"], ["GET", undefined], ["PUT", "content-type,x-extra"]] as const) {
      const refused = await preflight(origin, method, headers);
      assert.ok(!refused.ok || !refused.headers.get("access-control-allow-origin"), `${method} ${headers ?? ""} must not be allowed`);
    }
  }
  for (const origin of refusedOrigins) {
    const refused = await preflight(origin, "PUT", "content-type");
    assert.ok(!refused.headers.get("access-control-allow-origin"), `${origin} must get no allowance`);
  }
});
