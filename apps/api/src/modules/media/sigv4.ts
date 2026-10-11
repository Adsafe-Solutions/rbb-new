import { createHash, createHmac } from "node:crypto";

/* AWS Signature Version 4 — the request signing that S3-compatible
   storage (Cloudflare R2) accepts. Two uses:

     presignUrl     a URL that carries its own signature in the query
                    string, for the browser's direct upload: it is valid
                    for `expiresInSeconds`, for one method, one object and
                    the signed headers only.
     signHeaders    the Authorization header for the API's own calls
                    (HEAD, ranged GET, DELETE).

   About a hundred lines on node:crypto instead of an SDK dependency. The
   implementation is checked against the worked examples in AWS's S3
   SigV4 documentation (test/media/sigv4.test.ts).

   Nothing here logs, and no secret leaves this module except as an HMAC. */

export interface Credentials {
  accessKeyId: string;
  secretAccessKey: string;
}

export interface SigningScope {
  region: string;
  service: string;
}

export const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";
export const EMPTY_PAYLOAD_SHA256 = createHash("sha256").update("").digest("hex");

const sha256Hex = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const hmac = (key: Buffer | string, value: string) => createHmac("sha256", key).update(value, "utf8").digest();

/* RFC 3986 encoding as SigV4 requires: everything except A–Z a–z 0–9 - . _ ~ */
export const encodeRfc3986 = (value: string) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/* An object key as a URL path: each segment encoded, the slashes kept. */
export const encodeKeyPath = (key: string) => key.split("/").map(encodeRfc3986).join("/");

export const amzDate = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function canonicalQuery(params: URLSearchParams): string {
  return [...params.entries()]
    .map(([k, v]) => [encodeRfc3986(k), encodeRfc3986(v)] as const)
    .sort(([a, av], [b, bv]) => (a < b ? -1 : a > b ? 1 : av < bv ? -1 : av > bv ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
}

function canonicalHeaders(headers: Record<string, string>) {
  const entries = Object.entries(headers)
    .map(([name, value]) => [name.toLowerCase(), value.trim().replace(/\s+/g, " ")] as const)
    .sort(([a], [b]) => (a < b ? -1 : 1));
  return {
    block: entries.map(([name, value]) => `${name}:${value}\n`).join(""),
    signed: entries.map(([name]) => name).join(";"),
  };
}

function signature(credentials: Credentials, scope: SigningScope, date: Date, canonicalRequest: string) {
  const day = amzDate(date).slice(0, 8);
  const credentialScope = `${day}/${scope.region}/${scope.service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate(date), credentialScope, sha256Hex(canonicalRequest)].join("\n");
  const key = hmac(hmac(hmac(hmac(`AWS4${credentials.secretAccessKey}`, day), scope.region), scope.service), "aws4_request");
  return { credentialScope, value: createHmac("sha256", key).update(stringToSign, "utf8").digest("hex") };
}

/* `url` must not already carry X-Amz-* parameters. `headers` are the
   headers the caller MUST then send exactly (host is added). */
export function presignUrl(options: {
  method: string;
  url: URL;
  headers?: Record<string, string>;
  credentials: Credentials;
  scope: SigningScope;
  date: Date;
  expiresInSeconds: number;
}): string {
  const { method, credentials, scope, date, expiresInSeconds } = options;
  const url = new URL(options.url);
  const headers = canonicalHeaders({ host: url.host, ...options.headers });
  const day = amzDate(date).slice(0, 8);
  url.searchParams.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
  url.searchParams.set("X-Amz-Credential", `${credentials.accessKeyId}/${day}/${scope.region}/${scope.service}/aws4_request`);
  url.searchParams.set("X-Amz-Date", amzDate(date));
  url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
  url.searchParams.set("X-Amz-SignedHeaders", headers.signed);
  const canonicalRequest = [method, url.pathname, canonicalQuery(url.searchParams), headers.block, headers.signed, UNSIGNED_PAYLOAD].join("\n");
  const signed = signature(credentials, scope, date, canonicalRequest);
  return `${url.origin}${url.pathname}?${canonicalQuery(url.searchParams)}&X-Amz-Signature=${signed.value}`;
}

/* The headers to send with a request signed in the Authorization header. */
export function signHeaders(options: {
  method: string;
  url: URL;
  headers?: Record<string, string>;
  credentials: Credentials;
  scope: SigningScope;
  date: Date;
  payloadHash?: string;
}): Record<string, string> {
  const { method, url, credentials, scope, date } = options;
  const payloadHash = options.payloadHash ?? EMPTY_PAYLOAD_SHA256;
  const all = { ...options.headers, host: url.host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate(date) };
  const headers = canonicalHeaders(all);
  const canonicalRequest = [method, url.pathname, canonicalQuery(url.searchParams), headers.block, headers.signed, payloadHash].join("\n");
  const signed = signature(credentials, scope, date, canonicalRequest);
  const { host: _host, ...send } = all;
  return {
    ...send,
    authorization: `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${signed.credentialScope},SignedHeaders=${headers.signed},Signature=${signed.value}`,
  };
}
