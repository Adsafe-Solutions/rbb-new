import { readJson } from "../../http/body.ts";
import { ok } from "../../http/response.ts";
import type { Context, Route } from "../../http/router.ts";
import type { RequestFacts } from "../audit/audit.ts";
import { requireAuth } from "../auth/permissions.ts";
import type { PageRecord } from "./repository.ts";
import type { BlockPageService } from "./service.ts";
import { WORKFLOW_ACTIONS } from "../content/workflow.ts";
import { SCHEDULE_PERMISSION } from "../publishing/schedule.ts";

/* A block page's routes — one per organization, so no id in the address.
   The central table's content permissions (owners and editors alike);
   moving the page into published, and publishing the website, are
   owners' only.

     GET    /api/v1/<base>   content:read
     POST   /api/v1/<base>   content:create   create (once)
     PATCH  /api/v1/<base>   content:update   { revision, changes }
     DELETE /api/v1/<base>   content:delete   archive
     POST   /api/v1/<base>/submit | /withdraw   { revision }   content:update
     POST   /api/v1/<base>/approve | /reject    { revision }   content:approve
     POST   /api/v1/<base>/schedule   { revision, localTime, timeZone }   publish:execute (M15)
     POST   /api/v1/<base>/unschedule { revision }                        publish:execute
            (M14: the editorial workflow — content/workflow.ts)

   Not public: the website reads published pages from the snapshot. */

const BODY_LIMIT = 256 * 1024;
const facts = ({ requestId, clientIp, request }: Context): RequestFacts => ({ requestId, clientIp, userAgent: request.headers.get("user-agent") });

export const blockPageRoutes = <R extends PageRecord>(base: string, service: () => Promise<BlockPageService<R>>): Route[] => [
  { method: "GET", path: `/api/v1/${base}`, auth: "required", permission: "content:read", handler: async (c) => ok(await (await service()).get(requireAuth(c.auth))) },
  { method: "POST", path: `/api/v1/${base}`, auth: "required", permission: "content:create", handler: async (c) => ok(await (await service()).create(requireAuth(c.auth), await readJson(c.request, BODY_LIMIT), facts(c)), 201) },
  { method: "PATCH", path: `/api/v1/${base}`, auth: "required", permission: "content:update", handler: async (c) => ok(await (await service()).update(requireAuth(c.auth), await readJson(c.request, BODY_LIMIT), facts(c))) },
  { method: "DELETE", path: `/api/v1/${base}`, auth: "required", permission: "content:delete", handler: async (c) => ok(await (await service()).archive(requireAuth(c.auth), facts(c))) },
  ...WORKFLOW_ACTIONS.map(
    (action): Route => ({
      method: "POST",
      path: `/api/v1/${base}/${action}`,
      auth: "required",
      permission: action === "approve" || action === "reject" ? "content:approve" : "content:update",
      handler: async (c) => ok(await (await service()).act(requireAuth(c.auth), action, await readJson(c.request, BODY_LIMIT), facts(c))),
    })
  ),
  ...(["schedule", "unschedule"] as const).map(
    (action): Route => ({
      method: "POST",
      path: `/api/v1/${base}/${action}`,
      auth: "required",
      permission: SCHEDULE_PERMISSION,
      handler: async (c) => ok(await (await service())[action](requireAuth(c.auth), await readJson(c.request, BODY_LIMIT), facts(c))),
    })
  ),
];
