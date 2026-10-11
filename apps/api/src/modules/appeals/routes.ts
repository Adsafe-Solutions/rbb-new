import { z } from "zod";
import { Slug, type Appeal } from "@rbb/content-schema";
import { fromZod } from "../../errors.ts";
import { ok } from "../../http/response.ts";
import type { Route } from "../../http/router.ts";
import type { ContentStore } from "../content/repository.ts";
import { publishedAppeal } from "./service.ts";

/* M2's proof route: MongoDB → store → contract → HTTP.

   INTERNAL and read-only. It returns a published appeal only, and it is
   NOT the public content API: the public site reads published content
   from the snapshot (GET /api/v1/public/snapshot). The admin's appeal
   routes (/api/v1/appeals) are the shared content routes (app.ts). */
const Params = z.object({ slug: Slug });

export const appealRoutes = (appeals: () => Promise<ContentStore<Appeal>>): Route[] => [
  {
    method: "GET",
    path: "/api/v1/internal/appeals/:slug",
    async handler({ params }) {
      const parsed = Params.safeParse(params);
      if (!parsed.success) throw fromZod(parsed.error, "params");
      return ok(await publishedAppeal(await appeals(), parsed.data.slug));
    },
  },
];
