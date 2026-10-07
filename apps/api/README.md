# @rbb/api

The platform's backend: Node and TypeScript, MongoDB, deployed on Vercel.
The API is one Fetch-standard function (`Request → Response`, `src/app.ts`)
with no HTTP framework, plus two thin entries: `src/vercel.ts` for Vercel and
`src/server.ts` for local development.

```
src/
  app.ts               request pipeline: request id → body limit → route/CORS → handler → headers + log
  config/env.ts        the only reader of process.env; Zod-validated
  errors.ts            ApiError and its codes
  logging/logger.ts    JSON-line logger with redaction
  http/                router, response envelopes, CORS, JSON body reader
  db/                  MongoDB client cache, collections, indexes
  modules/health/      liveness and readiness
  modules/appeals/     repository → service → route (the M2 vertical slice)
  scripts/             ensure-indexes
api/index.js           Vercel function entry (re-exports the bundled dist/vercel.js)
test/                  unit tests; test/integration/ needs a disposable MongoDB
```

## Routes

Base path: **`/api/v1`**.

| Method | Path | What |
|---|---|---|
| GET | `/api/v1/health` | Liveness: `{"data":{"status":"ok"}}` |
| GET | `/api/v1/health/live` | Liveness (same) |
| GET | `/api/v1/health/ready` | Readiness: 200 when the configuration is valid **and** MongoDB answers a ping, otherwise 503 |
| GET | `/api/v1/internal/appeals/:slug` | **Internal proof route.** One *published* appeal; drafts and archived appeals are 404 |
| GET | `/health` | M0's liveness address, kept |

- **Liveness** never touches the database, and it still answers when the
  configuration is invalid.
- **Readiness** body: `{"data":{"status":"ok|unavailable","configuration":"ok|invalid","database":"ok|unavailable|not-configured"}}`.
- **The internal appeal route** is read-only and is **not** the public content
  API. The public site doesn't call it; it will read a published snapshot in
  a later milestone.

**There is no write route.** `AppealService.create` and `update` exist for
the admin to call once authentication lands (M3).

## Conventions

| | |
|---|---|
| Success | `{ "data": … }` |
| Error | `{ "error": { "code", "message", "requestId", "details"? } }`. `details` is `[{ path, message }]`, for `VALIDATION_ERROR` only |
| Codes | `BAD_REQUEST` 400 · `VALIDATION_ERROR` 400 · `UNAUTHORIZED` 401 · `FORBIDDEN` 403 · `NOT_FOUND` 404 · `METHOD_NOT_ALLOWED` 405 · `CONFLICT` 409 · `PAYLOAD_TOO_LARGE` 413 · `UNSUPPORTED_MEDIA_TYPE` 415 · `RATE_LIMITED` 429 · `INTERNAL_ERROR` 500 · `SERVICE_UNAVAILABLE` 503 |
| Request id | `X-Request-Id` on every response, and on every log line for that request. A caller's id is kept if it matches `[A-Za-z0-9._-]{8,64}`; otherwise a UUID is generated |
| Validation | Every path, query and body input goes through Zod. Messages describe the rule, never echo the input |
| Unexpected errors | A generic 500. The cause is logged, redacted, and never returned. A database outage is a 503, not a 500 |
| Body limit | Any request declaring more than **256 KiB** is refused before routing. `readJson(request, limit)` enforces a route's own (smaller) limit while streaming, and accepts `application/json` only. Media will never upload through the API |
| Headers | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store` |
| CORS | Only `WEB_ORIGIN` and `ADMIN_ORIGIN`, echoed exactly; never `*`. Preflight from any other origin is 403. Requests without an `Origin` header (servers, build scripts) are unaffected. Credentials are not enabled yet (M3) |
| Logs | One JSON line per event (`time`, `level`, `msg`, `service`, `env`, `requestId`). The request line holds method, **path without query string**, status and `durationMs`. Keys naming credentials are redacted, as are connection strings and token-shaped values inside any text. Bodies, cookies and auth headers are never logged |

## Environment

All variables are server-side only. `.env.example` lists them with empty
placeholders. Locally, use `apps/api/.env.local` (git-ignored); on Vercel, use
the project's Environment Variables.

| Variable | Required | Secret | |
|---|---|---|---|
| `NODE_ENV` | no (default `development`) | no | `development` · `test` · `production` |
| `ORGANIZATION_ID` | production | no | The organization this deployment serves (`orgId` on every record). Defaults to `rbb` outside production only |
| `MONGODB_URI` | production | **yes** | `mongodb://` or `mongodb+srv://`. Refused if it still contains `<placeholders>` |
| `MONGODB_DB` | production, and whenever `MONGODB_URI` is set | no | Database name |
| `WEB_ORIGIN`, `ADMIN_ORIGIN` | no | no | Exact origins allowed by CORS; `https://` in production |
| `LOG_LEVEL` | no (default `info`) | no | |
| `PORT` | no (default 4000) | no | Local dev server only |
| `MONGODB_TEST_URI` | integration tests only | **yes** | A disposable MongoDB. Never read by the app |

