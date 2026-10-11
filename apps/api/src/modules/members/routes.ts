import { z } from "zod";
import { fromZod } from "../../errors.ts";
import { readJson } from "../../http/body.ts";
import { ok } from "../../http/response.ts";
import type { Context, Route } from "../../http/router.ts";
import type { RequestFacts } from "../audit/audit.ts";
import { requireAuth } from "../auth/permissions.ts";
import type { MemberService } from "./service.ts";

/* Team management over HTTP (M17.1). Owners only: users:read to look,
   users:write to change. A member's id is their user id.

     GET  /api/v1/members                        the team
     POST /api/v1/members                        { email, name, role } — no password yet
     GET  /api/v1/members/:id
     POST /api/v1/members/:id/role               { revision, role }
     POST /api/v1/members/:id/deactivate         { revision } — also signs them out everywhere
     POST /api/v1/members/:id/reactivate         { revision }
     POST /api/v1/members/:id/sessions/revoke    signs them out everywhere
     POST /api/v1/members/:id/setup-link         M17.2: { token, expiresAt } — shown ONCE, delivered by hand

   Like every state-changing route, the POSTs need an allowed Origin. */

const BODY_LIMIT = 4 * 1024;
const Params = z.object({ id: z.uuid() });

const facts = ({ requestId, clientIp, request }: Context): RequestFacts => ({ requestId, clientIp, userAgent: request.headers.get("user-agent") });

const idOf = (context: Context) => {
  const params = Params.safeParse(context.params);
  if (!params.success) throw fromZod(params.error, "params");
  return params.data.id;
};

type Change = "changeRole" | "deactivate" | "reactivate";

export const memberRoutes = (members: () => Promise<MemberService>): Route[] => {
  const change = (path: string, method: Change): Route => ({
    method: "POST",
    path: `/api/v1/members/:id/${path}`,
    auth: "required",
    permission: "users:write",
    async handler(context) {
      const id = idOf(context);
      const body = await readJson(context.request, BODY_LIMIT);
      return ok(await (await members())[method](requireAuth(context.auth), id, body, facts(context)));
    },
  });

  return [
    {
      method: "GET",
      path: "/api/v1/members",
      auth: "required",
      permission: "users:read",
      handler: async (context) => ok(await (await members()).list(requireAuth(context.auth))),
    },
    {
      method: "POST",
      path: "/api/v1/members",
      auth: "required",
      permission: "users:write",
      async handler(context) {
        const body = await readJson(context.request, BODY_LIMIT);
        return ok(await (await members()).create(requireAuth(context.auth), body, facts(context)));
      },
    },
    {
      method: "GET",
      path: "/api/v1/members/:id",
      auth: "required",
      permission: "users:read",
      handler: async (context) => ok(await (await members()).get(requireAuth(context.auth), idOf(context))),
    },
    change("role", "changeRole"),
    change("deactivate", "deactivate"),
    change("reactivate", "reactivate"),
    {
      method: "POST",
      path: "/api/v1/members/:id/setup-link",
      auth: "required",
      permission: "users:write",
      handler: async (context) => ok(await (await members()).issueSetupLink(requireAuth(context.auth), idOf(context), facts(context))),
    },
    {
      method: "POST",
      path: "/api/v1/members/:id/sessions/revoke",
      auth: "required",
      permission: "users:write",
      handler: async (context) => ok(await (await members()).revokeSessions(requireAuth(context.auth), idOf(context), facts(context))),
    },
  ];
};
