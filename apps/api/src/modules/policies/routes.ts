import { POLICY_IDS, type Policy, type PolicyId } from "@rbb/content-schema";
import { ok } from "../../http/response.ts";
import type { Route } from "../../http/router.ts";
import { requireAuth } from "../auth/permissions.ts";
import { blockPageRoutes } from "../pages/routes.ts";
import type { PolicyDirectory, PolicyService } from "./service.ts";

/* The policies' routes (M19): the list, then each fixed policy as a typed
   single page at /api/v1/policies/<id> (modules/pages/routes.ts — the same
   permissions: content:* to edit, content:approve to approve, publish:execute
   to schedule). An id that is not one of the three has no route. */
export const policyRoutes = (directory: () => Promise<PolicyDirectory>, policy: (id: PolicyId) => Promise<PolicyService>): Route[] => [
  { method: "GET", path: "/api/v1/policies", auth: "required", permission: "content:read", handler: async (c) => ok(await (await directory()).list(requireAuth(c.auth))) },
  ...POLICY_IDS.flatMap((id) => blockPageRoutes<Policy>(`policies/${id}`, () => policy(id))),
];
