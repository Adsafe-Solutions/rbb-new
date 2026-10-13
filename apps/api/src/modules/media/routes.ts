import { readJson } from "../../http/body.ts";
import { json, ok } from "../../http/response.ts";
import type { Context, Route } from "../../http/router.ts";
import type { RequestFacts } from "../audit/audit.ts";
import { requireAuth } from "../auth/permissions.ts";
import { MediaService } from "./service.ts";

/* The media library over HTTP. Every route requires a session and a media
   permission from the central RBAC table (both checked by the app before a
   handler runs); handlers only translate HTTP to the service.

     GET    /api/v1/media/policy                 limits for client-side checks   media:read
     GET    /api/v1/media                        list (search, type, status, usage, sort, page);
                                                 each ready image says where it is used (usedBy)
     GET    /api/v1/media/:id                    one record, with usedBy
     POST   /api/v1/media/upload-intents         pending record + presigned PUT  media:write
     POST   /api/v1/media/:id/complete           verify the object → ready       media:write
     POST   /api/v1/media/:id/abort              upload failed/cancelled → failed media:write
     PATCH  /api/v1/media/:id                    alt, caption, credit, license, consent
     DELETE /api/v1/media/:id                    soft delete, then storage cleanup (409 while in use)

   Bodies are small JSON: file bytes go to storage, never here. */

const BODY_LIMIT = 8 * 1024;

const facts = ({ requestId, clientIp, request }: Context): RequestFacts => ({
  requestId,
  clientIp,
  userAgent: request.headers.get("user-agent"),
});

export const mediaRoutes = (media: () => Promise<MediaService>): Route[] => [
  {
    method: "GET",
    path: "/api/v1/media/policy",
    auth: "required",
    permission: "media:read",
    handler: () => ok(MediaService.policy()),
  },
  {
    method: "GET",
    path: "/api/v1/media",
    auth: "required",
    permission: "media:read",
    async handler(context) {
      const { items, pagination } = await (await media()).list(requireAuth(context.auth), Object.fromEntries(context.url.searchParams));
      return json(200, { data: items, pagination });
    },
  },
  {
    method: "GET",
    path: "/api/v1/media/:id",
    auth: "required",
    permission: "media:read",
    handler: async (context) => ok(await (await media()).get(requireAuth(context.auth), context.params.id!)),
  },
  {
    method: "POST",
    path: "/api/v1/media/upload-intents",
    auth: "required",
    permission: "media:write",
    async handler(context) {
      const body = await readJson(context.request, BODY_LIMIT);
      return ok(await (await media()).createUploadIntent(requireAuth(context.auth), body, facts(context)), 201);
    },
  },
  {
    method: "POST",
    path: "/api/v1/media/:id/complete",
    auth: "required",
    permission: "media:write",
    handler: async (context) => ok(await (await media()).complete(requireAuth(context.auth), context.params.id!, facts(context))),
  },
  {
    method: "POST",
    path: "/api/v1/media/:id/abort",
    auth: "required",
    permission: "media:write",
    handler: async (context) => ok(await (await media()).abort(requireAuth(context.auth), context.params.id!, facts(context))),
  },
  {
    method: "PATCH",
    path: "/api/v1/media/:id",
    auth: "required",
    permission: "media:write",
    async handler(context) {
      const body = await readJson(context.request, BODY_LIMIT);
      return ok(await (await media()).updateMetadata(requireAuth(context.auth), context.params.id!, body, facts(context)));
    },
  },
  {
    method: "DELETE",
    path: "/api/v1/media/:id",
    auth: "required",
    permission: "media:write",
    handler: async (context) => ok(await (await media()).delete(requireAuth(context.auth), context.params.id!, facts(context))),
  },
];
