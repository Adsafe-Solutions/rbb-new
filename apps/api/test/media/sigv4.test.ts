import { test } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_PAYLOAD_SHA256, encodeKeyPath, presignUrl, signHeaders } from "../../src/modules/media/sigv4.ts";

/* The worked examples from AWS's S3 documentation ("Signature Version 4:
   examples" — GET Object with a header signature, and a presigned URL).
   Their credentials are AWS's published example values, not real ones. */
const credentials = { accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" };
const scope = { region: "us-east-1", service: "s3" };
const date = new Date("2013-05-24T00:00:00Z");

test("header signature matches AWS's GET Object example", () => {
  const headers = signHeaders({
    method: "GET",
    url: new URL("https://examplebucket.s3.amazonaws.com/test.txt"),
    headers: { range: "bytes=0-9" },
    credentials,
    scope,
    date,
    payloadHash: EMPTY_PAYLOAD_SHA256,
  });
  assert.equal(
    headers.authorization,
    "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request,SignedHeaders=host;range;x-amz-content-sha256;x-amz-date,Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41"
  );
  assert.equal(headers["x-amz-date"], "20130524T000000Z");
});

test("presigned URL matches AWS's presigned GET example", () => {
  const url = presignUrl({ method: "GET", url: new URL("https://examplebucket.s3.amazonaws.com/test.txt"), credentials, scope, date, expiresInSeconds: 86400 });
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get("X-Amz-Signature"), "aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404");
  assert.equal(parsed.searchParams.get("X-Amz-SignedHeaders"), "host");
  assert.equal(parsed.searchParams.get("X-Amz-Expires"), "86400");
  assert.ok(!url.includes(credentials.secretAccessKey), "the secret is never in the URL");
});

test("object keys are encoded per segment, slashes kept", () => {
  assert.equal(encodeKeyPath("org/media/a b/ü(1).jpg"), "org/media/a%20b/%C3%BC%281%29.jpg");
});
