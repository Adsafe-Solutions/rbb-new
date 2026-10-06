/* Small HTTP helpers shared by the form endpoint (Document 21) and the
   donation endpoints (Document 22). Standard Fetch API objects only, so
   they run in any serverless runtime. */
import { randomBytes } from "node:crypto";

/* Crockford-style alphabet: no 0/O or 1/I to misread over the phone. */
const B32 = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/* A reference a person can quote. 8 characters for form submissions;
   donations use 16 (80 bits), because a donation reference is also the
   key to its status (server/donations/handler.mjs) and must not be
   guessable. 256 is a multiple of 32, so `% 32` has no bias. */
export const newReference = (prefix = "RBB-", length = 8) =>
  prefix + [...randomBytes(length)].map((b) => B32[b % B32.length]).join("");

export const json = (status, body, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extra,
    },
  });

/* Read at most `limit` bytes as text; null if the body is larger. */
export async function readBody(request, limit) {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
}

export const isJson = (request) =>
  /^application\/json\b/i.test(request.headers.get("content-type") ?? "");
