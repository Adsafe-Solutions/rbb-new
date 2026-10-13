import { MAX_BODY_BYTES } from "@rbb/forms";
import { MAX_FILE_BYTES, type FormDefinition } from "@rbb/content-schema";
import { errors } from "../../errors.ts";
import { readJson } from "../../http/body.ts";
import { ok } from "../../http/response.ts";
import type { Route } from "../../http/router.ts";
import type { FormService } from "./service.ts";
import type { FormUploadService } from "./uploads.ts";

/* The public site's forms over HTTP (M18).

     POST /api/v1/forms/:formId   { formId, fields, website, elapsedMs, antiSpamToken }
                                  → { data: { reference } }

   Public: no session. The app has already refused a POST whose Origin is
   not on the allow-list (CSRF) and answered the CORS preflight; here the
   Origin must be EXACTLY the public site (WEB_ORIGIN) — the admin origin
   has no business posting a visitor's form. JSON only, at most
   MAX_BODY_BYTES (415 / 413 / 400 from readJson). */

/* The raw request body, at most `limit` bytes (413 beyond). */
async function readBytes(request: Request, limit: number): Promise<Uint8Array> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) throw errors.payloadTooLarge(limit);
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
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
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.byteLength;
  }
  return bytes;
}

const decodeName = (value: string | null) => {
  try {
    return value ? decodeURIComponent(value).slice(0, 255) : null;
  } catch {
    return null;
  }
};

export interface UploadDeps {
  uploads: FormUploadService;
  definitions: { live(id: string): Promise<FormDefinition | null> };
}

/* POST /api/v1/forms/:formId/files?field=<id>   the file's bytes as the body
   (its type in Content-Type, its name URI-encoded in X-File-Name)
   → { data: { id, name, size } } — the id goes in the form's field. */
export const formUploadRoutes = (deps: () => Promise<UploadDeps>, webOrigin: string | null): Route[] => [
  {
    method: "POST",
    path: "/api/v1/forms/:formId/files",
    async handler(context) {
      if (!webOrigin || context.request.headers.get("origin") !== webOrigin) throw errors.forbidden("Uploads are accepted from the website only.");
      const { uploads, definitions } = await deps();
      const definition = await definitions.live(context.params.formId ?? "");
      const bytes = await readBytes(context.request, MAX_FILE_BYTES);
      return ok(await uploads.accept(definition, context.url.searchParams.get("field") ?? "", bytes, decodeName(context.request.headers.get("x-file-name")), context.clientIp), 201);
    },
  },
];

export const formRoutes = (forms: () => Promise<FormService>, webOrigin: string | null): Route[] => [
  {
    method: "POST",
    path: "/api/v1/forms/:formId",
    async handler(context) {
      if (!webOrigin || context.request.headers.get("origin") !== webOrigin) throw errors.forbidden("Submissions are accepted from the website only.");
      const body = await readJson(context.request, MAX_BODY_BYTES);
      const result = await (await forms()).submit(context.params.formId ?? "", body, {
        requestId: context.requestId,
        clientIp: context.clientIp,
        idempotencyKey: context.request.headers.get("idempotency-key"),
      });
      return ok(result);
    },
  },
];
