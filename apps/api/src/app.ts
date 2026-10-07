import { randomUUID } from "node:crypto";
import { ConfigError, describeEnvironment, loadConfig, type Config } from "./config/env.ts";
import { createMongoProvider, isDatabaseUnavailable, type MongoProvider } from "./db/mongo.ts";
import { ApiError, errors } from "./errors.ts";
import { BODY_LIMIT_BYTES } from "./http/body.ts";
import { corsHeaders, isAllowedOrigin, preflightHeaders } from "./http/cors.ts";
import { SECURITY_HEADERS, errorResponse } from "./http/response.ts";
import { createRouter, type Route } from "./http/router.ts";
import { createLogger, type Logger } from "./logging/logger.ts";
import { MongoAppealStore } from "./modules/appeals/repository.ts";
import { AppealService } from "./modules/appeals/service.ts";
import { appealRoutes } from "./modules/appeals/routes.ts";
import { healthRoutes } from "./modules/health/routes.ts";

/* The API: one Fetch-standard function, `handle(Request) → Response`.
   Built ONCE per runtime instance (src/vercel.ts, src/server.ts) and
   reused by every request it serves.

   Every request:
     1. gets a request id — the caller's X-Request-Id if it is a safe
        token, otherwise a new UUID — returned in X-Request-Id and on
        every log line
     2. is refused early if it declares a body over BODY_LIMIT_BYTES
     3. is routed: 404 unknown path, 405 known path / wrong method,
        CORS preflight answered for allowed origins only
     4. runs its handler; an ApiError becomes its error response, a
        database outage becomes 503, anything else becomes a generic 500
        whose details go only to the log
     5. leaves with security headers, CORS headers (allowed origins only)
        and one structured log line: method, path, status, duration

   An invalid configuration does not crash the app: liveness keeps
   answering, everything else is 503 with a generic message, and the
   problems (variable names only) are logged once at startup. */

export const REQUEST_ID_HEADER = "X-Request-Id";
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

export interface AppOptions {
  env?: Record<string, string | undefined>;
  /* A ready configuration, bypassing the environment (tests). */
  config?: Config;
  /* Overrides the database provider; null means "no database". */
  mongo?: MongoProvider | null;
  /* Where log lines go (default: stdout). */
  write?: (line: string) => void;
}

export interface App {
  handle(request: Request): Promise<Response>;
  readonly config: Config | null;
  readonly log: Logger;
}

export function createApp(options: AppOptions = {}): App {
  const env = options.env ?? process.env;
  let config: Config | null = options.config ?? null;
  let configProblems: string[] = [];
  if (!config) {
    try {
      config = loadConfig(env);
    } catch (error) {
      if (!(error instanceof ConfigError)) throw error;
      configProblems = error.problems;
    }
  }

  const log = createLogger({
    level: config?.logLevel ?? "info",
    base: { service: "rbb-api", env: config?.env ?? env.NODE_ENV ?? "development" },
    includeStacks: config ? config.env !== "production" : false,
    ...(options.write && { write: options.write }),
  });
  if (configProblems.length) log.error("configuration invalid — only liveness will answer", { problems: configProblems });
  else log.info("configuration loaded", { environment: describeEnvironment(env) });

  const mongo = options.mongo !== undefined ? options.mongo : config?.mongo ? createMongoProvider(config.mongo) : null;

  const appeals = async () => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    return new AppealService(new MongoAppealStore(await mongo.db(), config.orgId), config.orgId);
  };

  const routes: Route[] = [...healthRoutes({ configured: config !== null, mongo }), ...appealRoutes(appeals)];
  const router = createRouter(routes);
  const allowedOrigins = config?.cors.origins ?? [];

  async function respond(request: Request, url: URL, requestId: string, requestLog: Logger): Promise<Response> {
    const declared = Number(request.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > BODY_LIMIT_BYTES) throw errors.payloadTooLarge(BODY_LIMIT_BYTES);

    let match;
    try {
      match = router.match(request.method === "OPTIONS" ? "GET" : request.method, url.pathname);
    } catch {
      throw errors.badRequest("The request path is malformed.");
    }

    if (request.method === "OPTIONS") {
      if (match.kind === "not-found") throw errors.notFound("route");
      const methods = match.kind === "route" ? [match.route.method] : match.allowed;
      const origin = request.headers.get("origin");
      if (!request.headers.get("access-control-request-method"))
        return new Response(null, { status: 204, headers: { Allow: [...methods, "OPTIONS"].join(", ") } });
      if (!isAllowedOrigin(origin, allowedOrigins)) throw errors.forbidden("This origin is not allowed.");
      return new Response(null, { status: 204, headers: preflightHeaders(origin, [...methods, "OPTIONS"]) });
    }

    if (match.kind === "not-found") throw errors.notFound("route");
    if (match.kind === "method-not-allowed") throw errors.methodNotAllowed(match.allowed);
    if (!config && !match.route.live) throw errors.unavailable();

    return match.route.handler({ request, url, params: match.params, requestId, log: requestLog });
  }

  async function handle(request: Request): Promise<Response> {
    const started = performance.now();
    const incoming = request.headers.get(REQUEST_ID_HEADER);
    const requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    const url = new URL(request.url);
    const requestLog = log.child({ requestId });

    let response: Response;
    try {
      response = await respond(request, url, requestId, requestLog);
    } catch (error) {
      let apiError: ApiError;
      if (error instanceof ApiError) apiError = error;
      else if (isDatabaseUnavailable(error)) apiError = errors.unavailable("The database is unavailable.", error);
      else apiError = errors.internal(error);
      if (apiError.status >= 500) requestLog.error("request failed", { code: apiError.code, error: apiError.cause ?? apiError });
      response = errorResponse(apiError, requestId);
    }

    for (const [name, value] of Object.entries(SECURITY_HEADERS))
      if (!response.headers.has(name)) response.headers.set(name, value);
    for (const [name, value] of Object.entries(corsHeaders(request.headers.get("origin"), allowedOrigins)))
      if (!response.headers.has(name)) response.headers.set(name, value);
    response.headers.set(REQUEST_ID_HEADER, requestId);

    const fields = {
      method: request.method,
      /* The path only: a query string can carry personal data. */
      path: url.pathname,
      status: response.status,
      durationMs: Math.round(performance.now() - started),
    };
    if (response.status >= 500) requestLog.warn("request", fields);
    else requestLog.info("request", fields);
    return response;
  }

  return { handle, config, log };
}
