# @rbb/api

The platform's backend: Node and TypeScript, MongoDB, deployed on Vercel.
The API is one Fetch-standard function (`Request → Response`, `src/app.ts`)
with no HTTP framework, plus two thin entries: `src/vercel.ts` for Vercel and
`src/server.ts` for local development. It is organization-neutral: the
organization it serves comes from configuration.

```
src/
  app.ts               request pipeline: request id → body limit → route/CORS → CSRF → session/permission → handler → headers + log
  config/env.ts        the only reader of process.env; Zod-validated
  errors.ts            ApiError and its codes
  logging/logger.ts    JSON-line logger with redaction
  http/                router, response envelopes, CORS, JSON body reader
  db/                  MongoDB client cache, collections, indexes
  modules/health/      liveness and readiness
  modules/appeals/     repository → service → route (M2 vertical slice)
  modules/auth/        users, memberships, sessions, passwords, RBAC, login throttle, bootstrap, routes
  modules/audit/       append-only audit trail
  modules/donations/   donation-provider boundary (provider.ts) + Givebutter client/mapping (givebutter/)
  scripts/             ensure-indexes, bootstrap-owner
api/index.js           Vercel function entry (re-exports the bundled dist/vercel.js)
test/                  unit tests; test/integration/ needs a disposable MongoDB
```

## Routes

Base path: **`/api/v1`**.

| Method | Path | Auth | What |
|---|---|---|---|
| GET | `/api/v1/health`, `/api/v1/health/live`, `/health` | — | Liveness |
| GET | `/api/v1/health/ready` | — | Readiness: 200 when configured **and** MongoDB answers, else 503 |
| GET | `/api/v1/internal/appeals/:slug` | — | Internal proof route: one published appeal |
| POST | `/api/v1/auth/login` | — | `{ email, password }` → session cookie + `AuthView` |
| POST | `/api/v1/auth/setup-password` | — (CSRF-checked, throttled) | M17.2: `{ token, password }` — a new member's first password from an owner-issued setup link. Every unusable link gets the same 400. Does not sign in |
| POST | `/api/v1/auth/password` | required | M17.2: `{ currentPassword, newPassword }` — revokes every session of the account and sets a fresh session cookie with the same expiry |
| POST | `/api/v1/auth/logout` | optional | Revokes the current session, clears the cookie. Idempotent |
| GET | `/api/v1/auth/me` | required | The caller's `AuthView` |
| GET | `/api/v1/auth/sessions` | required | The caller's active sessions (no tokens or hashes) |
| DELETE | `/api/v1/auth/sessions/:id` | required | Revoke a session: your own always; another member's needs `users:write` |
| GET | `/api/v1/members` · `/api/v1/members/:id` | `users:read` (OWNER) | M17: the organization's team — role, status, password set, active sessions. Never a hash or token |
| POST | `/api/v1/members` | `users:write` (OWNER) | M17: `{ email, name, role }` — a member with no password yet (cannot sign in until they set one). 409 if the email has an account |
| POST | `/api/v1/members/:id/role` · `/deactivate` · `/reactivate` | `users:write` (OWNER) | M17: `{ revision, role }` / `{ revision }`. Never your own; deactivating signs them out everywhere; 409 if stale or it would leave no active owner |
| POST | `/api/v1/members/:id/setup-link` | `users:write` (OWNER) | M17.2: `{ token, expiresAt }` — a single-use, 72-hour link for a member without a password; the token is shown once. Not yourself, not a member with a password or a deactivated one |
| POST | `/api/v1/members/:id/sessions/revoke` | `users:write` (OWNER) | M17: sign a member out everywhere → `{ revoked }`. Not your own (use `/auth/sessions`) |
| GET | `/api/v1/integrations/donations/campaigns` | `appeals:read` | The donation provider's campaigns, provider-neutral (read-only) |
| GET | `/api/v1/integrations/donations/campaigns/:campaignId` | `appeals:read` | One campaign by the provider's id |
| GET | `/api/v1/media/policy` | `media:read` | Upload limits (types, max size), for client-side checks |
| GET | `/api/v1/media` | `media:read` | `?search=&type=image&status=ready\|pending\|failed&sort=newest\|oldest&page=&pageSize=` → `{ data, pagination }`. Never lists deleted media |
| GET | `/api/v1/media/:id` | `media:read` | One media record (404 if deleted) |
| POST | `/api/v1/media/upload-intents` | `media:write` | `{ filename, mimeType, size, width?, height? }` → pending record + a 5-minute presigned PUT URL for one new object |
| POST | `/api/v1/media/:id/complete` | `media:write` | Verifies the object in storage (size, real type from its bytes, dimensions) → `ready`. Idempotent |
| POST | `/api/v1/media/:id/abort` | `media:write` | The browser's upload failed or was cancelled → `failed` |
| PATCH | `/api/v1/media/:id` | `media:write` | `{ version, alt?, caption?, credit?, license?, consent? }` — nothing else is editable |
| DELETE | `/api/v1/media/:id` | `media:write` | Soft delete; then the object is removed from storage (retried by cleanup if that fails) |
| GET | `/api/v1/settings` | `settings:read` | The organization's working site settings (`null` until imported) with `revision` |
| PATCH | `/api/v1/settings` | `settings:write` (OWNER) | `{ revision, changes: { <section>: … } }` — sections `general`, `contact`, `social`, `seo`, `engagement`, and `countries` (internal: never published) — validated against the contract. A stale revision gives 409. The retired `branding`, `analytics`, `donations` and `features` are refused |
| GET | `/api/v1/publish/status` | `settings:read` | The live version, unpublished changes (by section), whether you can publish. Also (M14) the review queue (`review.approved` / `review.submitted`), `blockers` and the `changesKey` naming what would be published |
| POST | `/api/v1/publish` | `publish:execute` (OWNER) | Validates and publishes a new immutable snapshot version from the saved settings and the APPROVED content (M14). Optional `{ changesKey }`: 409 if what would be published changed since that review |
| GET | `/api/v1/posts`, `/api/v1/events` | `content:read` | `?search=&status=&type=(posts)&sort=updated\|date\|title&page=&pageSize=` → `{ data, pagination }` |
| GET | `/api/v1/posts/:id`, `/api/v1/events/:id` | `content:read` | One record with `revision`, who edited it and `previousSlugs` |
| POST | `/api/v1/posts`, `/api/v1/events` | `content:create` | Create a draft (M14: always — a `status` is refused), validated against the contract |
| PATCH | `/api/v1/posts/:id`, `/api/v1/events/:id` | `content:update` | `{ revision, changes, confirmSlugChange? }`. A stale revision gives 409; `null` clears an optional field |
| DELETE | `/api/v1/posts/:id`, `/api/v1/events/:id` | `content:delete` | Archive (nothing is destroyed) |
| POST | `/api/v1/<collection>/:id/submit` · `/withdraw` | `content:update` | M14 editorial workflow, `{ revision }`. Every collection; single pages use `/api/v1/<page>/<action>`. See docs/PUBLISHING.md |
| POST | `/api/v1/<collection>/:id/approve` · `/reject` | `content:approve` (OWNER) | Approve a submitted revision for the next website publish, or return it to draft. Stale revision or impossible move: 409 |
| POST | `/api/v1/<collection>/:id/schedule` · `/unschedule` (pages: `/api/v1/<page>/schedule`) | `publish:execute` (OWNER) | M15: `{ revision, localTime, timeZone }` (IANA) — queue an APPROVED revision for the website publication at that time; `{ revision }` drops it. 409 if stale or not approved, 400 for a past, ambiguous or skipped time |
| GET | `/api/v1/internal/scheduler/run` | `Authorization: Bearer <CRON_SECRET>` (no session) | M15: the scheduler — publishes what is approved and due, finishes a stopped publish, retries a failed deployment trigger. 503 without CRON_SECRET, 401 without the secret. Also `pnpm api:scheduler:run` |
| GET | `/api/v1/public/snapshot` | — public | The active published snapshot (`no-cache` + ETag; 404 before the first publish) |
| GET | `/api/v1/public/snapshot/:version` | — public | One published version (immutable cache) |
| POST | `/api/v1/forms/:formId` | — public; Origin must be exactly `WEB_ORIGIN` | M18: a website form → `{ data: { reference } }`. Contact, Volunteer, Partner, Fundraise when configured; Newsletter and Travel 503. JSON ≤ 16 KiB (415/413/400), 422 with `fields.<name>` codes, 429 + Retry-After, 503 when off, unconfigured or the email could not be sent. Email only — nothing stored |

