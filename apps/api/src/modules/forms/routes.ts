import { MAX_BODY_BYTES } from "@rbb/forms";
import { errors } from "../../errors.ts";
import { readJson } from "../../http/body.ts";
import { ok } from "../../http/response.ts";
import type { Route } from "../../http/router.ts";
import type { FormService } from "./service.ts";

/* The public site's forms over HTTP (M18).

     POST /api/v1/forms/:formId   { formId, fields, website, elapsedMs, antiSpamToken }
                                  → { data: { reference } }

   Public: no session. The app has already refused a POST whose Origin is
   not on the allow-list (CSRF) and answered the CORS preflight; here the
   Origin must be EXACTLY the public site (WEB_ORIGIN) — the admin origin
   has no business posting a visitor's form. JSON only, at most
   MAX_BODY_BYTES (415 / 413 / 400 from readJson). */

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
