import { json, ok } from "../../http/response.ts";
import type { Route } from "../../http/router.ts";
import type { Logger } from "../../logging/logger.ts";
import type { MongoProvider } from "../../db/mongo.ts";
import type { TargetKind } from "../../config/target.ts";

/* Health.

   LIVENESS   is the process up and answering? Depends on nothing — not the
              configuration, not the database — so a platform never restarts
              a healthy instance because MongoDB is down.
   READINESS  can this instance serve real requests? The configuration must
              be valid and the database must answer a ping. 200 when ready,
              503 when not.

   The readiness body keeps the { data } shape on 503 too (the one
   exception to the error convention): it is a status report, not a
   failed request. It names no host, database or credential.

   `target` (Phase 0) is the KIND of database this instance writes to —
   production, test, unclassified or none (config/target.ts), never its
   name — so test tooling can refuse a production API before it signs in
   or writes anything (test/support/smoke-target.mjs). */

const live = { status: "ok" } as const;

export function healthRoutes({
  configured,
  mongo,
  target = null,
}: {
  configured: boolean;
  mongo: MongoProvider | null;
  target?: TargetKind | null;
}): Route[] {
  const liveness = () => ok(live);
  return [
    /* M0's address, kept so nothing that already probes it breaks. */
    { method: "GET", path: "/health", live: true, handler: liveness },
    { method: "GET", path: "/api/v1/health", live: true, handler: liveness },
    { method: "GET", path: "/api/v1/health/live", live: true, handler: liveness },
    {
      method: "GET",
      path: "/api/v1/health/ready",
      live: true,
      async handler({ log }) {
        const database = !configured || !mongo ? "not-configured" : await reachable(mongo, log);
        const ready = configured && database === "ok";
        return json(ready ? 200 : 503, {
          data: { status: ready ? "ok" : "unavailable", configuration: configured ? "ok" : "invalid", database, target: target ?? "unknown" },
        });
      },
    },
  ];
}

async function reachable(mongo: MongoProvider, log: Logger) {
  try {
    await mongo.ping();
    return "ok" as const;
  } catch (error) {
    log.warn("readiness: database unreachable", { error: (error as Error)?.cause ?? error });
    return "unavailable" as const;
  }
}