The donation provider is Givebutter, behind `modules/donations/provider.ts`.
- **Client:** `GET` only, with an 8 s timeout and no retries. Failures become
  generic 503 or 404 responses; the provider's body, and which provider it
  was, are never returned.
- **Key:** `GIVEBUTTER_API_KEY` never leaves the server.
- **Findings:** `docs/GIVEBUTTER_SPIKE.md`.

The media library is `modules/media/` (`docs/MEDIA_LIBRARY.md`):
- **Files never pass through the API.** The browser PUTs them straight to R2
  with a presigned URL. `Content-Type` and `Content-Length` are signed, and
  the URL lasts 5 minutes.
- **Storage is an interface.** It's `ObjectStorage` (`storage.ts`), with
  `R2Storage` (`r2.ts`) as the implementation. It uses in-house SigV4
  (`sigv4.ts`), checked against AWS's published examples, so there's no AWS
  SDK.
- **The rules live in `policy.ts`:** images only (JPEG, PNG, WebP, AVIF; no
  SVG), 10 MiB, and immutable keys `[_<env>/]<orgId>/media/<uuid>/<safe-name>`.
- **Keys:** `R2_*` never leaves the server.

Settings, publishing and the public snapshot are covered in
`docs/PUBLISHING.md`. The first settings record comes from the website's own
values, with `pnpm api:settings:import -- --file …`.

The `AuthView` returned by login and `/me` is
`{ user: { id, email, name }, organization: { id }, membership: { role }, permissions, session: { id, expiresAt } }`.
It never contains a password hash, token, token hash or storage field.

These deliberately don't exist: no registration or signup route, no email
invitation, no email (or owner-driven) password reset, and no audit listing
(out of scope: the trail is written, never listed in the admin).
Owners manage the team over `/api/v1/members` (M17.1) and hand new members a
setup link (M17.2); see "Team management" and "Account setup and password
change" below.

## Conventions

