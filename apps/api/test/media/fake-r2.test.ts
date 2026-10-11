import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { R2Storage } from "../../src/modules/media/r2.ts";
import { startFakeR2, type FakeR2 } from "../support/fake-r2.ts";
import { fixture } from "./memory.ts";

/* R2Storage over real HTTP against the signature-checking fake R2
   (test/support/fake-r2.ts): every request it makes must verify. */
let fake: FakeR2;
let storage: R2Storage;
const png = fixture("sample.png");
before(async () => {
  fake = await startFakeR2({ origins: ["https://admin.example"] });
  storage = new R2Storage({ endpoint: fake.url, bucket: fake.bucket, credentials: fake.credentials, publicBaseUrl: fake.publicBaseUrl });
});
after(() => fake.close());

const put = (url: string, body: Uint8Array, type: string) => fetch(url, { method: "PUT", body, headers: { "Content-Type": type } });

test("presigned PUT, then signed HEAD, ranged GET, public GET and DELETE all verify", async () => {
  const key = "_test/org-a/media/1b2c/photo one.png";
  const target = await storage.createUploadTarget({ key, contentType: "image/png", contentLength: png.byteLength, expiresInSeconds: 300 });
  assert.equal((await put(target.url, png, "image/png")).status, 200);
  assert.deepEqual(await storage.head(key), { size: png.byteLength, contentType: "image/png" });
  assert.deepEqual(await storage.readStart(key, 8), png.slice(0, 8));
  const pub = await fetch(storage.publicUrl(key));
  assert.equal(pub.status, 200);
  await storage.delete(key);
  assert.equal(await storage.head(key), null);
  assert.deepEqual(fake.rejected, []);
});

test("the presigned URL refuses another type, another length, or an expired signature", async () => {
  const key = "_test/org-a/media/9f9f/x.png";
  const target = await storage.createUploadTarget({ key, contentType: "image/png", contentLength: png.byteLength, expiresInSeconds: 300 });
  assert.equal((await put(target.url, png, "text/html")).status, 403);
  assert.equal((await put(target.url, new Uint8Array([...png, 1]), "image/png")).status, 403);
  const expired = await new R2Storage({ endpoint: fake.url, bucket: fake.bucket, credentials: fake.credentials, publicBaseUrl: fake.publicBaseUrl, now: () => new Date(Date.now() - 600_000) })
    .createUploadTarget({ key, contentType: "image/png", contentLength: png.byteLength, expiresInSeconds: 300 });
  assert.equal((await put(expired.url, png, "image/png")).status, 403);
  assert.equal(fake.objects.has(key), false);
  assert.deepEqual(fake.rejected, ["signature mismatch", "signature mismatch", "expired"]);
});

test("CORS: only the admin origin may PUT from a browser", async () => {
  const preflight = (origin: string) => fetch(`${fake.url}/${fake.bucket}/x`, { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "content-type" } });
  const ok = await preflight("https://admin.example");
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get("access-control-allow-origin"), "https://admin.example");
  assert.equal((await preflight("https://evil.example")).status, 403);
});
