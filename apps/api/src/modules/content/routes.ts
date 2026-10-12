import { readJson } from "../../http/body.ts";
import { json, ok } from "../../http/response.ts";
import type { Context, Route } from "../../http/router.ts";
import type { RequestFacts } from "../audit/audit.ts";
import { requireAuth } from "../auth/permissions.ts";
import type { ContentRecordBase } from "./repository.ts";
import type { ContentService } from "./service.ts";
import { OWNER_ACTIONS, WORKFLOW_ACTIONS } from "./workflow.ts";
import { SCHEDULE_PERMISSION } from "../publishing/schedule.ts";

/* The admin's routes for a content collection — thin: HTTP ↔ service.
   Permissions are the central table's content:* ones (owners and editors
   alike); publishing the website stays publish:execute (owners).

     GET    /api/v1/<base>        list (search, status, type, sort, page)   content:read
     GET    /api/v1/<base>/:id    one record                                content:read
     POST   /api/v1/<base>        create                                    content:create
     PATCH  /api/v1/<base>/:id    { revision, changes, confirmSlugChange? } content:update
     DELETE /api/v1/<base>/:id    archive (nothing is ever destroyed)       content:delete
     POST   /api/v1/<base>/:id/submit | /withdraw   { revision }           content:update
     POST   /api/v1/<base>/:id/approve | /reject    { revision }           content:approve
            (M14: the editorial workflow — content/workflow.ts)
     POST   /api/v1/<base>/:id/schedule   { revision, localTime, timeZone } publish:execute
     POST   /api/v1/<base>/:id/unschedule { revision }                      publish:execute
            (M15: when an approved revision joins a website publish —
            publishing/schedule.ts)

   None of these is public: the website reads published records only
   through the snapshot (GET /api/v1/public/snapshot). */

const BODY_LIMIT = 128 * 1024;
const facts = ({ requestId, clientIp, request }: Context): RequestFacts => ({ requestId, clientIp, userAgent: request.headers.get("user-agent") });

export const contentRoutes = <R extends ContentRecordBase & { publishedAt?: string }>(base: string, service: () => Promise<ContentService<R>>): Route[] => [
  {
    method: "GET",
    path: `/api/v1/${base}`,
    auth: "required",
    permission: "content:read",
    async handler(context) {
      const { items, pagination } = await (await service()).list(requireAuth(context.auth), Object.fromEntries(context.url.searchParams));
      return json(200, { data: items, pagination });
    },
  },
  {
    method: "GET",
    path: `/api/v1/${base}/:id`,
    auth: "required",
    permission: "content:read",
    handler: async (context) => ok(await (await service()).get(requireAuth(context.auth), context.params.id!)),
  },
  {
    method: "POST",
    path: `/api/v1/${base}`,
    auth: "required",
    permission: "content:create",
    handler: async (context) => ok(await (await service()).create(requireAuth(context.auth), await readJson(context.request, BODY_LIMIT), facts(context)), 201),
  },
  {
    method: "PATCH",
    path: `/api/v1/${base}/:id`,
    auth: "required",
    permission: "content:update",
    handler: async (context) => ok(await (await service()).update(requireAuth(context.auth), context.params.id!, await readJson(context.request, BODY_LIMIT), facts(context))),
  },
  {
    method: "DELETE",
    path: `/api/v1/${base}/:id`,
    auth: "required",
    permission: "content:delete",
    handler: async (context) => ok(await (await service()).archive(requireAuth(context.auth), context.params.id!, facts(context))),
  },
  ...WORKFLOW_ACTIONS.map(
    (action): Route => ({
      method: "POST",
      path: `/api/v1/${base}/:id/${action}`,
      auth: "required",
      permission: OWNER_ACTIONS.includes(action) ? "content:approve" : "content:update",
      handler: async (context) => ok(await (await service()).act(requireAuth(context.auth), context.params.id!, action, await readJson(context.request, BODY_LIMIT), facts(context))),
    })
  ),
  ...(["schedule", "unschedule"] as const).map(
    (action): Route => ({
      method: "POST",
      path: `/api/v1/${base}/:id/${action}`,
      auth: "required",
      permission: SCHEDULE_PERMISSION,
      handler: async (context) => ok(await (await service())[action](requireAuth(context.auth), context.params.id!, await readJson(context.request, BODY_LIMIT), facts(context))),
    })
  ),
];
