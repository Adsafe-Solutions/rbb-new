import { readJson } from "../../http/body.ts";
import { ok } from "../../http/response.ts";
import type { Context, Route } from "../../http/router.ts";
import type { RequestFacts } from "../audit/audit.ts";
import type { FormDefinitionService } from "./service.ts";

/* The website forms in the admin — owners only (forms:write).

     GET    /api/v1/forms-admin          { forms, roles } — every form, and
                                         the Careers roles (with or
                                         without an application form)
     GET    /api/v1/forms-admin/:id      one form, as the editor starts
     PUT    /api/v1/forms-admin/:id      save it — LIVE AT ONCE
     DELETE /api/v1/forms-admin/:id      delete a career form / reset a
                                         built-in one — live at once */

const BODY_LIMIT = 64 * 1024;
const facts = ({ requestId, clientIp, request }: Context): RequestFacts => ({ requestId, clientIp, userAgent: request.headers.get("user-agent") });

export const formDefinitionRoutes = (service: () => Promise<FormDefinitionService>): Route[] => [
  { method: "GET", path: "/api/v1/forms-admin", auth: "required", permission: "forms:write", handler: async (c) => ok(await (await service()).list(c.auth)) },
  { method: "GET", path: "/api/v1/forms-admin/:id", auth: "required", permission: "forms:write", handler: async (c) => ok(await (await service()).get(c.auth, c.params.id ?? "")) },
  { method: "PUT", path: "/api/v1/forms-admin/:id", auth: "required", permission: "forms:write", handler: async (c) => ok(await (await service()).save(c.auth, c.params.id ?? "", await readJson(c.request, BODY_LIMIT), facts(c))) },
  { method: "DELETE", path: "/api/v1/forms-admin/:id", auth: "required", permission: "forms:write", handler: async (c) => ok(await (await service()).remove(c.auth, c.params.id ?? "", facts(c))) },
];
