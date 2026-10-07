import { errors } from "../errors.ts";

/* Request bodies. The API accepts JSON only, and never more than it needs:

     BODY_LIMIT_BYTES   the most any request may declare (checked by the
                        app before routing). Content records are the
                        largest JSON the API will take; 256 KiB holds a
                        long article with room to spare.
     readJson(…, limit) a route's own, usually smaller, limit — enforced
                        while streaming, so a body that lies about its
                        length (or sends none) is still cut off.

   Files never travel through here: media will upload straight to storage
   with signed URLs. */
export const BODY_LIMIT_BYTES = 256 * 1024;

export async function readJson(request: Request, limit = BODY_LIMIT_BYTES): Promise<unknown> {
  if (!/^application\/json\b/i.test(request.headers.get("content-type") ?? "")) throw errors.unsupportedMediaType();
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) throw errors.payloadTooLarge(limit);
  if (!request.body) throw errors.badRequest("A JSON request body is required.");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      throw errors.payloadTooLarge(limit);
    }
    chunks.push(value);
  }
  const text = new TextDecoder().decode(Buffer.concat(chunks));
  if (!text.trim()) throw errors.badRequest("A JSON request body is required.");
  try {
    return JSON.parse(text);
  } catch {
    throw errors.badRequest("The request body is not valid JSON.");
  }
}
