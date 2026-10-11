import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { errors } from "../../errors.ts";
import { readJson } from "../../http/body.ts";
import { json, ok } from "../../http/response.ts";
import type { Context, Route } from "../../http/router.ts";
import type { RequestFacts } from "../audit/audit.ts";
import { requireAuth } from "../auth/permissions.ts";
import type { PublishService } from "./service.ts";

/* Publishing over HTTP.

     GET  /api/v1/publish/status            what is live, and whether the
                                            working copy differs   settings:read
     POST /api/v1/publish                   publish                publish:execute (OWNER)
                                            optional JSON body { changesKey }: the
                                            status that was reviewed (M14) — 409
                                            when what would be published changed
     GET  /api/v1/publish/preview           what a publish WOULD   publish:execute (OWNER)
                                            put live (M36), never
                                            stored; for the website's
                                            local preview mode
     GET  /api/v1/public/snapshot           the ACTIVE snapshot    public
     GET  /api/v1/public/snapshot/:version  one published version  public

   The public routes take no session, no body and no organization: the
   organization is this deployment's configuration. Query strings and
   headers such as ?orgId= or X-Organization-ID are never read.

   CACHING (documented in docs/PUBLISHING.md):
     current    Cache-Control: no-cache + ETag "snapshot-v<N>". Every reader
                revalidates; an unchanged snapshot costs a 304, and a new
                publish is visible to the very next build — no stale window.
     versioned  public, max-age=31536000, immutable. A version never
                changes once published. */

const facts = ({ requestId, clientIp, request }: Context): RequestFacts => ({ requestId, clientIp, userAgent: request.headers.get("user-agent") });
const Version = z.coerce.number().int().positive().max(1_000_000_000);
const etagOf = (version: number) => `"snapshot-v${version}"`;
const PublishInput = z.strictObject({ changesKey: z.string().min(1).max(200).optional() });
/* The body is optional (a publish of whatever is approved now). */
async function publishInput(request: Request) {
  const body = await readJson(request, 1024, { optional: true });
  if (body === undefined) return {};
  const parsed = PublishInput.safeParse(body);
  if (!parsed.success) throw errors.validation(parsed.error.issues.map((i) => ({ path: ["body", ...i.path.map(String)].join("."), message: i.message })));
  return parsed.data;
}

/* Compares secrets in constant time (hashes: equal lengths whatever is sent). */
const sameSecret = (given: string, expected: string) => timingSafeEqual(createHash("sha256").update(given).digest(), createHash("sha256").update(expected).digest());

export const publishingRoutes = (
  publishing: () => Promise<PublishService>,
  scheduler: { secret: string } | null = null,
  /* Named in a preview so the local tool can refuse an unexpected database. */
  target: { organization: string; database: string } | null = null
): Route[] => [
  /* M15: the scheduler — run by a cron (Vercel Cron calls GET with
     "Authorization: Bearer <CRON_SECRET>"; any other cron, or the
     scheduler CLI, does the same). No session, no body, nothing from the
     caller but the secret: 503 when no secret is configured, 401 for a
     wrong or missing one. Publishes only what owners approved and
     scheduled, and is idempotent (PublishService.runScheduled). */
  {
    method: "GET",
    path: "/api/v1/internal/scheduler/run",
    async handler(context) {
      if (!scheduler) throw errors.unavailable("Scheduled publishing is not configured.");
      if (!sameSecret(context.request.headers.get("authorization") ?? "", `Bearer ${scheduler.secret}`)) throw errors.unauthenticated("The scheduler secret is missing or wrong.");
      return ok(await (await publishing()).runScheduled(facts(context)));
    },
  },
  {
    method: "GET",
    path: "/api/v1/publish/status",
    auth: "required",
    permission: "settings:read",
    handler: async (context) => ok(await (await publishing()).status(requireAuth(context.auth))),
  },
  {
    method: "GET",
    path: "/api/v1/publish/preview",
    auth: "required",
    permission: "publish:execute",
    handler: async (context) =>
      json(200, { data: { preview: true, target, ...(await (await publishing()).preview(requireAuth(context.auth))) } }, { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" }),
  },
  {
    method: "POST",
    path: "/api/v1/publish",
    auth: "required",
    permission: "publish:execute",
    handler: async (context) => ok(await (await publishing()).publish(requireAuth(context.auth), facts(context), await publishInput(context.request))),
  },
  {
    method: "GET",
    path: "/api/v1/public/snapshot",
    async handler({ request }) {
      const snapshot = await (await publishing()).publicSnapshot();
      if (!snapshot) throw errors.notFound("published snapshot");
      const etag = etagOf(snapshot.version);
      const headers = { "Cache-Control": "no-cache", ETag: etag, "X-Snapshot-Version": String(snapshot.version) };
      if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
      return json(200, { data: snapshot }, headers);
    },
  },
  {
    method: "GET",
    path: "/api/v1/public/snapshot/:version",
    async handler({ params }) {
      const version = Version.safeParse(params.version);
      if (!version.success) throw errors.notFound("published snapshot");
      const snapshot = await (await publishing()).publicSnapshot(version.data);
      if (!snapshot) throw errors.notFound("published snapshot");
      return json(200, { data: snapshot }, { "Cache-Control": "public, max-age=31536000, immutable", ETag: etagOf(snapshot.version), "X-Snapshot-Version": String(snapshot.version) });
    },
  },
];
