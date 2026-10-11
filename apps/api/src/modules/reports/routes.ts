import type { Report } from "@rbb/content-schema";
import type { Route } from "../../http/router.ts";
import { orderedContentRoutes } from "../content/ordered-routes.ts";
import type { ReportService } from "./service.ts";

/* /api/v1/reports — the ordered collection's routes
   (content/ordered-routes.ts): list, one, create, edit, DELETE archives,
   POST /api/v1/reports/order. */
export const reportRoutes = (service: () => Promise<ReportService>): Route[] => orderedContentRoutes<Report>("reports", service);