| | |
|---|---|
| Success | `{ "data": … }` |
| Error | `{ "error": { "code", "message", "requestId", "details"? } }`. `details` is `[{ path, message }]`, for `VALIDATION_ERROR` only |
| Codes | `BAD_REQUEST` 400 · `VALIDATION_ERROR` 400 · `UNAUTHENTICATED` 401 · `FORBIDDEN` 403 · `NOT_FOUND` 404 · `METHOD_NOT_ALLOWED` 405 · `CONFLICT` 409 · `PAYLOAD_TOO_LARGE` 413 · `UNSUPPORTED_MEDIA_TYPE` 415 · `RATE_LIMITED` 429 (+ `Retry-After`) · `INTERNAL_ERROR` 500 · `SERVICE_UNAVAILABLE` 503 |
| Request id | `X-Request-Id` on every response, every log line and every audit entry. A caller's id is kept if it matches `[A-Za-z0-9._-]{8,64}` |
| Validation | Every path, query and body input goes through Zod. Messages never echo the input |
| Unexpected errors | A generic 500. The cause is logged, redacted. A database outage is a 503 |
| Body limit | 256 KiB declared, refused before routing. `readJson` enforces each route's own limit (login: 4 KiB) and accepts JSON only |
| Headers | `nosniff`, `X-Frame-Options: DENY`, `CSP: default-src 'none'; frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store` |
| Logs | JSON lines: `requestId`, method, path (no query string), status, duration. Credentials are redacted by key and pattern. Passwords, hashes, tokens and cookies are never logged |

## Authentication

```
HttpOnly cookie (opaque token) → SHA-256 → session (this organization only)
  → not revoked, not expired → user active → membership active → role → permissions → route
```

Everything is decided server-side. The browser holds only the cookie; no
user id, role or organization id sent by a client is ever trusted.

### Models

All models are organization-scoped, with BSON dates in MongoDB and ISO strings
in the domain.

| Model | Fields |
|---|---|
| **User** | `id`, `orgId`, `email`, `emailNormalized` (NFKC, trimmed, lowercased; unique per org), `name`, `passwordHash`, `status: active\|disabled`, timestamps, `revision` |
| **Membership** | `id`, `orgId`, `userId` (unique per org), `role: OWNER\|EDITOR`, `status`, timestamps, `revision` |
| **Session** | `id`, `orgId`, `userId`, `tokenHash`, `createdAt`, `expiresAt`, `lastSeenAt`, `revokedAt` |
| **AuditLog** | `id`, `orgId`, `actorUserId`, `action`, `resourceType`, `resourceId`, `metadata`, `requestId`, `ipHash`, `userAgent`, `createdAt` |

### Passwords

Passwords use **scrypt** (Node built-in, no dependency) with OWASP's
parameters (N = 2¹⁷, r = 8, p = 1, 128 MiB):
- Each hash has its own 16-byte salt.
- Verification is constant-time.
- The stored form is `scrypt$N$r$p$salt$hash`, so parameters can be raised
  later without breaking existing hashes.

A login for an unknown email still runs one scrypt verification, so timing
doesn't reveal which accounts exist. New passwords (bootstrap) must be 12–256
characters.

### Sessions

- **Token:** 32 random bytes (base64url), sent once in the cookie. Only its
  SHA-256 is stored.
- **Lifetime:** absolute, `AUTH_SESSION_TTL_HOURS` (default 168 = 7 days).
  There's no sliding renewal.
- **lastSeenAt:** refreshed at most every 5 minutes.
- **Checks on every request:** expired, revoked, unknown, malformed, user
  disabled or membership disabled all mean 401.
- **Cleanup:** a TTL index deletes sessions after expiry, but code never
  relies on that.
- **Revocation:** logout revokes the current session. `DELETE
  /auth/sessions/:id` revokes your own sessions, or, as an OWNER, a member's.

### Cookie

`AUTH_COOKIE_NAME` (default `cms_session`) is set with `HttpOnly`,
`Path=/`, no `Domain` (host-only) and `Max-Age` equal to the session's
lifetime.
- **`SameSite`:** `AUTH_COOKIE_SAMESITE`, default `Strict`.
- **`Secure`:** in production. Local http development omits it, because
  browsers drop Secure cookies over http.

The intended topology keeps the cookie **first-party**: the admin calls the
API on its own origin (`/api/*`). Vite proxies this in development, and the
admin's host rewrites it to the API in production. That way `SameSite=Strict`
holds and third-party-cookie blocking doesn't apply.

`SameSite=None` (production only) exists for a cross-site deployment, but
browsers increasingly block such cookies. Prefer the rewrite.

### RBAC

The central table is `modules/auth/permissions.ts`.

| Permission | OWNER | EDITOR |
|---|---|---|
| `content:read/create/update/delete`, `media:read/write`, `appeals:read/write`, `settings:read` | ✓ | ✓ |
| `settings:write`, `publish:execute`, `content:approve` (M14), `users:read/write` | ✓ | — |

- Routes declare `auth` and `permission`. The app enforces both before the
  handler runs.
- `requireAuth`, `requirePermission` and `requireRole` handle
  resource-dependent checks inside handlers.
- Publishing is OWNER-only until a review workflow exists; changing that is
  one line.

### Organization isolation

