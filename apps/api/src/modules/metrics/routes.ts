import type { Metric } from "@rbb/content-schema";
import type { Route } from "../../http/router.ts";
import { orderedContentRoutes } from "../content/ordered-routes.ts";
import type { MetricService } from "./service.ts";

/* /api/v1/metrics — the ordered collection's routes
   (content/ordered-routes.ts): list, one, create, edit, DELETE archives,
   POST /api/v1/metrics/order. */
export const metricRoutes = (service: () => Promise<MetricService>): Route[] => orderedContentRoutes<Metric>("metrics", service);
