/* The server side of the site, host-neutral — Document 26. The ONE thing
   a host adapter needs: it builds both endpoints from the environment and
   routes a standard Fetch API Request to the right one.

     /api/forms           → server/handler.mjs          (Document 21)
     /api/donations/*     → server/donations/handler.mjs (Document 22)
     anything else        → null (the host serves the static site)

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
   startup log; both endpoints fail closed while any exist. */
import { loadConfig } from "./config.mjs";
import { createSubmissionHandler } from "./handler.mjs";
import { loadDonationConfig } from "./donations/config.mjs";
import { BASE_PATH, createDonationHandler } from "./donations/handler.mjs";

export const API_ROUTES = ["/api/forms", `${BASE_PATH}/*`];

export function createServerApp({
  env = process.env,
  rateLimiter,
  statusLimiter,
  log,
  capture,
  fetchImpl,
} = {}) {
  const emailConfig = loadConfig(env);
  const donationConfig = loadDonationConfig(env);
  const shared = { log, capture, fetchImpl };
  /* Drop undefined options so each handler keeps its own defaults. */
  const opts = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

  const forms = createSubmissionHandler(opts({ config: emailConfig, rateLimiter, ...shared }));
  const donations = createDonationHandler(
    opts({ config: donationConfig, emailConfig, rateLimiter, statusLimiter, ...shared })
  );

  return {
    emailMode: emailConfig.mode,
    donationMode: donationConfig.mode,
    problems: { email: emailConfig.problems, donations: donationConfig.problems },
    /* A Response for an API path, or null for everything else. */
    handle(request, context = {}) {
      const { pathname } = new URL(request.url);
      if (pathname === "/api/forms") return forms(request, context);
      if (pathname.startsWith(`${BASE_PATH}/`)) return donations(request, context);
      return null;
    },
  };
}