Every repository is bound to the deployment's `ORGANIZATION_ID` and puts it
in every query. A session, user, membership or audit entry of another
organization doesn't exist from the API's point of view:
- An org-B cookie on an org-A deployment gets 401.
- An org-B session id gets 404.
- `orgId` in a query string or body is ignored or refused.

### CSRF and CORS

- **SameSite:** the cookie is `SameSite=Strict`, so it's never sent on
  cross-site requests.
- **Origin check:** every **state-changing** request (POST, PUT, PATCH,
  DELETE) must carry an `Origin` on the allow-list (`WEB_ORIGIN`,
  `ADMIN_ORIGIN`), or it's refused with 403 before anything runs. Browsers
  always send `Origin` on these methods, and scripts can't forge it.
- **Content type:** login accepts `application/json` only, so a plain HTML
  form can't post to it (it would need a CORS preflight).
- **CORS:** only the listed origins get `Access-Control-Allow-Origin` (echoed
  exactly) plus `Allow-Credentials: true`. There's never a wildcard or a
  reflected arbitrary origin, and preflight from any other origin gets 403.

Assumption: every legitimate state-changing caller is a browser page on an
allowed origin. A future server-to-server route, such as a webhook, will need
an explicit per-route exception.

### Login throttling

Login throttling is stored in MongoDB (`auth_throttle`, TTL), so it holds
across serverless instances.
- **Per IP:** 20 attempts per 15 minutes, all attempts counted.
- **Per account:** 5 failed attempts per 15 minutes.
- Both limits are checked before any password work. Exceeding one returns 429
  with `Retry-After`.
- Throttle keys are keyed hashes (HMAC with `AUTH_SECRET`), so no IP address
  or email is stored.
- Client IP: on Vercel it comes from `x-real-ip`, which Vercel's edge sets.
  Locally it's the socket address. The app never reads forwarding headers
  itself.

Limitation: these are fixed windows, so up to twice the limit can land
around a window boundary.

### Audit log

`audit_logs` is append-only: there is no update or delete, in code or over
HTTP.
- **Recorded:** `auth.login.success`, `auth.login.failure`,
  `auth.login.rate_limited`, `auth.logout`, `auth.session.revoked` and
  `auth.owner.bootstrapped`; the team changes in "Team management" below.
- **Actor:** always comes from the server-resolved session.
- **Request facts:** each entry carries the request id, an HMAC of the IP
  (`ipHash`), and the user agent truncated to 256 characters.
- **Metadata:** sanitized. Keys naming credentials, and any `…Hash` key, are
  dropped; strings are redacted and bounded.
- **Failed logins:** recorded as `invalid_credentials` with a keyed account
  reference, never the email, so the trail can't reveal which emails exist.

Authentication events are written best-effort: a failed audit write is logged
loudly but doesn't lock everyone out.

### Owner bootstrap

There's no signup. The first OWNER of an organization is created once,
on purpose, from the command line (`src/scripts/bootstrap-owner.ts`). It
never runs on build or startup.

**1. Write `apps/api/.env.bootstrap` yourself.** It is git-ignored by the
root `.gitignore` rule `.env.*`. Never put the password in it.

```sh
BOOTSTRAP_OWNER_ENABLED=true
BOOTSTRAP_OWNER_EMAIL=owner@example.org
BOOTSTRAP_OWNER_NAME=Owner Name
BOOTSTRAP_TARGET_DB=<the application database, e.g. risingbeyondborders>
BOOTSTRAP_TARGET_ORG=<the organization, e.g. rbb>
BOOTSTRAP_ENSURE_INDEXES=true
```

**2. Check, then run, from the repo root:**

```sh
pnpm api:owner:setup -- --check   # read-only: prints the target and its state
pnpm api:owner:setup              # indexes (if asked), then the owner
```

`owner:setup` loads `apps/api/.env` (the database), then
`apps/api/.env.bootstrap`. It never loads `.env.local`, and first clears
any `MONGODB_*`, `ORGANIZATION_ID`, `NODE_ENV`, `BOOTSTRAP_OWNER_PASSWORD`
or `BOOTSTRAP_ALLOW_TEST_TARGET` your shell carries.

- **Opt-in:** without `BOOTSTRAP_OWNER_ENABLED=true` it refuses, as it
  does without `--confirm` (which the package script passes) or `--check`.
- **Target guard (`modules/auth/bootstrap-setup.ts`):** checked before
  connecting.
  - The resolved database and organization must equal
    `BOOTSTRAP_TARGET_DB` and `BOOTSTRAP_TARGET_ORG`.
  - It refuses a database ending in `_test`, `rbb_r2_smoke` and anything
    not on Atlas. Only the API's own tests may open a `*_test` database,
    with `BOOTSTRAP_ALLOW_TEST_TARGET=true`, which the real command clears.
- **Read-only preflight:** done immediately before any write.
  - It reports whether the database exists, its collections, the
    organization's owners, whether the email has an account (in any
    organization), and the indexes.
  - An existing owner or account stops it with nothing changed. It never
    resets an account.
- **Indexes:** with `BOOTSTRAP_ENSURE_INDEXES=true` it creates missing
  indexes first. This only ever adds; it never drops.
- **Password:**
  - It is typed at a hidden prompt, twice (12–256 characters).
  - With no terminal it is read from `BOOTSTRAP_OWNER_PASSWORD` and then
    removed from the process environment. Only the tests do this; the real
    command clears it, so it can only prompt.
  - It is hashed by `bootstrapOwner` (scrypt) and never printed, logged or
    passed as an argument.
