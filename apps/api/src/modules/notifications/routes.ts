import { ok } from "../../http/response.ts";
import type { Route } from "../../http/router.ts";
import { requireAuth } from "../auth/permissions.ts";
import type { NotificationService } from "./service.ts";

/* The topbar's notifications (2026-10-13). Any signed-in member; the
   service includes only what their permissions allow.

     GET /api/v1/notifications   { submissions, publishing, canApprove, canPublish, checkedAt } */

export const notificationRoutes = (service: () => Promise<NotificationService>): Route[] => [
  { method: "GET", path: "/api/v1/notifications", auth: "required", handler: async (c) => ok(await (await service()).list(requireAuth(c.auth))) },
];
