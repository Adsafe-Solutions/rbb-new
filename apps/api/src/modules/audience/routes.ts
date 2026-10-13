import { ok } from "../../http/response.ts";
import type { Context, Route } from "../../http/router.ts";
import type { RequestFacts } from "../audit/audit.ts";
import type { AudienceService } from "./service.ts";

/* Admin → Audience — owners only (submissions:read).

     GET /api/v1/audience            ?q&marketing=yes|no|unknown&form&page
                                     { items, total, matching, optedIn, page, pages }
     GET /api/v1/audience/export     the same filters → text/csv (download) */

const facts = ({ requestId, clientIp, request }: Context): RequestFacts => ({ requestId, clientIp, userAgent: request.headers.get("user-agent") });

export const audienceRoutes = (service: () => Promise<AudienceService>): Route[] => [
  { method: "GET", path: "/api/v1/audience", auth: "required", permission: "submissions:read", handler: async (c) => ok(await (await service()).list(c.auth, Object.fromEntries(c.url.searchParams))) },
  {
    method: "GET",
    path: "/api/v1/audience/export",
    auth: "required",
    permission: "submissions:read",
    async handler(c) {
      const csv = await (await service()).exportCsv(c.auth, Object.fromEntries(c.url.searchParams), facts(c));
      const day = new Date().toISOString().slice(0, 10);
      return new Response(csv, { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="rbb-audience-${day}.csv"`, "Cache-Control": "no-store" } });
    },
  },
];
