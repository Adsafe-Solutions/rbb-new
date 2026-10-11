import { test } from "node:test";
import assert from "node:assert/strict";
import { ConfigError, loadConfig } from "../../src/config/env.ts";
import { R2Storage } from "../../src/modules/media/r2.ts";
import { StorageError } from "../../src/modules/media/storage.ts";

/* R2Storage against a recorded fetch: what it sends, where, and how it
   reads answers. (test/live/r2.live.test.ts runs it against real R2.) */

const FAKE = { accessKeyId: "AKIDEXAMPLEEXAMPLE01", secretAccessKey: "fakesecretfakesecretfakesecretfakesecret0" };

function recording(answers: Response[] = []) {
  const calls: { url: string; method: string; headers: Record<string, string> }[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method ?? "GET", headers: Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>)) });
    return answers.shift() ?? new Response(null, { status: 200 });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

const storage = (fetchImpl: typeof fetch) =>
  new R2Storage({ endpoint: "https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/media-bucket", bucket: "media-bucket", credentials: FAKE, publicBaseUrl: "https://media.example.org/", fetch: fetchImpl, now: () => new Date("2026-10-07T10:00:00Z") });

test("presigned PUT: one object, path-style, 5-minute expiry, type and length signed — no secret in it", async () => {
  const r2 = storage(recording().fetchImpl);
  const target = await r2.createUploadTarget({ key: "_test/org-a/media/3f0b/photo.png", contentType: "image/png", contentLength: 1234, expiresInSeconds: 300 });
  const url = new URL(target.url);
  assert.equal(url.origin, "https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com", "the bucket path in the configured endpoint is not doubled");
  assert.equal(url.pathname, "/media-bucket/_test/org-a/media/3f0b/photo.png");
  assert.equal(url.searchParams.get("X-Amz-Expires"), "300");
  assert.equal(url.searchParams.get("X-Amz-SignedHeaders"), "content-length;content-type;host");
  assert.match(url.searchParams.get("X-Amz-Credential")!, /^AKIDEXAMPLEEXAMPLE01\/20261007\/auto\/s3\/aws4_request$/);
  assert.ok(!target.url.includes(FAKE.secretAccessKey));
  assert.deepEqual(target.headers, { "Content-Type": "image/png" });
  assert.equal(target.expiresAt.toISOString(), "2026-10-07T10:05:00.000Z");
});

test("head / readStart / delete: signed requests; 404 is 'absent', other failures are StorageError", async () => {
  const { calls, fetchImpl } = recording([
    new Response(null, { status: 200, headers: { "content-length": "1234", "content-type": "image/png" } }),
    new Response(null, { status: 404 }),
    new Response(new Uint8Array([1, 2, 3, 4]), { status: 206 }),
    new Response(null, { status: 204 }),
    new Response(null, { status: 404 }),
    new Response(null, { status: 403 }),
  ]);
  const r2 = storage(fetchImpl);
  assert.deepEqual(await r2.head("a/b.png"), { size: 1234, contentType: "image/png" });
  assert.equal(await r2.head("a/missing.png"), null);
  assert.deepEqual(await r2.readStart("a/b.png", 2), new Uint8Array([1, 2]));
  await r2.delete("a/b.png");
  await r2.delete("a/already-gone.png");
  await assert.rejects(r2.delete("a/forbidden.png"), StorageError);
  assert.equal(calls[2]!.headers.range, "bytes=0-1");
  for (const call of calls) {
    assert.match(call.headers.authorization!, /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLEEXAMPLE01\/20261007\/auto\/s3\/aws4_request, ?SignedHeaders=/);
    assert.ok(!JSON.stringify(call).includes(FAKE.secretAccessKey));
  }
});

test("a network failure becomes a StorageError naming no secret", async () => {
  const r2 = storage((async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch);
  await assert.rejects(r2.head("x.png"), (error: unknown) => error instanceof StorageError && !error.message.includes(FAKE.secretAccessKey));
});

test("public URLs come from the configured public origin, never the S3 endpoint", () => {
  const r2 = storage(recording().fetchImpl);
  assert.equal(r2.publicUrl("org/media/3f0b/a b.png"), "https://media.example.org/org/media/3f0b/a%20b.png");
});

const R2 = {
  R2_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
  R2_BUCKET: "media-bucket",
  R2_ACCESS_KEY_ID: "AKIDEXAMPLEEXAMPLE01",
  R2_SECRET_ACCESS_KEY: "fakesecretfakesecretfakesecretfakesecret0",
  R2_PUBLIC_URL: "https://media.example.org",
};

test("config: R2 is all-or-none; missing variables are named, values never echoed", () => {
  assert.equal(loadConfig({}).storage, null);
  const config = loadConfig(R2);
  assert.equal(config.storage?.endpoint, "https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com");
  assert.equal(config.storage?.publicBaseUrl, "https://media.example.org");
  assert.equal(loadConfig({ ...R2, R2_S3_API: `https://${R2.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/media-bucket` }).storage?.endpoint, `https://${R2.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);

  const { R2_PUBLIC_URL: _omit, ...partial } = R2;
  assert.throws(() => loadConfig(partial), (error: unknown) => {
    assert.ok(error instanceof ConfigError);
    assert.deepEqual(error.problems, ["R2_PUBLIC_URL is required when any R2_* media storage variable is set"]);
    return true;
  });
  for (const [name, value] of [
    ["R2_PUBLIC_URL", "http://media.example.org"],
    ["R2_PUBLIC_URL", `https://${R2.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`],
    ["R2_PUBLIC_URL", "https://media.example.org/?x=1"],
    ["R2_S3_API", "https://evil.example.com"],
    ["R2_ACCOUNT_ID", "not-an-account"],
  ])
    assert.throws(() => loadConfig({ ...R2, [name]: value }), (error: unknown) => {
      assert.ok(error instanceof ConfigError);
      assert.ok(error.problems.some((p) => p.startsWith(`${name} `)), error.problems.join());
      assert.ok(!error.problems.join().includes(value), "the value is never repeated");
      return true;
    });
});
