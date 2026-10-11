import { GET_INVOLVED_PAGE_IDS, type GetInvolvedPage, type GetInvolvedPageId } from "@rbb/content-schema";
import { ok } from "../../http/response.ts";
import type { Route } from "../../http/router.ts";
import { requireAuth } from "../auth/permissions.ts";
import { blockPageRoutes } from "../pages/routes.ts";
import type { GetInvolvedDirectory, GetInvolvedService } from "./service.ts";

/* The Get Involved routes (M20): the list, then each fixed page as a typed
   single page at /api/v1/get-involved/<id> (modules/pages/routes.ts — the
   same permissions: content:* to edit, content:approve to approve,
   publish:execute to schedule). An id that is not one of the five has no
   route. */
export const getInvolvedRoutes = (directory: () => Promise<GetInvolvedDirectory>, page: (id: GetInvolvedPageId) => Promise<GetInvolvedService>): Route[] => [
  { method: "GET", path: "/api/v1/get-involved", auth: "required", permission: "content:read", handler: async (c) => ok(await (await directory()).list(requireAuth(c.auth))) },
  ...GET_INVOLVED_PAGE_IDS.flatMap((id) => blockPageRoutes<GetInvolvedPage>(`get-involved/${id}`, () => page(id))),
];
