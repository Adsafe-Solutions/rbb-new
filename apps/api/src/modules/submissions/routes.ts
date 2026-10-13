import { readJson } from "../../http/body.ts";
import { ok } from "../../http/response.ts";
import type { Context, Route } from "../../http/router.ts";
import type { RequestFacts } from "../audit/audit.ts";
import type { SubmissionService } from "./service.ts";

/* Form submissions over HTTP — owners only.

     GET    /api/v1/submissions          ?form&status&from&to&q&before&limit
                                         { items, next, counts } newest first
     GET    /api/v1/submissions/:id      the whole submission
     POST   /api/v1/submissions/:id/status   { status: "new" | "read" }
     DELETE /api/v1/submissions/:id      deletes it for good

   The public site adds them (modules/forms); nothing here creates one. */

const BODY_LIMIT = 1024;
const facts = ({ requestId, clientIp, request }: Context): RequestFacts => ({ requestId, clientIp, userAgent: request.headers.get("user-agent") });

export const submissionRoutes = (service: () => Promise<SubmissionService>): Route[] => [
  {
    method: "GET",
    path: "/api/v1/submissions",
    auth: "required",
    permission: "submissions:read",
    handler: async (c) => ok(await (await service()).list(c.auth, Object.fromEntries(c.url.searchParams))),
  },
  {
    method: "GET",
    path: "/api/v1/submissions/:id",
    auth: "required",
    permission: "submissions:read",
    handler: async (c) => ok(await (await service()).get(c.auth, c.params.id)),
  },
  {
    method: "POST",
    path: "/api/v1/submissions/:id/status",
    auth: "required",
    permission: "submissions:write",
    handler: async (c) => ok(await (await service()).setStatus(c.auth, c.params.id, await readJson(c.request, BODY_LIMIT), facts(c))),
  },
  {
    method: "DELETE",
    path: "/api/v1/submissions/:id",
    auth: "required",
    permission: "submissions:write",
    handler: async (c) => ok(await (await service()).remove(c.auth, c.params.id, facts(c))),
  },
];