- **Afterwards:** delete `apps/api/.env.bootstrap`, or set
  `BOOTSTRAP_OWNER_ENABLED=false`. A second run stops anyway, because an
  owner exists.

`pnpm api:auth:bootstrap -- --confirm` runs the same script from `dist`,
with only `.env.local` loaded, so it needs the same `BOOTSTRAP_*`
variables.

### Team management (M17.1)

After bootstrap, owners manage everyone else over `/api/v1/members`
(`modules/members/`). Everything is `users:read` / `users:write`, so OWNER
only, and the service checks again.
- **A member** is a user plus their membership of this organization; their
  id is the user id. Members are **never deleted** (audit entries refer to
  them): an owner deactivates them, which disables the membership and revokes
  every session at once, and can reactivate them later. Old sessions stay
  revoked.
- **New members have no password** (`passwordHash: null`). Login treats that
  exactly like a wrong password, so they can't sign in until they set one
  from a setup link (M17.2, below).
- **Not yourself:** nobody changes their own role or status, or revokes their
  own sessions, here, so an owner can't lock themselves out by accident.
- **Effective at once:** every request re-reads role and status, so a
  promotion, demotion or deactivation applies to open sessions on their very
  next request.
- **Revisions:** role and status changes quote the membership's `revision`;
  a stale one is a 409.
- **The last active owner is kept.** Role and status changes run one at a
  time per organization under a lease in `member_state` (`members/lock.ts`;
  works without a replica set). Inside it, the acting owner is re-read and
  must still be an active owner, and a change that removes an active owner
  is refused (409) unless another active owner remains. Two owners demoting
  each other at the same moment: one succeeds, the other is refused.
- **Audited:** `users.created`, `users.role_changed` (from, to),
  `users.deactivated` (sessions revoked), `users.reactivated`,
  `users.sessions_revoked` (count) and `users.change_refused` (reason
  `last_owner`) — by user id, never the email.

### Account setup and password change (M17.2)

- **Setup links** (`POST /api/v1/members/:id/setup-link`, owners): a
  256-bit random token (the session-token generator), returned **once**.
  Only its SHA-256 is stored (`setup_tokens`); the owner delivers the link
  by hand — there is no email. The admin builds it as
  `<admin origin>/setup-password#token=<token>`, so the token is in the
  fragment and never reaches a server log.
  - Valid for **72 hours**, **single use**, for an active member who has no
    password yet. Issuing a new link revokes the member's earlier open
    ones; deactivating the member revokes them too (they stay revoked after
    reactivation).
- **Setting the first password** (`POST /api/v1/auth/setup-password`, no
  session, CSRF-checked):
  - The password policy (12–256 characters) is checked first; a weak
    password does **not** spend the link.
  - Throttled with login's throttle: every attempt counts against the IP
    (20 per 15 minutes, shared with login), every refusal against the link
    (5 per 15 minutes).
  - Unknown, malformed, used, revoked, expired, or inactive-member links
    all get the same 400 message.
  - The password is hashed, then the link is consumed in **one atomic
    update** (`usedAt` set only if still unused, unrevoked and unexpired):
    of simultaneous uses, exactly one succeeds. The member then signs in
    as usual — setup does not create a session.
- **Changing your password** (`POST /api/v1/auth/password`, signed in):
  - Requires the current password. A wrong one counts against the account
    exactly like a failed login (same throttle: the 6th try in the window
    is 429, and login is locked too).
  - The new password must follow the policy and differ from the current
    one. It is written only over the hash that was verified, so of two
    simultaneous changes one wins and the other gets 409.
  - **Every** session of the account is revoked, and the caller gets a new
    session cookie (new token) with the **same absolute expiry** — a
    password change never extends a session.
- **Audited:** `users.setup_link_issued` (link id, expiry, links replaced),
  `auth.password_setup.completed`, `auth.password_setup.refused` (reason:
  used, revoked, expired, inactive, password_already_set — never for
  unknown tokens), `auth.password_setup.rate_limited`,
  `auth.password.changed` (other sessions revoked),
  `auth.password.change_failed` (`invalid_current`, lockedOut) and
  `auth.password.rate_limited`. Never a password, token or hash.

## Public forms (M18)

The website's Contact, Volunteer, Partner and Fundraise forms post to
`POST /api/v1/forms/:formId` (`modules/forms/`). The field schema and
validation are `@rbb/forms`, shared with the website. **Email only:**
nothing a visitor sends is stored, logged or audited.

- **Checks, in order.**
  1. Exact `Origin` = `WEB_ORIGIN`. The app's CSRF check already refuses
     a missing or unknown Origin; the admin's origin is refused here too.
  2. JSON, at most 16 KiB (415, 413, 400).
  3. Unknown form → 404.
  4. Not enabled (mode `off`, no recipient, Newsletter, Travel) → 503.
  5. Rate limit → 429 with Retry-After.
  6. Bots (honeypot filled, or under 1.5 s) get a normal 200 and nothing
     is sent.
  7. Shared validation: 400 for a malformed body, 422 with
     `{ path: "fields.<name>", message: "required" | "format" | "too-long" | "invalid" }`.
  8. Email. Delivered → 200 `{ reference }`. Otherwise 503, never a
     success.
