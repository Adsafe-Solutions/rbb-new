import { readJson } from "../../http/body.ts";
import { ok } from "../../http/response.ts";
import type { Context, Route } from "../../http/router.ts";
import type { RequestFacts } from "../audit/audit.ts";
import { requireAuth } from "../auth/permissions.ts";
import type { SettingsService } from "./service.ts";

/* Site settings over HTTP. Permissions come from the central RBAC table:
   settings:read (owners and editors), settings:write (owners).

     GET   /api/v1/settings   the working settings (null until imported)
     PATCH /api/v1/settings   { revision, changes: { <section>: … } } */

const BODY_LIMIT = 32 * 1024;

const facts = ({ requestId, clientIp, request }: Context): RequestFacts => ({ requestId, clientIp, userAgent: request.headers.get("user-agent") });

export const settingsRoutes = (settings: () => Promise<SettingsService>): Route[] => [
  {
    method: "GET",
    path: "/api/v1/settings",
    auth: "required",
    permission: "settings:read",
    handler: async (context) => ok(await (await settings()).get(requireAuth(context.auth))),
  },
  {
    method: "PATCH",
    path: "/api/v1/settings",
    auth: "required",
    permission: "settings:write",
    async handler(context) {
      const body = await readJson(context.request, BODY_LIMIT);
      return ok(await (await settings()).update(requireAuth(context.auth), body, facts(context)));
    },
  },
];
