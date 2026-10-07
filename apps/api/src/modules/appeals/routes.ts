import { z } from "zod";
import { Slug } from "@rbb/content-schema";
import { fromZod } from "../../errors.ts";
import { ok } from "../../http/response.ts";
import type { Route } from "../../http/router.ts";
import type { AppealService } from "./service.ts";

/* M2's proof route: MongoDB → repository → service → contract → HTTP.

   INTERNAL and read-only. It returns a published appeal only, and it is
   NOT the public content API: the public site will read published content
   from a snapshot (a later milestone) and is not connected to this route. */
const Params = z.object({ slug: Slug });

export const appealRoutes = (appeals: () => Promise<AppealService>): Route[] => [
  {
    method: "GET",
    path: "/api/v1/internal/appeals/:slug",
    async handler({ params }) {
      const parsed = Params.safeParse(params);
      if (!parsed.success) throw fromZod(parsed.error, "params");
      const service = await appeals();
      return ok(await service.getPublished(parsed.data.slug));
    },
  },
];
