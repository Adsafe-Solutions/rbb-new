/* The server side of the site, host-neutral — Document 26. The ONE thing
   a host adapter needs: it builds the endpoint from the environment and
   routes a standard Fetch API Request to it.

     /api/forms           → server/handler.mjs          (Document 21)
     anything else        → null (the host serves the static site)

   There are no donation endpoints. The Razorpay integration (Document 22)
   was removed when RBB chose a different payment provider; that
   provider's endpoints, if it needs any, mount here.

   A host adapter (written only once RBB selects the host) is then a few
   lines: create the app ONCE per runtime instance, pass each request and
   the client IP the platform reports, and — on serverless or any
   multi-instance runtime — pass a shared rate limiter and set
   RATE_LIMIT_STORE=shared (Document 25). No platform SDK or dependency is
   used here, so nothing host-specific enters the codebase before a host
   is chosen.

     const app = createServerApp({ env: process.env, rateLimiter });
     export default (request, ctx) => app.handle(request, { clientIp }) ?? ctx.next();

   Secrets are read from `env` on the server only. `problems` lists
   configuration problems (names only, never values) for the adapter's
   startup log; the endpoint fails closed while any exist. */
import { loadConfig } from "./config.mjs";
import { createSubmissionHandler } from "./handler.mjs";

export const API_ROUTES = ["/api/forms"];

export function createServerApp({
  env = process.env,
  rateLimiter,
  log,
  capture,
  fetchImpl,
} = {}) {
  const emailConfig = loadConfig(env);
  const shared = { log, capture, fetchImpl };
  /* Drop undefined options so each handler keeps its own defaults. */
  const opts = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

  const forms = createSubmissionHandler(opts({ config: emailConfig, rateLimiter, ...shared }));

  return {
    emailMode: emailConfig.mode,
    problems: { email: emailConfig.problems },
    /* A Response for an API path, or null for everything else. */
    handle(request, context = {}) {
      const { pathname } = new URL(request.url);
      if (pathname === "/api/forms") return forms(request, context);
      return null;
    },
  };
}
