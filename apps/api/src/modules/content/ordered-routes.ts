import { readJson } from "../../http/body.ts";
import { json } from "../../http/response.ts";
import type { Route } from "../../http/router.ts";
import { requireAuth } from "../auth/permissions.ts";
import type { ContentRecordBase } from "./repository.ts";
import { contentRoutes } from "./routes.ts";
import type { OrderedContentService } from "./ordered.ts";

/* An ordered collection's routes: the shared content routes (list, one,
   create, edit, DELETE archives), plus its order:

     POST /api/v1/<base>/order   content:update   { items: [{ id, revision }] } */
export const orderedContentRoutes = <R extends ContentRecordBase & { order: number; publishedAt?: string }>(base: string, service: () => Promise<OrderedContentService<R>>): Route[] => [
  ...contentRoutes<R>(base, service),
  {
    method: "POST",
    path: `/api/v1/${base}/order`,
    auth: "required",
    permission: "content:update",
    handler: async (context) =>
      json(200, {
        data: await (await service()).reorder(requireAuth(context.auth), await readJson(context.request, 64 * 1024), { requestId: context.requestId, clientIp: context.clientIp, userAgent: context.request.headers.get("user-agent") }),
      }),
  },
];
