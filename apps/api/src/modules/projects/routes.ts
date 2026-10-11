import type { Project } from "@rbb/content-schema";
import type { Route } from "../../http/router.ts";
import { orderedContentRoutes } from "../content/ordered-routes.ts";
import type { ProjectService } from "./service.ts";

/* /api/v1/projects — the ordered collection's routes
   (content/ordered-routes.ts): list, one, create, edit, DELETE archives,
   POST /api/v1/projects/order. */
export const projectRoutes = (service: () => Promise<ProjectService>): Route[] => orderedContentRoutes<Project>("projects", service);