- **Rate limit.** Fixed windows in the shared MongoDB throttle
  (`auth_throttle`), so every API instance counts into the same counter.
  The key is an HMAC of the organization and client address plus the
  form, never the IP itself. Every attempt on an enabled form counts,
  bots and invalid ones included, so nothing can flood the inbox or the
  audit trail.
- **Client address.** It comes from the platform, never from a header the
  client sets: `x-real-ip` on Vercel (`src/vercel.ts`, which Vercel's edge
  sets itself), or the socket address in the local server. **Deployment
  dependency:** another host needs its own trusted-IP adapter, or every
  visitor shares one limit.
- **Email modes** (`EMAIL_MODE`; see the Environment table).
  - `off`: no form is enabled. This is the default.
  - `test`: renders and sends nothing.
  - `staging`: sends only to `EMAIL_TEST_RECIPIENT`, with `[TEST]`
    subjects.
  - `live`: sends as addressed, only with a key and a From on a real
    domain.
  - Misconfiguration fails closed. A global problem turns every form off;
    a bad recipient turns that form off. Problems are logged by variable
    name only.
  - Notification goes to RBB's inbox with Reply-To set to the visitor's
    validated address. The optional acknowledgement (`EMAIL_ACK_FORMS`)
    never quotes the submission.
  - Templates escape everything a visitor typed. They are byte-identical to
    the website server's while both exist (`test/forms.test.ts`).
- **No real email in tests.** Under `NODE_ENV=test` the default transport
  refuses to send. Every test passes its own fake transport, or uses test
  mode.
- **Audit:** `forms.submission` with the form, outcome (`delivered`,
  `spam_discarded`, `invalid`, `rate_limited`, `provider_rejected`,
  `provider_unavailable`), reference, mode and request id. Unlike member
  actions, there's no IP hash and no user agent. Only the first
  rate-limited attempt of a window is recorded.
- **Locally:** run the API with `WEB_ORIGIN=http://localhost:5173`,
  `EMAIL_MODE=test` and `EMAIL_TO_<FORM>` set, then `pnpm web:dev`. The
  website's dev proxy sends `/api/v1` to the API (`WEB_API_PROXY`, default
  `http://localhost:4000`).
- **Production (planned, not deployed):**
  - the API at `https://api.risingbeyondborders.org`;
  - the website built with
    `VITE_FORM_ENDPOINT_<FORM>=https://api.risingbeyondborders.org/api/v1/forms/<form>`
    for the four forms;
  - `WEB_ORIGIN` set to the website's production origin.

  Real delivery also needs a verified Resend domain, an approved From
  address and RBB's approved recipients.

## Environment

The env template (`.env.example`) has placeholders only. Locally, use
`apps/api/.env.local` (git-ignored); in production, use Vercel's Environment
Variables.

| Variable | Required | Secret | |
|---|---|---|---|
| `NODE_ENV` | no (`development`) | no | `development` · `test` · `production` |
| `ORGANIZATION_ID` | production, and with the production database | no | The organization this deployment serves. Defaults to `rbb` outside production only; must be `rbb` with `MONGODB_DB=risingbeyondborders` |
| `MONGODB_URI` | production | **yes** | `mongodb://` or `mongodb+srv://` |
| `MONGODB_DB` | production, and with `MONGODB_URI` | no | Database name |
| `RBB_TARGET` | with the production database | no | `production` · `test` · `development`: what this configuration points at on purpose. Must be `production` with `MONGODB_DB=risingbeyondborders`, and only then (see "Production safety") |
| `WEB_ORIGIN`, `ADMIN_ORIGIN` | no | no | Exact origins allowed by CORS and the CSRF check. `https://` in production — RBB's admin is `https://admin.risingbeyondborders.org`, which must also be on the R2 bucket's CORS rule (docs/MEDIA_LIBRARY.md). Locally, `ADMIN_ORIGIN=http://localhost:5174` |
| `AUTH_SECRET` | production | **yes** | 32+ characters. Keys IP and throttle pseudonyms. Development without it uses a per-process secret (warned) |
| `AUTH_COOKIE_NAME` | no (`cms_session`) | no | |
| `AUTH_COOKIE_SAMESITE` | no (`strict`) | no | `strict` · `lax` · `none` (`none` only in production) |
| `AUTH_SESSION_TTL_HOURS` | no (168) | no | 1–720 |
| `GIVEBUTTER_API_KEY` | no | **yes** | Donation provider API key. Unset means the provider isn't configured (503) |
| `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_PUBLIC_URL` | all together, or none (media then 503) | no | Media storage. `R2_PUBLIC_URL` is the bucket's public https origin, never the S3 endpoint |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | with the above | **yes** | R2 API token key pair: needs Object Read & Write on `R2_BUCKET` |
| `R2_S3_API` | no | no | S3 endpoint; default `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com` (a `/<bucket>` path is ignored) |
| `DEPLOY_HOOK_URL` | no | **yes** | Build hook POSTed after a publish. Unset means no automatic rebuild |
| `CRON_SECRET` | no | **yes** | M15: 32+ characters. The bearer secret the scheduler route requires (Vercel Cron sends it). Unset means the scheduler is off (503): scheduled publications wait for an owner's publish |
| `EMAIL_MODE` | no (`off`) | no | M18 forms: `off` · `test` (render, send nothing) · `staging` (only `EMAIL_TEST_RECIPIENT`, `[TEST]` subjects) · `live` |
| `EMAIL_API_KEY` (alias `RESEND_API_KEY`) | staging/live | **yes** | Resend sending key for form email, restricted to the verified domain |
| `EMAIL_FROM` | staging/live | no | Approved From on the verified domain; a `resend.dev` sender is refused in live |
| `EMAIL_TO_CONTACT`, `_VOLUNTEER`, `_PARTNER`, `_FUNDRAISE` | per form | no | RBB's approved inbox for that form; unset or not one address = that form off |
| `EMAIL_ACK_FORMS` | no | no | Comma list of forms that email the submitter an acknowledgement |
| `EMAIL_TEST_RECIPIENT` | staging | no | The one inbox all staging email goes to |
| `FORMS_RATE_LIMIT_MAX`, `FORMS_RATE_LIMIT_WINDOW_S` | no (5, 600) | no | Submissions per client and form per window (shared MongoDB counter) |
| `LOG_LEVEL` | no (`info`) | no | |
| `PORT` | no (4000) | no | Local server only |
| `BOOTSTRAP_OWNER_EMAIL`, `BOOTSTRAP_OWNER_NAME`, `BOOTSTRAP_OWNER_PASSWORD` | bootstrap command only | password: **yes** | Never read by the API itself |
| `MONGODB_TEST_URI` | integration tests only | **yes** | A disposable MongoDB. Never read by the app |