How configuration failures behave:
- An invalid configuration is logged **by variable name only**.
- The app then serves liveness and returns 503 for everything else.
- Production refuses to start without `ORGANIZATION_ID`, `MONGODB_URI` and
  `MONGODB_DB`, so development defaults can never apply there.

## MongoDB

**Connection**
- There is one `MongoClient` per process (`src/db/mongo.ts`), cached on
  `globalThis` and reused by every warm invocation. No request connects or
  disconnects.
- Pool settings: `maxPoolSize: 10`, `serverSelectionTimeoutMS: 5000`,
  `ignoreUndefined: true`.
- A failed connect is not cached, so the next request retries.

**Documents vs records.** The repository maps between what MongoDB stores
and what the contract defines.

| Field | Stored document | Content record (`@rbb/content-schema`) |
|---|---|---|
| `_id` | `ObjectId`, database identity | not present |
| `id` | content identity, referenced by other records | same |
| `slug` | the URL; not the `_id` | same |
| `revision` | integer, +1 per write; updates must name it | not present |
| `createdAt`, `updatedAt`, `publishedAt` | BSON `Date` | ISO-8601 strings |
| `orgId` | on every document, in every query | same |

**Layers**

```
route (HTTP + Zod params) → service (contract + rules) → repository (MongoDB) → MongoDB
```

Every record entering or leaving the service is checked with the
contract's `Appeal` schema; the API defines no content schema of its own.

**Indexes** (`src/db/collections.ts`)

| Index | Why |
|---|---|
| `appeals.orgId_slug_unique` | Lookup by slug; a slug is a unique URL within an organization |
| `appeals.orgId_id_unique` | Lookup and update by content id, unique within an organization |

`pnpm api:db:indexes` creates any missing index:
- It only adds; it never drops or rewrites.
- It is idempotent.
- It refuses production unless run with `-- --confirm`.
- It needs a prior `pnpm api:build`.

The app never creates indexes itself and never seeds data.

## Local development

```sh
pnpm install
cp apps/api/.env.example apps/api/.env.local     # then fill in
pnpm api:dev                                     # http://localhost:4000 (TypeScript source, Node ≥ 22.18)
pnpm api:build && pnpm api:start                 # the compiled bundle
```

With no MongoDB configured, the API still runs: readiness reports
`not-configured` and database routes return 503.

## Tests

```sh
pnpm api:test                  # unit tests, no database needed
MONGODB_TEST_URI=mongodb://127.0.0.1:27017 pnpm api:test:integration
```

Integration tests use **only** `MONGODB_TEST_URI`, never `MONGODB_URI`:
- Each run creates its own `rbb_test_<random>` database and drops only that
  one.
- Without `MONGODB_TEST_URI` the suite fails with instructions; it never
  falls back to another database.

A local `mongod --dbpath <tmp> --port 27017` is enough.

## Vercel

- **Project root:** `apps/api`. It is a separate Vercel project from the web
  and admin.
- **Build:** `vercel.json` sets `buildCommand: pnpm run build`.
  - It typechecks, then esbuild bundles the source and the workspace packages
    into `dist/`.
  - `mongodb` stays an external dependency.
  - Production therefore runs plain compiled JavaScript, never TypeScript
    source.
- **Entry:** `api/index.js` re-exports the method handlers from
  `dist/vercel.js`, and `vercel.json` rewrites every path to it. The app, and
  its MongoDB client, is created once per function instance.
- **Environment:** set the variables above in Vercel. Use `NODE_ENV=production`
  for the production environment.

These are assumptions until the first deploy. Nothing has been deployed, so
check them then:
- Vercel's pnpm workspace install from the repository root.
- Rewritten requests keep their original path in `request.url`.
- `@vercel/functions`' `attachDatabasePool` may be worth adding for idle
  pool cleanup.

## Not here yet

- Authentication and RBAC (M3)
- Admin CRUD routes
- The publishing pipeline and public snapshot
- R2 media
- Givebutter
- The form endpoint

The form *domain* is shared in `packages/forms`. The endpoint, with its
anti-spam checks, rate limiting and Resend delivery behind
`apps/web/server/email/deliver.mjs`, still runs from `apps/web/server`, where
the site posts to its own `/api/forms`. Moving it here waits on the hosting
decision.
