import type { Homepage } from "@rbb/content-schema";
import type { Route } from "../../http/router.ts";
import { blockPageRoutes } from "../pages/routes.ts";
import type { HomepageService } from "./service.ts";

/* /api/v1/homepage — GET, POST (create once), PATCH { revision, changes },
   DELETE (archive); the block-page routes (modules/pages/routes.ts). */
export const homepageRoutes = (service: () => Promise<HomepageService>): Route[] => blockPageRoutes<Homepage>("homepage", service);