**Production database user:** the API must connect as a dedicated MongoDB
user with **readWrite on the organization's database only** (for RBB,
`risingbeyondborders`). Never `atlasAdmin`. Keep admin users for maintenance.

## Production safety

Production is identified by the resources a configuration points at
(`src/config/target.ts`), never by `NODE_ENV` — a development server can
be connected to the production database:

| Target | When | What may use it |
|---|---|---|
| production | `MONGODB_DB=risingbeyondborders` | the API itself (deliberate CMS work) and maintenance commands given `--production=risingbeyondborders` |
| test | `MONGODB_DB` ends in `_test` | everything, including tests and smoke tests |
| unclassified | any other database | the API and maintenance commands; never tests or smoke tests |

- **On purpose only.** With the production database, the configuration
  must also say `RBB_TARGET=production` and `ORGANIZATION_ID=rbb`, or it is
  refused by name before anything connects. `RBB_TARGET=production` with
  any other database is refused too.
- **The production bucket** (`R2_BUCKET=rbb`) only with the production
  database, and the production database only with it. Test or development
  configuration that names the production bucket is refused.
- **Media keys** follow the target: the production database's new objects
  are filed under `rbb/media/…`, never `_development/…`, whatever
  `NODE_ENV` is. (One object uploaded before Phase 0 is under
  `_development/rbb/media/…`; it is left where it is.)
- **Maintenance commands** — `api:db:indexes`, `api:settings:import`,
  `api:media:cleanup` (even its report), `api:scheduler:run` — print their
  target and refuse production unless given the database's name, typed:
  `-- --production=risingbeyondborders`. A generic `--confirm` is not
  enough. `api:owner:setup` / `api:auth:bootstrap` keep their own stricter
  check (`BOOTSTRAP_TARGET_DB` / `_ORG` must name the target).
- **Tests and smoke tests never touch production, and there is no
  override:** the integration harness needs a `_test` database; the
  live R2 test refuses the production bucket (use a separate test
  bucket); `test/support/dev-server-fake-storage.ts` starts only on a
  `_test` database; and every browser smoke (`apps/admin/scripts/smoke-*`,
  `apps/web/scripts/smoke-forms.mjs`) first asks the API it is pointed at
  — `GET /api/v1/health/ready` reports the target's kind, never its name
  — and stops unless it is `test` (`test/support/smoke-target.mjs`).
- **Env files:** `pnpm api:dev` / `api:start` and the maintenance commands
  load `apps/api/.env.local`; `api:owner:setup` loads `.env` then
  `.env.bootstrap`; `api:test:r2` loads `.env` then `.env.local`. Whichever
  file names the production database must carry `RBB_TARGET=production`
  and `ORGANIZATION_ID=rbb`. For smoke tests, run the API on the test
  database (as `test/support/dev-server-fake-storage.ts` does), not on the
  production `.env.local`.

**Replacing a broad database user with least privilege** (in the Atlas UI,
by an Atlas project owner; nothing in this repository does it):
1. Database Access → Add New Database User: password authentication, a
   generated password, **Specific Privileges → `readWrite` on
   `risingbeyondborders`** only, restricted to this cluster. This covers
   everything the API and its commands do: reads, writes, index creation
   (`api:db:indexes`), and the CMS's publishing.
2. A second user with `readWrite` on `risingbeyondborders_test` only, for
   integration tests and smoke runs.
3. Put each user's connection string where it is used (`.env.local` and
   Vercel for the API; the test runner's `MONGODB_TEST_URI` for tests), and
   check `GET /api/v1/health/ready` answers `ok`.
4. Then remove the broad user from every application configuration, and
   delete it or keep it for people only (Atlas admin tasks, backups).
   `api:owner:setup` lists the cluster's databases before it writes, which
   `readWrite` cannot: run that one-time command with an admin user. Every
   other command and the API need nothing beyond `readWrite`.
