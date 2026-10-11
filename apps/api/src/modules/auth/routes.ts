import { z } from "zod";
import type { AuthConfig } from "../../config/env.ts";
import { fromZod } from "../../errors.ts";
import { readJson } from "../../http/body.ts";
import { json, ok } from "../../http/response.ts";
import type { Context, Route } from "../../http/router.ts";
import type { RequestFacts } from "../audit/audit.ts";
import { requireAuth } from "./permissions.ts";
import { clearedSessionCookie, sessionCookie } from "./cookies.ts";
import { toAuthView, type AuthService } from "./service.ts";

/* Authentication over HTTP. Handlers only translate: body/params → the
   service → a response (and the cookie). Sessions are resolved by the app
   before a handler runs (`auth` on the route), never here.

   There is no registration, email invitation or password-reset route.
   M17.2: a new member sets their first password from an owner-issued setup
   link (POST /auth/setup-password, no session), and anyone signed in can
   change their password (POST /auth/password). */

const LOGIN_BODY_LIMIT = 4 * 1024;
const SessionParams = z.object({ id: z.uuid() });

const facts = ({ requestId, clientIp, request }: Context): RequestFacts => ({
  requestId,
  clientIp,
  userAgent: request.headers.get("user-agent"),
});

export const authRoutes = (auth: () => Promise<AuthService>, cookie: AuthConfig["cookie"]): Route[] => [
  {
    method: "POST",
    path: "/api/v1/auth/login",
    async handler(context) {
      const body = await readJson(context.request, LOGIN_BODY_LIMIT);
      const { token, maxAgeSeconds, view } = await (await auth()).login(body, facts(context));
      const response = ok(view);
      response.headers.append("Set-Cookie", sessionCookie(cookie, token, maxAgeSeconds));
      return response;
    },
  },
  {
    method: "POST",
    path: "/api/v1/auth/setup-password",
    async handler(context) {
      const body = await readJson(context.request, LOGIN_BODY_LIMIT);
      await (await auth()).setupPassword(body, facts(context));
      return ok({ passwordSet: true });
    },
  },
  {
    method: "POST",
    path: "/api/v1/auth/password",
    auth: "required",
    async handler(context) {
      const body = await readJson(context.request, LOGIN_BODY_LIMIT);
      const { token, maxAgeSeconds, view } = await (await auth()).changePassword(requireAuth(context.auth), body, facts(context));
      const response = ok(view);
      response.headers.append("Set-Cookie", sessionCookie(cookie, token, maxAgeSeconds));
      return response;
    },
  },
  {
    method: "POST",
    path: "/api/v1/auth/logout",
    auth: "optional",
    async handler(context) {
      await (await auth()).logout(context.auth, facts(context));
      const response = ok({ signedOut: true });
      response.headers.append("Set-Cookie", clearedSessionCookie(cookie));
      return response;
    },
  },
  {
    method: "GET",
    path: "/api/v1/auth/me",
    auth: "required",
    handler: ({ auth: context }) => ok(toAuthView(requireAuth(context))),
  },
  {
    method: "GET",
    path: "/api/v1/auth/sessions",
    auth: "required",
    handler: async (context) => ok(await (await auth()).listSessions(requireAuth(context.auth))),
  },
  {
    method: "DELETE",
    path: "/api/v1/auth/sessions/:id",
    auth: "required",
    async handler(context) {
      const params = SessionParams.safeParse(context.params);
      if (!params.success) throw fromZod(params.error, "params");
      const { current } = await (await auth()).revokeSession(requireAuth(context.auth), params.data.id, facts(context));
      const response = json(200, { data: { revoked: true } });
      if (current) response.headers.append("Set-Cookie", clearedSessionCookie(cookie));
      return response;
    },
  },
];
