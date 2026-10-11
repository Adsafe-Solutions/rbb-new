import type { Program } from "@rbb/content-schema";
import type { Route } from "../../http/router.ts";
import { orderedContentRoutes } from "../content/ordered-routes.ts";
import type { ProgramService } from "./service.ts";

/* /api/v1/programs — the ordered collection's routes
   (content/ordered-routes.ts): list, one, create, edit, DELETE archives,
   POST /api/v1/programs/order. */
export const programRoutes = (service: () => Promise<ProgramService>): Route[] => orderedContentRoutes<Program>("programs", service);
