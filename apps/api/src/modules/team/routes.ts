import type { TeamMember } from "@rbb/content-schema";
import type { Route } from "../../http/router.ts";
import { orderedContentRoutes } from "../content/ordered-routes.ts";
import type { TeamService } from "./service.ts";

/* /api/v1/team — the ordered collection's routes (content/ordered-routes.ts):
   list, one, create, edit, DELETE archives, POST /api/v1/team/order. */
export const teamRoutes = (service: () => Promise<TeamService>): Route[] => orderedContentRoutes<TeamMember>("team", service);
