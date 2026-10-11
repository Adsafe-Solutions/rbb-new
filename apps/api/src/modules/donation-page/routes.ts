import { readJson } from "../../http/body.ts";
import { ok } from "../../http/response.ts";
import type { Context, Route } from "../../http/router.ts";
import type { RequestFacts } from "../audit/audit.ts";
import { requireAuth } from "../auth/permissions.ts";
import type { DonationPageService } from "./service.ts";
import { WORKFLOW_ACTIONS } from "../content/workflow.ts";
import { SCHEDULE_PERMISSION } from "../publishing/schedule.ts";

/* The general donation page — one per organization, so two routes and no
   collection CRUD. The central table's content permissions: owners and
   editors read and save; publishing the website stays publish:execute.

     GET   /api/v1/donation-page   content:read
     PATCH /api/v1/donation-page   content:update   { revision, changes }
     POST  /api/v1/donation-page/submit | /withdraw   content:update
     POST  /api/v1/donation-page/approve | /reject    content:approve
           (M14: the editorial workflow — content/workflow.ts)
     POST  /api/v1/donation-page/schedule | /unschedule   publish:execute (M15)

   Not public: the website reads the published page from the snapshot. */

const BODY_LIMIT = 128 * 1024;
const facts = ({ requestId, clientIp, request }: Context): RequestFacts => ({ requestId, clientIp, userAgent: request.headers.get("user-agent") });

export const donationPageRoutes = (service: () => Promise<DonationPageService>): Route[] => [
  {
    method: "GET",
    path: "/api/v1/donation-page",
    auth: "required",
    permission: "content:read",
    handler: async (context) => ok(await (await service()).get(requireAuth(context.auth))),
  },
  {
    method: "PATCH",
    path: "/api/v1/donation-page",
    auth: "required",
    permission: "content:update",
    handler: async (context) => ok(await (await service()).update(requireAuth(context.auth), await readJson(context.request, BODY_LIMIT), facts(context))),
  },
  ...WORKFLOW_ACTIONS.map(
    (action): Route => ({
      method: "POST",
      path: `/api/v1/donation-page/${action}`,
      auth: "required",
      permission: action === "approve" || action === "reject" ? "content:approve" : "content:update",
      handler: async (context) => ok(await (await service()).act(requireAuth(context.auth), action, await readJson(context.request, BODY_LIMIT), facts(context))),
    })
  ),
  ...(["schedule", "unschedule"] as const).map(
    (action): Route => ({
      method: "POST",
      path: `/api/v1/donation-page/${action}`,
      auth: "required",
      permission: SCHEDULE_PERMISSION,
      handler: async (context) => ok(await (await service())[action](requireAuth(context.auth), await readJson(context.request, BODY_LIMIT), facts(context))),
    })
  ),
];