5. Backups (Atlas snapshots) are a project setting, not a database role.

## MongoDB

- **Databases:** one Atlas cluster, two databases, each named once:

  | Database | Used by | Configured as |
  |---|---|---|
  | `risingbeyondborders` | the application (API, publishing, admin) | `MONGODB_URI` + `MONGODB_DB` |
  | `risingbeyondborders_test` | integration tests and the live R2 test, nothing else | `MONGODB_TEST_URI` + `MONGODB_TEST_DB` |

  Tests never read `MONGODB_URI` or `MONGODB_DB`, and never write to the
  application database (see "Tests").
- **Connection:** one client per process, reused by warm invocations (see
  `src/db/mongo.ts`).
- **Documents vs records:** documents get their own ObjectId `_id`; content
  ids and slugs are separate fields; timestamps are BSON Dates. Records are
  validated, contract-shaped and use ISO dates.
- **Indexes:** every index, and the reason for it, is in
  `src/db/collections.ts`. `pnpm api:db:indexes` creates missing ones only.
  It's idempotent, never drops anything, and refuses the production
  database without `-- --production=risingbeyondborders` (see "Production
  safety").
- **Seed data:** the app never seeds data and never creates users on its own.

## Local development

```sh
pnpm install
cp apps/api/.env.example apps/api/.env.local     # fill in; ADMIN_ORIGIN=http://localhost:5174
pnpm api:build && pnpm api:db:indexes
BOOTSTRAP_OWNER_EMAIL=… BOOTSTRAP_OWNER_NAME=… pnpm api:auth:bootstrap -- --confirm
pnpm api:dev                                     # http://localhost:4000
pnpm admin:dev                                   # http://localhost:5174 — proxies /api to the API
```

Use a local or test database for this, never production. (Deliberate CMS
work on production uses the same commands with a configuration that says
so — `RBB_TARGET=production` and `ORGANIZATION_ID=rbb`; see "Production
safety".)

## Tests

```sh
pnpm api:test                                    # unit tests, no database
MONGODB_TEST_URI=… MONGODB_TEST_DB=risingbeyondborders_test pnpm api:test:integration
ADMIN_SMOKE_EMAIL=… ADMIN_SMOKE_PASSWORD=… pnpm admin:smoke   # browser sign-in flow (needs API + admin running)

# Live R2 (needs the R2_* variables of a TEST bucket, MONGODB_TEST_URI and MONGODB_TEST_DB): uploads,
# verifies and deletes a few tiny objects under _test/live-<random>/. Refuses the production bucket.
MONGODB_TEST_URI=… MONGODB_TEST_DB=risingbeyondborders_test pnpm api:test:r2

# Media UI against a local, signature-checking fake R2 (no real bucket), on a _test database only:
MONGODB_URI=… MONGODB_DB=risingbeyondborders_test node apps/api/test/support/dev-server-fake-storage.ts   # instead of api:dev
ADMIN_SMOKE_EMAIL=… ADMIN_SMOKE_PASSWORD=… pnpm admin:smoke:media
```

Integration tests use **one dedicated test database**: `MONGODB_TEST_URI`
(the cluster) and `MONGODB_TEST_DB` (`risingbeyondborders_test`). Both are
required; nothing falls back to `MONGODB_URI` or `MONGODB_DB`
(`test/integration/mongo.ts`).
- **Never the application's database:** the name must end in `_test` and
  must not be `MONGODB_DB`. Before writing anything, each test file checks
  that the database holds **only** records of the reserved test
  organizations (`org-a`, `org-b`, `org-d`, `org-fresh`, `test-org`,
  `live-<hex>`), and refuses to run otherwise.
- **Cleanup:** each file deletes those organizations' records before it
  starts (leftovers of an interrupted run) and after it finishes. The
  database, its collections and indexes stay; it is never dropped or
  emptied wholesale. The one test that needs conflicting indexes (M2 → M7
  appeals) uses its own `itest_…` scratch collection and drops only that.
- **One run at a time:** every run uses the same test organizations, and
  login throttling counts per IP across organizations, so two runs at once
  against the same test database would disturb each other.
- On Atlas, keep the machine awake for a full run (`caffeinate -i` on
  macOS): a sleep mid-request can fail a test with a 500.

## Vercel

- **Project root:** `apps/api`.
- **Build:** `vercel.json` runs `pnpm run build`, which typechecks and then
  bundles into `dist/`. `mongodb` stays external.
- **Entry:** `api/index.js` serves every path through the rewrite.

The admin is a separate Vercel project, which needs two rewrites:
1. `/api/(.*)` → this API's deployment, which keeps the cookie first-party.
2. Every other path → `/index.html` (SPA).

These are unverified until the first deploy:
- the pnpm workspace install
- that rewrites keep the original `request.url`
- that `x-real-ip` reaches the function

## Not here yet

- Owner-driven password reset for a member who already has a password
- Email invitations, email password reset and email verification
- Media folders/tags, image resizing, documents (PDF), EXIF/GPS stripping
- Givebutter changes
- Newsletter and Travel forms (M18 keeps both off; Newsletter waits for
  approved consent wording, recipient and subscriber processing)
- Retiring `apps/web/server` (the old form endpoint) — a separate, reviewed
  change once nothing depends on it
